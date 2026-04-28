import Link from 'next/link';
import { requireSession } from '@/lib/auth/guards';
import { listReviewCases } from '@/lib/db/queries';
import { ReviewFilters } from '@/components/review/review-filters';

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    new: 'bg-amber-50 text-amber-700 ring-amber-200',
    resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    exception: 'bg-rose-50 text-rose-700 ring-rose-200',
    rejected_for_learning: 'bg-slate-100 text-slate-700 ring-slate-200',
    in_review: 'bg-blue-50 text-blue-700 ring-blue-200',
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${styles[status] || 'bg-slate-100 text-slate-700 ring-slate-200'}`}>
      {status}
    </span>
  );
}

export default async function PendingReviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ bucket?: string; status?: string }>;
}) {
  await requireSession();
  const resolvedSearchParams = (await searchParams) ?? {};
  const bucket = resolvedSearchParams.bucket || '';
  const status = resolvedSearchParams.status || '';
  const items = await listReviewCases(20, {
    bucket: bucket || undefined,
    status: status || undefined,
  });

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-8">
      <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Pendiente revisión</h1>
            <p className="mt-2 text-sm text-slate-600">Mesa operativa para revisar documentos, filtrar la cola y abrir el detalle de cada caso.</p>
          </div>
          <Link href="/dashboard" className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
            Volver al dashboard
          </Link>
        </div>

        <ReviewFilters currentBucket={bucket} currentStatus={status} />
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Cola de revisión</h2>
            <p className="mt-1 text-sm text-slate-600">Lista priorizada para entrar al detalle y tomar acción.</p>
          </div>
          <div className="text-sm text-slate-500">{items.length} caso(s)</div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Estado</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Proveedor</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Folio</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Monto</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Bucket</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    No hay casos para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{item.vendor_name || '-'}</div>
                      <div className="text-xs text-slate-500">{item.vendor_rut || 'RUT no informado'}</div>
                    </td>
                    <td className="px-4 py-3">{item.folio || '-'}</td>
                    <td className="px-4 py-3">{item.amount_total || '-'}</td>
                    <td className="px-4 py-3">{item.bucket}</td>
                    <td className="px-4 py-3">
                      <Link href={`/caso/${item.id}`} className="font-medium text-slate-900 underline underline-offset-2">
                        Revisar caso
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
