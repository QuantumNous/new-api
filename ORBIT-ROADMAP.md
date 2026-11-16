# BEU Developer Orbit roadmap

Phase 0 establishes cloud tooling, Git remotes, repeatable setup, and an honest validation baseline. It does not implement the features below.

| Future work | Preparation and acceptance criteria |
| --- | --- |
| Phase 1: identity and landing page | Review existing frontend components, i18n, and settings first. Add Orbit identity and community messaging while preserving upstream branding, attribution, and license notices. Validate navigation, accessibility, and private cloud previews. |
| Student verification | Define eligibility, verification provider, manual review, expiry, minimal data retention, and abuse controls before implementation. Reuse existing account flows and follow the repository's authentication security requirements. |
| API quota policies | Define free allowances, resets, per-user limits, abuse handling, and concurrency rules. Read upstream billing conventions before modifying quota logic; verify accounting and supported databases. |
| Sponsorship requests | Decide application fields, review workflow, consent, and notification rules. Keep sponsorship requests separate from provider credentials and account permissions. |
| Transactional emails | Choose a mail service and domain later. Design templates, retries, sender verification, delivery logs, and secrets configuration; never send live mail from development tests. |
| OmniRoute integration | Confirm the exact OmniRoute project, supported API contract, license, and responsibility boundary before choosing an integration. Test compatibility with fixtures or mocks before using real providers. |

Each feature should use a separate branch and PR into the Orbit fork, with acceptance criteria and relevant tests. Preserve New API behavior through small, reviewable changes. Oracle deployment and AI inference hosting remain outside this plan until separately requested. No PR merges without owner approval.
