package mao

import (
	"fmt"
	"strings"

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
	if v, ok := cloned["watermark"]; ok {
		if md == nil {
			md = make(map[string]interface{})
		}
		md["watermark"] = v
	}
	if v, ok := cloned["camera_fixed"]; ok {
		if md == nil {
			md = make(map[string]interface{})
		}
		md["camera_fixed"] = v
	}

	applyReferenceMedia(cloned, out, &md)

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

// applyReferenceMedia maps common client image fields onto catertx fields:
// - only explicitly marked first-frame fields → top-level `image`
// - everything else (even a single image) → metadata.reference_images
//
// First-frame markers: existing `image`, or aliases `first_image` / `first_frame`.
// Without this, images / input_reference / reference_images are dropped and upstream
// treats the job as textGenerate (no visual reference).
func applyReferenceMedia(cloned, out map[string]interface{}, md *map[string]interface{}) {
	// Explicit first-frame aliases (do not treat plain images[] as first frame).
	if strings.TrimSpace(asString(out["image"])) == "" {
		for _, key := range []string{"first_image", "first_frame"} {
			if urls := collectURLStrings(cloned[key]); len(urls) > 0 {
				out["image"] = urls[0]
				break
			}
		}
	}
	if strings.TrimSpace(asString(out["last_frame"])) == "" {
		if urls := collectURLStrings(cloned["last_image"]); len(urls) > 0 {
			out["last_frame"] = urls[0]
		}
	}

	firstFrame := strings.TrimSpace(asString(out["image"]))
	lastFrame := strings.TrimSpace(asString(out["last_frame"]))

	var refs []string
	seen := map[string]struct{}{}
	add := func(u string) {
		u = strings.TrimSpace(u)
		if u == "" || u == firstFrame || u == lastFrame {
			return
		}
		if _, ok := seen[u]; ok {
			return
		}
		seen[u] = struct{}{}
		refs = append(refs, u)
	}

	// All non-first-frame image sources → reference_images (including a single image).
	for _, u := range collectURLStrings(cloned["reference_images"]) {
		add(u)
	}
	if *md != nil {
		for _, u := range collectURLStrings((*md)["reference_images"]) {
			add(u)
		}
	}
	for _, u := range collectURLStrings(cloned["images"]) {
		add(u)
	}
	for _, u := range collectURLStrings(cloned["image_urls"]) {
		add(u)
	}
	for _, u := range collectURLStrings(cloned["image_url"]) {
		add(u)
	}
	if u := strings.TrimSpace(asString(cloned["input_reference"])); u != "" {
		add(u)
	}

	if len(refs) == 0 {
		return
	}
	if *md == nil {
		*md = make(map[string]interface{})
	}
	(*md)["reference_images"] = refs
}

func collectURLStrings(v interface{}) []string {
	if v == nil {
		return nil
	}
	switch t := v.(type) {
	case string:
		if u := strings.TrimSpace(t); u != "" {
			return []string{u}
		}
	case []string:
		out := make([]string, 0, len(t))
		for _, s := range t {
			if u := strings.TrimSpace(s); u != "" {
				out = append(out, u)
			}
		}
		return out
	case []interface{}:
		out := make([]string, 0, len(t))
		for _, item := range t {
			switch x := item.(type) {
			case string:
				if u := strings.TrimSpace(x); u != "" {
					out = append(out, u)
				}
			case map[string]interface{}:
				for _, key := range []string{"url", "image_url", "http_url", "uri", "src", "href"} {
					if u := strings.TrimSpace(asString(x[key])); u != "" {
						out = append(out, u)
						break
					}
				}
			}
		}
		return out
	case map[string]interface{}:
		for _, key := range []string{"url", "image_url", "http_url", "uri", "src", "href"} {
			if u := strings.TrimSpace(asString(t[key])); u != "" {
				return []string{u}
			}
		}
	}
	return nil
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
