<!-- Parent: ../AGENTS.md -->

# relay/channel/task/hailuo_v2

## Purpose

International MiniMax H3 V2 asynchronous video adaptor. It accepts the H3
`content[]` request, submits to `/v2/video_generation`, polls
`/v2/query/video_generation/{task_id}`, and settles per-call billing from the
persisted upstream usage response.

## Rules

- Keep this protocol isolated from the legacy `hailuo` V1 adaptor.
- Validate only after model mapping on the normal relay path and accept only
  the mapped upstream model `MiniMax-H3`.
- Never return the upstream task ID to clients; creation responses use the
  pre-generated public task ID.
- Treat incomplete successful poll responses as retryable protocol errors.
- Completion billing must use the persisted billing snapshot and `task.Data`;
  do not depend on process-local state or mutable channel configuration.
- JSON operations use `common.*`; optional scalar wire fields use pointers.

## Verification

Run `go test ./relay/channel/task/hailuo_v2/...` and
`go build ./relay/channel/task/hailuo_v2/...`.
