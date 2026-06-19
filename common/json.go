package common

import (
	"bytes"
	"encoding/json"
	"io"

	"github.com/bytedance/sonic"
)

// jsonAPI 使用 sonic 的标准兼容配置（EscapeHTML + SortMapKeys），与 encoding/json
// 保持字节级一致（保护 JSON 签名等依赖 map 顺序的场景），同时获得 sonic 的性能。
var jsonAPI = sonic.ConfigStd

func Unmarshal(data []byte, v any) error {
	return jsonAPI.Unmarshal(data, v)
}

func UnmarshalJsonStr(data string, v any) error {
	return jsonAPI.UnmarshalFromString(data, v)
}

func DecodeJson(reader io.Reader, v any) error {
	return jsonAPI.NewDecoder(reader).Decode(v)
}

func Marshal(v any) ([]byte, error) {
	return jsonAPI.Marshal(v)
}

// ValidJson 校验数据是否为合法 JSON（替代 encoding/json 的 json.Valid）。
func ValidJson(data []byte) bool {
	return jsonAPI.Valid(data)
}

func GetJsonType(data json.RawMessage) string {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 {
		return "unknown"
	}
	firstChar := trimmed[0]
	switch firstChar {
	case '{':
		return "object"
	case '[':
		return "array"
	case '"':
		return "string"
	case 't', 'f':
		return "boolean"
	case 'n':
		return "null"
	default:
		return "number"
	}
}

// JsonRawMessageToString returns JSON strings as their decoded value and other JSON values as raw text.
func JsonRawMessageToString(data json.RawMessage) string {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		return ""
	}
	if trimmed[0] != '"' {
		return string(trimmed)
	}
	var value string
	if err := Unmarshal(trimmed, &value); err != nil {
		return string(trimmed)
	}
	return value
}
