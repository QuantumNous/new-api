package common

import (
	"encoding/json"

	appcommon "github.com/QuantumNous/new-api/common"
)

// RemoveLocalRequestFields removes gateway-only top-level fields while
// preserving all other passthrough JSON values verbatim.
func RemoveLocalRequestFields(data []byte, fields ...string) ([]byte, error) {
	var body map[string]json.RawMessage
	if err := appcommon.Unmarshal(data, &body); err != nil {
		return nil, err
	}

	changed := false
	for _, field := range fields {
		if _, ok := body[field]; ok {
			delete(body, field)
			changed = true
		}
	}
	if !changed {
		return data, nil
	}
	return appcommon.Marshal(body)
}
