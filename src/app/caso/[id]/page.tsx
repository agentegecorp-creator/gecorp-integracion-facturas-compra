import { requireSession } from '@/lib/auth/guards';
import { getReviewCaseById } from '@/lib/db/queries';

type CaseDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CaseDetailPage({ params }: CaseDetailPageProps) {
  await requireSession();
  const { id } = await params;
  const item = await getReviewCaseById(id);

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Caso {id}</h1>
      {!item ? (
        <p className="mt-2 text-slate-600">Caso no encontrado.</p>
      ) : (
        <pre className="mt-6 overflow-auto rounded-2xl bg-slate-900 p-4 text-sm text-slate-100">
          {JSON.stringify(item, null, 2)}
        </pre>
      )}
    </main>
  );
}
