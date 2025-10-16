# Bug Report

## Missing Embedded Front-End Bundle Breaks Builds

### Summary
Running `go test ./...` fails immediately because the Go build cannot find any files matching the `//go:embed web/dist` directive in [`main.go`](../main.go). The repository does not contain a built `web/dist` directory, so the embed directive has no files to include and compilation aborts during test collection.

### Steps to Reproduce
1. Ensure no `web/dist` directory exists (which is the default state of the repository).
2. Execute `go test ./...` from the project root.

### Observed Behavior
The build stops with the error:

```
main.go:33:12: pattern web/dist: no matching files found
```

### Expected Behavior
Tests and builds should succeed (or at least start running) without requiring contributors to pre-build the front-end bundle. The Go binary should degrade gracefully when the static assets have not been generated yet, for example by embedding a placeholder bundle or deferring static file serving until after a build step has been run.

### Suggested Fixes
- Commit a minimal placeholder `web/dist` directory so the embed directive always matches files; or
- Adjust the application to skip embedding when the bundle is absent and serve a clear error page instead; or
- Document the mandatory front-end build step in the contribution guidelines and automate it in the CI pipeline.

Addressing this issue will allow `go test` to run successfully and make the developer onboarding experience smoother.
