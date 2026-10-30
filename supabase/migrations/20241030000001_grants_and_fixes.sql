-- Grants and small fixes for MoneyFlow
-- Safe to run after the init migration.

-- Allow authenticated users to call the transfer function
GRANT EXECUTE ON FUNCTION public.create_transfer(UUID, UUID, UUID, NUMERIC, TEXT, DATE, TEXT) TO authenticated;

-- Ensure profiles can be read/updated by owner (already have policy; reinforce SELECT)
-- (no-op if policy exists — run only if needed)

-- Helpful view: account balances should match ledger (optional reconciliation helper)
CREATE OR REPLACE FUNCTION public.recompute_account_balance(p_account_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_opening NUMERIC;
  v_user UUID;
  v_balance NUMERIC;
BEGIN
  SELECT opening_balance, user_id INTO v_opening, v_user
  FROM public.accounts WHERE id = p_account_id;

  IF v_user IS NULL OR v_user <> auth.uid() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT COALESCE(v_opening, 0) + COALESCE(
    SUM(
      CASE
        WHEN type IN ('income', 'refund') THEN amount
        WHEN type IN ('expense', 'debt_payment') THEN -amount
        WHEN type = 'transfer' AND account_id = p_account_id AND to_account_id IS NOT NULL THEN -amount
        WHEN type = 'transfer' AND account_id = p_account_id THEN amount
        ELSE 0
      END
    ),
    0
  )
  INTO v_balance
  FROM public.transactions
  WHERE user_id = v_user
    AND deleted_at IS NULL
    AND (
      account_id = p_account_id
      OR to_account_id = p_account_id
    );

  -- For transfers the paired model stores two rows both with type transfer:
  -- outgoing: account_id = from, to_account_id = to, amount positive
  -- incoming: account_id = to, to_account_id = from, amount positive
  -- Simpler recompute from single-sided effect:
  SELECT COALESCE(v_opening, 0) + COALESCE((
    SELECT SUM(
      CASE
        WHEN t.type IN ('income', 'refund') AND t.account_id = p_account_id THEN t.amount
        WHEN t.type IN ('expense', 'debt_payment') AND t.account_id = p_account_id THEN -t.amount
        WHEN t.type = 'transfer' AND t.account_id = p_account_id THEN -t.amount
        ELSE 0
      END
    )
    FROM public.transactions t
    WHERE t.user_id = v_user AND t.deleted_at IS NULL AND t.account_id = p_account_id
  ), 0)
  INTO v_balance;

  UPDATE public.accounts SET current_balance = v_balance WHERE id = p_account_id;
  RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.recompute_account_balance(UUID) TO authenticated;
