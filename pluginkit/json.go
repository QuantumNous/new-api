package pluginkit

import (
	"unsafe"

	"github.com/MoeForge/moego/json"
)

// The module's JSON goes through these functions and nothing else. The codec
// is fixed to moego/json, which is what new-api's common JSON helpers use:
// key order, escaping and number forms of encoded values are part of what
// hooks receive, so every host gets the same bytes.

func marshalJSON(v any) ([]byte, error) {
	return json.Marshal(v)
}

func unmarshalJSON(data []byte, v any) error {
	return json.Unmarshal(data, v)
}

func unmarshalJSONString(data string, v any) error {
	return json.Unmarshal(unsafe.Slice(unsafe.StringData(data), len(data)), v)
}
