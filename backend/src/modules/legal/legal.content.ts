/**
 * Documentos legais servidos pela API e versionados para registro de consentimento (LGPD).
 *
 * ⚠️ TEMPLATE — revise com assessoria jurídica antes de operar comercialmente.
 * Ao alterar o texto, ATUALIZE a `version` para forçar novo aceite dos usuários.
 */
import type { ConsentDocument } from '@prisma/client';

export interface LegalDocument {
  document: ConsentDocument;
  title: string;
  version: string; // data da versão (ISO) — usada como prova de qual texto foi aceito
  effectiveDate: string;
  content: string; // markdown
}

const TERMS_OF_USE: LegalDocument = {
  document: 'TERMS_OF_USE',
  title: 'Termos de Uso',
  version: '2026-06-17',
  effectiveDate: '2026-06-17',
  content: `# Termos de Uso — CondoHub

## 1. Objeto
O CondoHub é uma plataforma de gestão condominial (SaaS) que disponibiliza
funcionalidades como cadastro de moradores, reservas de áreas comuns, chamados,
controle de visitantes e encomendas, cobranças, assembleias e comunicação.

## 2. Cadastro e acesso
O acesso é vinculado a um condomínio (tenant). O usuário é responsável pela
veracidade dos dados informados e pela guarda de suas credenciais.

## 3. Uso aceitável
É vedado utilizar a plataforma para fins ilícitos, violar direitos de terceiros
ou tentar comprometer a segurança e o isolamento entre condomínios.

## 4. Papéis e permissões
As funcionalidades disponíveis dependem do papel do usuário (síndico, morador,
porteiro), conforme regras de acesso da plataforma.

## 5. Cobranças
Cobranças do condomínio ao morador são processadas por gateway de pagamento
terceiro. O CondoHub não armazena dados de cartão.

## 6. Limitação de responsabilidade
A plataforma é fornecida "como está". Empregamos esforços razoáveis de
disponibilidade e segurança, sem garantia de operação ininterrupta.

## 7. Alterações
Estes termos podem ser atualizados. Mudanças relevantes exigirão novo aceite.

## 8. Contato
Dúvidas: suporte@condohub.com.br`,
};

const PRIVACY_POLICY: LegalDocument = {
  document: 'PRIVACY_POLICY',
  title: 'Política de Privacidade',
  version: '2026-06-17',
  effectiveDate: '2026-06-17',
  content: `# Política de Privacidade — CondoHub (LGPD)

## 1. Controlador e operador
O condomínio contratante é o **controlador** dos dados dos seus moradores; o
CondoHub atua como **operador**, tratando dados conforme instruções do controlador.

## 2. Dados tratados
Dados cadastrais (nome, CPF, e-mail, telefone, unidade), foto (quando enviada),
registros de visitantes e encomendas, reservas, chamados, cobranças e votos em
assembleia, além de dados técnicos (logs de acesso, IP, user agent).

## 3. Finalidades e base legal
Tratamos os dados para execução da gestão condominial e cumprimento de obrigações
legais/contratuais (art. 7º, II, V e art. 7º, X da LGPD) e, quando aplicável,
mediante **consentimento** (art. 7º, I).

## 4. Compartilhamento
Compartilhamos dados apenas com operadores necessários à prestação do serviço
(ex.: gateway de pagamento, provedor de e-mail, hospedagem), sob obrigação contratual.

## 5. Retenção
Dados são mantidos enquanto durar o vínculo com o condomínio e pelos prazos legais
aplicáveis (ex.: registros financeiros). Após, são eliminados ou anonimizados.

## 6. Direitos do titular
O titular pode confirmar o tratamento, acessar, corrigir, **exportar** e solicitar a
**eliminação/anonimização** dos seus dados. A plataforma oferece exportação
(\`/api/privacy/me/export\`) e anonimização (\`/api/privacy/me/erasure\`), ressalvados
os dados de retenção obrigatória.

## 7. Segurança
Adotamos isolamento por condomínio (multi-tenant), criptografia de senha (argon2id),
tokens de sessão com rotação e controle de acesso por papel.

## 8. Encarregado (DPO) e contato
Encarregado de dados: privacidade@condohub.com.br`,
};

export const LEGAL_DOCUMENTS: Record<ConsentDocument, LegalDocument> = {
  TERMS_OF_USE,
  PRIVACY_POLICY,
};

/** Versão corrente de cada documento (para registrar/validar consentimento). */
export const CURRENT_VERSIONS = {
  TERMS_OF_USE: TERMS_OF_USE.version,
  PRIVACY_POLICY: PRIVACY_POLICY.version,
} as const;
