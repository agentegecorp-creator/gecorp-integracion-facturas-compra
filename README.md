# Gecorp Integración Facturas Compra

MVP web operativo para `facturascompra.gecorp.cl`, enfocado en la cola de revisión SII → NetSuite.

## Estado actual
La app ya dejó de ser solo scaffold:
- login operativo
- dashboard operativo
- cola de revisión web
- decisiones y auditoría
- mezcla de casos seed + casos reales importados desde artefactos del pipeline

## Ruta oficial de sincronización de casos reales
El script oficial para poblar y actualizar `review_cases` es:

```bash
npx tsx scripts/sync-review-cases-from-pipeline.ts
```

Ese flujo unificado concentra en una sola pasada:
- importación desde salida real utilizable del pipeline
- idempotencia por `source_document_id`
- enriquecimiento de proveedor real
- hidratación de fechas, recepción, montos y contexto operacional
- reducción del peso de seed/demo en la cola activa

## Scripts legacy / transición
Los siguientes scripts quedan como referencia histórica de cómo se armó el flujo, pero ya no deben usarse como ruta principal:
- `scripts/import-review-cases-from-dashboard.ts`
- `scripts/reconcile-imported-review-cases.ts`
- `scripts/enrich-review-cases-from-pipeline-artifacts.ts`
- `scripts/hydrate-review-cases-from-enriched-csv.ts`

## Variables mínimas
- `DATABASE_URL`
- `SESSION_COOKIE_NAME`
- `SESSION_TTL_HOURS`
- `APP_BASE_URL`
- `SEED_DEFAULT_PASSWORD`

## Próximo foco
- seguir reduciendo seed/demo
- exponer mejor más contexto real en la mesa de revisión
- consolidar aún más la operación real desde pipeline hacia app web

