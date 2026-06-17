import PDFDocument from 'pdfkit';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/utils/errors';
import type { ItemResult } from './assemblies.service';

const dt = (d: Date | null) =>
  d ? d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : '—';
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

const RULE_LABEL: Record<string, string> = {
  SIMPLE_MAJORITY: 'Maioria simples',
  ABSOLUTE_MAJORITY: 'Maioria absoluta (fração ideal)',
  TWO_THIRDS: 'Dois terços (2/3)',
  UNANIMITY: 'Unanimidade',
};
const TYPE_LABEL: Record<string, string> = { ORDINARIA: 'Ordinária (AGO)', EXTRAORDINARIA: 'Extraordinária (AGE)' };
const MODE_LABEL: Record<string, string> = { PRESENCIAL: 'Presencial', VIRTUAL: 'Virtual', HIBRIDA: 'Híbrida' };

/** Gera a ata da assembleia em PDF (Buffer). Exige assembleia encerrada. */
export async function buildMinutesPdf(assemblyId: string, condoName: string): Promise<Buffer> {
  const assembly = await prisma.assembly.findFirst({
    where: { id: assemblyId },
    include: {
      items: { include: { options: true }, orderBy: { order: 'asc' } },
      attendances: {
        include: { apartment: { select: { number: true } }, resident: { select: { fullName: true } } },
        orderBy: { checkedInAt: 'asc' },
      },
    },
  });
  if (!assembly) throw AppError.notFound('Assembleia não encontrada');
  if (assembly.status !== 'CLOSED') throw AppError.business('A ata só pode ser gerada após o encerramento da assembleia');

  const totalWeight = assembly.attendances.reduce((s, a) => s + Number(a.weight), 0);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Cabeçalho
    doc.fontSize(16).font('Helvetica-Bold').text(condoName, { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(13).text('ATA DE ASSEMBLEIA', { align: 'center' });
    doc.moveDown(0.8);

    doc.fontSize(10).font('Helvetica');
    doc.font('Helvetica-Bold').text(assembly.title);
    doc.font('Helvetica');
    doc.text(`Tipo: ${TYPE_LABEL[assembly.type] ?? assembly.type}   ·   Modalidade: ${MODE_LABEL[assembly.mode] ?? assembly.mode}`);
    doc.text(`Convocada para: ${dt(assembly.scheduledFor)}`);
    doc.text(`Aberta em: ${dt(assembly.openedAt)}   ·   Encerrada em: ${dt(assembly.closedAt)}`);
    if (assembly.meetingUrl) doc.text(`Local/Link: ${assembly.meetingUrl}`);
    doc.moveDown(0.6);

    // Quórum / presença
    doc.font('Helvetica-Bold').text('1. Presença e Quórum');
    doc.font('Helvetica');
    doc.text(
      `Unidades presentes: ${assembly.attendances.length}   ·   Peso presente (fração ideal): ${totalWeight.toFixed(6)}`,
    );
    doc.moveDown(0.3);
    for (const a of assembly.attendances) {
      doc.fontSize(9).text(`• Unidade ${a.apartment.number}${a.resident ? ` — ${a.resident.fullName}` : ''} (${dt(a.checkedInAt)})`);
    }
    doc.fontSize(10).moveDown(0.6);

    // Edital
    doc.font('Helvetica-Bold').text('2. Edital de Convocação');
    doc.font('Helvetica').fontSize(9).text(assembly.notice, { align: 'justify' });
    doc.fontSize(10).moveDown(0.6);

    // Deliberações
    doc.font('Helvetica-Bold').text('3. Ordem do Dia e Deliberações');
    doc.font('Helvetica').moveDown(0.2);

    assembly.items.forEach((item, idx) => {
      const r = (item.resultJson as unknown as ItemResult) ?? null;
      doc.font('Helvetica-Bold').fontSize(10).text(`3.${idx + 1}. ${item.title}`);
      doc.font('Helvetica').fontSize(9);
      if (item.description) doc.text(item.description, { align: 'justify' });
      doc.text(`Regra de deliberação: ${RULE_LABEL[item.quorumRule] ?? item.quorumRule}`);

      if (!r) {
        doc.text('Resultado: não apurado.');
      } else if (item.options.length > 0 && r.options) {
        for (const o of r.options) doc.text(`   - ${o.label}: ${o.weight.toFixed(6)} (${pct(r.totalWeight ? o.weight / r.totalWeight : 0)})`);
        const winner = r.options.find((o) => o.optionId === r.winnerOptionId);
        doc.font('Helvetica-Bold').text(`   Eleito: ${winner ? winner.label : '— (empate/sem votos)'}`);
        doc.font('Helvetica');
      } else {
        doc.text(`   SIM: ${r.yes.toFixed(6)}   ·   NÃO: ${r.no.toFixed(6)}   ·   ABSTENÇÕES: ${r.abstain.toFixed(6)}`);
        doc.font('Helvetica-Bold').text(`   Resultado: ${r.approved ? 'APROVADO' : 'REPROVADO'}`);
        doc.font('Helvetica');
      }
      doc.moveDown(0.5);
    });

    doc.moveDown(1);
    doc.fontSize(8).fillColor('#666').text(
      `Ata gerada eletronicamente em ${dt(new Date())} — CondoHub. Documento em conformidade com a Lei 14.309/2022.`,
      { align: 'center' },
    );

    doc.end();
  });
}
