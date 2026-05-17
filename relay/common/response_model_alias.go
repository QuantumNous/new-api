package common

import (
	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

// GetCallerModelName returns the model name that should be shown to the API caller.
// Priority: Gin context "original_model" -> info.OriginModelName -> info.UpstreamModelName.
func GetCallerModelName(c *gin.Context, info *RelayInfo) string {
	if c != nil {
		if v := c.GetString(string(constant.ContextKeyOriginalModel)); v != "" {
			return v
		}
	}
	if info != nil && info.OriginModelName != "" {
		return info.OriginModelName
	}
	if info != nil {
		return info.UpstreamModelName
	}
	return ""
}

// PatchTopLevelModelRaw rewrites the top-level "model" field in a raw JSON payload.
// Returns (patched data, whether a change was made, error).
func PatchTopLevelModelRaw(data []byte, callerModel string) ([]byte, bool, error) {
	if len(data) == 0 || callerModel == "" {
		return data, false, nil
	}

	existing := gjson.GetBytes(data, "model")
	if !existing.Exists() || existing.String() == callerModel {
		return data, false, nil
	}

	patched, err := sjson.SetBytes(data, "model", callerModel)
	if err != nil {
		return data, false, err
	}
	return patched, true, nil
}

// PatchResponsesEventModelRaw rewrites response.model in a Responses API SSE event payload.
// It applies to any event that contains a response.model field, regardless of event type.
// Returns (patched data, whether a change was made, error).
func PatchResponsesEventModelRaw(data []byte, callerModel string) ([]byte, bool, error) {
	if len(data) == 0 || callerModel == "" {
		return data, false, nil
	}

	existing := gjson.GetBytes(data, "response.model")
	if !existing.Exists() || existing.String() == callerModel {
		return data, false, nil
	}

	patched, err := sjson.SetBytes(data, "response.model", callerModel)
	if err != nil {
		return data, false, err
	}
	return patched, true, nil
}

const responseBodyRewrittenKey = "response_body_rewritten"

// MarkResponseBodyRewritten sets a context flag indicating the response body was modified.
func MarkResponseBodyRewritten(c *gin.Context) {
	if c != nil {
		c.Set(responseBodyRewrittenKey, true)
	}
}

// IsResponseBodyRewritten returns true if the response body was rewritten.
func IsResponseBodyRewritten(c *gin.Context) bool {
	if c == nil {
		return false
	}
	v, _ := c.Get(responseBodyRewrittenKey)
	b, ok := v.(bool)
	return ok && b
}
