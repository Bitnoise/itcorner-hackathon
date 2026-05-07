import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AppNav } from './AppNav';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
  useRouterState: () => ({ location: { pathname: '/' } }),
}));

describe('AppNav', () => {
  const noop = () => {};

  describe('patient role', () => {
    it('renders the MedBridge brand', () => {
      render(<AppNav role="patient" userName="Anna" onLogout={noop} />);
      expect(screen.getByText('MedBridge')).toBeInTheDocument();
    });

    it('renders Dashboard link to /patient', () => {
      render(<AppNav role="patient" userName="Anna" onLogout={noop} />);
      const link = screen.getByRole('link', { name: 'Dashboard' });
      expect(link).toHaveAttribute('href', '/patient');
    });

    it('renders My Documents link to /patient/documents', () => {
      render(<AppNav role="patient" userName="Anna" onLogout={noop} />);
      const link = screen.getByRole('link', { name: 'My Documents' });
      expect(link).toHaveAttribute('href', '/patient/documents');
    });

    it('does not render doctor-only links', () => {
      render(<AppNav role="patient" userName="Anna" onLogout={noop} />);
      expect(screen.queryByRole('link', { name: 'My Schedule' })).not.toBeInTheDocument();
    });

    it('shows the user name', () => {
      render(<AppNav role="patient" userName="Anna" onLogout={noop} />);
      expect(screen.getByText('Anna')).toBeInTheDocument();
    });

    it('renders a logout button', () => {
      render(<AppNav role="patient" userName="Anna" onLogout={noop} />);
      expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
    });
  });

  describe('doctor role', () => {
    it('renders Dashboard link to /doctor', () => {
      render(<AppNav role="doctor" userName="Ben" onLogout={noop} />);
      const link = screen.getByRole('link', { name: 'Dashboard' });
      expect(link).toHaveAttribute('href', '/doctor');
    });

    it('renders My Schedule link to /doctor/schedule', () => {
      render(<AppNav role="doctor" userName="Ben" onLogout={noop} />);
      const link = screen.getByRole('link', { name: 'My Schedule' });
      expect(link).toHaveAttribute('href', '/doctor/schedule');
    });

    it('does not render patient-only links', () => {
      render(<AppNav role="doctor" userName="Ben" onLogout={noop} />);
      expect(screen.queryByRole('link', { name: 'My Documents' })).not.toBeInTheDocument();
    });
  });
});
