interface DoctorProfileSummaryProps {
  specialization: string | null;
}

export function DoctorProfileSummary({ specialization }: DoctorProfileSummaryProps) {
  const display = specialization && specialization.length > 0 ? specialization : '—';
  return (
    <p className="text-sm text-slate-500">
      <span className="font-medium text-slate-600">Specialization:</span>{' '}
      <span>{display}</span>
    </p>
  );
}
