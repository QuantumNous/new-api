import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

// Tests run inside workerd against a real (in-memory) D1, so SQL, bindings and the WebCrypto
// paths behave the way they will in production instead of the way a mock was written.
export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          bindings: {
            HUB_BASE_URL: "https://hub.test",
            BROKER_BASE_URL: "https://broker.test",
            JWT_ISSUER: "https://hub.test",
            JWT_AUDIENCE: "https://hub.test/desktop",
            GOOGLE_CLIENT_ID: "google-client",
            GOOGLE_CLIENT_SECRET: "google-secret",
            SLACK_CLIENT_ID: "slack-client",
            SLACK_CLIENT_SECRET: "slack-secret",
            GITHUB_APP_ID: "12345",
            GITHUB_APP_SLUG: "boxai-agent",
          },
        },
      },
    },
  },
});
