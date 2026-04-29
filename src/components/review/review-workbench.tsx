'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ReviewDecisionForm } from '@/components/review/review-decision-form';
import { estadoLabel, etapaLabel, fieldLabel } from '@/lib/review/labels';

type ReviewItem = {
  id: string;
  vendor_name: string | null;
  vendor_rut: string | null;
  folio: string | null;
  bucket: string;
  status: string;
  amount_total: string | null;
  document_type?: string | null;
  issue_date?: string | null;
  summary_text?: string | null;
  sandbox_publish_status?: string | null;
};

type ReviewCaseDetail = ReviewItem & {
  reception_date?: string | null;
  payload_json?: {
    context?: {
      entity?: number;
      referenciaAccount?: number;
      categoriaOc?: string;
      learningCategory?: string;
      motivo?: string;
      rut?: string;
      razonSocial?: string;
      error?: string;
      terminosNs?: string;
      accountCorrecta?: string;
      comentariosGonzalo?: string;
      matchConfianza?: string;
      ocPolicyCorrecta?: string;
      requiereRevisionManual?: string;
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
  };

  return styles[bucket] || 'bg-slate-100 text-slate-700 ring-slate-200';
}

function formatCurrency(value: string | null) {
  if (!value) return '-';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;

  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
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
  if (bucket === 'error_real') return 'Crítico';
  if (bucket === 'rejected_sii') return 'Alto';
  if (bucket === 'revision_oc') return 'Medio';
  return 'Normal';
}

function priorityChipClass(bucket: string) {
  if (bucket === 'error_real') return 'bg-rose-50 text-rose-700 ring-rose-200';
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

function sandboxPublishChipClass(status: string | null | undefined) {
  if (status === 'ready') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'published') return 'bg-sky-50 text-sky-700 ring-sky-200';
  if (status === 'failed') return 'bg-rose-50 text-rose-700 ring-rose-200';
  return 'bg-slate-100 text-slate-700 ring-slate-200';
}

function nextActionLabel(bucket: string) {
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
                      {sandboxPublishLabel(item.sandbox_publish_status)}
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-600">{item.summary_text || 'Sin resumen.'}</p>
                <p className="mt-2 text-xs font-medium text-slate-500">Siguiente acción sugerida: {nextActionLabel(item.bucket)}</p>
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
                    {sandboxPublishLabel(selected.sandbox_publish_status)}
                  </span>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Siguiente acción sugerida</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{nextActionLabel(selected.bucket)}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Folio</p>
                <p className="mt-1 font-medium text-slate-900">{selected.folio || '-'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Monto total</p>
                <p className="mt-1 font-medium text-slate-900">{formatCurrency(selected.amount_total)}</p>
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
                <p className="text-sm text-slate-500">Estado</p>
                <p className="mt-1 font-medium text-slate-900">{statusLabel(selected.status)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2">
                <p className="text-sm text-slate-500">Etapa del caso</p>
                <div className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-sm font-medium ring-1 ${bucketChipClass(selected.bucket)}`}>
                  {bucketLabel(selected.bucket)}
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Resumen del documento</p>
              <p className="mt-1 text-sm text-slate-800">{selected.summary_text || 'Sin resumen disponible.'}</p>
            </div>
            {context ? (
              <div className="space-y-3">
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
                {typeof context.entity === 'number' ? (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">{fieldLabel('entity')}</p>
                    <p className="mt-1 font-medium text-slate-900">{context.entity}</p>
                  </div>
                ) : null}
                {typeof context.referenciaAccount === 'number' ? (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">{fieldLabel('referenciaAccount')}</p>
                    <p className="mt-1 font-medium text-slate-900">{context.referenciaAccount}</p>
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

            <div className="pt-2">
              <ReviewDecisionForm
                caseId={selected.id}
                currentValues={{
                  vendorName: selected.vendor_name,
                  documentType: selected.document_type,
                  issueDate: selected.issue_date,
                }}
              />
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
