/**
 * Smoke test do gateway Asaas contra o SANDBOX (validação E2E manual do P0.2).
 *
 * Pré-requisitos no .env:
 *   PAYMENT_PROVIDER=asaas
 *   ASAAS_API_KEY=<sua chave de sandbox>
 *   ASAAS_BASE_URL=https://sandbox.asaas.com/api/v3   (padrão)
 *
 * Uso:  npm run asaas:smoke
 *
 * Exercita: criação de cliente + cobrança PIX + recuperação do QR + consulta de status.
 * Não cria nada no nosso banco — fala apenas com o Asaas.
 */
import { env } from '@/config/env';
import { asaasGateway } from '@/lib/gateway/asaas.gateway';

/* eslint-disable no-console */
async function main() {
  if (env.PAYMENT_PROVIDER !== 'asaas' || !env.ASAAS_API_KEY) {
    console.error('✗ Configure PAYMENT_PROVIDER=asaas e ASAAS_API_KEY (sandbox) no .env antes de rodar.');
    process.exit(1);
  }
  console.log(`→ Base URL: ${env.ASAAS_BASE_URL}`);

  const input = {
    externalReference: `smoke-${Date.now()}`,
    amount: 5.0,
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    description: 'CondoHub — smoke test (sandbox)',
    customer: { name: 'Cliente Sandbox', cpf: '11144477735', email: 'sandbox@condohub.test' },
  };

  console.log('→ Criando cobrança PIX...');
  const pix = await asaasGateway.createPixCharge(input);
  console.log(`  gatewayChargeId: ${pix.gatewayChargeId}`);
  console.log(`  status: ${pix.status}`);
  console.log(`  pixPayload: ${pix.pixPayload ? pix.pixPayload.slice(0, 40) + '…' : '(não recuperado)'}`);
  console.log(`  qrCode: ${pix.pixQrCodeUrl ? 'OK (data URL)' : '(ausente)'}`);

  console.log('→ Consultando status (getCharge)...');
  const status = await asaasGateway.getCharge(pix.gatewayChargeId);
  console.log(`  status atual: ${status.status}`);

  console.log('\n✓ Smoke test concluído. Cobrança criada no sandbox do Asaas.');
  console.log('  Dica: pague o PIX no painel de sandbox e confirme o webhook PAYMENT_RECEIVED → POST /api/charges/webhook');
}

main().catch((err) => {
  console.error('✗ Smoke test falhou:', err);
  process.exit(1);
});
