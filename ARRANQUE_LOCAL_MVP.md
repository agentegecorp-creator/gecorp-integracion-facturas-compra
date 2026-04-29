# Arranque local MVP — Integración Facturas Compra

## Fecha
- 2026-04-27

## Objetivo
Dejar los pasos exactos para instalar, inicializar y probar localmente el MVP web.

---

## 1. Entrar al proyecto

```bash
cd /Users/agentegecorp/.openclaw/workspace/proyectos/sii-netsuite/gecorp-integracion-facturas-compra
```

---

## 2. Instalar dependencias

```bash
npm install
```

---

## 3. Preparar variables de entorno

Crear `.env.local` a partir de `.env.example`.

Ejemplo:

```bash
cp .env.example .env.local
```

Contenido mínimo esperado en `.env.local`:

```env
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DBNAME
SESSION_COOKIE_NAME=facturascompra_session
SESSION_TTL_HOURS=12
APP_BASE_URL=http://localhost:3000
SEED_DEFAULT_PASSWORD=CAMBIAR_ESTA_CLAVE
```

---

## 4. Inicializar base de datos

Aplicar el esquema inicial:

```bash
psql "$DATABASE_URL" -f /Users/agentegecorp/.openclaw/workspace/proyectos/sii-netsuite/SQL_INICIAL_MVP_FACTURAS_COMPRA.sql
```

---

## 5. Cargar usuarios iniciales

```bash
npx tsx scripts/seed-users.ts
```

Usuarios cargados:
- gonzalo@gecorp.cl
- monica@gecorp.cl
- leon@gecorp.cl
- patricio@gecorp.cl

Todos quedan con la clave definida en `SEED_DEFAULT_PASSWORD`.

---

## 6. Levantar la app

```bash
npm run dev
```

URL local esperada:
- `http://localhost:3000/login`

---

## 7. Prueba end-to-end mínima

### Login
1. abrir `/login`
2. ingresar email de usuario semilla
3. ingresar clave semilla
4. validar redirección a `/dashboard`

### Protección de sesión
1. abrir `/dashboard` sin cookie
2. validar redirección a `/login`

### Cola
1. abrir `/pendiente-revision`
2. validar que responde aunque no haya casos

### Caso individual
1. abrir `/caso/<uuid>`
2. validar que carga detalle o responde “Caso no encontrado”

### Logout
1. presionar `Cerrar sesión`
2. validar vuelta a estado no autenticado

---

## 8. Carga útil oficial de `review_cases`

La ruta oficial para poblar y actualizar `review_cases` es:

```bash
npx tsx scripts/sync-review-cases-from-pipeline.ts
```

Ese script debe reemplazar el uso manual separado de importadores parciales.

### Importante
Estos scripts quedan como legado/transición y ya no son la ruta recomendada:
- `scripts/import-review-cases-from-dashboard.ts`
- `scripts/reconcile-imported-review-cases.ts`
- `scripts/enrich-review-cases-from-pipeline-artifacts.ts`
- `scripts/hydrate-review-cases-from-enriched-csv.ts`

## 9. Próxima prueba real

Después del sync oficial, validar:
- que aparezcan casos reales en `/pendiente-revision`
- que ya no dominen los casos seed abiertos
- que se vean proveedor, monto, fechas y contexto mejorado

---

## 10. Problemas esperables en primera corrida

### Si falla login
Revisar:
- `DATABASE_URL`
- schema aplicado
- usuarios sembrados
- dependencia `bcryptjs` instalada

### Si falla seed
Revisar:
- `SEED_DEFAULT_PASSWORD`
- tabla `users` existente
- acceso real a Postgres

### Si falla navegación protegida
Revisar:
- cookie de sesión
- middleware
- dominio/puerto local

---

## 11. Recomendación práctica

La primera meta no es belleza visual.
La primera meta es lograr este ciclo completo:
- levantar app
- hacer login
- proteger rutas
- leer DB

Cuando eso esté estable, seguimos con:
- review_cases reales
- decisiones
- auditoría
- mejor UX
