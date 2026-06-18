/**
 * Gera o PDF de apresentação comercial do CondoHub (escopo + MVP) para síndicos.
 * Uso:  npm run pitch:pdf   → gera docs/CondoHub-Apresentacao.pdf
 */
import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';

// Paleta
const PRIMARY = '#2563EB';
const DARK = '#0F172A';
const MUTED = '#64748B';
const LIGHT = '#EEF2FF';
const LINE = '#E2E8F0';

const OUT = path.resolve(__dirname, '../../docs/CondoHub-Apresentacao.pdf');

const doc = new PDFDocument({ size: 'A4', margin: 56, bufferPages: true });
doc.pipe(fs.createWriteStream(OUT));

const PAGE_W = doc.page.width;
const M = doc.page.margins.left;
const CONTENT_W = PAGE_W - M * 2;

// ---------- helpers ----------
function ensureSpace(needed: number) {
  if (doc.y + needed > doc.page.height - 70) doc.addPage();
}

function sectionTitle(text: string) {
  ensureSpace(60);
  doc.moveDown(0.6);
  const y = doc.y;
  doc.rect(M, y, 4, 18).fill(PRIMARY);
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(15).text(text, M + 12, y - 1);
  doc.moveDown(0.6);
  doc.fillColor(DARK);
}

function paragraph(text: string) {
  doc.font('Helvetica').fontSize(10.5).fillColor('#334155').text(text, M, doc.y, { width: CONTENT_W, lineGap: 2 });
  doc.moveDown(0.5);
}

function bullet(text: string, bold?: string) {
  ensureSpace(20);
  doc.fontSize(10.5).fillColor('#334155');
  doc.font('Helvetica').text('•  ', M, doc.y, { continued: true, width: CONTENT_W, lineGap: 1.5 });
  if (bold) doc.font('Helvetica-Bold').fillColor(DARK).text(`${bold} `, { continued: true });
  doc.font('Helvetica').fillColor('#334155').text(text);
  doc.moveDown(0.35);
}

function groupTitle(text: string) {
  ensureSpace(28);
  doc.moveDown(0.2);
  doc.font('Helvetica-Bold').fontSize(11.5).fillColor(PRIMARY).text(text, M, doc.y);
  doc.moveDown(0.25);
}

// ============================================================
// CAPA
// ============================================================
doc.rect(0, 0, PAGE_W, 230).fill(PRIMARY);
doc.circle(M + 6, 70, 7).fill('#FFFFFF');
doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(14).text('CondoHub', M + 22, 63);

doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(34).text('CondoHub', M, 120);
doc.font('Helvetica').fontSize(14).fillColor('#DBEAFE').text('Gestão de condomínios — simples, completa e transparente', M, 165, { width: CONTENT_W });

doc.fillColor(DARK).font('Helvetica-Bold').fontSize(13).text('Apresentação do Produto & MVP', M, 280);
doc.font('Helvetica').fontSize(11).fillColor(MUTED).text('Material para síndicos e administradoras de condomínios', M, 300);

// Caixa de destaque
const boxY = 350;
doc.roundedRect(M, boxY, CONTENT_W, 120, 8).fill(LIGHT);
doc.fillColor(DARK).font('Helvetica-Bold').fontSize(12).text('Tudo o que o condomínio precisa em um só lugar', M + 18, boxY + 18, { width: CONTENT_W - 36 });
doc.font('Helvetica').fontSize(10.5).fillColor('#334155').text(
  'Cobranças por PIX e boleto, reservas de áreas comuns, chamados, portaria com QR Code, '
  + 'assembleias digitais com votação, comunicação com os moradores e muito mais — '
  + 'acessível pelo navegador, em qualquer dispositivo.',
  M + 18, boxY + 40, { width: CONTENT_W - 36, lineGap: 2 },
);

const today = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
doc.fillColor(MUTED).font('Helvetica').fontSize(9.5).text(`Documento gerado em ${today}`, M, 760);

// ============================================================
// SUMÁRIO EXECUTIVO
// ============================================================
doc.addPage();
sectionTitle('O que é o CondoHub');
paragraph(
  'O CondoHub é uma plataforma online de gestão para condomínios pequenos e médios. '
  + 'Centraliza a operação do dia a dia do síndico e melhora a experiência do morador, '
  + 'substituindo planilhas, grupos de mensagens e papelada por um sistema único, '
  + 'organizado e seguro.',
);

sectionTitle('O problema que resolvemos');
bullet('controle financeiro em planilhas, com cobranças manuais e alta inadimplência.', 'Desorganização:');
bullet('avisos e decisões perdidos em grupos de WhatsApp.', 'Comunicação ruidosa:');
bullet('reservas e chamados sem registro, gerando conflitos.', 'Falta de histórico:');
bullet('moradores sem visibilidade sobre cobranças e contas do condomínio.', 'Pouca transparência:');
bullet('assembleias presenciais com baixo quórum e atas manuais.', 'Burocracia:');

sectionTitle('A solução');
paragraph(
  'Uma única plataforma, acessível pelo navegador, que cada papel usa conforme sua necessidade: '
  + 'o síndico administra, o morador acompanha e participa, e a portaria registra visitantes e encomendas. '
  + 'Dados isolados por condomínio, com segurança e conformidade com a LGPD.',
);

groupTitle('Para quem é');
bullet('Síndico — administra cobranças, finanças, reservas, chamados, assembleias e comunicação.', 'Síndico:');
bullet('Morador — vê cobranças (PIX), faz reservas, abre chamados, vota em assembleias e dá sugestões.', 'Morador:');
bullet('Porteiro — valida visitantes por QR Code e registra encomendas.', 'Porteiro:');

// ============================================================
// MÓDULOS DO MVP
// ============================================================
doc.addPage();
sectionTitle('Módulos do MVP');
paragraph('O MVP já entrega os módulos essenciais para operar um condomínio de ponta a ponta:');

groupTitle('Financeiro');
bullet('geração de cobranças por PIX e boleto, individuais ou em lote mensal (uma por unidade).', 'Cobranças:');
bullet('QR Code e código copia-e-cola para o morador pagar pelo celular.', 'PIX:');
bullet('acompanhamento de status (pendente, pago, vencido) e inadimplência.', 'Controle:');
bullet('registro de despesas e receitas, fluxo de caixa e relatórios.', 'Finanças:');

groupTitle('Convivência');
bullet('reserva de áreas comuns (salão, churrasqueira, quadra…) com aprovação e regras de uso.', 'Reservas:');
bullet('abertura e acompanhamento de chamados de manutenção.', 'Chamados:');
bullet('mural de avisos e notificações para os moradores.', 'Comunicação:');
bullet('mural de sugestões de melhoria com votação dos moradores.', 'Sugestões:');

groupTitle('Segurança e portaria');
bullet('cadastro de visitantes pelo morador e validação na portaria por QR Code.', 'Visitantes:');
bullet('registro e baixa de encomendas, com aviso ao morador.', 'Encomendas:');

groupTitle('Governança');
bullet(
  'convocação, votação online com peso por fração ideal, apuração de quórum e ata gerada '
  + 'automaticamente — em conformidade com a Lei 14.309/2022.',
  'Assembleias digitais:',
);

groupTitle('Visão geral');
bullet('painel com os principais indicadores do condomínio para o síndico.', 'Dashboard:');

// ============================================================
// DIFERENCIAIS + SEGURANÇA
// ============================================================
doc.addPage();
sectionTitle('Diferenciais');
bullet('cobrança por PIX nativa, do envio à baixa do pagamento.', 'Pagamento descomplicado:');
bullet('voto ponderado por fração ideal e ata automática — algo raro no mercado.', 'Assembleia digital de verdade:');
bullet('o morador enxerga suas cobranças e o que acontece no condomínio.', 'Transparência:');
bullet('funciona no navegador do computador e do celular, sem instalar nada.', 'Acesso em qualquer lugar:');

sectionTitle('Segurança e conformidade');
bullet('consentimento registrado, exportação e exclusão de dados do titular.', 'LGPD:');
bullet('cada condomínio enxerga apenas os próprios dados (isolamento total).', 'Privacidade por design:');
bullet('senhas criptografadas e sessões protegidas com expiração e renovação.', 'Acesso seguro:');
bullet('backups automáticos do banco de dados, com restauração testada.', 'Continuidade:');

sectionTitle('Como funciona');
paragraph(
  'O condomínio recebe seu ambiente próprio. O síndico cadastra blocos, unidades e convida os '
  + 'moradores e a portaria por e-mail. A partir daí, cada um acessa a plataforma pelo navegador, '
  + 'com as permissões do seu papel. Não há instalação nem servidor por conta do condomínio.',
);

// ============================================================
// STATUS DO MVP + ROADMAP + CONTATO
// ============================================================
doc.addPage();
sectionTitle('Status do MVP');
paragraph('Plataforma funcional e testada, pronta para operação assistida (early access) com os primeiros condomínios.');
bullet('Disponível agora: cobranças, finanças, reservas, chamados, avisos, sugestões, visitantes, encomendas, assembleias e dashboard.', '');
bullet('Em evolução: pagamentos em produção com a operadora, app mobile dedicado, conciliação bancária e relatórios avançados.', '');

sectionTitle('Próximos passos no roadmap');
bullet('integração de pagamento em produção (PIX/boleto com a operadora).');
bullet('aplicativo mobile para o morador.');
bullet('conciliação bancária automática e régua de inadimplência.');
bullet('marketplace de serviços para o condomínio.');

sectionTitle('Vamos conversar');
doc.roundedRect(M, doc.y, CONTENT_W, 88, 8).fill(LIGHT);
const cy = doc.y;
doc.fillColor(DARK).font('Helvetica-Bold').fontSize(12).text('Quer levar o CondoHub para o seu condomínio?', M + 18, cy + 16, { width: CONTENT_W - 36 });
doc.font('Helvetica').fontSize(10.5).fillColor('#334155').text(
  'Agende uma demonstração sem compromisso. Mostramos a plataforma funcionando com dados de exemplo '
  + 'e desenhamos a implantação para a realidade do seu condomínio.',
  M + 18, cy + 38, { width: CONTENT_W - 36, lineGap: 2 },
);
doc.moveDown(2);
doc.fillColor(DARK).font('Helvetica-Bold').fontSize(10.5).text('Contato:', M, doc.y, { continued: true });
doc.font('Helvetica').fillColor('#334155').text('  contato@condohub.com.br  ·  (00) 00000-0000');

// ============================================================
// RODAPÉ (numeração) — pula a capa
// ============================================================
const range = doc.bufferedPageRange();
for (let i = 1; i < range.count; i++) {
  doc.switchToPage(i);
  doc.page.margins.bottom = 0; // escrever no rodapé sem disparar nova página
  const yFoot = doc.page.height - 42;
  doc.lineWidth(0.5).strokeColor(LINE).moveTo(M, yFoot).lineTo(PAGE_W - M, yFoot).stroke();
  doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
  doc.text('CondoHub — Apresentação do Produto', M, yFoot + 8, { width: CONTENT_W / 2, align: 'left', lineBreak: false });
  doc.text(`Página ${i + 1} de ${range.count}`, M + CONTENT_W / 2, yFoot + 8, { width: CONTENT_W / 2, align: 'right', lineBreak: false });
}

doc.end();
/* eslint-disable no-console */
console.log(`✓ PDF gerado: ${OUT}`);
