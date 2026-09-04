package openai

import (
	"encoding/json"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

// mergeImageRequestExtra flattens the unknown fields captured in
// ImageRequest.Extra back into the outbound JSON body. OpenRouter's
// /v1/images endpoint accepts params outside the OpenAI image schema
// (aspect_ratio, resolution, seed, input_references, provider), which
// the generic ImageRequest serialization drops. Known fields always
// win over Extra entries with the same key.
func mergeImageRequestExtra(request dto.ImageRequest) (map[string]json.RawMessage, error) {
	base, err := common.Marshal(request)
	if err != nil {
		return nil, err
	}
	var bodyMap map[string]json.RawMessage
	if err := common.Unmarshal(base, &bodyMap); err != nil {
		return nil, err
	}
	for k, v := range request.Extra {
		if _, exists := bodyMap[k]; !exists {
			bodyMap[k] = v
		}
	}
	return bodyMap, nil
}
