import { Link, useRouterState } from '@tanstack/react-router';

type Role = 'patient' | 'doctor';

interface NavLink {
  to: string;
  label: string;
}

const NAV_LINKS: Record<Role, NavLink[]> = {
  patient: [
    { to: '/patient', label: 'Dashboard' },
    { to: '/patient/documents', label: 'My Documents' },
  ],
  doctor: [
    { to: '/doctor', label: 'Dashboard' },
    { to: '/doctor/schedule', label: 'My Schedule' },
  ],
};

interface AppNavProps {
  role: Role;
  userName: string;
  onLogout: () => void;
}

export function AppNav({ role, userName, onLogout }: AppNavProps) {
  const { location } = useRouterState();
  const links = NAV_LINKS[role];

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-slate-200 bg-white px-4 py-6">
      <div className="mb-8">
        <span className="text-lg font-bold text-slate-900">MedBridge</span>
        <p className="mt-0.5 text-xs capitalize text-slate-400">{role}</p>
      </div>

      <nav className="flex-1">
        <ul className="space-y-1">
          {links.map(({ to, label }) => {
            const isActive = location.pathname === to;
            return (
              <li key={to}>
                <Link
                  to={to}
                  className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-slate-200 pt-4">
        <p className="mb-2 truncate text-sm font-medium text-slate-700">{userName}</p>
        <button
          type="button"
          onClick={onLogout}
          className="w-full rounded border border-slate-300 px-3 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-100"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
