import { type FormEvent, useState } from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { rootRoute } from './__root';
import { apiClient } from '../lib/api-client';
import { setToken } from '../lib/auth-token';
import { currentUserQueryOptions } from '../features/auth/queries';

type ValidationIssue = { path: (string | number)[]; message: string };

class ValidationError extends Error {
  constructor(public readonly issues: ValidationIssue[]) {
    super('validation');
  }
}

const loginSearchSchema = z.object({
  reason: z.string().optional(),
});

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: (search) => loginSearchSchema.parse(search),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { reason } = loginRoute.useSearch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const res = await apiClient.auth.login({ body: credentials });
      if (res.status === 422) {
        const body = res.body as { issues?: ValidationIssue[] };
        throw new ValidationError(body.issues ?? []);
      }
      if (res.status !== 200) throw new Error('invalid_credentials');
      return res.body;
    },
    onSuccess: async (data) => {
      setToken(data.token);
      const user = await queryClient.fetchQuery(currentUserQueryOptions);
      await navigate({ to: `/${user.role}` });
    },
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  }

  const fieldErrors: Record<string, string> =
    loginMutation.error instanceof ValidationError
      ? Object.fromEntries(
          loginMutation.error.issues
            .filter((i) => i.path.length > 0)
            .map((i) => [String(i.path[0]), i.message]),
        )
      : {};

  const topError =
    loginMutation.error && !(loginMutation.error instanceof ValidationError)
      ? 'Invalid credentials. Please check your email and password.'
      : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow"
      >
        <h1 className="text-2xl font-semibold text-slate-900">MedBridge</h1>

        {reason === 'session-expired' && !loginMutation.error && (
          <p role="status" aria-live="polite" className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Your session has expired. Please log in again.
          </p>
        )}

        {topError && (
          <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {topError}
          </p>
        )}

        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          {fieldErrors['email'] && (
            <p className="text-xs text-red-600">{fieldErrors['email']}</p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          {fieldErrors['password'] && (
            <p className="text-xs text-red-600">{fieldErrors['password']}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loginMutation.isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
