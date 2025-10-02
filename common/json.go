package common

import (
	"bytes"
	"encoding/json"
)

func Unmarshal(data []byte, v any) error {
	return json.Unmarshal(data, v)
}

func UnmarshalJsonStr(data string, v any) error {
	return json.Unmarshal(StringToByteSlice(data), v)
}

func DecodeJson(reader *bytes.Reader, v any) error {
	return json.NewDecoder(reader).Decode(v)
}

func Marshal(v any) ([]byte, error) {
	return json.Marshal(v)
}

func GetJsonType(data json.RawMessage) string {
	data = bytes.TrimSpace(data)
	if len(data) == 0 {
		return "unknown"
	}
	firstChar := bytes.TrimSpace(data)[0]
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

// 8-1.png?Expires=1007170000&OSSAccessKeyId=
// 9-1.png?Expires=1007170000\\u0026OSSAccessKeyId=
func MarshalWithoutHTMLEscape(v interface{}) ([]byte, error) {
	buffer := &bytes.Buffer{}
	encoder := json.NewEncoder(buffer)
	encoder.SetEscapeHTML(false) // 关闭HTML转义
	err := encoder.Encode(v)
	if err != nil {
		return nil, err
	}
	// 移除末尾的换行符
	result := buffer.Bytes()
	if len(result) > 0 && result[len(result)-1] == '\n' {
		result = result[:len(result)-1]
	}
	return result, nil
}
