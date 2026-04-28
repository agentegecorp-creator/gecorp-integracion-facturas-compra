import { requireSession } from '@/lib/auth/guards';
import { listReviewCases } from '@/lib/db/queries';

export default async function PendingReviewPage() {
  await requireSession();
  const items = await listReviewCases();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Pendiente revisión</h1>
      <p className="mt-2 text-slate-600">Cola principal del MVP.</p>

      <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Proveedor</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Folio</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Bucket</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Estado</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">{item.vendor_name || '-'}</td>
                <td className="px-4 py-3">{item.folio || '-'}</td>
                <td className="px-4 py-3">{item.bucket}</td>
                <td className="px-4 py-3">{item.status}</td>
                <td className="px-4 py-3">{item.amount_total || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
