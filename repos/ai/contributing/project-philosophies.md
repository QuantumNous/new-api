# Project Philosophies

## Core Architecture

- **Unified provider interface (adapter pattern).** Keep a layered architecture (Specifications → Utilities → Providers → Core) that enables a single, consistent API across many AI providers.
  - This is our central architecture backbone and the heart of what the AI SDK is.
  - It also enables community providers to be developed independently in 3rd party packages.

- **Keep the building blocks separated.** Building blocks beyond the provider abstraction layer must be cleanly architected and not entangled with it.
  - Critical for tree shaking and agentic development.
  - Enforcing architectural boundaries reduces complexity and the potential for side effects.

- **Lean, focused mission.** Keep the AI SDK centered on its core mission: the provider abstraction layer, plus directly associated building blocks on top (e.g. the UI chatbot protocol).
  - Be conservative about adding entirely new building blocks. Any such feature needs to be carefully evaluated with the team.
  - The better solution often is to create a separate project built on top of the AI SDK.

## API Design

- **Stability and backward compatibility first.** Changes must remain backward compatible — never change the signature of existing public functions. The only exception is a new AI SDK major release.
  - Even in a major version, breaking changes should have a good justification.
  - If keeping a public API unchanged would result in inferior or painful DX, making the breaking change is absolutely right — it just must happen as part of a new major release.

- **Be extremely cautious with `@ai-sdk/provider`.** This package contains the spec. Treat any spec changes as potentially breaking.
  - Ideally, `@ai-sdk/provider` changes are only made in alignment with a new AI SDK major release.

- **Conservative API surface.** Keep provider option schemas as restrictive as possible to preserve flexibility for future changes.
  - Keep response schemas minimal (no unused properties).
  - Keep schemas flexible enough to handle provider API changes without unnecessary breakages.
  - Use minimal package exports, especially from the `@ai-sdk/provider` package, which is responsible for the spec. Usage of the TypeScript primitives `Params` and `ReturnType` is encouraged in consuming code over having direct exports of the underlying types.

- **Beware premature abstraction.** Provider APIs evolve quickly. Avoid adding generic parameters or abstractions that translate differently across providers.
  - Follow the rule of 3: wait until at least 3 providers have implemented the same concept before generalizing, to ensure the abstraction is solid.
  - When unsure or provider-specific, prefer `providerOptions`.
  - There can be significant pressure to abstract based on one provider. Resist it.

- **Use `Experimental_` prefixes to explore new features outside of major releases.** When a new feature needs to be explored outside of a major release cycle, use code structures explicitly marked as experimental (e.g. `Experimental_*` prefix for types, `experimental_*` prefix for functions). This allows iteration without committing to a stable API contract.
  - It is acceptable for `@ai-sdk/provider` to export `Experimental_*` types for this purpose. These types may have breaking changes outside of major releases.
  - Non-experimental types must NEVER include references to experimental types (e.g., do not add a reference to something like `Experimental_VideoModelV4` to `ProviderV4`).
  - Experimental features must remain fully isolated until they are promoted to stable.
  - Adding a new experimental feature requires broad consensus between the maintainers. Use it with caution. Do not use experimental code as a way out when you're unsure about stability.
  - Confine the prefix to the import and export seams: declare symbols with their unprefixed names and apply the `Experimental_*` / `experimental_*` alias only where they cross a package boundary. See `naming-conventions.md` for the exact pattern.

- **Clear, accurate naming.** When in doubt, prefer longer, more explicit names that are unambiguous and correct (e.g. `.languageModel(id)` over `.chat(id)`).
  - Optimize for clarity for both developers and coding agents, not brevity.

## Developer & Agent Experience

- **Build with developers _and_ agents in mind.** Consistent APIs, development patterns, and naming conventions are key.
  - Monitor common agent hallucinations encountered when using agents to write AI SDK code.
  - Agent hallucinations can be worth considering as a suggestion to make the API work the way the agent expected it in the first place.

- **DX through consistency.** Consistent naming conventions and development patterns improve developer experience.
  - Normalized conventions are extremely critical for coding agents — document them in `AGENTS.md`.
  - This matters especially across provider implementations that are technically decoupled.
