# NewAPI Video Test Page Design

## Goal

Create a standalone frontend test page outside the `new-api` product UI that can directly call `new-api` video APIs with a `new-api` API key.

This page is for fast local or intranet testing of:

- HappyHorse text-to-video
- HappyHorse image-to-video
- HappyHorse reference-to-video
- HappyHorse video edit
- Kling text-to-video
- Kling first-frame image-to-video
- Kling first-last-frame image-to-video
- Kling reference-to-video
- Kling video edit

## Non-Goals

- No integration into the existing `web/classic` or `web/default` apps
- No user/account system
- No server-side storage
- No direct Alibaba OpenAPI calls
- No long-term production hardening

## Recommended Shape

Create a small standalone frontend project in a separate directory, for example:

`C:\Users\shaoq\Desktop\newapi-video-test`

The page will talk to `new-api` only through:

- `POST /v1/videos`
- `GET /v1/videos/:task_id`

Authentication:

- `Authorization: Bearer <new-api-key>`

## Page Structure

One single-page app with four sections:

### 1. Connection

Fields:

- Base URL
- API Key
- Default model
- Remember config in `localStorage`

### 2. Presets

Quick presets for:

- HappyHorse text
- HappyHorse first-frame
- HappyHorse reference
- HappyHorse video edit
- Kling text
- Kling first-frame
- Kling first-last-frame
- Kling reference
- Kling video edit

Selecting a preset should prefill the form with the expected model and field shape.

### 3. Request Builder

Two synchronized views:

- Form view
- Raw JSON view

Form fields should cover the most common inputs:

- `model`
- `prompt`
- `duration`
- `ratio`
- `images`
- `videos`
- `resolution` for HappyHorse
- `mode` for Kling
- `audio` for Kling

Advanced request details should be editable in raw JSON or metadata fields:

- `metadata`
- `multi_shot`
- `multi_prompt`
- `element_list`

### 4. Result Panel

Show:

- Final submitted JSON
- Submit response
- `task_id`
- Poll button
- Latest task status
- Full fetch response
- Video preview when URL is available

## Data Flow

1. User fills Base URL and API Key
2. User chooses a preset
3. User edits form or raw JSON
4. Frontend generates request body
5. Frontend sends request to `POST /v1/videos`
6. Frontend extracts `task_id`
7. Frontend polls `GET /v1/videos/:task_id`
8. Frontend renders status and preview

## Error Handling

The page should clearly show:

- network errors
- non-2xx API responses
- malformed JSON
- missing required fields
- polling failures

Do not silently swallow request errors.

## Security Tradeoff

This page is intentionally temporary and local-first.

Accepted tradeoffs:

- API key stored in `localStorage` if user enables remember
- no backend proxy
- no secret masking beyond basic password-style input

The page should include a visible warning that it is for local/internal testing only.

## Technical Recommendation

Use a very small standalone frontend stack:

- Vite
- React
- plain CSS

Reason:

- fastest to build and run
- easy local preview
- enough structure for form state and polling

## Verification

Minimum validation after implementation:

- submit a HappyHorse text-to-video request
- submit a Kling text-to-video request
- poll a known `task_id`
- verify result panel renders returned JSON
- verify preview renders when fetch response contains a usable video URL

## Recommendation Summary

Build a standalone single-page frontend outside the `new-api` product UI, using a `new-api` key to call `POST /v1/videos` and `GET /v1/videos/:task_id`, with preset-driven forms for HappyHorse and Kling plus raw JSON editing for advanced fields.
