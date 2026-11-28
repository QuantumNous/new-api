import { createFileRoute } from '@tanstack/react-router';
import { Box, Flex, Heading, Text, TextField } from '@radix-ui/themes';
import { getAuth } from '@workos/authkit-tanstack-react-start';

export const Route = createFileRoute('/_authenticated/account')({
  component: RouteComponent,
  loader: async () => {
    const auth = await getAuth();

    const userFields: Array<[label: string, value: string | undefined]> = [
      ['First name', auth.user?.firstName ?? ''],
      ['Last name', auth.user?.lastName ?? ''],
      ['Email', auth.user?.email],
      ['Id', auth.user?.id],
    ];

    if (auth.user && 'role' in auth && auth.role) {
      userFields.push(['Role', auth.role]);
    }

    if (auth.user && 'permissions' in auth && auth.permissions) {
      userFields.push(['Permissions', auth.permissions.join(', ')]);
    }

    return userFields;
  },
});

function RouteComponent() {
  const userFields = Route.useLoaderData();
  return (
    <>
      <Flex direction="column" gap="2" mb="7">
        <Heading size="8" align="center">
          Account details
        </Heading>
        <Text size="5" align="center" color="gray">
          Below are your account details
        </Text>
      </Flex>

      {userFields && (
        <Flex direction="column" justify="center" gap="3" width="400px">
          {userFields.map(([label, value]) => (
            <Flex asChild align="center" gap="6" key={String(value)}>
              <label>
                <Text weight="bold" size="3" style={{ width: 100 }}>
                  {label}
                </Text>

                <Box flexGrow="1">
                  <TextField.Root value={String(value) || ''} readOnly />
                </Box>
              </label>
            </Flex>
          ))}
        </Flex>
      )}
    </>
  );
}
