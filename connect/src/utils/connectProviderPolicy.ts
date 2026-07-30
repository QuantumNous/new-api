import type { Provider } from "@/types";

/**
 * Clients whose provider list BoxAI Connect curates. These are the ones it
 * seeds a BoxAI entry into, so showing the full upstream catalog beside it
 * would bury the entry the product exists to create.
 *
 * Must stay in step with `SUPPORTED_APPS` in
 * `src-tauri/src/boxai/provider_seed.rs`.
 */
const CURATED_APPS = new Set([
  "claude",
  "codex",
  "gemini",
  "grokbuild",
  "opencode",
  "openclaw",
  "hermes",
]);

/**
 * Within a curated client, Connect surfaces two kinds of providers:
 * - `official` — the client's built-in official login / empty shell
 * - BoxAI — the gateway-backed entry seeded after sign-in
 *
 * Everything else (BYOK, third-party presets, live imports, copies) is
 * upstream CC Switch surface that Connect deliberately does not expose.
 */
export function isConnectManagedProvider(provider: Provider): boolean {
  if (provider.id.startsWith("boxai-")) {
    return true;
  }
  return provider.category === "official";
}

/**
 * Filter a client's provider map for display.
 *
 * A client Connect does not curate keeps the full upstream surface. Filtering
 * it would hide the providers the user added by hand there and leave an empty
 * panel, since Connect seeds nothing into it.
 */
export function filterConnectProviders(
  providers: Record<string, Provider>,
  appId?: string,
): Record<string, Provider> {
  if (appId !== undefined && !CURATED_APPS.has(appId)) {
    return providers;
  }
  return Object.fromEntries(
    Object.entries(providers).filter(([, provider]) =>
      isConnectManagedProvider(provider),
    ),
  );
}
