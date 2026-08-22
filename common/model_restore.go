package common

import (
	"bytes"
	"strings"

	"github.com/QuantumNous/new-api/constant"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

type modelRestorePair struct {
	Origin   string
	Upstream string
}

// restoreModelJSONPaths lists model-carrying fields across the OpenAI chat,
// OpenAI Responses, Claude messages, Gemini and image/task response shapes.
var restoreModelJSONPaths = []string{
	"model",
	"message.model",
	"response.model",
	"modelVersion",
}

var modelFieldMarker = []byte(`"model`)

// SetModelRestore records the client-facing model name so the response writers
// can rewrite the upstream model name back before the payload reaches the
// client. Recording is skipped when the mapping did not actually rename.
func SetModelRestore(c *gin.Context, originModelName string, upstreamModelName string) {
	if c == nil {
		return
	}
	origin := strings.TrimSpace(originModelName)
	upstream := strings.TrimSpace(upstreamModelName)
	if origin == "" || origin == upstream {
		ClearModelRestore(c)
		return
	}
	SetContextKey(c, constant.ContextKeyModelRestore, modelRestorePair{Origin: origin, Upstream: upstream})
}

// ClearModelRestore drops a recorded rename, used when a retry lands on a
// channel that has no model mapping for this request.
func ClearModelRestore(c *gin.Context) {
	if c == nil {
		return
	}
	SetContextKey(c, constant.ContextKeyModelRestore, modelRestorePair{})
}

func getModelRestore(c *gin.Context) (modelRestorePair, bool) {
	if c == nil {
		return modelRestorePair{}, false
	}
	pair, ok := GetContextKeyType[modelRestorePair](c, constant.ContextKeyModelRestore)
	if !ok || pair.Origin == "" {
		return modelRestorePair{}, false
	}
	return pair, true
}

// RestoreModelName maps an upstream model name back to the name the client
// asked for. Variants of the mapped name are restored as well, covering both
// directions an adaptor may rewrite it: a dated snapshot the provider appends
// ("deepseek-v4-flash-2026-08-01") and a suffix an adaptor strips before the
// request goes out ("deepseek-v4-flash" for a mapped "deepseek-v4-flash-thinking").
func RestoreModelName(c *gin.Context, model string) string {
	pair, ok := getModelRestore(c)
	if !ok || model == "" || model == pair.Origin {
		return model
	}
	if pair.Upstream == "" || model == pair.Upstream ||
		strings.HasPrefix(model, pair.Upstream+"-") || strings.HasPrefix(pair.Upstream, model+"-") {
		return pair.Origin
	}
	return model
}

// RestoreModelNameInJSON rewrites every model-carrying field of a serialized
// response body. The payload is returned untouched when no rename is pending or
// when it carries no recognizable model field.
func RestoreModelNameInJSON(c *gin.Context, body []byte) []byte {
	if _, ok := getModelRestore(c); !ok || len(body) == 0 {
		return body
	}
	// Every model-carrying path below contains "model", so a payload without it
	// can skip the JSON scan entirely.
	if !bytes.Contains(body, modelFieldMarker) {
		return body
	}
	for _, path := range restoreModelJSONPaths {
		result := gjson.GetBytes(body, path)
		if !result.Exists() || result.Type != gjson.String {
			continue
		}
		restored := RestoreModelName(c, result.String())
		if restored == result.String() {
			continue
		}
		patched, err := sjson.SetBytes(body, path, restored)
		if err != nil {
			continue
		}
		body = patched
	}
	return body
}

// RestoreModelNameInString is the string flavor used by the SSE writers that
// forward raw upstream chunks.
func RestoreModelNameInString(c *gin.Context, body string) string {
	if _, ok := getModelRestore(c); !ok || body == "" {
		return body
	}
	if !strings.Contains(body, string(modelFieldMarker)) {
		return body
	}
	return string(RestoreModelNameInJSON(c, []byte(body)))
}
