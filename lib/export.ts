export function download(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const esc = (v: string | number | null | undefined) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** UTF-8 BOM so Excel opens it correctly. */
export const toCSV = (rows: (string | number | null | undefined)[][]) => '\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
export async function toPDF(title: string, subtitle: string, sections: { heading: string; head: string[]; body: (string | number)[][] }[], file: string) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF();
  doc.setFontSize(16); doc.text(title, 14, 16); doc.setFontSize(9); doc.text(subtitle, 14, 22);
  let y = 28;
  for (const s of sections) {
    doc.setFontSize(11); doc.text(s.heading, 14, y + 4);
    autoTable(doc, { startY: y + 7, head: [s.head], body: s.body.map((r) => r.map(String)), styles: { fontSize: 8 }, headStyles: { fillColor: [4, 120, 87] } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 10;
    if (y > 270) { doc.addPage(); y = 16; }
  }
  doc.save(file);
}
