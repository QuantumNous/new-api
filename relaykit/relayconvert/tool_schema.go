package relayconvert

import (
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/internal/toolconv"
)

// SanitizeChatRequestTools drops invalid null "required" members from the tool
// schemas of a Chat Completions request, in place. Routes that forward a
// request without protocol conversion never reach ConvertRequest, so callers on
// those routes use this to get the same repair.
func SanitizeChatRequestTools(request *dto.GeneralOpenAIRequest) {
	toolconv.SanitizeChatRequestTools(request)
}

// SanitizeResponsesRequestTools is the Responses counterpart of
// SanitizeChatRequestTools.
func SanitizeResponsesRequestTools(request *dto.OpenAIResponsesRequest) {
	toolconv.SanitizeResponsesRequestTools(request)
}
