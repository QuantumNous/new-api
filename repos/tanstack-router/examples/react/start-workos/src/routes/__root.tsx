import { Box, Button, Card, Container, Flex, Theme } from '@radix-ui/themes';
import { HeadContent, Link, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { Suspense } from 'react';
import { getSignInUrl } from '@workos/authkit-tanstack-react-start';
import { AuthKitProvider, getAuthAction } from '@workos/authkit-tanstack-react-start/client';
import Footer from '../components/footer';
import SignInButton from '../components/sign-in-button';
import appCssUrl from '../app.css?url';
import type { ReactNode } from 'react';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'AuthKit Example in TanStack Start',
      },
    ],
    links: [{ rel: 'stylesheet', href: appCssUrl }],
  }),
  loader: async () => {
    // getAuthAction() returns auth state without accessToken, safe for client
    // Pass to AuthKitProvider as initialAuth to avoid loading flicker
    const auth = await getAuthAction();
    const url = await getSignInUrl();
    return {
      auth,
      url,
    };
  },
  component: RootComponent,
  notFoundComponent: () => <div>Not Found</div>,
});

function RootComponent() {
  const { auth, url } = Route.useLoaderData();
  return (
    <RootDocument>
      <AuthKitProvider initialAuth={auth}>
        <Theme accentColor="iris" panelBackground="solid" style={{ backgroundColor: 'var(--gray-1)' }}>
          <Container style={{ backgroundColor: 'var(--gray-1)' }}>
            <Flex direction="column" gap="5" p="5" height="100vh">
              <Box asChild flexGrow="1">
                <Card size="4">
                  <Flex direction="column" height="100%">
                    <Flex asChild justify="between">
                      <header>
                        <Flex gap="4">
                          <Button asChild variant="soft">
                            <Link to="/">Home</Link>
                          </Button>

                          <Button asChild variant="soft">
                            <Link to="/account">Account</Link>
                          </Button>

                          <Button asChild variant="soft">
                            <Link to="/client">Client Demo</Link>
                          </Button>
                        </Flex>

                        <Suspense fallback={<div>Loading...</div>}>
                          <SignInButton user={auth.user} url={url} />
                        </Suspense>
                      </header>
                    </Flex>

                    <Flex flexGrow="1" align="center" justify="center">
                      <main>
                        <Outlet />
                      </main>
                    </Flex>
                  </Flex>
                </Card>
              </Box>
              <Footer />
            </Flex>
          </Container>
        </Theme>
        <TanStackRouterDevtools position="bottom-right" />
      </AuthKitProvider>
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
