package dto

import (
	"encoding/json"
	"reflect"
)

type ImageRequest struct {
	Model          string          `json:"model"`
	Prompt         string          `json:"prompt" binding:"required"`
	N              int             `json:"n,omitempty"`
	Size           string          `json:"size,omitempty"`
	Quality        string          `json:"quality,omitempty"`
	ResponseFormat string          `json:"response_format,omitempty"`
	Style          string          `json:"style,omitempty"`
	User           string          `json:"user,omitempty"`
	ExtraFields    json.RawMessage `json:"extra_fields,omitempty"`
	Background     string          `json:"background,omitempty"`
	Moderation     string          `json:"moderation,omitempty"`
	OutputFormat   string          `json:"output_format,omitempty"`
	// 用匿名字段接住额外的字段
	Extra map[string]json.RawMessage `json:"-"`
}

func (r *ImageRequest) UnmarshalJSON(data []byte) error {
	// 先解析成 map[string]interface{}
	var rawMap map[string]json.RawMessage
	if err := json.Unmarshal(data, &rawMap); err != nil {
		return err
	}

	// 用 struct tag 获取所有已定义字段名
	knownFields := GetJSONFieldNames(reflect.TypeOf(*r))

	// 再正常解析已定义字段
	type Alias ImageRequest
	var known Alias
	if err := json.Unmarshal(data, &known); err != nil {
		return err
	}
	*r = ImageRequest(known)

	// 提取多余字段
	r.Extra = make(map[string]json.RawMessage)
	for k, v := range rawMap {
		if _, ok := knownFields[k]; !ok {
			r.Extra[k] = v
		}
	}
	return nil
}

func (r ImageRequest) MarshalJSON() ([]byte, error) {
	// 将已定义字段转为 map
	type Alias ImageRequest
	alias := Alias(r)
	base, err := json.Marshal(alias)
	if err != nil {
		return nil, err
	}

	var baseMap map[string]json.RawMessage
	if err := json.Unmarshal(base, &baseMap); err != nil {
		return nil, err
	}

	// 合并 ExtraFields
	for k, v := range r.Extra {
		baseMap[k] = v
	}

	return json.Marshal(baseMap)
}

type ImageResponse struct {
	Data    []ImageData `json:"data"`
	Created int64       `json:"created"`
}
type ImageData struct {
	Url           string `json:"url"`
	B64Json       string `json:"b64_json"`
	RevisedPrompt string `json:"revised_prompt"`
}

func GetJSONFieldNames(t reflect.Type) map[string]struct{} {
	fields := make(map[string]struct{})
	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)

		// 跳过匿名字段（例如 ExtraFields）
		if field.Anonymous {
			continue
		}

		tag := field.Tag.Get("json")
		if tag == "-" || tag == "" {
			continue
		}

		// 取逗号前字段名（排除 omitempty 等）
		name := tag
		if commaIdx := indexComma(tag); commaIdx != -1 {
			name = tag[:commaIdx]
		}
		fields[name] = struct{}{}
	}
	return fields
}

func indexComma(s string) int {
	for i := 0; i < len(s); i++ {
		if s[i] == ',' {
			return i
		}
	}
	return -1
}
