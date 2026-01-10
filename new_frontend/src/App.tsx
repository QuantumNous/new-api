import { Suspense } from 'react';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { LoadingPage } from '@/components/atoms/Loading';
import { router } from '@/router';

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="new-api-theme">
      <Suspense fallback={<LoadingPage />}>
        <RouterProvider router={router} />
      </Suspense>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;
