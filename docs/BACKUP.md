# Backup e Restauração (Postgres)

Procedimento de backup automático e recuperação de desastre (DR) do CondoHub.

## Backup automático

O serviço `db-backup` (em `docker-compose.yml`) roda `pg_dump` em loop e mantém
retenção configurável:

- **Formato:** custom (`-Fc`, comprimido, restaurável seletivamente).
- **Destino:** `./backups/condohub-<timestamp>.dump` (volume no host).
- **Periodicidade:** `BACKUP_INTERVAL` (padrão `86400`s = 24h).
- **Retenção:** `BACKUP_RETENTION_DAYS` (padrão `7` dias).

Subir junto com a stack:

```bash
docker compose up -d db-backup
docker compose logs -f db-backup   # acompanhar
```

> Produção: aponte o volume `./backups` para um disco/objeto fora do host
> (ex.: bucket S3 sincronizado) para sobreviver à perda da máquina.

## Backup manual

```bash
PGHOST=localhost PGPORT=5544 PGUSER=condohub PGPASSWORD=condohub \
PGDATABASE=condohub BACKUP_DIR=./backups sh scripts/db-backup.sh
```

Ou direto no container:

```bash
docker exec condohub-db-1 pg_dump -Fc -U condohub -d condohub -f /tmp/condohub.dump
docker cp condohub-db-1:/tmp/condohub.dump ./backups/
```

## Restauração (DR)

⚠️ **Destrutivo:** o banco alvo é derrubado e recriado.

```bash
PGHOST=localhost PGPORT=5544 PGUSER=condohub PGPASSWORD=condohub \
sh scripts/db-restore.sh ./backups/condohub-<timestamp>.dump condohub
```

Após restaurar, rode as migrações pendentes (se o dump for mais antigo que o schema):

```bash
cd backend && npm run prisma:deploy
```

## Teste de restauração (recomendado periodicamente)

Restaure num banco descartável e compare contagens com a produção — um backup
só vale se a restauração for comprovada:

```bash
sh scripts/db-restore.sh ./backups/condohub-<timestamp>.dump condohub_restore_test
```
