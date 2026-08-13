# ModelAPI Seedance 201 Created Hotfix Design

## Problem

ModelAPI accepts `POST /v1/tasks` with HTTP `201 Created`. The shared async-task relay accepts only HTTP `200 OK` before invoking the provider adaptor's `DoResponse`, so a successful ModelAPI task is rejected, the public task is not persisted, and the customer receives `fail_to_fetch_task` even though the upstream video is generated.

Production evidence from 2026-08-11 shows channel 145 returning HTTP 201 for `doubao-seedance-2-5-260628`. Flatkey refunded the `$0.56` pre-consume and wrote only an error log, while the upstream task completed.

## Options

1. Accept every 2xx response in the shared task relay. This is broad and could change the contract for every asynchronous provider.
2. Normalize `201 Created` to `200 OK` inside the ModelAPI Seedance adaptor. This follows the existing provider-local `202 -> 200` pattern and has the smallest blast radius.
3. Add a shared provider-specific success-status policy. This is more flexible but unnecessary for the incident and increases hotfix risk.

## Decision

Use option 2. `TaskAdaptor.DoRequest` will rewrite only HTTP 201 to HTTP 200 before returning to the shared relay. HTTP 200 remains unchanged; 4xx and 5xx responses remain errors. No public response schema, billing formula, channel configuration, asset behavior, or polling behavior changes.

## Validation

- Add a unit test that returns HTTP 201 from an in-process upstream server and asserts that `DoRequest` returns HTTP 200 with the original body intact.
- Assert that HTTP 500 is not normalized.
- Run the ModelAPI Seedance package tests, async-task relay tests, formatting, vet/build checks, and review the final diff.
- Do not submit another paid production generation during hotfix validation; production verification is limited to deployment health and zero-cost checks.

## Deployment

Router deploy is required because the change affects `/v1/videos` provider relay behavior. Console, website, Terraform, database migrations, and runtime configuration are not involved. The behavior is request-local and has no multi-node coordination requirement.
