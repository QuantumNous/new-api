/**
 * Shared sanitization module for new-api scripts.
 *
 * Provides best-effort redaction of sensitive values in text content.
 * Used by inject-key.js (--scan mode) and exec-token.js (output sanitization).
 */

const SENSITIVE_KEYWORDS = [
  "password", "passwd", "secret", "token", "credential",
  "apikey", "api_key", "api-key", "api_secret",
  "auth", "auth_token", "authorization",
  "private_key", "private-key", "privatekey",
  "access_key", "access-key", "accesskey",
  "client_secret", "client-secret",
];

const SENSITIVE_PATTERN = new RegExp(
  "(" + SENSITIVE_KEYWORDS.join("|") + ")",
  "i"
);

function sanitize(content) {
  // Rule 1: sk- prefixed tokens
  let result = content.replace(/sk-[A-Za-z0-9_\-]{4,}/g, "sk-<REDACTED>");

  // Rule 2: Bearer tokens
  result = result.replace(/Bearer\s+[A-Za-z0-9_.\-\/+=]{4,}/g, "Bearer <REDACTED>");

  // Rule 3: Credentials in connection strings (user:pass@host pattern)
  result = result.replace(
    /[A-Za-z0-9_.\-]+:[A-Za-z0-9_.\-]+@[^\s]+/g,
    "<REDACTED>"
  );

  // Rule 4: Values of sensitive-named fields (line-by-line)
  result = result
    .split("\n")
    .map((line) => {
      // JSON: "key": "value"  or  "key": "value",
      const jsonMatch = line.match(
        /^(\s*"([^"]+)"\s*:\s*)"([^"]*)"(.*)$/
      );
      if (jsonMatch) {
        const [, prefix, key, , suffix] = jsonMatch;
        if (SENSITIVE_PATTERN.test(key)) {
          return `${prefix}"<REDACTED>"${suffix}`;
        }
        return line;
      }

      // YAML: key: value  (unquoted or quoted)
      const yamlMatch = line.match(
        /^(\s*([\w.\-]+)\s*:\s*)(.+)$/
      );
      if (yamlMatch) {
        const [, prefix, key, value] = yamlMatch;
        if (SENSITIVE_PATTERN.test(key) && value.trim() !== "" && value.trim() !== "|" && value.trim() !== ">") {
          return `${prefix}<REDACTED>`;
        }
        return line;
      }

      // ENV / TOML: KEY=value  or  KEY = "value"
      const envMatch = line.match(
        /^(\s*([\w.\-]+)\s*=\s*)(.+)$/
      );
      if (envMatch) {
        const [, prefix, key] = envMatch;
        if (SENSITIVE_PATTERN.test(key)) {
          return `${prefix}<REDACTED>`;
        }
        return line;
      }

      return line;
    })
    .join("\n");

  return result;
}

module.exports = { sanitize, SENSITIVE_KEYWORDS, SENSITIVE_PATTERN };
