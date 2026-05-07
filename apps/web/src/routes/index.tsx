import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexPage,
});

function IndexPage() {
  return (
    <section className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="text-2xl font-semibold">MedBridge</h1>
      <p className="text-slate-600">Loading…</p>
    </section>
  );
}
