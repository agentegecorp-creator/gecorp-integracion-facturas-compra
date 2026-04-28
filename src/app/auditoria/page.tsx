import Link from 'next/link';
import { requireSession } from '@/lib/auth/guards';
import { listAuditLog } from '@/lib/db/queries';

export default async function AuditPage() {
  await requireSession();
  const events = await listAuditLog();

  return (
    <main className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Auditoría</h1>
          <p className="mt-2 text-slate-600">Trazabilidad operativa del flujo y de las decisiones tomadas.</p>
        </div>
        <Link href="/dashboard" className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
          Volver al dashboard
        </Link>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Eventos recientes</h2>
        <p className="mt-1 text-sm text-slate-600">Primer corte útil del audit log del MVP.</p>

        {events.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Todavía no hay eventos registrados.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {events.map((event) => (
              <div key={event.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{event.action}</p>
                  <p className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString('es-CL')}</p>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {event.user_name || 'Usuario desconocido'} {event.user_email ? `(${event.user_email})` : ''}
                </p>
                <p className="mt-2 text-sm text-slate-800">
                  Entidad: {event.entity_type} {event.entity_id ? `· ${event.entity_id}` : ''}
                </p>
                <pre className="mt-3 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                  {JSON.stringify(event.details_json, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
