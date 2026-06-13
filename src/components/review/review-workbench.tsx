'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ReviewDecisionForm } from '@/components/review/review-decision-form';
import { estadoLabel, etapaLabel, fieldLabel } from '@/lib/review/labels';
import { approvalGroupValueFromIds } from '@/lib/review/catalogs';

type ReviewItem = {
  id: string;
  vendor_name: string | null;
  vendor_rut: string | null;
  folio: string | null;
  bucket: string;
  status: string;
  amount_total: string | null;
  document_type?: string | null;
  issue_date?: string | Date | null;
  summary_text?: string | null;
  sandbox_publish_status?: string | null;
  sandbox_record_id?: string | null;
  sandbox_record_type?: string | null;
};

type ReviewCaseDetail = ReviewItem & {
  reception_date?: string | null;
  payload_json?: {
    document?: {
      documentType?: string;
      documentTypeLabel?: string;
      dueDate?: string;
      dueDateRule?: string;
      paymentDate?: string;
      paymentDateRule?: string;
      paymentTermsId?: string | number;
      paymentTermsLabel?: string;
      accountingDateProposed?: string;
      accountId?: string | number;
      classId?: string | number;
      departmentId?: string | number;
      locationId?: string | number;
      purchaseOrderReference?: string;
      amountNet?: number | string;
      amountVat?: number | string;
      amountVatNonRecoverable?: number | string;
      amountExempt?: number | string;
      amountOtherTax?: number | string;
      amountTotal?: number | string;
      amountTotalCalculated?: number | string;
      amountTotalDelta?: number | string;
      amountReconciliationStatus?: string;
      serviceDescription?: string;
      summary?: string;
      memo?: string;
      description?: string;
      invoiceNote?: string;
      invoiceDetail?: string;
    };
    context?: {
      entity?: string | number;
      referenciaAccount?: string | number;
      categoriaOc?: string;
      learningCategory?: string;
      motivo?: string;
      rut?: string;
      razonSocial?: string;
      error?: string;
      terminosNs?: string;
      accountCorrecta?: string;
      classCorrecta?: string;
      departmentCorrecta?: string;
      locationCorrecta?: string;
      pagoPorTef?: string;
      trabajaConOc?: string;
      comentariosGonzalo?: string;
      matchConfianza?: string;
      ocPolicyCorrecta?: string;
      requiereRevisionManual?: string;
      referenciaOcCorrelacion?: string;
      assignedTo?: string;
      engineNote?: string;
      ocCategory?: string;
      reviewStatus?: string;
      vendorIdProposed?: string | number;
      accountIdProposed?: string | number;
      accountSuggestedB2?: string | number;
      classSuggestedB2?: string;
      departmentSuggestedB2?: string;
      locationSuggestedB2?: string;
      ocPolicySuggestedB2?: string;
      sourceSuggestedB2?: string;
      approvalGroup?: string;
      approverGroup?: string;
      approverIdsProposed?: number[];
      approverSource?: string;
      expenseCategory?: string;
      postingStatus?: string;
      nsId?: string | number;
      sourceRun?: string;
      automaticCreationMode?: string;
      confidenceLevel?: string;
      classIdProposed?: string | number;
      departmentIdProposed?: string | number;
      locationIdProposed?: string | number;
      paymentTermsLabel?: string;
      paymentTermsId?: string | number;
      accountingDateProposed?: string;
      dueDate?: string;
      paymentDate?: string;
      paymentDateRule?: string;
      invoiceNote?: string;
      invoiceDetail?: string;
      accountingDimensionRule?: string;
    };
  } | null;
};

function bucketLabel(bucket: string) {
  return etapaLabel(bucket);
}

function bucketChipClass(bucket: string) {
  const styles: Record<string, string> = {
    pending_review: 'bg-slate-100 text-slate-700 ring-slate-200',
    revision_oc: 'bg-amber-50 text-amber-700 ring-amber-200',
    error_real: 'bg-rose-50 text-rose-700 ring-rose-200',
    rejected_sii: 'bg-blue-50 text-blue-700 ring-blue-200',
    approved_auto: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  };

  return styles[bucket] || 'bg-slate-100 text-slate-700 ring-slate-200';
}

function formatCurrency(value: string | number | null | undefined) {
  if (!value) return '-';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;

  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return '-';
  const raw = value instanceof Date ? value.toISOString() : String(value);
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly) {
    return `${dateOnly[3]}-${dateOnly[2]}-${dateOnly[1]}`;
  }
  const chileDate = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s|$)/);
  if (chileDate) {
    return `${chileDate[1]}-${chileDate[2]}-${chileDate[3]}`;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function statusLabel(status: string) {
  return estadoLabel(status);
}

function statusChipClass(status: string) {
  const styles: Record<string, string> = {
    new: 'bg-amber-50 text-amber-700 ring-amber-200',
    resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    exception: 'bg-rose-50 text-rose-700 ring-rose-200',
    rejected_for_learning: 'bg-slate-100 text-slate-700 ring-slate-200',
    in_review: 'bg-blue-50 text-blue-700 ring-blue-200',
  };

  return styles[status] || 'bg-slate-100 text-slate-700 ring-slate-200';
}

function priorityLabel(bucket: string) {
  if (bucket === 'approved_auto') return 'Cerrado';
  if (bucket === 'error_real') return 'Crítico';
  if (bucket === 'rejected_sii') return 'Alto';
  if (bucket === 'revision_oc') return 'Medio';
  return 'Normal';
}

function priorityChipClass(bucket: string) {
  if (bucket === 'error_real') return 'bg-rose-50 text-rose-700 ring-rose-200';
  if (bucket === 'approved_auto') return 'bg-cyan-50 text-cyan-700 ring-cyan-200';
  if (bucket === 'rejected_sii') return 'bg-orange-50 text-orange-700 ring-orange-200';
  if (bucket === 'revision_oc') return 'bg-amber-50 text-amber-700 ring-amber-200';
  return 'bg-slate-100 text-slate-700 ring-slate-200';
}

function sandboxPublishLabel(status: string | null | undefined) {
  if (status === 'ready') return 'Listo para Sandbox';
  if (status === 'published') return 'Publicado en Sandbox';
  if (status === 'failed') return 'Falló publicación Sandbox';
  return 'No listo para Sandbox';
}

function sandboxPublishDisplay(item: { sandbox_publish_status?: string | null; sandbox_record_id?: string | null }) {
  const label = sandboxPublishLabel(item.sandbox_publish_status);
  if (item.sandbox_publish_status === 'published' && item.sandbox_record_id) {
    return `${label} #${item.sandbox_record_id}`;
  }
  return label;
}

function sandboxPublishChipClass(status: string | null | undefined) {
  if (status === 'ready') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'published') return 'bg-sky-50 text-sky-700 ring-sky-200';
  if (status === 'failed') return 'bg-rose-50 text-rose-700 ring-rose-200';
  return 'bg-slate-100 text-slate-700 ring-slate-200';
}

function pipelineModeLabel(mode: string | null | undefined) {
  if (!mode) return '-';
  if (mode.includes('STUB')) return 'Simulación del pipeline, no publicación real';
  return mode;
}

function displaySummaryText(item: ReviewItem) {
  if (item.bucket === 'approved_auto' && item.summary_text?.includes('Sandbox-STUB')) {
    return item.summary_text.replace(' (Sandbox-STUB)', '; pendiente de publicación manual a Sandbox');
  }

  return item.summary_text || 'Sin resumen.';
}

function nextActionLabel(bucket: string, sandboxPublishStatus?: string | null) {
  if (bucket === 'approved_auto') {
    if (sandboxPublishStatus === 'published') return 'Ya publicado en Sandbox';
    if (sandboxPublishStatus === 'failed') return 'Reintentar publicación a Sandbox';
    return 'Publicar manualmente a Sandbox';
  }
  if (bucket === 'error_real') return 'Definir corrección contable';
  if (bucket === 'rejected_sii') return 'Gestionar rechazo con proveedor';
  if (bucket === 'revision_oc') return 'Validar contra OC real';
  return 'Revisar y decidir';
}

export function ReviewWorkbench({ items }: { items: ReviewItem[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const [selectedDetail, setSelectedDetail] = useState<ReviewCaseDetail | null>(null);
  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? items[0] ?? null, [items, selectedId]);

  useEffect(() => {
    if (!selected?.id) {
      setSelectedDetail(null);
      return;
    }

    let cancelled = false;

    fetch(`/api/review-cases/${selected.id}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('No se pudo cargar detalle del caso.');
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setSelectedDetail(data.item as ReviewCaseDetail);
      })
      .catch(() => {
        if (!cancelled) setSelectedDetail(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selected?.id]);

  const context = selectedDetail?.payload_json?.context;
  const document = selectedDetail?.payload_json?.document;
  const dueDate = document?.dueDate || context?.dueDate;
  const paymentDate = document?.paymentDate || context?.paymentDate;
  const paymentDateRule = document?.paymentDateRule || context?.paymentDateRule;
  const accountingDate = document?.accountingDateProposed || context?.accountingDateProposed;
  const paymentTermsLabel = document?.paymentTermsLabel || context?.paymentTermsLabel;
  const purchaseOrderReference = document?.purchaseOrderReference || context?.referenciaOcCorrelacion;
  const amountNet = document?.amountNet;
  const amountVat = document?.amountVat;
  const amountVatNonRecoverable = document?.amountVatNonRecoverable;
  const amountExempt = document?.amountExempt;
  const amountTotal = document?.amountTotal || selected?.amount_total;
  const amountTotalCalculated = document?.amountTotalCalculated;
  const amountTotalDelta = document?.amountTotalDelta;
  const amountReconciliationStatus = document?.amountReconciliationStatus;
  const siiDocumentType = document?.documentType || selected?.document_type;
  const siiDocumentTypeLabel = document?.documentTypeLabel;
  const invoiceNote = document?.invoiceNote || context?.invoiceNote;
  const invoiceDetail = document?.invoiceDetail || context?.invoiceDetail;
  const documentMemo = invoiceDetail || document?.serviceDescription || document?.memo || document?.description || document?.summary;
  const proposedApprovalGroup = context?.approvalGroup
    || context?.approverGroup
    || approvalGroupValueFromIds(context?.approverIdsProposed);
  const isAutomaticCreated = selected?.bucket === 'approved_auto';

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Cola de revisión</h2>
            <p className="mt-1 text-sm text-slate-600">Vista de trabajo con selección rápida de documentos.</p>
          </div>
          <div className="text-sm text-slate-500">{items.length} documento(s)</div>
        </div>

        <div className="mt-6 space-y-3">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
              No hay documentos para los filtros seleccionados.
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`block w-full rounded-2xl border p-4 text-left transition ${
                  item.id === selected?.id
                    ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{item.vendor_name || '-'}</div>
                    <div className="text-xs text-slate-500">{item.vendor_rut || 'RUT no informado'} · Folio {item.folio || '-'}</div>
                    <div className="mt-1 text-xs text-slate-500">{formatCurrency(item.amount_total)}</div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <div className={`inline-flex rounded-full px-2 py-0.5 ring-1 ${statusChipClass(item.status)}`}>
                      {statusLabel(item.status)}
                    </div>
                    <div className={`mt-1 inline-flex rounded-full px-2 py-0.5 ring-1 ${bucketChipClass(item.bucket)}`}>
                      {bucketLabel(item.bucket)}
                    </div>
                    <div className={`mt-1 inline-flex rounded-full px-2 py-0.5 ring-1 ${priorityChipClass(item.bucket)}`}>
                      Prioridad {priorityLabel(item.bucket)}
                    </div>
                    <div className={`mt-1 inline-flex rounded-full px-2 py-0.5 ring-1 ${sandboxPublishChipClass(item.sandbox_publish_status)}`}>
                      {sandboxPublishDisplay(item)}
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-600">{displaySummaryText(item)}</p>
                <p className="mt-2 text-xs font-medium text-slate-500">Siguiente acción sugerida: {nextActionLabel(item.bucket, item.sandbox_publish_status)}</p>
              </button>
            ))
          )}
        </div>
      </section>

      <aside className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-xl font-semibold text-slate-900">Detalle del documento</h2>
        {!selected ? (
          <p className="mt-4 text-sm text-slate-500">Selecciona un documento de la lista para revisar su detalle.</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-slate-900">{selected.vendor_name || '-'}</div>
                  <div className="text-sm text-slate-500">{selected.vendor_rut || 'RUT no informado'}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-sm font-medium ring-1 ${statusChipClass(selected.status)}`}>
                    {statusLabel(selected.status)}
                  </span>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-sm font-medium ring-1 ${bucketChipClass(selected.bucket)}`}>
                    {bucketLabel(selected.bucket)}
                  </span>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-sm font-medium ring-1 ${priorityChipClass(selected.bucket)}`}>
                    Prioridad {priorityLabel(selected.bucket)}
                  </span>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-sm font-medium ring-1 ${sandboxPublishChipClass(selected.sandbox_publish_status)}`}>
                    {sandboxPublishDisplay(selected)}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Folio</p>
                <p className="mt-1 font-medium text-slate-900">{selected.folio || '-'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Tipo de documento SII</p>
                <p className="mt-1 font-medium text-slate-900">{siiDocumentTypeLabel || siiDocumentType || '-'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Fecha documento</p>
                <p className="mt-1 font-medium text-slate-900">{formatDate(selected.issue_date)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Fecha recepción</p>
                <p className="mt-1 font-medium text-slate-900">{formatDate(selectedDetail?.reception_date)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Fecha contable propuesta</p>
                <p className="mt-1 font-medium text-slate-900">{formatDate(accountingDate)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Fecha vencimiento factura</p>
                <p className="mt-1 font-medium text-slate-900">{formatDate(dueDate)}</p>
                {document?.dueDateRule ? <p className="mt-1 text-xs text-slate-500">{document.dueDateRule}</p> : null}
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Fecha pago propuesta</p>
                <p className="mt-1 font-medium text-slate-900">{formatDate(paymentDate)}</p>
                {paymentDateRule ? <p className="mt-1 text-xs text-slate-500">{paymentDateRule}</p> : null}
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Término de pago</p>
                <p className="mt-1 font-medium text-slate-900">{paymentTermsLabel || '-'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Número de OC en factura</p>
                <p className="mt-1 font-medium text-slate-900">{String(siiDocumentType) === '61' ? 'No aplica para Nota de Crédito' : (purchaseOrderReference || '-')}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Monto afecto</p>
                <p className="mt-1 font-medium text-slate-900">{formatCurrency(amountNet)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">IVA recuperable</p>
                <p className="mt-1 font-medium text-slate-900">{formatCurrency(amountVat)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">IVA no recuperable</p>
                <p className="mt-1 font-medium text-slate-900">{formatCurrency(amountVatNonRecoverable)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Monto exento</p>
                <p className="mt-1 font-medium text-slate-900">{formatCurrency(amountExempt)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Monto bruto (total)</p>
                <p className="mt-1 font-medium text-slate-900">{formatCurrency(amountTotal)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Cuadratura RCV</p>
                <p className="mt-1 font-medium text-slate-900">{amountReconciliationStatus || '-'}</p>
                {amountTotalCalculated !== undefined || amountTotalDelta !== undefined ? (
                  <p className="mt-1 text-xs text-slate-500">Calculado {formatCurrency(amountTotalCalculated)} · Diferencia {formatCurrency(amountTotalDelta)}</p>
                ) : null}
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Estado</p>
                <p className="mt-1 font-medium text-slate-900">{statusLabel(selected.status)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2">
                <p className="text-sm text-slate-500">Etapa del caso</p>
                <div className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-sm font-medium ring-1 ${bucketChipClass(selected.bucket)}`}>
                  {bucketLabel(selected.bucket)}
                </div>
              </div>
              {selected.sandbox_publish_status === 'published' ? (
                <>
                  <div className="rounded-2xl bg-cyan-50 p-4">
                    <p className="text-sm text-cyan-700">ID Sandbox real</p>
                    <p className="mt-1 font-medium text-slate-900">{selectedDetail?.sandbox_record_id || '-'}</p>
                  </div>
                  <div className="rounded-2xl bg-cyan-50 p-4">
                    <p className="text-sm text-cyan-700">Registro Sandbox</p>
                    <p className="mt-1 font-medium text-slate-900">{selectedDetail?.sandbox_record_type || 'vendorbill'}</p>
                  </div>
                </>
              ) : null}
              {isAutomaticCreated && selected.sandbox_publish_status !== 'published' ? (
                <div className="rounded-2xl bg-cyan-50 p-4 md:col-span-2">
                  <p className="text-sm text-cyan-700">Origen automático</p>
                  <p className="mt-1 font-medium text-slate-900">{pipelineModeLabel(context?.automaticCreationMode)}</p>
                </div>
              ) : null}
              <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2">
                <p className="text-sm text-slate-500">Glosa con detalle del documento</p>
                <p className="mt-1 text-sm text-slate-800">{documentMemo || '-'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2">
                <p className="text-sm text-slate-500">Nota</p>
                <p className="mt-1 text-sm text-slate-800">{invoiceNote || '-'}</p>
              </div>
            </div>
            {context ? (
              <div className="space-y-3">
                {context.accountingDimensionRule ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-800">{context.accountingDimensionRule}</p>
                  </div>
                ) : null}
                {context.vendorIdProposed === null || context.accountIdProposed === null ? (
                  <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                    <p className="text-sm font-semibold text-violet-800">Proveedor nuevo o incompleto</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-violet-700">Grupo de aprobación</p>
                        <p className="mt-1 text-sm font-medium text-slate-900">{proposedApprovalGroup || 'Pendiente de definir'}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-violet-700">Cuenta contable</p>
                        <p className="mt-1 text-sm font-medium text-slate-900">{context.accountCorrecta || context.accountSuggestedB2 || 'Pendiente de definir'}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-violet-700">Categoría Gasto</p>
                        <p className="mt-1 text-sm font-medium text-slate-900">{context.expenseCategory || context.ocCategory || context.categoriaOc || 'Pendiente de definir'}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-violet-700">Política OC</p>
                        <p className="mt-1 text-sm font-medium text-slate-900">{context.ocPolicyCorrecta || context.ocPolicySuggestedB2 || 'Pendiente de definir'}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-violet-700">Estado proveedor</p>
                        <p className="mt-1 text-sm font-medium text-slate-900">{context.vendorIdProposed ? 'Encontrado en NetSuite' : 'Pendiente de alta/validación'}</p>
                      </div>
                    </div>
                  </div>
                ) : null}
                {context.motivo || context.error || context.comentariosGonzalo ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {context.motivo || context.error ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 md:col-span-2">
                        <p className="text-sm text-amber-700">Motivo principal</p>
                        <p className="mt-1 text-sm text-slate-900">{context.motivo || context.error}</p>
                      </div>
                    ) : null}
                    {context.comentariosGonzalo ? (
                      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 md:col-span-2">
                        <p className="text-sm text-indigo-700">Comentario de Gonzalo</p>
                        <p className="mt-1 text-sm text-slate-900">{context.comentariosGonzalo}</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="grid gap-3 md:grid-cols-2">
                {context.accountSuggestedB2 || context.classSuggestedB2 || context.departmentSuggestedB2 || context.locationSuggestedB2 || context.ocPolicySuggestedB2 || context.sourceSuggestedB2 ? (
                  <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 md:col-span-2">
                    <p className="text-sm font-semibold text-teal-800">Sugerencia contable B2 (abril-mayo)</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {context.accountSuggestedB2 ? (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-teal-700">Cuenta sugerida</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{context.accountSuggestedB2}</p>
                        </div>
                      ) : null}
                      {context.classSuggestedB2 ? (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-teal-700">Clase sugerida</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{context.classSuggestedB2}</p>
                        </div>
                      ) : null}
                      {context.departmentSuggestedB2 ? (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-teal-700">Departamento sugerido</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{context.departmentSuggestedB2}</p>
                        </div>
                      ) : null}
                      {context.locationSuggestedB2 ? (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-teal-700">Ubicación sugerida</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{context.locationSuggestedB2}</p>
                        </div>
                      ) : null}
                      {context.ocPolicySuggestedB2 ? (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-teal-700">Política OC sugerida</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{context.ocPolicySuggestedB2}</p>
                        </div>
                      ) : null}
                      {context.sourceSuggestedB2 ? (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-teal-700">Fuente sugerencia</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{context.sourceSuggestedB2}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {context.accountCorrecta || context.classCorrecta || context.departmentCorrecta || context.locationCorrecta || context.terminosNs || context.pagoPorTef || context.trabajaConOc || context.ocPolicyCorrecta || proposedApprovalGroup ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 md:col-span-2">
                    <p className="text-sm font-semibold text-emerald-800">Datos enriquecidos desde conocimiento previo</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {context.accountCorrecta ? (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-emerald-700">Cuenta correcta sugerida</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{context.accountCorrecta}</p>
                        </div>
                      ) : null}
                      {context.classCorrecta ? (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-emerald-700">Clase sugerida</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{context.classCorrecta}</p>
                        </div>
                      ) : null}
                      {context.departmentCorrecta ? (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-emerald-700">Departamento sugerido</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{context.departmentCorrecta}</p>
                        </div>
                      ) : null}
                      {context.locationCorrecta ? (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-emerald-700">Ubicación sugerida</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{context.locationCorrecta}</p>
                        </div>
                      ) : null}
                      {context.terminosNs ? (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-emerald-700">Términos NS</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{context.terminosNs}</p>
                        </div>
                      ) : null}
                      {context.pagoPorTef ? (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-emerald-700">Pago por TEF</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{context.pagoPorTef}</p>
                        </div>
                      ) : null}
                      {context.trabajaConOc ? (
                        <div className="md:col-span-2">
                          <p className="text-xs uppercase tracking-wide text-emerald-700">Trabajo con OC</p>
                          <p className="mt-1 text-sm text-slate-900">{context.trabajaConOc}</p>
                        </div>
                      ) : null}
                      {context.ocPolicyCorrecta ? (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-emerald-700">Política OC</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{context.ocPolicyCorrecta}</p>
                        </div>
                      ) : null}
                      {proposedApprovalGroup ? (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-emerald-700">Grupo de aprobación</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">{proposedApprovalGroup}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {context.terminosNs ? (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">{fieldLabel('terminosNs')}</p>
                    <p className="mt-1 font-medium text-slate-900">{context.terminosNs}</p>
                  </div>
                ) : null}
                {context.accountCorrecta ? (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">{fieldLabel('accountCorrecta')}</p>
                    <p className="mt-1 font-medium text-slate-900">{context.accountCorrecta}</p>
                  </div>
                ) : null}
                {context.ocPolicyCorrecta || context.categoriaOc ? (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">{fieldLabel('ocPolicyCorrecta')}</p>
                    <p className="mt-1 font-medium text-slate-900">{context.ocPolicyCorrecta || context.categoriaOc}</p>
                  </div>
                ) : null}
                {context.matchConfianza ? (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">{fieldLabel('matchConfianza')}</p>
                    <p className="mt-1 font-medium text-slate-900">{context.matchConfianza}</p>
                  </div>
                ) : null}
                {context.learningCategory ? (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">{fieldLabel('learningCategory')}</p>
                    <p className="mt-1 font-medium text-slate-900">{context.learningCategory}</p>
                  </div>
                ) : null}
                {context.requiereRevisionManual ? (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">{fieldLabel('requiereRevisionManual')}</p>
                    <p className="mt-1 font-medium text-slate-900">{context.requiereRevisionManual}</p>
                  </div>
                ) : null}
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/auditoria" className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
                Ver auditoría
              </Link>
            </div>

            {isAutomaticCreated ? (
              <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900">
                Documento creado automáticamente por el pipeline. Esta vista es solo de consulta y no requiere decisión manual.
              </div>
            ) : (
            <div className="pt-2">
              <ReviewDecisionForm
                key={selected.id}
                caseId={selected.id}
                currentValues={{
                  accountId: document?.accountId || context?.accountIdProposed || context?.referenciaAccount,
                  vendorName: selected.vendor_name,
                  documentType: selected.document_type,
                  issueDate: selected.issue_date,
                  accountingDate,
                  dueDate,
                  paymentDate,
                  classId: document?.classId || context?.classIdProposed || context?.classCorrecta || context?.classSuggestedB2,
                  departmentId: document?.departmentId || context?.departmentIdProposed || context?.departmentCorrecta || context?.departmentSuggestedB2,
                  locationId: document?.locationId || context?.locationIdProposed || context?.locationCorrecta || context?.locationSuggestedB2,
                  approvalGroup: proposedApprovalGroup,
                  ocCategory: context?.ocCategory || context?.categoriaOc,
                  expenseCategory: context?.expenseCategory,
                  ocPolicy: context?.ocPolicyCorrecta || context?.ocPolicySuggestedB2,
                  newVendorEntity: context?.entity || context?.vendorIdProposed,
                  invoiceNote,
                  invoiceDetail: documentMemo,
                }}
              />
            </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
