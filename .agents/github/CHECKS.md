# Agent issue and PR checks

Do every check for your case before you fill `.agents/github/ISSUE.md` or `.agents/github/PR.md`. If one check fails, tell the user and stop. Do not file a partial issue or open a partial PR. Do not fill gaps with speculation.

## Out of scope

If the request matches an item below, tell the user this repository does not accept it. Point them to the right place when there is one. Do not file or open.

- Coding Plan
- Reverse-engineered channels
- Third-party API wrappers
- Codex channel-type changes, or compatibility from exposing a Codex endpoint as a general-purpose API through a reverse proxy
- Codex API-specific protocol or behavior treated as standard OpenAI API behavior (confirm with the channel or API provider)
- Pass-through-only forwarding (pass-through sends content as-is and does not go through new-api processing logic)
- Relay reports that only paste an upstream error, with no direct-upstream vs new-api comparison
- Third-party hosting sites, relay services, or API services (contact their operator)

## Usage, configuration, or integration

Search https://docs.newapi.ai/ , https://deepwiki.com/QuantumNous/new-api , the README, and the code yourself. Do not send the user to "read the docs first". If the material answers the request, answer the user and do not file or open. For a feature request, confirm that the current version cannot already do it.

## Required facts

Get these facts for a bug issue, and for a PR that fixes a bug:

- Actual behavior, expected result, steps to reproduce
- Impact and frequency
- new-api version / commit / image tag (not `latest` / `unknown`), deploy source, database
- Evidence that the problem is in new-api rather than the client or upstream
- Every applicable type below

If a fact is missing, ask the user for that fact and wait. Ask for the facts themselves. Do not tell the user to confirm a template, tick checkboxes, or acknowledge the guidelines.

Type facts (write the applicable ones in Evidence):

- Relay / API: endpoint and method, channel type, model, conversion format, pass-through enabled, evidence of upstream native support, the equivalent redacted request sent directly upstream and the same request through new-api (status, body, server logs for each)
- Billing: endpoint and model, response `usage`, ratio or pricing configuration, consumption log, expected charge and calculation basis
- Frontend: page path, browser and version, active theme, Console / Network errors
- Deployment / upgrade: deployment method, OS and architecture, database type, versions before and after, startup or migration logs
- Feature: description, use case, why the current version cannot do it

## Issue only

- Search issues, PRs, and discussions for duplicates. Do not file a duplicate.
- A large or directional feature issue is for maintainer alignment. Do not open a PR yet.

## PR only

- New features need a linked issue. If none exists, file one first with `.agents/github/ISSUE.md`.
- Large or directional changes need maintainer agreement on that issue before the PR.
- Evidence is commands or steps actually run and the observed results. Stating only that `go build` or tests passed is not proof.
- One focused change. No secrets.

## Writing

Write the body as a briefing for a maintainer who did not see the conversation. The maintainer reads it in under a minute. Give a little context first, then the facts.

### Sections

- Agent line: fill every field. Write "unknown" for a value the runtime does not expose. Do not guess a model id.
- Request summary: 1 to 4 sentences on what the user asked the agent to do and later constraints. Keep the user's intent and limits. Add nothing the user did not state.
- Summary: if the change alters a flow, a call chain, a state, a file layout, or a data path, show it as a diagram. Text alone is for a change with no shape, such as one constant or one typo. Pick the smallest view that makes the point clear, and put a short sentence next to it:

  | Change | View |
  | --- | --- |
  | Control flow or logic | pseudocode, or a `diff` of the pseudocode |
  | Call chain | call tree, or a `diff` of the call tree |
  | Requests between client, new-api, and upstream | Mermaid `sequenceDiagram` |
  | Lifecycle or status (task, channel, token) | Mermaid `stateDiagram-v2` |
  | Branching decision (routing, retry, billing path) | Mermaid `flowchart` |
  | File or module layout | shallow file tree, or a `diff` of the tree |
  | Frontend structure | component tree with the state and module boundaries that matter |

  Use a `diff` block when the surrounding shape already exists and the point is what changes. Show only the calls, files, and states that the reviewer needs. One or two views are enough. Keep one diagram to about 8 nodes or lines; split a larger flow into two views, or move detail into the text.

  ```diff
   relay.TextHelper
     ConvertRequest
  +  applyStreamOptions
     DoRequest
  ```

  ```mermaid
  sequenceDiagram
      Client->>new-api: POST /v1/chat/completions
      new-api->>Upstream: converted request
      Upstream-->>new-api: stream
      new-api-->>Client: stream with usage
  ```
- Evidence: show before and after. Screenshots for visual changes, then command output and test runs. Link long logs; do not paste them.
- Merge Danger: a two-way door is cheap to roll back. A one-way door is not (data migration, destructive action, public contract change). Blast Radius is the scope of possible impact (relay, billing, quota, auth, database, frontend, deployment, consumers).
- Keep every heading in the template. If a section does not apply, write why.

### Sentences

- One instruction or one fact per sentence. Split sentences longer than about 25 words.
- Say who does what, in active voice and present tense: "the relay drops `stream_options`", not "`stream_options` is dropped".
- Put the condition before the action: "If pass-through is on, the relay skips conversion."
- Give each word one meaning, and call each thing by one name. Use the new-api terms from `docs/translation-glossary.md`.
- Write the real symbol, file, flag, endpoint, or command in code font, not a description of it.
- Keep "only" and "not" next to the word they change. Make every "it", "this", and "they" point at one thing; repeat the noun when in doubt.
- Write whole sentences with articles and verbs. Spell out arrows and abbreviations.
- State the mechanism or the number: "a column rename fails the build", not "schema changes can cause issues". If a sentence fits any other project unchanged, cut it.

### Words

- Use the plain word: "use", not "utilize" or "leverage"; "help", not "facilitate"; "is" or "has", not "serves as" or "features".
- Cut filler and hedging: "in order to" becomes "to"; delete "it is important to note that"; "could potentially" becomes "may".
- Cut AI vocabulary: additionally, crucial, delve, enhance, robust, seamless, pivotal, showcase, underscore, comprehensive.
- Cut "not just X, but Y", forced groups of three, "-ing" tails ("ensuring...", "highlighting..."), and generic conclusions.
- Use no em dashes, no decorative emojis, no bold label that repeats its line, no chatbot phrases.

Write facts only. Do not paste unfiltered AI-generated text, speculation, or an implementation plan in the body or in later comments. Repeated submissions may result in a block.
