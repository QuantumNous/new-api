# Docs

This is the documentation of Base UI.

To start the docs site in development mode, from the project root, run:

```bash
pnpm start
```

If you do not have pnpm installed, select your OS and follow the instructions on the [pnpm website](https://pnpm.io/installation).

Package managers other than pnpm (like npm or Yarn) are not supported and don't work.

## How can I add a new demo to the documentation?

[You can follow this guide](../CONTRIBUTING.md)
on how to get started contributing to Base UI.

## Error code extraction

Errors in production are minified. They are extracted out of the source code by running the command

```bash
pnpm extract-error-codes
```

This updates the `./src/error-codes.json` file with the newly extracted errors.

Important: If you just altered the text of an error, you are allowed to update the existing error code with the new text in `./src/error-codes.json`, but only under the following conditions:

1. There hasn't been an update to the semantic meaning of the error message. Error codes need to outlive Base UI versions, so the same code must mean the same thing across versions.
2. There hasn't been a change in parameters, no added and no removed.

In both of those cases, always create a new error code lline in `./src/error-codes.json`.
