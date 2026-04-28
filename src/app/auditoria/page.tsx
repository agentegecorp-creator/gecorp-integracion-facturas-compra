import { requireSession } from '@/lib/auth/guards';

export default async function AuditPage() {
  await requireSession();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Auditoría</h1>
      <p className="mt-2 text-slate-600">Pantalla protegida lista. Pendiente conectar eventos reales.</p>
    </main>
  );
}
