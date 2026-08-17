package origin

import (
	"bytes"
	"errors"
	"fmt"

	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

func RewriteResponsesModel(body []byte, upstreamModel string) ([]byte, error) {
	return rewriteRequestModel(body, upstreamModel, "Responses")
}

func RewriteMessagesModel(body []byte, upstreamModel string) ([]byte, error) {
	return rewriteRequestModel(body, upstreamModel, "Messages")
}

func RewriteMessagesResponseModel(body []byte, platformModel string) ([]byte, error) {
	trimmed := bytes.TrimSpace(body)
	if len(trimmed) == 0 || trimmed[0] != '{' || !gjson.ValidBytes(trimmed) || !upstreamModelPattern.MatchString(platformModel) {
		return nil, errors.New("invalid Origin Messages response")
	}
	document := gjson.ParseBytes(trimmed)
	path := "model"
	model := document.Get(path)
	nestedModel := document.Get("message.model")
	if model.Exists() && nestedModel.Exists() {
		return nil, errors.New("Origin Messages response contains conflicting model fields")
	}
	if !model.Exists() {
		path = "message.model"
		model = nestedModel
	}
	if !model.Exists() || model.Type != gjson.String || model.String() == "" {
		return nil, errors.New("Origin Messages response model must be a non-empty string")
	}
	rewritten, err := sjson.SetBytes(trimmed, path, platformModel)
	if err != nil {
		return nil, errors.New("replace Origin Messages response model")
	}
	return rewritten, nil
}

func rewriteRequestModel(body []byte, upstreamModel, protocol string) ([]byte, error) {
	trimmed := bytes.TrimSpace(body)
	if len(trimmed) == 0 || trimmed[0] != '{' || !gjson.ValidBytes(trimmed) || !upstreamModelPattern.MatchString(upstreamModel) {
		return nil, fmt.Errorf("invalid Origin %s request", protocol)
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
		return nil, fmt.Errorf("Origin %s request must contain exactly one model", protocol)
	}
	model := document.Get("model")
	if !model.Exists() || model.Type != gjson.String || model.String() == "" {
		return nil, fmt.Errorf("Origin %s model must be a non-empty string", protocol)
	}
	rewritten, err := sjson.SetBytes(trimmed, "model", upstreamModel)
	if err != nil {
		return nil, fmt.Errorf("replace Origin %s model", protocol)
	}
	return rewritten, nil
}
