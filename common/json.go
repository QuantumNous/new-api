package common

import (
	"bytes"
	"encoding/json"
)

func UnmarshalJson(data []byte, v any) error {
	return json.Unmarshal(data, v)
}

func UnmarshalJsonStr(data string, v any) error {
	return json.Unmarshal(StringToByteSlice(data), v)
}

func DecodeJson(reader *bytes.Reader, v any) error {
	return json.NewDecoder(reader).Decode(v)
}

func EncodeJson(v any) ([]byte, error) {
	return json.Marshal(v)
}
