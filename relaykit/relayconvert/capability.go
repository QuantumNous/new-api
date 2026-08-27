package relayconvert

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/ir"
	"github.com/QuantumNous/new-api/relaykit/ir/project"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/QuantumNous/new-api/relaykit/types"
)

// validateRequestCapabilities enforces protocol-level media capabilities before
// projection or upstream dispatch. Chat Completions has no portable PDF file
// part, so every request whose final native format is Chat is rejected when it
// contains a PDF, regardless of the target model or source protocol.
func validateRequestCapabilities(_ convmeta.Meta, from, target types.RelayFormat, request any) error {
	if target != types.RelayFormatOpenAI {
		return nil
	}
	irReq, err := project.FromRequest(from, request)
	if err != nil {
		return err
	}
	if !requestHasPDF(irReq) {
		return nil
	}
	const message = "the Chat Completions protocol does not support portable PDF file parts; use the Responses, Claude, or Gemini native protocol instead"
	return types.NewError(
		fmt.Errorf("capability_unsupported: %s", message),
		types.ErrorCodeCapabilityUnsupported,
		types.ErrOptionWithStatusCode(http.StatusBadRequest),
		types.ErrOptionWithSkipRetry(),
	)
}

func requestHasPDF(req *ir.Request) bool {
	if req == nil {
		return false
	}
	for _, message := range req.Messages {
		for _, block := range message.Blocks {
			if blockHasPDF(block) {
				return true
			}
		}
	}
	return false
}

func blockHasPDF(block ir.Block) bool {
	if block.Media != nil {
		if strings.EqualFold(strings.TrimSpace(strings.SplitN(block.Media.MIME, ";", 2)[0]), "application/pdf") ||
			strings.HasSuffix(strings.ToLower(strings.TrimSpace(block.Media.Filename)), ".pdf") ||
			strings.HasSuffix(strings.ToLower(strings.SplitN(strings.TrimSpace(block.Media.URL), "?", 2)[0]), ".pdf") {
			return true
		}
	}
	if block.ToolResult != nil {
		for _, nested := range block.ToolResult.Blocks {
			if blockHasPDF(nested) {
				return true
			}
		}
	}
	return false
}
