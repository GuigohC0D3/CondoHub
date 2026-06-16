import crypto from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@/config/env';

/**
 * Storage de arquivos via S3 (ou compatível: R2/MinIO).
 * Padrão de upload: o backend gera uma presigned URL (PUT), o cliente envia o
 * arquivo direto ao bucket, e então registra a metadata (fileUrl) no recurso.
 * Buckets devem ser privados; a URL pública é servida via CDN/URL assinada.
 */

const isConfigured = Boolean(env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);

const client = isConfigured
  ? new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      },
    })
  : null;

export function storageEnabled(): boolean {
  return isConfigured;
}

/** Monta a chave do objeto isolada por tenant: <condominiumId>/<scope>/<uuid>-<nome>. */
export function buildObjectKey(condominiumId: string, scope: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
  return `${condominiumId}/${scope}/${crypto.randomUUID()}-${safe}`;
}

export function publicUrlFor(key: string): string {
  if (env.S3_PUBLIC_URL) return `${env.S3_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  if (env.S3_ENDPOINT) return `${env.S3_ENDPOINT.replace(/\/$/, '')}/${env.S3_BUCKET}/${key}`;
  return `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${key}`;
}

export interface PresignResult {
  uploadUrl: string; // PUT aqui
  publicUrl: string; // referência a salvar no recurso
  key: string;
  expiresIn: number;
}

export async function presignUpload(params: {
  condominiumId: string;
  scope: string;
  fileName: string;
  mimeType: string;
  expiresIn?: number;
}): Promise<PresignResult> {
  if (!client) throw new Error('Storage S3 não configurado');
  const key = buildObjectKey(params.condominiumId, params.scope, params.fileName);
  const expiresIn = params.expiresIn ?? 300;

  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, ContentType: params.mimeType }),
    { expiresIn },
  );

  return { uploadUrl, publicUrl: publicUrlFor(key), key, expiresIn };
}

/** Upload direto de um buffer (server-side). Retorna a URL pública. */
export async function putObject(params: {
  condominiumId: string;
  scope: string;
  fileName: string;
  contentType: string;
  body: Buffer;
}): Promise<string> {
  if (!client) throw new Error('Storage S3 não configurado');
  const key = buildObjectKey(params.condominiumId, params.scope, params.fileName);
  await client.send(
    new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: params.body, ContentType: params.contentType }),
  );
  return publicUrlFor(key);
}
