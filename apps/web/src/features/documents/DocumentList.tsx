import type { DocumentItem } from './use-documents';

interface DocumentListProps {
  documents: DocumentItem[];
  isLoading?: boolean;
}

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
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DocumentList({ documents, isLoading }: DocumentListProps) {
  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading documents...</p>;
  }

  if (documents.length === 0) {
    return <p className="text-sm text-slate-500">No documents uploaded yet.</p>;
  }

  return (
    <ul className="divide-y divide-slate-200">
      {documents.map((doc) => (
        <li key={doc.id} className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-slate-800">{doc.filename}</p>
            <p className="text-xs text-slate-500">
              {doc.mimeType} &middot; {formatBytes(doc.size)} &middot; {formatDate(doc.uploadedAt)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
