package dto

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/types"
)

// SystemOneRequest is a TypeSafe System One decision request, as served by
// decision models on Ollama (POST /v1/systemone). State and questions stay
// raw because decision backends read the state object as written; forwarding
// the raw messages preserves the client's member order.
type SystemOneRequest struct {
	Model     string          `json:"model"`
	State     json.RawMessage `json:"state,omitempty"`
	Questions json.RawMessage `json:"questions,omitempty"`
	Images    []string        `json:"images,omitempty"`
	KeepAlive string          `json:"keep_alive,omitempty"`
	// The decision endpoint returns a single JSON object; stream is kept only
	// so an explicit client request produces a clear validation error.
	Stream *bool `json:"stream,omitempty"`
}

func (r *SystemOneRequest) IsStream(c *http.Request) bool {
	return false
}

func (r *SystemOneRequest) GetTokenCountMeta() *types.TokenCountMeta {
	texts := make([]string, 0, 2)
	if len(r.State) > 0 {
		texts = append(texts, string(r.State))
	}
	if len(r.Questions) > 0 {
		texts = append(texts, string(r.Questions))
	}
	return &types.TokenCountMeta{
		CombineText: strings.Join(texts, "\n"),
	}
}

func (r *SystemOneRequest) SetModelName(modelName string) {
	if modelName != "" {
		r.Model = modelName
	}
}

// SystemOneResponse carries only what the gateway needs from the upstream
// answer; the body itself is forwarded to the client verbatim.
type SystemOneResponse struct {
	Usage struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
}
