import { useState } from 'react';
import { useSharedDocuments } from './use-shared-documents';
import { getToken } from '../../lib/auth-token';

const baseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3001';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Direct fetch bypass of apiClient: the shared ts-rest apiClient hardcodes
// `response.json()` and cannot return a Blob, so a binary download has to go
// through fetch with the auth header set manually.
async function downloadFile(documentId: string, filename: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${baseUrl}/documents/${documentId}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(`Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function SharedDocumentsList() {
  const { data: groups, isLoading, error } = useSharedDocuments();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function handleDownload(documentId: string, filename: string) {
    setDownloadingId(documentId);
    setDownloadError(null);
    try {
      await downloadFile(documentId, filename);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setDownloadingId(null);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading shared documents…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-600">Failed to load shared documents.</p>;
  }
  if (!groups || groups.length === 0) {
    return <p className="text-sm text-slate-500">No documents have been shared with you yet.</p>;
  }

  return (
    <div className="space-y-4">
      {downloadError && (
        <p className="text-sm text-red-600">Download failed: {downloadError}</p>
      )}
      {groups.map((group) => (
        <section key={group.patientId} className="rounded border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-800">{group.patientDisplayName}</h3>
          <ul className="mt-2 divide-y divide-slate-200">
            {group.documents.map((doc) => {
              const isDownloading = downloadingId === doc.id;
              return (
                <li key={doc.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm text-slate-700">{doc.filename}</p>
                    <p className="text-xs text-slate-500">
                      {doc.mimeType} &middot; {formatBytes(doc.size)} &middot; {formatDate(doc.uploadedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDownload(doc.id, doc.filename)}
                    disabled={isDownloading}
                    className="rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isDownloading ? 'Downloading…' : 'Download'}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
