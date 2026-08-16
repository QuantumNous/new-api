package origin

import (
	"bytes"
	"errors"

	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

func RewriteResponsesModel(body []byte, upstreamModel string) ([]byte, error) {
	trimmed := bytes.TrimSpace(body)
	if len(trimmed) == 0 || trimmed[0] != '{' || !gjson.ValidBytes(trimmed) || !upstreamModelPattern.MatchString(upstreamModel) {
		return nil, errors.New("invalid Origin Responses request")
	}
	document := gjson.ParseBytes(trimmed)
	modelCount := 0
	document.ForEach(func(key, _ gjson.Result) bool {
		if key.String() == "model" {
			modelCount++
		}
		return true
	})
	if modelCount != 1 {
		return nil, errors.New("Origin Responses request must contain exactly one model")
	}
	model := document.Get("model")
	if !model.Exists() || model.Type != gjson.String || model.String() == "" {
		return nil, errors.New("Origin Responses model must be a non-empty string")
	}
	rewritten, err := sjson.SetBytes(trimmed, "model", upstreamModel)
	if err != nil {
		return nil, errors.New("replace Origin Responses model")
	}
	return rewritten, nil
}
