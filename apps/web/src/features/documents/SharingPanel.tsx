import {
  useDocumentShares,
  useGrantAccess,
  useRevokeAccess,
} from './use-document-shares';

interface SharingPanelProps {
  documentId: string;
}

export function SharingPanel({ documentId }: SharingPanelProps) {
  const { data: doctors, isLoading, error } = useDocumentShares(documentId);
  const grant = useGrantAccess(documentId);
  const revoke = useRevokeAccess(documentId);

  if (isLoading) {
    return <p className="text-xs text-slate-500">Loading doctors…</p>;
  }
  if (error) {
    return <p className="text-xs text-red-600">Failed to load sharing state.</p>;
  }
  if (!doctors || doctors.length === 0) {
    return <p className="text-xs text-slate-500">No doctors registered yet.</p>;
  }

  const pendingDoctorId = grant.isPending
    ? (grant.variables ?? null)
    : revoke.isPending
      ? (revoke.variables ?? null)
      : null;

  function handleToggle(doctorId: string, currentlyHasAccess: boolean) {
    if (currentlyHasAccess) {
      revoke.mutate(doctorId);
    } else {
      grant.mutate(doctorId);
    }
  }

  return (
    <ul className="space-y-2">
      {doctors.map((d) => {
        const isPending = pendingDoctorId === d.doctorId;
        return (
          <li key={d.doctorId} className="flex items-center justify-between text-sm">
            <span className="text-slate-700">{d.displayName}</span>
            <button
              type="button"
              onClick={() => handleToggle(d.doctorId, d.hasAccess)}
              disabled={isPending}
              className={`rounded border px-3 py-1 text-xs ${
                d.hasAccess
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {isPending ? '…' : d.hasAccess ? 'Shared' : 'Share'}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
