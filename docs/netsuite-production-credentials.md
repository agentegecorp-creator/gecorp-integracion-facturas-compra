# Credenciales NetSuite Produccion

No pegar valores secretos en chats ni commits. Cargar estas variables en `.env.local` para pruebas locales y en Vercel para ejecucion web:

```bash
NETSUITE_PROD_ACCOUNT=
NETSUITE_PROD_CONSUMER_KEY=
NETSUITE_PROD_CONSUMER_SECRET=
NETSUITE_PROD_TOKEN_ID=
NETSUITE_PROD_TOKEN_SECRET=
NETSUITE_PROD_BASE_URL=
```

Validacion local solo lectura:

```bash
npx tsx scripts/preflight-netsuite-production.ts
```

Preflight solo lectura contra documentos listos para Produccion:

```bash
npx tsx scripts/preflight-netsuite-production.ts --duplicates --limit 5
```

El preflight no crea ni modifica registros en NetSuite.
