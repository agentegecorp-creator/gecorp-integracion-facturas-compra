import Link from 'next/link';
import { requireSession } from '@/lib/auth/guards';
import { getReviewCaseById, getReviewDecisionsByCaseId } from '@/lib/db/queries';
import { ReviewDecisionForm } from '@/components/review/review-decision-form';
import { decisionLabel, estadoLabel, etapaLabel } from '@/lib/review/labels';

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('es-CL');
}

function optionalString(value: unknown) {
  if (value == null) return undefined;
  return String(value);
}

type CaseDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CaseDetailPage({ params }: CaseDetailPageProps) {
  await requireSession();
  const { id } = await params;
  const item = await getReviewCaseById(id);
  const decisions = await getReviewDecisionsByCaseId(id);
  const payload = item?.payload_json as
    | {
        document?: Record<string, string | number | null | undefined>;
        context?: Record<string, string | number | null | undefined>;
      }
    | undefined;
  const document = payload?.document ?? {};
  const context = payload?.context ?? {};

  return (
    <main className="p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Caso {id}</h1>
          <p className="mt-2 text-slate-600">Detalle operativo del documento en revisión.</p>
        </div>
        <Link href="/pendiente-revision" className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
          Volver a la cola
        </Link>
      </div>
      {!item ? (
        <p className="mt-6 text-slate-600">Caso no encontrado.</p>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                    {estadoLabel(item.status)}
                  </div>
                  <h2 className="mt-4 text-xl font-semibold text-slate-900">{item.vendor_name || '-'}</h2>
                  <p className="mt-1 text-sm text-slate-600">{item.vendor_rut || 'RUT no informado'} · Folio {item.folio || '-'}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200">
                  Etapa del caso: <strong>{etapaLabel(item.bucket)}</strong>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Tipo documento</p>
                  <p className="mt-1 font-medium text-slate-900">{item.document_type || '-'}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Monto total</p>
                  <p className="mt-1 font-medium text-slate-900">{item.amount_total || '-'}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Fecha documento</p>
                  <p className="mt-1 font-medium text-slate-900">{item.issue_date || '-'}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Fecha recepción</p>
                  <p className="mt-1 font-medium text-slate-900">{item.reception_date || '-'}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2">
                  <p className="text-sm text-slate-500">Resumen</p>
                  <p className="mt-1 font-medium text-slate-900">{item.summary_text || '-'}</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Historial de decisiones</h2>
              <p className="mt-1 text-sm text-slate-600">Historial de decisiones tomadas sobre este documento.</p>

              {decisions.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">Todavía no hay decisiones registradas para este documento.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {decisions.map((decision) => (
                    <div key={decision.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-slate-900">{decisionLabel(decision.decision_type)}</p>
                        <p className="text-xs text-slate-500">{formatDateTime(decision.created_at)}</p>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{decision.user_name} ({decision.user_email})</p>
                      <p className="mt-3 text-sm text-slate-800">{decision.notes || 'Sin notas.'}</p>
                      <pre className="mt-3 overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                        {JSON.stringify(decision.correction_json, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-slate-900 p-5 text-sm text-slate-100 shadow-sm">
              <p className="mb-3 text-xs uppercase tracking-wide text-slate-400">Detalle técnico</p>
              <pre className="overflow-auto">{JSON.stringify(item.payload_json, null, 2)}</pre>
            </div>
          </div>

          <div className="space-y-6">
            <ReviewDecisionForm
              caseId={id}
              currentValues={{
                vendorName: item.vendor_name,
                documentType: item.document_type,
                issueDate: item.issue_date,
                accountingDate: optionalString(document.accountingDateProposed || context.accountingDateProposed),
                dueDate: optionalString(document.dueDate || context.dueDate),
                paymentDate: optionalString(document.paymentDate || context.paymentDate),
                classId: document.classId || context.classIdProposed || context.classCorrecta || context.classSuggestedB2,
                departmentId: document.departmentId || context.departmentIdProposed || context.departmentCorrecta || context.departmentSuggestedB2,
                locationId: document.locationId || context.locationIdProposed || context.locationCorrecta || context.locationSuggestedB2,
              }}
            />
          </div>
        </div>
      )}
    </main>
  );
}
