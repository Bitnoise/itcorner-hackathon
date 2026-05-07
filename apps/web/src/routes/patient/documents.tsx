import { createRoute, redirect, isRedirect, useNavigate } from '@tanstack/react-router';
import { useRef } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { rootRoute } from '../__root';
import { currentUserQueryOptions } from '../../features/auth/queries';
import { getToken, clearToken } from '../../lib/auth-token';
import { useDocuments } from '../../features/documents/use-documents';
import { useUploadDocument } from '../../features/documents/use-upload-document';
import { DocumentList } from '../../features/documents/DocumentList';
import { AppNav } from '../../components/AppNav';

export const patientDocumentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/patient/documents',
  beforeLoad: async ({ context: { queryClient } }) => {
    try {
      const user = await queryClient.ensureQueryData(currentUserQueryOptions);
      if (user.role !== 'patient') {
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
  component: PatientDocumentsPage,
});

function PatientDocumentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useQuery(currentUserQueryOptions);
  const { data: documents = [], isLoading } = useDocuments();
  const { mutate: upload, isPending, error } = useUploadDocument();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleLogout() {
    clearToken();
    queryClient.clear();
    await navigate({ to: '/login' });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    upload(file);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }

  return (
    <div className="flex h-screen">
      <AppNav role="patient" userName={user?.firstName ?? ''} onLogout={handleLogout} />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-slate-900">My Documents</h1>
            <label className="cursor-pointer rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
              {isPending ? 'Uploading...' : 'Upload file'}
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFileChange}
                disabled={isPending}
              />
            </label>
          </div>

          {error && (
            <p className="text-sm text-red-600">
              Upload failed: {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          )}

          <section className="rounded-lg border border-slate-200 p-6">
            <DocumentList documents={documents} isLoading={isLoading} />
          </section>
        </div>
      </main>
    </div>
  );
}
