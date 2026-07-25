export interface Env {
  DB: D1Database;

  HUB_BASE_URL: string;
  BROKER_BASE_URL: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;

  // Per-provider OAuth apps. Absent credentials disable that provider with a 501 rather than
  // failing halfway through a consent the user already granted.
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  SLACK_CLIENT_ID?: string;
  SLACK_CLIENT_SECRET?: string;
  NOTION_CLIENT_ID?: string;
  NOTION_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_APP_ID?: string;
  GITHUB_APP_SLUG?: string;
  // PKCS#8 PEM. GitHub hands out PKCS#1 ("BEGIN RSA PRIVATE KEY"), which WebCrypto cannot
  // import: convert once with
  //   openssl pkcs8 -topk8 -nocrypt -in app.private-key.pem -out app.pkcs8.pem
  GITHUB_APP_PRIVATE_KEY?: string;
}
