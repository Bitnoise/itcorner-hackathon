import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DoctorProfileSummary } from './DoctorProfileSummary';

describe('DoctorProfileSummary', () => {
  it('renders the specialization label and value when specialization is set', () => {
    render(<DoctorProfileSummary specialization="Cardiology" />);
    expect(screen.getByText(/specialization/i)).toBeInTheDocument();
    expect(screen.getByText('Cardiology')).toBeInTheDocument();
  });

  it('renders an em-dash when specialization is null', () => {
    render(<DoctorProfileSummary specialization={null} />);
    expect(screen.getByText(/specialization/i)).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders an em-dash when specialization is an empty string', () => {
    render(<DoctorProfileSummary specialization="" />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
