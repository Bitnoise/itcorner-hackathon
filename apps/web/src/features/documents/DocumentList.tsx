import { useState } from 'react';
import type { DocumentItem } from './use-documents';
import { SharingPanel } from './SharingPanel';

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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading documents...</p>;
  }

  if (documents.length === 0) {
    return <p className="text-sm text-slate-500">No documents uploaded yet.</p>;
  }

  return (
    <ul className="divide-y divide-slate-200">
      {documents.map((doc) => {
        const isExpanded = expandedId === doc.id;
        return (
          <li key={doc.id} className="py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">{doc.filename}</p>
                <p className="text-xs text-slate-500">
                  {doc.mimeType} &middot; {formatBytes(doc.size)} &middot; {formatDate(doc.uploadedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : doc.id)}
                className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
              >
                {isExpanded ? 'Hide sharing' : 'Manage sharing'}
              </button>
            </div>
            {isExpanded && (
              <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
                <SharingPanel documentId={doc.id} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
