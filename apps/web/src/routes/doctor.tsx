import { createRoute, useNavigate, redirect, isRedirect } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { rootRoute } from './__root';
import { fetchCurrentUser, currentUserQueryOptions } from '../features/auth/queries';
import { clearToken, getToken } from '../lib/auth-token';
import { SharedDocumentsList } from '../features/documents/SharedDocumentsList';
import { AppNav } from '../components/AppNav';

export const doctorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/doctor',
  beforeLoad: async ({ context: { queryClient } }) => {
    try {
      const user = await queryClient.ensureQueryData(currentUserQueryOptions);
      if (user.role !== 'doctor') {
        throw redirect({ to: `/${user.role}` });
      }
    } catch (e) {
      if (isRedirect(e)) throw e;
      const hadToken = !!getToken();
      clearToken();
      throw redirect({
        to: '/login',
        ...(hadToken ? { search: { reason: 'session-expired' } } : {}),
      });
    }
  },
  component: DoctorDashboard,
});

function DoctorDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useQuery({ ...currentUserQueryOptions, queryFn: fetchCurrentUser });

  async function handleLogout() {
    clearToken();
    queryClient.clear();
    await navigate({ to: '/login' });
  }

  return (
    <div className="flex h-screen">
      <AppNav role="doctor" userName={user?.firstName ?? ''} onLogout={handleLogout} />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <h1 className="text-2xl font-semibold text-slate-900">
            Welcome, {user?.firstName}
          </h1>

          <section className="rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800">Upcoming appointments</h2>
            <p className="mt-2 text-sm text-slate-500">No appointments scheduled yet.</p>
          </section>

          <section className="rounded-lg border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800">Documents shared with me</h2>
            <div className="mt-3">
              <SharedDocumentsList />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
