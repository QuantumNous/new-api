package helper

import (
	"bytes"
	"encoding/json"

	"github.com/QuantumNous/new-api/common"
)

func SanitizeClaudeCountTokensRequestBody(body []byte) []byte {
	if len(bytes.TrimSpace(body)) == 0 {
		return body
	}
	var payload map[string]json.RawMessage
	if err := common.Unmarshal(body, &payload); err != nil {
		return body
	}
	changed := false
	for _, field := range []string{"temperature", "top_p", "top_k", "stream", "stop_sequences", "stop"} {
		if _, ok := payload[field]; ok {
			delete(payload, field)
			changed = true
		}
	}
	if !changed {
		return body
	}
	next, err := common.Marshal(payload)
	if err != nil {
		return body
	}
	return next
}
