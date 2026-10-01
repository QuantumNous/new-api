// rslint-disable
declare global {
  interface Window {
    optionalChainingTest: string;
    nullishCoalescingTest: string;
  }
}

// Test optional chaining and nullish coalescing
const user = { profile: { email: 'john@example.com' } };
const nullUser: typeof user | null = null;

// Basic tests
const email = user.profile?.email ?? 'No email';
// @ts-expect-error
const nullEmail = nullUser?.profile?.email ?? 'No email';
// @ts-expect-error
const nullValue = null ?? 'fallback';

// Set results on window for testing
window.optionalChainingTest = email;
window.nullishCoalescingTest = `${nullEmail}, ${nullValue}`;
