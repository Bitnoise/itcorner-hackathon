import { createRoute, useNavigate, redirect, isRedirect } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { rootRoute } from './__root';
import { fetchCurrentUser, currentUserQueryOptions } from '../features/auth/queries';
import { clearToken } from '../lib/auth-token';

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
      clearToken();
      throw redirect({ to: '/login' });
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
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Welcome, {user?.firstName}
          </h1>
          <p className="text-sm text-slate-500">Doctor</p>
        </div>
        <button
          onClick={handleLogout}
          className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100"
        >
          Log out
        </button>
      </div>

      <section className="rounded-lg border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800">Upcoming appointments</h2>
        <p className="mt-2 text-sm text-slate-500">No appointments scheduled yet.</p>
      </section>
    </div>
  );
}
