import { Button, Flex } from '@radix-ui/themes';
import { Link } from '@tanstack/react-router';
import type { User } from '@workos/authkit-tanstack-react-start';

export default function SignInButton({ large, user, url }: { large?: boolean; user: User | null; url: string }) {
  if (user) {
    return (
      <Flex gap="3">
        <Button asChild size={large ? '3' : '2'}>
          <Link to="/logout" reloadDocument>
            Sign Out
          </Link>
        </Button>
      </Flex>
    );
  }

  return (
    <Button asChild size={large ? '3' : '2'}>
      <a href={url}>Sign In{large && ' with AuthKit'}</a>
    </Button>
  );
}
