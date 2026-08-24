# BytePlus Seedance Channel Design

## Goal

Add a dedicated `BytePlus` channel type for the BytePlus Ark Seedance endpoint at
`https://ark.ap-southeast.bytepluses.com`. The channel must use Flatkey's shared
Seedance `content[]` API, always request the upstream moderation bypass described
by the supplier, and remain independently selectable and configurable in the
admin console.

## Selected Approach

Create a thin `relay/channel/task/byteplus` adapter around the existing Ark
Seedance implementation in `relay/channel/task/doubao`. The wrapper owns the
channel identity, model list, fixed moderation header, request dispatch, and
white-label result conversion. It delegates the compatible create-body mapping,
task submission response parsing, polling, billing lifecycle, and status parsing
to the existing implementation.

This avoids changing the behavior of existing `VolcEngine` and `DoubaoVideo`
channels and avoids duplicating the full Ark protocol implementation.

## Channel Identity and Configuration

- Go constant: `constant.ChannelTypeBytePlus = 107` (types `105` and `106` are
  already assigned on the current `main` branch).
- Admin label and channel name: `BytePlus`.
- Default base URL: `https://ark.ap-southeast.bytepluses.com`.
- Authentication: channel Key becomes `Authorization: Bearer <key>`.
- Client-facing models:
  - `seedance-2.0`
  - `seedance-2.0-fast`
  - `seedance-2.0-mini`
- Account-specific Ark endpoint IDs remain private channel configuration, not
  source code or committed documentation. Configure the channel with this
  mapping shape, replacing each placeholder with the endpoint ID from the
  supplier account:

  ```json
  {
    "seedance-2.0": "<configured-endpoint-id>",
    "seedance-2.0-fast": "<configured-fast-endpoint-id>",
    "seedance-2.0-mini": "<configured-mini-endpoint-id>"
  }
  ```

The API key from the supplied document must only be stored in the channel Key
field and must not be written to source, tests, logs, or documentation.

## Request Flow

1. The client submits `POST /v1/videos` using `dto.SeedanceVideoRequest` and the
   shared official Seedance `content[]` shape.
2. `taskcommon.BindSeedanceRequest` validates the request and stores the reusable
   parsed body.
3. Flatkey model mapping replaces the public model alias with the configured
   account-specific `ep-*` endpoint ID.
4. The BytePlus adapter reuses the existing Ark request-body mapping and sends
   `POST {baseURL}/api/v3/contents/generations/tasks`.
5. Every create request includes the server-controlled header
   `x-ark-moderation-scene: skip-ark-moderation`. Clients cannot disable or
   override this value.
6. Polling uses `GET {baseURL}/api/v3/contents/generations/tasks/{id}` and the
   existing Ark status mapping.

The moderation header applies to task creation. It is not added to polling GET
requests because polling does not submit content for moderation.

## White-Label Boundary

`BytePlus` is registered as a white-label task channel:

- Public task IDs remain Flatkey `task_*` IDs.
- Successful OpenAI video responses return the Flatkey content proxy URL from
  `task.GetResultURL()` rather than the upstream video URL.
- The video proxy resolves the real upstream URL from persisted Ark task data on
  the server.
- Upstream supplier names, hostnames, endpoint IDs, and branded error text are
  not returned to API clients.

The `BytePlus` name is visible only as an administrator-facing channel type.

## Admin Console

Add channel type `107` to the console's channel type constants and icon mapping.
The channel form must supply the BytePlus base URL by default while retaining the
normal editable Base URL, Key, Models, and Model Mapping fields.

No new public request format or new settings page is introduced.

## Testing

Use test-driven development for each behavior:

- Channel type `107` has the `BytePlus` name and default base URL.
- The task adapter factory selects the BytePlus adapter.
- The BytePlus create request always contains the fixed moderation-bypass header
  and normal Bearer authorization.
- The adapter exposes the three public model aliases.
- Model mapping sends the configured `ep-*` value upstream without hardcoding it.
- BytePlus is detected as an OpenAI video endpoint and a white-label task channel.
- Completed tasks expose the Flatkey proxy URL, not the upstream URL.
- The video proxy extracts the upstream URL server-side for download.
- Existing Doubao/VolcEngine tests continue to pass unchanged.

## Deployment and Operations

This changes relay routing and provider behavior, so production router deployment
is required. The console service must also be deployed because it serves the
updated channel-management frontend. No database migration, Terraform change,
Cloudflare change, or website deployment is required.

Before enabling production traffic, create the channel with the supplied API key,
base URL, models, and model mapping; then run one low-cost create -> poll ->
download smoke test. Do not commit the API key or include it in test fixtures.
