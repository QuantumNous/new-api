# Playground Generated Image Download Design

## Goal

When an assistant response contains a complete supported base64 data-image, the Playground displays the image and provides a download action directly beneath that image.

## Interaction

- Render each complete PNG, JPEG, WebP, or GIF image as an inline preview.
- Place a right-aligned Download button immediately below each image.
- Give every image its own button so multiple generated images can be downloaded independently.
- Do not show a download button while a streamed data-image is incomplete; retain the existing loading state.
- Use the existing localized Download label and an accessible link name.

## Download Behavior

- Use the existing data URI directly as the download target instead of decoding it into another in-memory Blob.
- Generate deterministic filenames in response order: `generated-image-1.<extension>`, `generated-image-2.<extension>`, and so on.
- Derive the extension from the validated image MIME type. Normalize `image/jpeg` and `image/jpg` to `.jpg`.
- Keep the native image and download path restricted to the already supported raster MIME types.

## Code Boundaries

- Extend the parsed generated-image model in `message-utils.ts` with the derived download filename.
- Keep MIME validation and filename derivation in the parser so the React component only renders trusted output.
- Wrap each preview and its download action in a small image block inside `playground-chat.tsx`.
- Do not change backend responses, streaming transport, or general message actions.

## Error Handling

Unsupported or malformed data-image Markdown remains outside the native image/download path. Incomplete image Markdown stays hidden from the Markdown renderer until complete.

## Testing

- Add a failing parser test that requires a MIME-derived download filename before implementation.
- Cover sequential filenames for multiple images and JPEG extension normalization.
- Re-run all Playground tests, TypeScript type checking, targeted ESLint and Prettier checks, and the production frontend build.

## Acceptance Criteria

1. A supported complete base64 image appears in the Playground.
2. A localized Download button appears below that image.
3. Clicking the button downloads the exact data URI with a deterministic, MIME-correct filename.
4. Multiple images have independent buttons and sequential filenames.
5. An incomplete streamed image exposes neither base64 text nor a premature download action.
