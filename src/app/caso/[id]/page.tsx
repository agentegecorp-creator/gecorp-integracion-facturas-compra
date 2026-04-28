import Link from 'next/link';
import { requireSession } from '@/lib/auth/guards';
import { getReviewCaseById, getReviewDecisionsByCaseId } from '@/lib/db/queries';
import { ReviewDecisionForm } from '@/components/review/review-decision-form';

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

  return (
    <main className="p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Caso {id}</h1>
          <p className="mt-2 text-slate-600">Detalle operativo del caso en revisión.</p>
        </div>
        <Link href="/pendiente-revision" className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
          Volver a la cola
        </Link>
      </div>
      {!item ? (
        <p className="mt-6 text-slate-600">Caso no encontrado.</p>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 rounded-2xl bg-white p-6 shadow-sm md:grid-cols-2">
            <div>
              <p className="text-sm text-slate-500">Proveedor</p>
              <p className="font-medium">{item.vendor_name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">RUT</p>
              <p className="font-medium">{item.vendor_rut || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Folio</p>
              <p className="font-medium">{item.folio || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Tipo documento</p>
              <p className="font-medium">{item.document_type || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Bucket</p>
              <p className="font-medium">{item.bucket}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Estado</p>
              <p className="font-medium">{item.status}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Monto total</p>
              <p className="font-medium">{item.amount_total || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Resumen</p>
              <p className="font-medium">{item.summary_text || '-'}</p>
            </div>
          </div>

          <ReviewDecisionForm caseId={id} />

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Historial de decisiones</h2>
            <p className="mt-1 text-sm text-slate-600">Trazabilidad operativa del caso.</p>

            {decisions.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">Todavía no hay decisiones registradas para este caso.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {decisions.map((decision) => (
                  <div key={decision.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{decision.decision_type}</p>
                      <p className="text-xs text-slate-500">{new Date(decision.created_at).toLocaleString('es-CL')}</p>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{decision.user_name} ({decision.user_email})</p>
                    <p className="mt-3 text-sm text-slate-800">{decision.notes || 'Sin notas.'}</p>
                    <pre className="mt-3 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                      {JSON.stringify(decision.correction_json, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-slate-900 p-4 text-sm text-slate-100 shadow-sm">
            <p className="mb-3 text-xs uppercase tracking-wide text-slate-400">Payload técnico</p>
            <pre className="overflow-auto">{JSON.stringify(item.payload_json, null, 2)}</pre>
          </div>
        </div>
      )}
    </main>
  );
}
