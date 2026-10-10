# Naming Conventions

## Variable and Identifier Names

Prefer descriptive, unabbreviated names for variables, parameters, and identifiers. Optimize for clarity for both developers and coding agents, not for brevity (see also `project-philosophies.md`).

- Avoid single-letter variables (`e`, `x`, `i`, `t`, …). Use `error`, `event`, `index`, `text`, etc. The one common exception is short-lived loop counters in trivial numeric loops.
- Avoid ad-hoc abbreviations (`msg`, `req`, `res`, `cfg`, `opts`, `tmp`). Spell them out: `message`, `request`, `response`, `config`, `options`, `temporary`.
- Acronyms that are already terms of art are fine (`url`, `id`, `json`, `http`).
- Match the surrounding naming in the file or package. If a module consistently uses a longer name for a concept, don't introduce a shorter alias.

## Stream Event and Part Type Names

Hyphenated type names (used in stream events, message parts, and UI message chunks) follow a **noun-verb** (subject-action) pattern:

```
<noun>-<action>
```

Examples:

- `text-start`, `text-delta`, `text-end`
- `reasoning-start`, `reasoning-delta`, `reasoning-end`
- `tool-input-start`, `tool-input-delta`, `tool-input-end`
- `stream-start`
- `tool-call`, `tool-result`, `tool-error`
- `source-url`, `source-document`
- `response-metadata`, `message-metadata`

The noun describes **what** the event is about, and the verb/action describes **what happened**.

Do **not** use verb-first names like `start-step` or `finish-step`. Use `step-start` and `step-end` instead.

### Preferred verbs

For streaming lifecycle events, use these verbs consistently:

| Verb    | Meaning                            | Example                          |
| ------- | ---------------------------------- | -------------------------------- |
| `start` | Beginning of a stream or section   | `text-start`, `reasoning-start`  |
| `delta` | Incremental update within a stream | `text-delta`, `tool-input-delta` |
| `end`   | End of a stream or section         | `text-end`, `reasoning-end`      |

Use `end` (not `finish`, `stop`, or `complete`) for the final event in a lifecycle.

For non-lifecycle events, use the most specific verb that applies:

| Verb        | Meaning                              | Example                                         |
| ----------- | ------------------------------------ | ----------------------------------------------- |
| `available` | Data is ready for consumption        | `tool-input-available`, `tool-output-available` |
| `error`     | An error occurred                    | `tool-input-error`, `tool-output-error`         |
| `request`   | A request for action (e.g. approval) | `tool-approval-request`                         |
| `response`  | A response to a request              | `tool-approval-response`                        |
| `denied`    | A request was rejected               | `tool-output-denied`                            |

> **Note:** There are existing violations of these conventions (`start-step` and `finish-step` in UI message stream chunks). These should be migrated to `step-start` and `step-end` when possible.

## Experimental Prefixes

New features that are explored outside of a major release cycle are marked as experimental using prefixes: `Experimental_*` for types and classes, `experimental_*` for functions and values. See `project-philosophies.md` for when to introduce an experimental feature.

**For exported experimental symbols, keep the experimental prefix at the import and export seams only.** Declare the symbol with its plain, unprefixed name and apply the prefix as an _alias_ where the symbol crosses a package boundary:

- In the package that owns the feature, name every declaration without the prefix and add the `Experimental_*` / `experimental_*` alias only in the public export (typically the package's `index.ts`).
- In packages that consume the feature, import the prefixed symbol under its unprefixed alias and use the unprefixed name throughout the file.

```ts
// realtime-session.ts — declare with the plain name
export abstract class AbstractRealtimeSession {
  /* … */
}

// index.ts — apply the prefix only at the export seam
export { AbstractRealtimeSession as Experimental_AbstractRealtimeSession } from './realtime-session';
```

```ts
// consumer.ts — import under the unprefixed alias, then use the plain name
import { Experimental_AbstractRealtimeSession as AbstractRealtimeSession } from 'ai';

class RealtimeStore extends AbstractRealtimeSession {
  /* … */
}
```

Why this matters:

- **Smaller diff when promoting to stable.** Removing the prefix only touches the export and import lines, not every reference throughout the implementation.
- **Harder to leak unprefixed.** Because the public surface is a single, explicit list of aliases, a new experimental symbol can't accidentally be exported without its prefix.
- **Implementation reads cleanly.** Internal code stays free of prefixes, so it reads the same way it will once the feature is stable.
