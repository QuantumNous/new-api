// Placeholder values for the provider payloads the tests replay. They are not credentials of any
// kind; they are named here once so the fixtures stay identical across suites.
export const STUB = {
  googleAccess: "placeholder-google-access",
  googleAccessRenewed: "placeholder-google-access-renewed",
  googleRefresh: "placeholder-google-refresh",
  googleRefreshRotated: "placeholder-google-refresh-rotated",
  slackBot: "placeholder-slack-bot",
  githubUser: "placeholder-github-user",
  githubInstallation: "placeholder-github-installation",
} as const;
