import { withSentryConfig } from '@sentry/nextjs';

export default withSentryConfig(
  {},
  {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    // Only print logs for uploading source maps in CI
    silent: !process.env.CI,

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,
  },
);
