# relay/ — AI Provider Relay

## Overview
HTTP proxy layer routing requests to 40+ upstream AI providers with format conversion.

## Structure
```
relay/
├── channel/         # Provider adapters
│   ├── adapter.go   # Interface
│   ├── api_request.go
│   └── <provider>/  # Per-provider package
├── common/          # RelayInfo, request_conversion.go, override.go
├── helper/          # Stream helpers
├── relay_adaptor.go # Factory GetAdaptor()
└── relay-text.go, relay-audio.go, ...  # Format handlers
```

## Where to Look
| Task | Location |
|---|---|
| Add provider | `relay/channel/<name>/` |
| Request format | `relay/common/request_conversion.go` |
| Stream handling | `relay/common/relay_info.go` |
| Factory | `relay/relay_adaptor.go:GetAdaptor()` |

## Conventions
- Each provider = separate Go package (`relay/channel/<name>/`)
- Files: `adaptor.go` (interface impl), `constants.go`, `dto.go`, `relay-<name>.go`
- Register new adaptor in `relay/relay_adaptor.go:GetAdaptor()`
- RelayInfo tracks `RequestConversionChain []types.RelayFormat`

## Anti-Patterns
- Do NOT add provider without implementing all Adaptor methods.
- Do NOT forget StreamOptions check (Rule 4).
