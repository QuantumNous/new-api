package openai

import (
	"encoding/json"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

var jimengZhizinanImageExtraFields = []string{
	"negative_prompt",
	"ratio",
	"resolution",
	"sample_strength",
	"filePath",
}

var jimengZhizinanImageEditExtraFields = []string{
	"negative_prompt",
	"sample_strength",
}

func convertJimengZhizinanImageRequest(request dto.ImageRequest) (map[string]json.RawMessage, error) {
	body := make(map[string]json.RawMessage, len(jimengZhizinanImageExtraFields)+3)
	if request.Model != "" {
		if err := putJimengZhizinanImageField(body, "model", request.Model); err != nil {
			return nil, err
		}
	}
	if err := putJimengZhizinanImageField(body, "prompt", request.Prompt); err != nil {
		return nil, err
	}
	if request.ResponseFormat != "" {
		if err := putJimengZhizinanImageField(body, "response_format", request.ResponseFormat); err != nil {
			return nil, err
		}
	}
	for _, field := range jimengZhizinanImageExtraFields {
		if value, ok := request.Extra[field]; ok && len(value) > 0 {
			body[field] = value
		}
	}
	return body, nil
}

func convertJimengZhizinanImageEditRequest(request dto.ImageRequest) (map[string]json.RawMessage, error) {
	body := make(map[string]json.RawMessage, len(jimengZhizinanImageEditExtraFields)+7)
	if request.Model != "" {
		if err := putJimengZhizinanImageField(body, "model", request.Model); err != nil {
			return nil, err
		}
	}
	if err := putJimengZhizinanImageField(body, "prompt", request.Prompt); err != nil {
		return nil, err
	}
	if len(request.Image) > 0 {
		body["image"] = request.Image
	}
	if request.Size != "" {
		if err := putJimengZhizinanImageField(body, "size", request.Size); err != nil {
			return nil, err
		}
	}
	if request.ResponseFormat != "" {
		if err := putJimengZhizinanImageField(body, "response_format", request.ResponseFormat); err != nil {
			return nil, err
		}
	}
	if request.N != nil {
		if err := putJimengZhizinanImageField(body, "n", request.N); err != nil {
			return nil, err
		}
	}
	for _, field := range jimengZhizinanImageEditExtraFields {
		if value, ok := request.Extra[field]; ok && len(value) > 0 {
			body[field] = value
		}
	}
	return body, nil
}

func putJimengZhizinanImageField(body map[string]json.RawMessage, field string, value any) error {
	raw, err := common.Marshal(value)
	if err != nil {
		return fmt.Errorf("marshal jimeng zhizinan image field %s: %w", field, err)
	}
	body[field] = raw
	return nil
}
