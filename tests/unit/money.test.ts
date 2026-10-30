import { add, subtract, multiply, divide, percentOf, money, sum, compare } from '../../src/lib/money';

describe('money utils', () => {
  test('add avoids float errors', () => {
    expect(add('0.1', '0.2')).toBe('0.30');
    expect(add('10.50', '0.25')).toBe('10.75');
  });

  test('subtract', () => {
    expect(subtract('100.00', '40.50')).toBe('59.50');
  });

  test('multiply', () => {
    expect(multiply('12.50', 2)).toBe('25.00');
  });

  test('divide', () => {
    expect(divide('100.00', 4)).toBe('25.00');
  });

  test('percentOf', () => {
    expect(percentOf('25', '100')).toBe(25);
    expect(percentOf('0', '0')).toBe(0);
  });

  test('sum', () => {
    expect(sum(['10.10', '20.20', '0.05'])).toBe('30.35');
  });

  test('compare', () => {
    expect(compare('10', '9.99')).toBe(1);
    expect(compare('5', '5.00')).toBe(0);
  });

  test('money normalizes', () => {
    expect(money('1.999')).toBe('2.00');
    expect(money(1.5)).toBe('1.50');
  });
});
