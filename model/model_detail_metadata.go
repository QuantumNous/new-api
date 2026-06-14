package model

import (
	"database/sql/driver"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

type JSONTextList []string

func (j JSONTextList) Value() (driver.Value, error) {
	if len(j) == 0 {
		return "", nil
	}
	b, err := common.Marshal([]string(j))
	if err != nil {
		return nil, err
	}
	return string(b), nil
}

func (j *JSONTextList) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}

	var raw string
	switch v := value.(type) {
	case []byte:
		raw = string(v)
	case string:
		raw = v
	default:
		return fmt.Errorf("unsupported JSONTextList type: %T", value)
	}

	raw = strings.TrimSpace(raw)
	if raw == "" {
		*j = nil
		return nil
	}

	var values []string
	if strings.HasPrefix(raw, "[") {
		if err := common.UnmarshalJsonStr(raw, &values); err != nil {
			return err
		}
	} else {
		values = strings.Split(raw, ",")
	}

	*j = normalizeStringList(values, nil)
	return nil
}

var modelDetailModalities = map[string]struct{}{
	"text":  {},
	"image": {},
	"audio": {},
	"video": {},
	"file":  {},
}

var modelDetailCapabilities = map[string]struct{}{
	"function_calling":  {},
	"streaming":         {},
	"vision":            {},
	"json_mode":         {},
	"structured_output": {},
	"reasoning":         {},
	"tools":             {},
	"system_prompt":     {},
	"web_search":        {},
	"code_interpreter":  {},
	"caching":           {},
	"embeddings":        {},
}

func normalizeStringList(values []string, allowed map[string]struct{}) JSONTextList {
	if len(values) == 0 {
		return nil
	}

	seen := make(map[string]struct{}, len(values))
	result := make(JSONTextList, 0, len(values))
	for _, value := range values {
		item := strings.ToLower(strings.TrimSpace(value))
		if item == "" {
			continue
		}
		if allowed != nil {
			if _, ok := allowed[item]; !ok {
				continue
			}
		}
		if _, ok := seen[item]; ok {
			continue
		}
		seen[item] = struct{}{}
		result = append(result, item)
	}
	return result
}

func (mi *Model) NormalizeDetailMetadata() {
	if mi.ContextLength < 0 {
		mi.ContextLength = 0
	}
	if mi.MaxOutputTokens < 0 {
		mi.MaxOutputTokens = 0
	}
	mi.KnowledgeCutoff = strings.TrimSpace(mi.KnowledgeCutoff)
	mi.ReleaseDate = strings.TrimSpace(mi.ReleaseDate)
	mi.ParameterCount = strings.TrimSpace(mi.ParameterCount)
	mi.InputModalities = normalizeStringList(mi.InputModalities, modelDetailModalities)
	mi.OutputModalities = normalizeStringList(mi.OutputModalities, modelDetailModalities)
	mi.Capabilities = normalizeStringList(mi.Capabilities, modelDetailCapabilities)
}
