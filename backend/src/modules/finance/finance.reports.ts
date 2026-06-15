import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import type { ReportData } from './finance.service';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const date = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });

/** Gera o relatório financeiro em PDF (Buffer). */
export function buildReportPdf(data: ReportData, condoName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text(condoName, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(13).text(`Relatório financeiro — ${data.period}`, { align: 'center' });
    doc.moveDown(1);

    const section = (title: string, rows: ReportData['revenues']) => {
      doc.fontSize(12).fillColor('#111').text(title, { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(10);
      if (!rows.length) {
        doc.fillColor('#666').text('Sem lançamentos.').fillColor('#111');
      }
      for (const r of rows) {
        doc.text(`${date(r.date)}  ·  ${r.description}${r.category ? ` (${r.category})` : ''}`, { continued: true });
        doc.text(`  ${brl(r.amount)}`, { align: 'right' });
      }
      doc.moveDown(0.8);
    };

    section('Receitas', data.revenues);
    section('Despesas', data.expenses);

    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#111');
    doc.text(`Total de receitas: ${brl(data.totalRevenue)}`);
    doc.text(`Total de despesas: ${brl(data.totalExpense)}`);
    doc.fontSize(12).fillColor(data.balance >= 0 ? '#15803d' : '#b91c1c');
    doc.text(`Saldo: ${brl(data.balance)}`);

    doc.end();
  });
}

/** Gera o relatório financeiro em Excel (Buffer). */
export async function buildReportXlsx(data: ReportData, condoName: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CondoHub';

  const addSheet = (name: string, rows: ReportData['revenues']) => {
    const ws = wb.addWorksheet(name);
    ws.columns = [
      { header: 'Data', key: 'date', width: 14 },
      { header: 'Descrição', key: 'description', width: 40 },
      { header: 'Categoria', key: 'category', width: 22 },
      { header: 'Valor (R$)', key: 'amount', width: 16 },
    ];
    ws.getRow(1).font = { bold: true };
    for (const r of rows) {
      ws.addRow({ date: date(r.date), description: r.description, category: r.category ?? '-', amount: r.amount });
    }
    ws.getColumn('amount').numFmt = '#,##0.00';
  };

  const summary = wb.addWorksheet('Resumo');
  summary.addRow([condoName]);
  summary.addRow([`Relatório financeiro — ${data.period}`]);
  summary.addRow([]);
  summary.addRow(['Total de receitas', data.totalRevenue]);
  summary.addRow(['Total de despesas', data.totalExpense]);
  summary.addRow(['Saldo', data.balance]);
  summary.getColumn(2).numFmt = '#,##0.00';

  addSheet('Receitas', data.revenues);
  addSheet('Despesas', data.expenses);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
