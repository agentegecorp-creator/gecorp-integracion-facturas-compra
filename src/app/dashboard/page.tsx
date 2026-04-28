import { requireSession } from '@/lib/auth/guards';

export default async function DashboardPage() {
  const session = await requireSession();

  return (
    <main className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard operativo</h1>
          <p className="mt-2 text-slate-600">Bienvenido, {session.name}. Ya hay sesión protegida funcionando.</p>
        </div>
        <form action="/api/auth/logout" method="post">
          <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
            Cerrar sesión
          </button>
        </form>
      </div>
    </main>
  );
}
