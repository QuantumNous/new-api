import { createFileRoute, redirect } from '@tanstack/react-router';
import { getAuth, getSignInUrl } from '@workos/authkit-tanstack-react-start';

export const Route = createFileRoute('/_authenticated')({
  loader: async ({ location }) => {
    // Loader runs on server (even during client-side navigation via RPC)
    const { user } = await getAuth();
    if (!user) {
      const path = location.pathname;
      const href = await getSignInUrl({ data: { returnPathname: path } });
      throw redirect({ href });
    }
  },
});
