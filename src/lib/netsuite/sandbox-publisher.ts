import crypto from 'node:crypto';
import fs from 'node:fs';

type ReviewCaseRow = {
  id: string;
  vendor_name: string | null;
  folio: string | null;
  document_type: string | null;
  issue_date: string | Date | null;
  reception_date: string | Date | null;
  amount_total: string | number | null;
  payload_json?: {
    document?: Record<string, unknown>;
    context?: Record<string, unknown>;
  } | null;
};

type NetSuiteConfig = {
  account: string;
  consumerKey: string;
  consumerSecret: string;
  tokenId: string;
  tokenSecret: string;
  baseUrl: string;
};

const LEGACY_SANDBOX_CONFIG_PATHS = [
  process.env.NETSUITE_SB_CONFIG_PATH,
  '/Users/agentegecorp/.openclaw/workspace/proyectos/sii-netsuite/sandbox_runner.real.json',
  '/Users/agentegecorp/.openclaw/workspace/proyectos/sii-netsuite/sandbox_runner.marzo.real.json',
].filter(Boolean) as string[];

const DOCUMENT_TYPE_NS: Record<string, number> = {
  '33': 2,
  '34': 104,
  '61': 107,
};

const TAX_CODE: Record<string, number> = {
  '33': 6,
  '34': 9,
  '61': 6,
};

const POSTING_PERIOD_2026: Record<string, number> = {
  '2026-01': 73,
  '2026-02': 74,
  '2026-03': 75,
  '2026-04': 76,
  '2026-05': 77,
  '2026-06': 78,
  '2026-07': 79,
  '2026-08': 80,
  '2026-09': 81,
  '2026-10': 82,
  '2026-11': 83,
  '2026-12': 84,
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta variable de entorno ${name}`);
  return value;
}

export function hasNetSuiteSandboxConfig() {
  const hasEnvConfig = [
    'NETSUITE_SB_ACCOUNT',
    'NETSUITE_SB_CONSUMER_KEY',
    'NETSUITE_SB_CONSUMER_SECRET',
    'NETSUITE_SB_TOKEN_ID',
    'NETSUITE_SB_TOKEN_SECRET',
    'NETSUITE_SB_BASE_URL',
  ].every((name) => Boolean(process.env[name]?.trim()));

  return hasEnvConfig || Boolean(findLegacySandboxConfigPath());
}

function findLegacySandboxConfigPath() {
  return LEGACY_SANDBOX_CONFIG_PATHS.find((configPath) => fs.existsSync(configPath));
}

function loadLegacyConfig(): NetSuiteConfig | null {
  const configPath = findLegacySandboxConfigPath();
  if (!configPath) return null;

  const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
    netsuite?: {
      account?: string;
      consumer_key?: string;
      consumer_secret?: string;
      token_id?: string;
      token_secret?: string;
      base_url?: string;
    };
  };
  const netsuite = parsed.netsuite ?? {};
  const required = [
    netsuite.account,
    netsuite.consumer_key,
    netsuite.consumer_secret,
    netsuite.token_id,
    netsuite.token_secret,
    netsuite.base_url,
  ];
  if (required.some((value) => !String(value ?? '').trim())) return null;

  return {
    account: String(netsuite.account),
    consumerKey: String(netsuite.consumer_key),
    consumerSecret: String(netsuite.consumer_secret),
    tokenId: String(netsuite.token_id),
    tokenSecret: String(netsuite.token_secret),
    baseUrl: String(netsuite.base_url).replace(/\/$/, ''),
  };
}

function loadConfig(): NetSuiteConfig {
  const legacyConfig = loadLegacyConfig();
  if (legacyConfig) return legacyConfig;

  return {
    account: requiredEnv('NETSUITE_SB_ACCOUNT'),
    consumerKey: requiredEnv('NETSUITE_SB_CONSUMER_KEY'),
    consumerSecret: requiredEnv('NETSUITE_SB_CONSUMER_SECRET'),
    tokenId: requiredEnv('NETSUITE_SB_TOKEN_ID'),
    tokenSecret: requiredEnv('NETSUITE_SB_TOKEN_SECRET'),
    baseUrl: requiredEnv('NETSUITE_SB_BASE_URL').replace(/\/$/, ''),
  };
}

function encode(value: string | number) {
  return encodeURIComponent(String(value))
    .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function oauthHeader(config: NetSuiteConfig, method: string, url: string) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params: Record<string, string> = {
    oauth_consumer_key: config.consumerKey,
    oauth_token: config.tokenId,
    oauth_nonce: nonce,
    oauth_timestamp: timestamp,
    oauth_signature_method: 'HMAC-SHA256',
    oauth_version: '1.0',
  };
  const normalized = Object.keys(params)
    .sort()
    .map((key) => `${encode(key)}=${encode(params[key])}`)
    .join('&');
  const baseString = [method.toUpperCase(), encode(url), encode(normalized)].join('&');
  const signingKey = `${encode(config.consumerSecret)}&${encode(config.tokenSecret)}`;
  params.oauth_signature = crypto.createHmac('sha256', signingKey).update(baseString).digest('base64');
  return `OAuth ${Object.entries(params).map(([key, value]) => `${encode(key)}="${encode(value)}"`).join(', ')}, realm="${config.account}"`;
}

async function requestNetSuite(
  method: string,
  path: string,
  payload?: Record<string, unknown>,
  options?: { prefer?: string },
) {
  const config = loadConfig();
  const url = `${config.baseUrl}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: oauthHeader(config, method, url),
      Accept: 'application/json',
      ...(payload
        ? {
            'Content-Type': 'application/json',
            Prefer: options?.prefer ?? 'return=representation',
          }
        : {}),
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const raw = await response.text();
  const body = raw.trim().startsWith('{') ? JSON.parse(raw) : raw ? { message: raw } : {};
  return {
    success: response.ok,
    status: response.status,
    body,
    raw,
    location: response.headers.get('location'),
  };
}

async function suiteql(query: string) {
  const result = await requestNetSuite('POST', '/services/rest/query/v1/suiteql', { q: query }, { prefer: 'transient' });
  if (!result.success) {
    throw new Error(`SuiteQL Sandbox falló HTTP ${result.status}: ${result.raw || JSON.stringify(result.body)}`);
  }
  const body = result.body as { items?: Record<string, unknown>[] };
  return body.items ?? [];
}

export async function createRecord(recordType: string, payload: Record<string, unknown>) {
  const result = await requestNetSuite('POST', `/services/rest/record/v1/${recordType}`, payload);
  const body = result.body as Record<string, unknown>;
  const links = Array.isArray(body.links) ? body.links as Array<{ href?: string }> : [];
  const recordId = String(body.id ?? body.internalId ?? result.location ?? links.at(-1)?.href ?? '');
  return {
    ...result,
    recordId,
  };
}

function isoDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function numericId(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return String(Math.trunc(parsed));
  }
  return null;
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function postingPeriodId(date: string) {
  return POSTING_PERIOD_2026[date.slice(0, 7)] ?? null;
}

function recordIdFromLocation(value: string) {
  const match = value.match(/\/([^/?]+)(?:\?.*)?$/);
  return match?.[1] ?? value;
}

export function buildSandboxPayload(row: ReviewCaseRow) {
  const payload = row.payload_json ?? {};
  const document = payload.document ?? {};
  const context = payload.context ?? {};
  const documentType = String(document.documentType ?? row.document_type ?? '').trim();
  const recordType = documentType === '61' ? 'vendorcredit' : 'vendorbill';
  const tranDate = isoDate(context.accountingDateProposed ?? document.accountingDateProposed ?? document.issueDate ?? row.issue_date);
  const dueDate = isoDate(document.dueDate ?? context.dueDate ?? tranDate);
  const entityId = numericId(context.vendorIdProposed, context.entity, document.vendorId, document.entityId);
  const accountId = numericId(document.accountId, context.accountIdProposed, context.referenciaAccount);
  const locationId = numericId(document.locationId, context.locationIdProposed) ?? '5';
  const classId = numericId(document.classId, context.classIdProposed);
  const departmentId = numericId(document.departmentId, context.departmentIdProposed);
  const requesterId = numericId(context.requesterIdProposed, document.requesterId);
  const postingPeriod = tranDate ? postingPeriodId(tranDate) : null;
  const folio = String(row.folio ?? document.folio ?? '').trim();

  if (!folio) throw new Error('Caso sin folio');
  if (!entityId) throw new Error('Caso sin proveedor NetSuite');
  if (!accountId) throw new Error('Caso sin cuenta contable NetSuite');
  if (!tranDate) throw new Error('Caso sin fecha contable');
  if (!postingPeriod) throw new Error(`Sin período contable configurado para ${tranDate.slice(0, 7)}`);

  const memo = String(document.invoiceDetail ?? document.serviceDescription ?? `RCV F-${folio} ${row.vendor_name ?? ''}`).slice(0, 300);
  const nsDocumentType = numericId(context.documentTypeNsProposed, document.documentTypeNs, DOCUMENT_TYPE_NS[documentType]);
  const lineAmount = documentType === '34'
    ? numberValue(document.amountExempt) || numberValue(row.amount_total)
    : numberValue(document.amountNet) || numberValue(row.amount_total);

  const header: Record<string, unknown> = {
    entity: { id: entityId },
    tranId: folio,
    tranDate,
    dueDate: dueDate ?? tranDate,
    postingPeriod: { id: String(postingPeriod) },
    subsidiary: { id: '2' },
    currency: { id: '1' },
    customForm: { id: documentType === '61' ? '129' : '114' },
    approvalStatus: { id: '1' },
    custbody_gd_tipo_documento: { id: nsDocumentType ?? DOCUMENT_TYPE_NS[documentType] ?? 103 },
    custbody_gecorp_tipo_de_compra: { id: '1' },
    memo,
  };

  if (requesterId) header.custbody_gecorp_solicitante = { id: requesterId };
  if (locationId) header.location = { id: locationId };
  if (classId) header.class = { id: classId };
  if (departmentId) header.department = { id: departmentId };
  if (String(document.paymentDateRule ?? context.paymentDateRule ?? '').toLowerCase().includes('tef')) {
    header.custbody_9997_is_for_ep_eft = true;
  }
  if (documentType === '34') {
    header.taxDetailsOverride = true;
    header.userTaxTotal = 0;
  }

  const line: Record<string, unknown> = {
    account: { id: accountId },
    amount: lineAmount,
    memo,
    location: { id: locationId },
  };
  if (classId) line.class = { id: classId };
  if (departmentId) line.department = { id: departmentId };
  if (documentType === '34') {
    line.taxCode = { id: String(TAX_CODE[documentType]) };
    line.taxRate = 0;
    line.taxAmount = 0;
  }

  header.expense = { items: [line] };
  return { recordType, payload: header, tranId: folio, entityId };
}

export async function findExistingTransaction(tranId: string, entityId: string) {
  const safeTranId = tranId.replace(/'/g, "''");
  const safeEntityId = entityId.replace(/[^0-9]/g, '');
  const rows = await suiteql(`
    SELECT t.id, t.tranId, t.type, t.entity
    FROM transaction t
    WHERE t.type IN ('VendBill','VendCred')
      AND t.tranId = '${safeTranId}'
      AND t.entity = ${safeEntityId}
  `);
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id ?? ''),
    tranId: String(row.tranid ?? row.tranId ?? tranId),
    type: String(row.type ?? ''),
  };
}

export function normalizeRecordId(recordId: string) {
  return recordId.startsWith('http') ? recordIdFromLocation(recordId) : recordId;
}
