/**
 * Static platform-detection flags, evaluated once at module load. SSR-safe —
 * every flag is `false` when `navigator` is undefined.
 *
 * Scope is intentionally limited to traits that don't change at runtime (OS,
 * rendering engine, environment). Dynamic capabilities like input modality
 * (pointer/touch/hover) belong in a separate feature-detection layer because
 * they can change mid-session (e.g. plugging in a mouse).
 *
 * Import as a namespace and pick the most precise group for the quirk:
 *
 * ```ts
 * import { platform } from '@base-ui/utils/platform';
 * if (platform.os.mac) { ... }
 * if (platform.engine.webkit) { ... }
 * ```
 *
 * Each category is its own module under `./platform/*`, so unused namespaces
 * tree-shake away.
 *
 *   - `os.*` for OS-specific behavior (keyboard shortcuts, native menus).
 *   - `engine.*` for rendering-engine bugs (CSS, layout, focus).
 *   - `screenReader.*` for AT-specific accessibility workarounds.
 *   - `env.*` for test-environment gating.
 */

export * as platform from './parts';
