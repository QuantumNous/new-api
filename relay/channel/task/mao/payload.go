package mao

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
)

// buildUpstreamPayload clones body, maps logic model + resolution to upstream model ID,
// strips resolution/size, applies metadata rules, and defaults response_format to url.
func buildUpstreamPayload(body map[string]interface{}, logicModel string) (map[string]interface{}, error) {
	cloned, err := cloneBodyMap(body)
	if err != nil {
		return nil, err
	}

	resolution := asString(cloned["resolution"])
	size := asString(cloned["size"])
	tier := normalizeTier(resolution, size)

	upstreamModel, err := resolveUpstreamModel(logicModel, tier)
	if err != nil {
		return nil, err
	}

	out := make(map[string]interface{})

	if v, ok := cloned["prompt"]; ok {
		out["prompt"] = v
	}

	if v, ok := cloned["duration"]; ok {
		out["duration"] = v
	} else if v, ok := cloned["seconds"]; ok {
		out["duration"] = v
	}

	if v, ok := cloned["ratio"]; ok {
		out["ratio"] = v
	} else if v, ok := cloned["aspect_ratio"]; ok {
		out["ratio"] = v
	}

	for _, key := range []string{"seed", "image", "last_frame", "videos", "audios", "n"} {
		if v, ok := cloned[key]; ok {
			out[key] = v
		}
	}

	if v, ok := cloned["response_format"]; ok && v != nil && asString(v) != "" {
		out["response_format"] = v
	} else {
		out["response_format"] = "url"
	}

	md := cloneMetadata(cloned["metadata"])
	if v, ok := cloned["generate_audio"]; ok {
		if md == nil {
			md = make(map[string]interface{})
		}
		md["generate_audio"] = v
	}
	if md != nil {
		if !supportsCameraFixed(logicModel) {
			delete(md, "camera_fixed")
		}
		if len(md) > 0 {
			out["metadata"] = md
		}
	}

	if dur, ok := out["duration"]; ok {
		sec, err := asInt(dur)
		if err != nil {
			return nil, fmt.Errorf("invalid duration: %w", err)
		}
		if err := validateDuration(logicModel, sec); err != nil {
			return nil, err
		}
	}

	out["model"] = upstreamModel
	return out, nil
}

func cloneBodyMap(body map[string]interface{}) (map[string]interface{}, error) {
	if body == nil {
		return make(map[string]interface{}), nil
	}
	b, err := common.Marshal(body)
	if err != nil {
		return nil, err
	}
	var out map[string]interface{}
	if err := common.Unmarshal(b, &out); err != nil {
		return nil, err
	}
	if out == nil {
		out = make(map[string]interface{})
	}
	return out, nil
}

func cloneMetadata(v interface{}) map[string]interface{} {
	if v == nil {
		return nil
	}
	m, ok := v.(map[string]interface{})
	if !ok {
		return nil
	}
	out := make(map[string]interface{}, len(m))
	for k, val := range m {
		out[k] = val
	}
	return out
}

func asString(v interface{}) string {
	if v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return t
	default:
		return fmt.Sprint(t)
	}
}

func asInt(v interface{}) (int, error) {
	switch t := v.(type) {
	case int:
		return t, nil
	case int32:
		return int(t), nil
	case int64:
		return int(t), nil
	case float32:
		return int(t), nil
	case float64:
		return int(t), nil
	case string:
		var n int
		_, err := fmt.Sscanf(t, "%d", &n)
		return n, err
	default:
		return 0, fmt.Errorf("unsupported duration type %T", v)
	}
}
