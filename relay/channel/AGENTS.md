# relay/channel/ — Provider Adapters

## Overview
40+ provider packages implementing the Adaptor interface.

## Structure
Each provider is a Go package:
- `adaptor.go` — Implements Adaptor interface
- `constants.go` — Provider constants
- `dto.go` — Provider-specific DTOs
- `relay-<name>.go` — Main conversion logic

Task adaptors (async video/music) live in `relay/channel/task/`.

## Where to Look
| Task | Location |
|---|---|
| Largest providers | `openai/`, `gemini/`, `claude/`, `volcengine/` |
| Task adaptors | `task/suno/`, `task/kling/`, `task/sora/`, etc. |

## Conventions
- Adaptor interface: Init, GetRequestURL, SetupRequestHeader, ConvertOpenAIRequest, ConvertRerankRequest, ConvertEmbeddingRequest, ConvertAudioRequest, ConvertImageRequest, ConvertOpenAIResponsesRequest, DoRequest, DoResponse, GetModelList, GetChannelName, ConvertClaudeRequest, ConvertGeminiRequest
- Register new provider in `relay/relay_adaptor.go` factory
- Use `relay/channel/api_request.go` for HTTP execution

## Anti-Patterns
- Do NOT leave "TODO implement me" stubs in production code.
- Do NOT implement custom HTTP clients — use `api_request.go`.
- Do NOT forget StreamOptions (Rule 4).
