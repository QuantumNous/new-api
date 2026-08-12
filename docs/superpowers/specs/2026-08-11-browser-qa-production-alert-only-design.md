# Browser QA Production Alert-Only Migration Design

## Goal

Move the verified staging Browser QA implementation onto the current `main` baseline and run it automatically after the production console deployment completes. Production Browser QA is alert-only: it sends the existing sanitized Chinese DingTalk report but never rolls back production and does not gate the already-completed deployment.

This phase deliberately does not solve or bypass Cloudflare Turnstile. The run may complete, report a product finding, or report that human verification blocked replay. All three outcomes are reporting outcomes, not deployment decisions.

## Current State

- `staging` contains the Browser QA workflow, runtime, cleanup, candidate promotion, UI/network fixed-case DSL, DingTalk notification, Terraform, and documentation.
- `main` does not yet contain `.github/workflows/gcp-browser-qa.yml` or `scripts/browser_qa/`.
- Production backend deployment is `.github/workflows/gcp-deploy.yml`.
- `deploy-console` and `deploy-router` are independently approved production jobs. The recorded onboarding path is owned by `newapi-console`, so the first production integration depends only on `deploy-console`.
- Production currently reports `turnstile_check=true`; the staging runtime currently rejects that state during preflight.

## Chosen Approach

Reuse the existing Browser QA cloud resources and parameterize the runtime target. Do not create a second Artifact Registry repository, broker, Cloud Run job set, service-account set, Gmail credential, identity seed, or report bucket in this phase.

The reusable workflow receives a trusted target profile:

- `staging`
  - website: `https://staging-website.flatkey.ai`
  - console: `https://staging-console.flatkey.ai`
  - docs: `https://docs.flatkey.ai`
- `production`
  - website: `https://flatkey.ai`
  - console: `https://console.flatkey.ai`
  - docs: `https://docs.flatkey.ai`

Callers pass only the profile name. They cannot pass arbitrary origins or hosts. The runtime resolves the exact allowlisted origins from that profile and rejects every other value.

## Main-Branch Port

Port the staging Browser QA changes onto a feature branch based on the latest `origin/main`, preserving current main changes. The expected source commits are:

1. `8856463d4` - restored Browser QA implementation and direct run traceability.
2. `582297c54` - rerun evidence isolation.
3. `dc9fb416a` - structured UI/network candidate and fixed-case support.
4. `44e08be60` - verified implementation and migration HTML documentation.

Resolve conflicts against current main rather than replacing current main files wholesale. Production wiring is implemented as a new commit after the port.

## Workflow Design

### Reusable Browser QA workflow

Add a required `target_environment` input with the closed values `staging` and `production`. Manual dispatch defaults to `staging`; reusable callers must pass it explicitly.

The workflow exports the selected profile to the main, cleanup, and candidate Cloud Run executions through execution-scoped environment overrides. Reusing a Cloud Run job must not mutate its persistent target origin between runs.

The existing GCS layout remains `runs/<github-run-id>/...`. GitHub run IDs are repository-wide unique. Every root/main/cleanup/candidate manifest and DingTalk summary additionally records the selected environment so staging and production evidence cannot be confused.

The existing DingTalk secrets are reused. No webhook or signing value is written to manifests, artifacts, summaries, or logs.

### Production caller

Add `browser-qa-production` to `.github/workflows/gcp-deploy.yml`:

- `needs: deploy-console`
- calls `./.github/workflows/gcp-browser-qa.yml`
- `target_environment: production`
- `mode: normal`
- `fail_on_findings: false`
- passes the existing Browser QA DingTalk secrets
- uses the same least-privilege permission ceiling already used by staging

The QA job starts only after the approved console deployment has completed. It does not depend on `deploy-router`, because router approval is independent and the onboarding replay targets the console. It does not modify deployment traffic and has no rollback permission.

If Browser QA reports findings, replay failure, Turnstile blockage, cleanup failure, or infrastructure failure, the DingTalk report is sent. The production revision remains deployed. As with the staging alert-only behavior, the QA job may be red for an actionable failure, but it is downstream of deployment and cannot undo or block that deployment.

The standalone website production workflow is intentionally out of scope for this phase.

## Runtime and Origin Safety

Replace staging-only origin constants with a closed environment-profile mapping. Keep the following invariants:

- exact HTTPS origins only;
- no caller-controlled arbitrary hostnames;
- website and console are writable only during the recorded replay and mandatory cleanup boundaries;
- docs remain read-only;
- no payment, subscription, invitation, administrator, global setting, real model call, or arbitrary external navigation;
- all test identities remain deterministic, run-scoped QA identities;
- cleanup remains independent of the browser agent.

The fixed-case DSL keeps logical origin identifiers and resolves them through the selected target profile. Existing staging fixed cases continue to work unchanged.

## Turnstile Behavior for This Phase

Production preflight accepts that Turnstile is enabled instead of classifying the environment as misconfigured. The browser is allowed to follow the normal recorded user path but is not allowed to bypass, forge, replay, outsource, or solve a challenge through a third-party service.

If the widget completes normally, replay continues. If it blocks automation, the supervisor emits a sanitized terminal classification such as `human_verification_blocked`, preserves available screenshot/console/network evidence, proceeds to independent cleanup when applicable, and sends the Chinese DingTalk report.

Turnstile tokens and verification details are sensitive and must remain excluded from logs, GCS manifests, GitHub summaries, artifacts, and DingTalk.

## Failure and Notification Semantics

- Deployment failures prevent the QA caller from starting.
- QA findings do not fail because `fail_on_findings=false`.
- Replay, cleanup, infrastructure, or human-verification blockage is reported through the existing terminal notification path.
- Notification runs for every trusted terminal status.
- Notification failure is visible in GitHub Actions but never triggers rollback.
- Production messages include the production label and a direct link to the exact GitHub Actions run.

## Tests

Add or update tests that prove:

1. `main` contains the full Browser QA implementation ported from staging.
2. The reusable workflow requires a closed `target_environment` input.
3. Staging caller passes `staging`; production caller passes `production`.
4. Production QA depends on `deploy-console`, uses `normal`, and sets `fail_on_findings=false`.
5. Production QA does not depend on `deploy-router`, gate traffic, or call rollback.
6. Staging and production origin profiles accept only their exact hosts.
7. Arbitrary origins, mixed profiles, HTTP origins, query strings, and fragments fail closed.
8. Turnstile enabled is accepted only for the production profile and can produce a sanitized `human_verification_blocked` result.
9. Environment appears in manifests and DingTalk summaries without leaking secrets.
10. Existing Python, Node, schema, workflow-contract, cleanup, candidate, and notification tests remain green.

## Rollback

The production integration is reversible without touching cloud infrastructure:

1. Remove the `browser-qa-production` caller job from `.github/workflows/gcp-deploy.yml`.
2. Leave the reusable workflow and staging integration intact.
3. Existing Browser QA resources and evidence remain available for staging and manual diagnosis.

No production traffic rollback, IAM removal, Secret mutation, or Terraform destroy is part of this feature rollback.

## Acceptance Criteria

- A `main` production console deployment automatically starts Browser QA after `deploy-console` succeeds.
- The production run uses only the exact production origins.
- The run sends a sanitized Chinese DingTalk message on success or failure with a direct run link.
- Findings are alert-only and never roll back production.
- Turnstile is not bypassed; a challenge may be reported as a controlled blocked result.
- The existing staging workflow continues to pass unchanged.
- All relevant automated tests pass before the branch is integrated.
