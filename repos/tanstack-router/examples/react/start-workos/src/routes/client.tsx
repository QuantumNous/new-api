import { Link, createFileRoute } from '@tanstack/react-router';
import { Badge, Box, Button, Callout, Code, Flex, Heading, Text, TextField } from '@radix-ui/themes';
import { useAccessToken, useAuth } from '@workos/authkit-tanstack-react-start/client';
import { useState } from 'react';

export const Route = createFileRoute('/client')({
  component: RouteComponent,
});

function RouteComponent() {
  const {
    user,
    loading,
    sessionId,
    organizationId,
    role,
    roles,
    permissions,
    entitlements,
    featureFlags,
    impersonator,
    signOut,
    switchToOrganization,
  } = useAuth();
  const { accessToken, loading: tokenLoading, error: tokenError, refresh, getAccessToken } = useAccessToken();

  const handleRefreshToken = async () => {
    try {
      await refresh();
    } catch (err) {
      console.error('Token refresh failed:', err);
    }
  };

  const handleGetFreshToken = async () => {
    try {
      const token = await getAccessToken();
      console.log('Fresh token:', token);
    } catch (err) {
      console.error('Get fresh token failed:', err);
    }
  };

  const handleClientSignOut = async () => {
    console.log('🧪 Testing client-side signOut() from useAuth()...');
    try {
      await signOut({ returnTo: '/' });
      console.log('✅ signOut() completed');
    } catch (err) {
      console.error('❌ signOut() failed:', err);
    }
  };

  const [orgIdInput, setOrgIdInput] = useState('');
  const [switchOrgResult, setSwitchOrgResult] = useState<string | null>(null);

  const handleSwitchOrg = async () => {
    if (!orgIdInput.trim()) {
      setSwitchOrgResult('Please enter an organization ID');
      return;
    }

    console.log(`🔄 Switching to organization: ${orgIdInput}...`);
    setSwitchOrgResult(null);

    try {
      const result = await switchToOrganization(orgIdInput.trim());
      if (result && 'error' in result) {
        console.error('❌ Switch failed:', result.error);
        setSwitchOrgResult(`Error: ${result.error}`);
      } else {
        console.log('✅ Successfully switched organizations');
        setSwitchOrgResult('✅ Success! Check updated claims above.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('❌ Switch error:', message);
      setSwitchOrgResult(`Error: ${message}`);
    }
  };

  if (loading) {
    return (
      <Flex direction="column" gap="2" align="center">
        <Heading size="8">Loading...</Heading>
      </Flex>
    );
  }

  if (!user) {
    return (
      <Flex direction="column" gap="4" align="center" maxWidth="600px">
        <Heading size="8" align="center">
          Client-Side Hooks Demo
        </Heading>
        <Text size="5" align="center" color="gray">
          This page demonstrates the client-side hooks from <Code>@workos/authkit-tanstack-start/client</Code>
        </Text>
        <Callout.Root>
          <Callout.Text>ℹ️ Please sign in to see the client-side hooks in action.</Callout.Text>
        </Callout.Root>
      </Flex>
    );
  }

  return (
    <Flex direction="column" gap="5" maxWidth="800px">
      <Flex direction="column" gap="2" mb="2">
        <Heading size="8" align="center">
          Client-Side Hooks Demo
        </Heading>
        <Text size="5" align="center" color="gray">
          Using <Code>useAuth()</Code> and <Code>useAccessToken()</Code>
        </Text>
      </Flex>

      <Callout.Root>
        <Callout.Text>
          ℹ️ This page uses client-side React hooks to access authentication data. Unlike server-side loaders, these
          hooks work in client components and automatically update when auth state changes.
        </Callout.Text>
      </Callout.Root>

      <Flex direction="column" gap="3">
        <Heading size="5">useAuth() Hook</Heading>
        <Flex direction="column" gap="2">
          <Flex align="center" gap="2">
            <Text weight="bold" style={{ width: 150 }}>
              User ID:
            </Text>
            <TextField.Root value={user.id} readOnly style={{ flexGrow: 1 }} />
          </Flex>
          <Flex align="center" gap="2">
            <Text weight="bold" style={{ width: 150 }}>
              Email:
            </Text>
            <TextField.Root value={user.email} readOnly style={{ flexGrow: 1 }} />
          </Flex>
          <Flex align="center" gap="2">
            <Text weight="bold" style={{ width: 150 }}>
              First Name:
            </Text>
            <TextField.Root value={user.firstName || ''} readOnly style={{ flexGrow: 1 }} />
          </Flex>
          <Flex align="center" gap="2">
            <Text weight="bold" style={{ width: 150 }}>
              Last Name:
            </Text>
            <TextField.Root value={user.lastName || ''} readOnly style={{ flexGrow: 1 }} />
          </Flex>
          <Flex align="center" gap="2">
            <Text weight="bold" style={{ width: 150 }}>
              Session ID:
            </Text>
            <TextField.Root value={sessionId || ''} readOnly style={{ flexGrow: 1 }} />
          </Flex>
          {organizationId && (
            <Flex align="center" gap="2">
              <Text weight="bold" style={{ width: 150 }}>
                Organization ID:
              </Text>
              <TextField.Root value={organizationId} readOnly style={{ flexGrow: 1 }} />
            </Flex>
          )}
          {role && (
            <Flex align="center" gap="2">
              <Text weight="bold" style={{ width: 150 }}>
                Role:
              </Text>
              <TextField.Root value={role} readOnly style={{ flexGrow: 1 }} />
            </Flex>
          )}
          {roles && roles.length > 0 && (
            <Flex align="center" gap="2">
              <Text weight="bold" style={{ width: 150 }}>
                Roles:
              </Text>
              <Flex gap="2" wrap="wrap" style={{ flexGrow: 1 }}>
                {roles.map((r) => (
                  <Badge key={r}>{r}</Badge>
                ))}
              </Flex>
            </Flex>
          )}
          {permissions && permissions.length > 0 && (
            <Flex align="center" gap="2">
              <Text weight="bold" style={{ width: 150 }}>
                Permissions:
              </Text>
              <Flex gap="2" wrap="wrap" style={{ flexGrow: 1 }}>
                {permissions.map((p) => (
                  <Badge key={p} color="blue">
                    {p}
                  </Badge>
                ))}
              </Flex>
            </Flex>
          )}
          {entitlements && entitlements.length > 0 && (
            <Flex align="center" gap="2">
              <Text weight="bold" style={{ width: 150 }}>
                Entitlements:
              </Text>
              <Flex gap="2" wrap="wrap" style={{ flexGrow: 1 }}>
                {entitlements.map((e) => (
                  <Badge key={e} color="green">
                    {e}
                  </Badge>
                ))}
              </Flex>
            </Flex>
          )}
          {featureFlags && featureFlags.length > 0 && (
            <Flex align="center" gap="2">
              <Text weight="bold" style={{ width: 150 }}>
                Feature Flags:
              </Text>
              <Flex gap="2" wrap="wrap" style={{ flexGrow: 1 }}>
                {featureFlags.map((f) => (
                  <Badge key={f} color="purple">
                    {f}
                  </Badge>
                ))}
              </Flex>
            </Flex>
          )}
          {impersonator && (
            <Flex align="center" gap="2">
              <Text weight="bold" style={{ width: 150 }}>
                Impersonator:
              </Text>
              <TextField.Root value={impersonator.email} readOnly style={{ flexGrow: 1 }} />
            </Flex>
          )}
        </Flex>
      </Flex>

      <Flex direction="column" gap="3">
        <Heading size="5">useAccessToken() Hook</Heading>
        <Flex direction="column" gap="2">
          <Flex align="center" gap="2">
            <Text weight="bold" style={{ width: 150 }}>
              Token Status:
            </Text>
            <Badge color={tokenLoading ? 'yellow' : accessToken ? 'green' : 'gray'}>
              {tokenLoading ? 'Loading' : accessToken ? 'Available' : 'None'}
            </Badge>
          </Flex>
          {tokenError && (
            <Flex align="center" gap="2">
              <Text weight="bold" style={{ width: 150 }}>
                Error:
              </Text>
              <Badge color="red">{tokenError.message}</Badge>
            </Flex>
          )}
          {accessToken && (
            <Flex align="center" gap="2">
              <Text weight="bold" style={{ width: 150 }}>
                Access Token:
              </Text>
              <Box style={{ flexGrow: 1, maxWidth: '100%', overflow: 'hidden' }}>
                <Code size="2" style={{ wordBreak: 'break-all', display: 'block' }}>
                  ...{accessToken.slice(-20)}
                </Code>
              </Box>
            </Flex>
          )}
          <Flex gap="2" mt="2">
            <Button onClick={handleRefreshToken} disabled={tokenLoading}>
              Refresh Token
            </Button>
            <Button onClick={handleGetFreshToken} disabled={tokenLoading} variant="soft">
              Get Fresh Token (Console)
            </Button>
          </Flex>
        </Flex>
      </Flex>

      <Flex direction="column" gap="3">
        <Heading size="5">Organization Management</Heading>
        <Text size="2" color="gray">
          Switch to a different organization. Requires multi-organization setup in WorkOS.
        </Text>
        <Callout.Root>
          <Callout.Text>
            <strong>Setup required:</strong> This feature requires your WorkOS user to be a member of multiple
            organizations. Create organizations in the WorkOS dashboard and add your user to them.
          </Callout.Text>
        </Callout.Root>
        <Flex direction="column" gap="2">
          <Flex align="center" gap="2">
            <Text weight="bold" style={{ width: 150 }}>
              Current Org:
            </Text>
            <Badge color={organizationId ? 'green' : 'gray'} size="2">
              {organizationId || 'None'}
            </Badge>
          </Flex>
          <Flex align="center" gap="2">
            <Text weight="bold" style={{ width: 150 }}>
              Switch to Org:
            </Text>
            <TextField.Root
              placeholder="org_..."
              value={orgIdInput}
              onChange={(e) => setOrgIdInput(e.target.value)}
              style={{ flexGrow: 1 }}
            />
            <Button onClick={handleSwitchOrg} disabled={!orgIdInput.trim()}>
              Switch
            </Button>
          </Flex>
          {switchOrgResult && (
            <Callout.Root color={switchOrgResult.startsWith('✅') ? 'green' : 'red'}>
              <Callout.Text>{switchOrgResult}</Callout.Text>
            </Callout.Root>
          )}
        </Flex>
      </Flex>

      <Flex direction="column" gap="3">
        <Heading size="5">Sign Out Methods</Heading>
        <Text size="2" color="gray">
          Test different sign out approaches. Check the browser console for logs.
        </Text>
        <Flex gap="2" wrap="wrap">
          <Button onClick={handleClientSignOut} color="red">
            Sign Out (Client-Side useAuth)
          </Button>
          <Button asChild color="red" variant="soft">
            <Link to="/logout" reloadDocument>
              Sign Out (Route Loader)
            </Link>
          </Button>
        </Flex>
        <Callout.Root color="blue">
          <Callout.Text>
            <strong>Client-Side useAuth:</strong> Calls <Code>signOut()</Code> from the provider context. This tests the
            redirect handling logic we just fixed.
            <br />
            <strong>Route Loader:</strong> Uses the <Code>/logout</Code> route which calls the server function directly
            in a loader.
          </Callout.Text>
        </Callout.Root>
      </Flex>
    </Flex>
  );
}
