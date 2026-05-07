import { createRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { rootRoute } from './__root';
import { apiClient } from '../lib/api-client';

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexPage,
});

type ApiState = 'loading' | 'ok' | 'down';

function useApiHealth(): ApiState {
  const query = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await apiClient.health.check();
      if (res.status !== 200) {
        throw new Error(`unexpected status ${res.status}`);
      }
      return res.body;
    },
    refetchInterval: 30_000,
  });
  if (query.isPending) return 'loading';
  if (query.isError) return 'down';
  return query.data.status === 'ok' ? 'ok' : 'down';
}

function IndexPage() {
  const state = useApiHealth();
  const label = state === 'loading' ? 'API: …' : state === 'ok' ? 'API: ok' : 'API: down';

  return (
    <section className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="text-2xl font-semibold">MedBridge</h1>
      <p
        className={
          state === 'ok'
            ? 'text-emerald-700'
            : state === 'down'
              ? 'text-red-700'
              : 'text-slate-500'
        }
        data-testid="api-status"
      >
        {label}
      </p>
    </section>
  );
}
