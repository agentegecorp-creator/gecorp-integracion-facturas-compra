'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ReviewDecisionForm } from '@/components/review/review-decision-form';

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
};

type ReviewCaseDetail = ReviewItem & {
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
    };
  } | null;
};

function bucketLabel(bucket: string) {
  const labels: Record<string, string> = {
    pending_review: 'Pendiente revisión',
    revision_oc: 'Revisión OC',
    error_real: 'Error real',
    rejected_sii: 'Rechazada SII',
  };

  return labels[bucket] || bucket;
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
            <h2 className="text-xl font-semibold text-slate-900">Cola de revisión MVP</h2>
            <p className="mt-1 text-sm text-slate-600">Vista operativa tipo mesa, con selección rápida de casos.</p>
          </div>
          <div className="text-sm text-slate-500">{items.length} caso(s)</div>
        </div>

        <div className="mt-6 space-y-3">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
              No hay casos para los filtros seleccionados.
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
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <div>{item.status}</div>
                    <div className={`mt-1 inline-flex rounded-full px-2 py-0.5 ring-1 ${bucketChipClass(item.bucket)}`}>
                      {bucketLabel(item.bucket)}
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-600">{item.summary_text || 'Sin resumen.'}</p>
              </button>
            ))
          )}
        </div>
      </section>

      <aside className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-xl font-semibold text-slate-900">Detalle del documento</h2>
        {!selected ? (
          <p className="mt-4 text-sm text-slate-500">Selecciona un caso de la lista para revisar su detalle.</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <div className="text-lg font-semibold text-slate-900">{selected.vendor_name || '-'}</div>
              <div className="text-sm text-slate-500">{selected.vendor_rut || 'RUT no informado'}</div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Folio</p>
                <p className="mt-1 font-medium text-slate-900">{selected.folio || '-'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Monto total</p>
                <p className="mt-1 font-medium text-slate-900">{selected.amount_total || '-'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Estado</p>
                <p className="mt-1 font-medium text-slate-900">{selected.status}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Bucket</p>
                <div className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-sm font-medium ring-1 ${bucketChipClass(selected.bucket)}`}>
                  {bucketLabel(selected.bucket)}
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Resumen</p>
              <p className="mt-1 text-sm text-slate-800">{selected.summary_text || 'Sin resumen.'}</p>
            </div>
            {context ? (
              <div className="grid gap-3 md:grid-cols-2">
                {typeof context.entity === 'number' ? (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Entity</p>
                    <p className="mt-1 font-medium text-slate-900">{context.entity}</p>
                  </div>
                ) : null}
                {typeof context.referenciaAccount === 'number' ? (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Cuenta referencial</p>
                    <p className="mt-1 font-medium text-slate-900">{context.referenciaAccount}</p>
                  </div>
                ) : null}
                {context.categoriaOc ? (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Categoría OC</p>
                    <p className="mt-1 font-medium text-slate-900">{context.categoriaOc}</p>
                  </div>
                ) : null}
                {context.learningCategory ? (
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Learning category</p>
                    <p className="mt-1 font-medium text-slate-900">{context.learningCategory}</p>
                  </div>
                ) : null}
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
