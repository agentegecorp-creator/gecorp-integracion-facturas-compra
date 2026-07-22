import crypto from 'node:crypto';
import fs from 'node:fs';

type ReviewCaseRow = {
  id: string;
  vendor_name: string | null;
  folio: string | null;
  document_type: string | null;
  issue_date: string | Date | null;
  reception_date: string | Date | null;
  amount_tax?: string | number | null;
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

export type NetSuiteTarget = 'sandbox' | 'production';

const LEGACY_SANDBOX_CONFIG_PATHS = [
  process.env.NETSUITE_SB_CONFIG_PATH,
  '/Users/agentegecorp/.openclaw/workspace/proyectos/sii-netsuite/sandbox_runner.real.json',
  '/Users/agentegecorp/.openclaw/workspace/proyectos/sii-netsuite/sandbox_runner.marzo.real.json',
].filter(Boolean) as string[];

const ENV_CONFIG_BY_TARGET: Record<NetSuiteTarget, Record<keyof NetSuiteConfig, string>> = {
  sandbox: {
    account: 'NETSUITE_SB_ACCOUNT',
    consumerKey: 'NETSUITE_SB_CONSUMER_KEY',
    consumerSecret: 'NETSUITE_SB_CONSUMER_SECRET',
    tokenId: 'NETSUITE_SB_TOKEN_ID',
    tokenSecret: 'NETSUITE_SB_TOKEN_SECRET',
    baseUrl: 'NETSUITE_SB_BASE_URL',
  },
  production: {
    account: 'NETSUITE_PROD_ACCOUNT',
    consumerKey: 'NETSUITE_PROD_CONSUMER_KEY',
    consumerSecret: 'NETSUITE_PROD_CONSUMER_SECRET',
    tokenId: 'NETSUITE_PROD_TOKEN_ID',
    tokenSecret: 'NETSUITE_PROD_TOKEN_SECRET',
    baseUrl: 'NETSUITE_PROD_BASE_URL',
  },
};

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
  '2026-04': 77,
  '2026-05': 78,
  '2026-06': 79,
  '2026-07': 81,
  '2026-08': 82,
  '2026-09': 83,
  '2026-10': 85,
  '2026-11': 86,
  '2026-12': 87,
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta variable de entorno ${name}`);
  return value;
}

export function hasNetSuiteSandboxConfig() {
  return hasNetSuiteConfig('sandbox');
}

export function hasNetSuiteProductionConfig() {
  return hasNetSuiteConfig('production');
}

export function hasNetSuiteConfig(target: NetSuiteTarget = 'sandbox') {
  const envConfig = ENV_CONFIG_BY_TARGET[target];
  const hasEnvConfig = Object.values(envConfig).every((name) => Boolean(process.env[name]?.trim()));

  return hasEnvConfig || (target === 'sandbox' && Boolean(findLegacySandboxConfigPath()));
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

function loadConfig(target: NetSuiteTarget = 'sandbox'): NetSuiteConfig {
  const legacyConfig = target === 'sandbox' ? loadLegacyConfig() : null;
  if (legacyConfig) return legacyConfig;

  const envConfig = ENV_CONFIG_BY_TARGET[target];
  return {
    account: requiredEnv(envConfig.account),
    consumerKey: requiredEnv(envConfig.consumerKey),
    consumerSecret: requiredEnv(envConfig.consumerSecret),
    tokenId: requiredEnv(envConfig.tokenId),
    tokenSecret: requiredEnv(envConfig.tokenSecret),
    baseUrl: requiredEnv(envConfig.baseUrl).replace(/\/$/, ''),
  };
}

function encode(value: string | number) {
  return encodeURIComponent(String(value))
    .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function oauthHeader(config: NetSuiteConfig, method: string, url: string) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const parsedUrl = new URL(url);
  const params: Record<string, string> = {
    oauth_consumer_key: config.consumerKey,
    oauth_token: config.tokenId,
    oauth_nonce: nonce,
    oauth_timestamp: timestamp,
    oauth_signature_method: 'HMAC-SHA256',
    oauth_version: '1.0',
  };
  parsedUrl.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  const normalized = Object.keys(params)
    .sort()
    .map((key) => `${encode(key)}=${encode(params[key])}`)
    .join('&');
  const baseUrl = `${parsedUrl.origin}${parsedUrl.pathname}`;
  const baseString = [method.toUpperCase(), encode(baseUrl), encode(normalized)].join('&');
  const signingKey = `${encode(config.consumerSecret)}&${encode(config.tokenSecret)}`;
  params.oauth_signature = crypto.createHmac('sha256', signingKey).update(baseString).digest('base64');
  parsedUrl.searchParams.forEach((_value, key) => {
    delete params[key];
  });
  return `OAuth ${Object.entries(params).map(([key, value]) => `${encode(key)}="${encode(value)}"`).join(', ')}, realm="${config.account}"`;
}

export async function requestNetSuite(
  method: string,
  path: string,
  payload?: Record<string, unknown>,
  options?: { prefer?: string; accept?: string },
  target: NetSuiteTarget = 'sandbox',
) {
  const config = loadConfig(target);
  const url = `${config.baseUrl}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: oauthHeader(config, method, url),
      Accept: options?.accept ?? 'application/json',
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

async function suiteql(query: string, target: NetSuiteTarget = 'sandbox') {
  const result = await requestNetSuite('POST', '/services/rest/query/v1/suiteql', { q: query }, { prefer: 'transient' }, target);
  if (!result.success) {
    throw new Error(`SuiteQL NetSuite ${target} falló HTTP ${result.status}: ${result.raw || JSON.stringify(result.body)}`);
  }
  const body = result.body as { items?: Record<string, unknown>[] };
  return body.items ?? [];
}

export async function createRecord(recordType: string, payload: Record<string, unknown>, target: NetSuiteTarget = 'sandbox') {
  const result = await requestNetSuite('POST', `/services/rest/record/v1/${recordType}`, payload, undefined, target);
  const body = result.body as Record<string, unknown>;
  const links = Array.isArray(body.links) ? body.links as Array<{ href?: string }> : [];
  const recordId = String(body.id ?? body.internalId ?? result.location ?? links.at(-1)?.href ?? '');
  return {
    ...result,
    recordId,
  };
}

export async function updateRecord(recordType: string, recordId: string, payload: Record<string, unknown>, target: NetSuiteTarget = 'sandbox') {
  return requestNetSuite('PATCH', `/services/rest/record/v1/${recordType}/${recordId}`, payload, undefined, target);
}

export async function replaceRecordTaxDetails(recordType: string, recordId: string, payload: Record<string, unknown>, target: NetSuiteTarget = 'sandbox') {
  return requestNetSuite('PATCH', `/services/rest/record/v1/${recordType}/${recordId}?replace=taxDetails`, payload, undefined, target);
}

async function verifyExemptVendorBillTaxIsZero(recordType: string, recordId: string, target: NetSuiteTarget = 'sandbox') {
  const result = await requestNetSuite('GET', `/services/rest/record/v1/${recordType}/${recordId}?expandSubResources=true`, undefined, undefined, target);
  if (!result.success) return { ...result, verified: false };

  const body = result.body as {
    taxDetailsOverride?: unknown;
    userTaxTotal?: unknown;
    taxDetails?: { items?: Array<{ taxAmount?: unknown; taxRate?: unknown }> };
  };
  const taxItems = Array.isArray(body.taxDetails?.items) ? body.taxDetails.items : [];
  const hasPositiveTaxLine = taxItems.some((item) => numberValue(item.taxAmount) !== 0 || numberValue(item.taxRate) !== 0);
  const verified = body.taxDetailsOverride === true && numberValue(body.userTaxTotal) === 0 && !hasPositiveTaxLine;
  return { ...result, verified };
}

async function verifyVendorBillTaxDetails(recordType: string, recordId: string, expectedTaxDetails: Record<string, unknown>, target: NetSuiteTarget = 'sandbox') {
  const result = await requestNetSuite('GET', `/services/rest/record/v1/${recordType}/${recordId}?expandSubResources=true`, undefined, undefined, target);
  if (!result.success) return { ...result, verified: false };

  const body = result.body as {
    taxDetailsOverride?: unknown;
    userTaxTotal?: unknown;
    taxDetails?: { items?: Array<{ taxAmount?: unknown; taxBasis?: unknown; taxRate?: unknown; netAmount?: unknown }> };
  };
  const expectedItems = ((expectedTaxDetails.taxDetails as { items?: Array<Record<string, unknown>> } | undefined)?.items ?? []);
  const actualItems = Array.isArray(body.taxDetails?.items) ? body.taxDetails.items : [];
  const expectedTotal = expectedItems.reduce((sum, item) => sum + numberValue(item.taxAmount), 0);
  const actualTotal = actualItems.reduce((sum, item) => sum + numberValue(item.taxAmount), 0);
  const expectedBasis = expectedItems.reduce((sum, item) => sum + numberValue(item.taxBasis ?? item.netAmount), 0);
  const actualBasis = actualItems.reduce((sum, item) => sum + numberValue(item.taxBasis ?? item.netAmount), 0);
  const verified =
    body.taxDetailsOverride === true &&
    actualItems.length >= expectedItems.length &&
    numberValue(body.userTaxTotal) === expectedTotal &&
    actualTotal === expectedTotal &&
    actualBasis === expectedBasis;

  return { ...result, verified };
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

function taxDetailItem(
  lineNumber: number,
  taxCodeId: number,
  taxTypeId: string,
  taxBasis: number,
  taxRate: number,
  taxAmount: number,
) {
  return {
    taxDetailsReference: `__RECORD_ID___${lineNumber}`,
    taxType: { id: taxTypeId },
    taxCode: { id: String(taxCodeId) },
    taxBasis,
    taxRate,
    taxAmount,
    netAmount: taxBasis,
  };
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
  const amountVat = numberValue(document.amountVat ?? row.amount_tax);
  const amountExempt = numberValue(document.amountExempt);
  const amountOtherTax = numberValue(document.amountOtherTax);
  const nonTaxedAmount = documentType === '33'
    ? amountExempt + amountOtherTax
    : 0;
  const hasTaxOverride = documentType === '34' || nonTaxedAmount > 0;
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
  if (hasTaxOverride) {
    header.taxDetailsOverride = true;
    header.userTaxTotal = documentType === '33' ? amountVat : 0;
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
  } else if (hasTaxOverride) {
    line.taxCode = { id: String(TAX_CODE[documentType]) };
    line.taxRate = documentType === '33' ? 19 : 0;
    line.taxAmount = documentType === '33' ? amountVat : 0;
  }

  const expenseItems = [line];
  if (documentType === '33' && nonTaxedAmount > 0) {
    const nonTaxedMemoSuffix = amountOtherTax > 0 && amountExempt === 0
      ? 'IMP. ESP. DIESEL / OTRO IMPUESTO'
      : 'EXENTO/NO GRAVADO';
    const nonTaxedLine: Record<string, unknown> = {
      account: { id: accountId },
      amount: nonTaxedAmount,
      memo: `${memo} ${nonTaxedMemoSuffix}`.slice(0, 300),
      location: { id: locationId },
      taxCode: { id: String(TAX_CODE['34']) },
      taxRate: 0,
      taxAmount: 0,
    };
    if (classId) nonTaxedLine.class = { id: classId };
    if (departmentId) nonTaxedLine.department = { id: departmentId };
    expenseItems.push(nonTaxedLine);
  }

  const taxDetailsItems = [];
  if (documentType === '34') {
    taxDetailsItems.push(taxDetailItem(1, TAX_CODE['34'], '6', lineAmount, 0, 0));
  } else if (documentType === '33' && hasTaxOverride) {
    if (lineAmount > 0) {
      taxDetailsItems.push(taxDetailItem(1, TAX_CODE['33'], '2', lineAmount, 19, amountVat));
    }
    if (nonTaxedAmount > 0) {
      taxDetailsItems.push(taxDetailItem(expenseItems.length, TAX_CODE['34'], '6', nonTaxedAmount, 0, 0));
    }
  }
  const taxDetailsOverride = taxDetailsItems.length > 0 ? { taxDetails: { items: taxDetailsItems } } : null;

  header.expense = { items: expenseItems };
  return { recordType, payload: header, tranId: folio, entityId, documentType, taxDetailsOverride, zeroTaxDetails: taxDetailsOverride };
}

export async function enforceTaxDetailsForOverriddenDocument(
  recordType: string,
  recordId: string,
  taxDetailsOverride: Record<string, unknown> | null,
  target: NetSuiteTarget = 'sandbox',
) {
  if (!taxDetailsOverride || recordType !== 'vendorbill') return null;
  const payload = JSON.parse(JSON.stringify(taxDetailsOverride).replace(/__RECORD_ID__/g, recordId)) as Record<string, unknown>;
  const replaceResult = await replaceRecordTaxDetails(recordType, recordId, payload, target);
  if (replaceResult.success) return replaceResult;

  const taxDetailsVerification = await verifyVendorBillTaxDetails(recordType, recordId, payload, target);
  if (taxDetailsVerification.verified) {
    return {
      ...replaceResult,
      success: true,
      status: taxDetailsVerification.status,
      body: {
        fallback: 'verified_tax_details_after_replace_failure',
        replaceResult: replaceResult.body,
        verification: taxDetailsVerification.body,
      },
      raw: JSON.stringify({
        fallback: 'verified_tax_details_after_replace_failure',
        replaceStatus: replaceResult.status,
      }),
    };
  }

  const verification = await verifyExemptVendorBillTaxIsZero(recordType, recordId, target);
  if (!verification.verified) return replaceResult;

  return {
    ...replaceResult,
    success: true,
    status: verification.status,
    body: {
      fallback: 'verified_zero_tax_after_replace_failure',
      replaceResult: replaceResult.body,
      verification: verification.body,
    },
    raw: JSON.stringify({
      fallback: 'verified_zero_tax_after_replace_failure',
      replaceStatus: replaceResult.status,
    }),
  };
}

export const enforceZeroTaxDetailsForExemptDocument = enforceTaxDetailsForOverriddenDocument;

export async function findExistingTransaction(tranId: string, entityId: string, target: NetSuiteTarget = 'sandbox') {
  const safeTranId = tranId.replace(/'/g, "''");
  const safeEntityId = entityId.replace(/[^0-9]/g, '');
  const rows = await suiteql(`
    SELECT t.id, t.tranId, t.type, t.entity, t.total, t.foreignTotal
    FROM transaction t
    WHERE t.type IN ('VendBill','VendCred')
      AND t.tranId = '${safeTranId}'
      AND t.entity = ${safeEntityId}
  `, target);
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id ?? ''),
    tranId: String(row.tranid ?? row.tranId ?? tranId),
    type: String(row.type ?? ''),
    entityId: String(row.entity ?? entityId),
    total: String(row.total ?? ''),
    foreignTotal: String(row.foreigntotal ?? row.foreignTotal ?? ''),
  };
}

export function normalizeRecordId(recordId: string) {
  return recordId.startsWith('http') ? recordIdFromLocation(recordId) : recordId;
}
