import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { rootRoute } from './routes/__root';
import { indexRoute } from './routes/index';
import { loginRoute } from './routes/login';
import { patientRoute } from './routes/patient';
import { patientDocumentsRoute } from './routes/patient/documents';
import { doctorRoute } from './routes/doctor';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 30_000,
    },
  },
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  patientRoute,
  patientDocumentsRoute,
  doctorRoute,
]);

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  context: { queryClient },
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Missing #root element in index.html');
}

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
