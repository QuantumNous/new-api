package attemptlog

// This file is the only place that depends on the relay layer. It converts a
// RelayInfo into this package's primitive inputs, so the classifier and the
// record builder stay testable without constructing relay state.

import (
	"time"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
)

// RelayInfoView is the subset of *relaycommon.RelayInfo this package reads.
// Declaring it as an interface avoids importing relay/common, which keeps the
// dependency pointing one way and lets tests supply a fake.
type RelayInfoView interface {
	GetEstimatePromptTokens() int
	GetSendResponseCount() int
	HasSendResponse() bool
}

// FeaturesFrom builds the per-request feature set.
//
// meta may be nil: when both token counting and sensitive-word checking are
// disabled the relay layer skips building CombineText to avoid a large
// allocation, so character counts are simply absent rather than wrong.
//
// c is the gin context, used to read the raw request body for byte-exact
// prefix hashing. It may be nil in tests, in which case prefix hashes and
// task_type_guess are left empty.
func FeaturesFrom(
	c *gin.Context,
	requestId string,
	tenantId int,
	tokenId int,
	relayFormat types.RelayFormat,
	requestPath string,
	modelName string,
	estimatePromptTokens int,
	isStream bool,
	meta *types.TokenCountMeta,
	request dto.Request,
) RequestFeatures {
	features := RequestFeatures{
		RequestId:      requestId,
		TenantId:       tenantId,
		TokenId:        tokenId,
		RelayFormat:    string(relayFormat),
		RequestPath:    requestPath,
		ModelName:      modelName,
		InputTokensEst: estimatePromptTokens,
		IsStream:       isStream,
	}

	if meta != nil {
		features.Chars = CountChars(meta.CombineText)
		features.ToolsCount = meta.ToolsCount
		if meta.MaxTokens > 0 {
			maxTokens := meta.MaxTokens
			features.MaxTokensReq = &maxTokens
		}
	}

	features.Temperature = temperatureOf(request)

	// Gemini's GetTokenCountMeta does not populate ToolsCount, so fall back to
	// inspecting the request directly rather than reporting a false zero.
	if count, ok := toolsCountOf(request); ok && count > features.ToolsCount {
		features.ToolsCount = count
	}
	features.HasTools = features.ToolsCount > 0

	// PR2: byte-exact prefix hashes and task type guess. Read the raw body
	// once and feed it to both extractors.
	if c != nil {
		body := RawBodyBytes(c)
		prefixes := ComputePrefixHashes(body, relayFormat)
		features.PrefixHashSystem = prefixes.System
		features.PrefixHashTools = prefixes.Tools
		features.PrefixHashPrefix = prefixes.Prefix
		features.TaskTypeGuess = GuessTaskType(LastUserText(body, relayFormat))
	} else {
		features.TaskTypeGuess = GuessTaskType("")
	}
	features.TaskTypeGuessVer = TaskTypeGuessVersion

	return features
}

func temperatureOf(request dto.Request) *float64 {
	switch r := request.(type) {
	case *dto.GeneralOpenAIRequest:
		return r.Temperature
	case *dto.ClaudeRequest:
		return r.Temperature
	case *dto.GeminiChatRequest:
		return r.GenerationConfig.Temperature
	case *dto.OpenAIResponsesRequest:
		return r.Temperature
	default:
		return nil
	}
}

// toolsCountOf reports the number of tool definitions in the request. The second
// return value distinguishes "no tools" from "this request shape carries tools
// in a form we do not count".
func toolsCountOf(request dto.Request) (int, bool) {
	switch r := request.(type) {
	case *dto.GeneralOpenAIRequest:
		return len(r.Tools), true
	case *dto.ClaudeRequest:
		return len(r.GetTools()), true
	case *dto.GeminiChatRequest:
		// Gemini nests declarations inside an opaque tools payload, so presence
		// is all we can assert without parsing it.
		if len(r.Tools) > 0 && string(r.Tools) != "[]" && string(r.Tools) != "null" {
			return 1, true
		}
		return 0, true
	case *dto.OpenAIResponsesRequest:
		if len(r.Tools) > 0 && string(r.Tools) != "[]" && string(r.Tools) != "null" {
			return 1, true
		}
		return 0, true
	default:
		return 0, false
	}
}

// FirstTokenTimeOf resolves the relay layer's first-response timestamp.
//
// RelayInfo initializes FirstResponseTime to one second before the request
// start so that HasSendResponse can act as a sentinel. Callers must not read the
// raw field: this returns nil when the sentinel never fired, which is what
// distinguishes "no response" from "response at time zero".
//
// The relay layer stamps this on the first chunk of any shape, including role
// openers and pings, so it is a fallback rather than the TTFT measurement. It is
// also never reset between retries. resolveFirstTokenTime handles both caveats.
func FirstTokenTimeOf(info RelayInfoView, firstResponseTime time.Time) *time.Time {
	if info == nil || !info.HasSendResponse() {
		return nil
	}
	t := firstResponseTime
	return &t
}
