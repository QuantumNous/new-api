package zzdh

import (
	"fmt"
	"strconv"
	"strings"
)

func apiOrigin(raw string) string {
	b := strings.TrimRight(strings.TrimSpace(raw), "/")
	if b == "" {
		return defaultBase
	}
	for _, suf := range []string{createPath, "/v8/videos/generations", "/v8/videos", "/v8", "/v1/videos"} {
		b = trimSuffixFold(b, suf)
	}
	return strings.TrimRight(b, "/")
}

func trimSuffixFold(s, suf string) string {
	if len(s) < len(suf) {
		return s
	}
	tail := s[len(s)-len(suf):]
	if strings.EqualFold(tail, suf) {
		return strings.TrimRight(s[:len(s)-len(suf)], "/")
	}
	return s
}

// normalizeCreateBody maps aliases and validates ZZDH MiniMax-H3 create JSON.
// Returns an error for invalid fps / duration / aspect_ratio / unsupported resolution.
// Logic model zzdh-Minimax-h3 + resolution/size selects upstream *-480p/*-720p/*-1080p/*-2k;
// legacy resolution-locked model names pass through. Resolution is always stripped upstream.
func normalizeCreateBody(body map[string]interface{}, logicOrUpstreamModel string) error {
	if body == nil {
		return fmt.Errorf("empty request body")
	}

	applyReferenceMedia(body)

	// Capture resolution hints before stripping (quality / bare size as fallbacks).
	topResolution := firstNonEmptyString(body, "resolution")
	if topResolution == "" {
		topResolution = firstNonEmptyString(body, "quality")
	}
	sizeHint := firstNonEmptyString(body, "size")

	// ratio / size(with :) → aspect_ratio
	if ar := firstNonEmptyString(body, "aspect_ratio"); ar == "" {
		if ratio := firstNonEmptyString(body, "ratio"); ratio != "" && strings.Contains(ratio, ":") {
			body["aspect_ratio"] = ratio
		} else if sizeHint != "" && strings.Contains(sizeHint, ":") {
			body["aspect_ratio"] = sizeHint
		}
	}
	delete(body, "ratio")
	if sizeHint != "" && strings.Contains(sizeHint, ":") {
		delete(body, "size")
		sizeHint = ""
	}

	// seconds → duration
	dur := asPositiveInt(body["duration"])
	if dur <= 0 {
		if sec := asPositiveInt(body["seconds"]); sec > 0 {
			body["duration"] = sec
			dur = sec
		}
	}
	delete(body, "seconds")

	if dur > 0 && (dur < minDurSec || dur > maxDurSec) {
		return fmt.Errorf("duration must be between %d and %d seconds", minDurSec, maxDurSec)
	}

	if ar := firstNonEmptyString(body, "aspect_ratio"); ar != "" {
		if _, ok := allowedAspectRatios[ar]; !ok {
			return fmt.Errorf("unsupported aspect_ratio %q", ar)
		}
	}

	if fpsRaw, exists := body["fps"]; exists && fpsRaw != nil {
		fps := asPositiveInt(fpsRaw)
		if fps == 0 {
			if s, ok := fpsRaw.(string); ok {
				fps, _ = strconv.Atoi(strings.TrimSpace(s))
			}
		}
		if fps != 0 && fps != defaultFPS {
			return fmt.Errorf("fps must be %d", defaultFPS)
		}
		if fps == 0 {
			delete(body, "fps")
		} else {
			body["fps"] = defaultFPS
		}
	}

	tier := resolveClientTier(topResolution, sizeHint)
	upstreamModel, err := resolveUpstreamModel(logicOrUpstreamModel, tier)
	if err != nil {
		return err
	}

	// Upstream locks delivery by model name — omit resolution/quality/bare size
	// so clients carrying ApiMart values (e.g. 768P) are not rejected.
	delete(body, "resolution")
	delete(body, "quality")
	if size := firstNonEmptyString(body, "size"); size != "" && !strings.Contains(size, ":") {
		delete(body, "size")
	}

	// unsupported
	delete(body, "negative_prompt")

	body["model"] = upstreamModel
	return nil
}

// applyReferenceMedia maps common client image fields onto ZZDH create fields:
// - explicit first-frame aliases → top-level `image`
// - explicit last-frame aliases → top-level `last_frame`
// - everything else (images / image_url(s) / input_reference / image_with_roles / …)
//   → top-level `reference_images` (including a single image)
//
// Without this, clients sending OpenAI-style `images` are treated as text-only upstream.
func applyReferenceMedia(body map[string]interface{}) {
	if body == nil {
		return
	}

	// ApiMart image_with_roles: split by role before generic collection.
	if roles, ok := body["image_with_roles"]; ok && roles != nil {
		applyImageWithRoles(body, roles)
		delete(body, "image_with_roles")
	}

	// Explicit first / last frame (do not treat plain images[] as first frame).
	if firstNonEmptyString(body, "image") == "" {
		for _, key := range []string{"first_image", "first_frame"} {
			if urls := collectURLStrings(body[key]); len(urls) > 0 {
				body["image"] = urls[0]
				break
			}
		}
	}
	if firstNonEmptyString(body, "last_frame") == "" {
		for _, key := range []string{"last_image", "last_frame_image"} {
			if urls := collectURLStrings(body[key]); len(urls) > 0 {
				body["last_frame"] = urls[0]
				break
			}
		}
	}

	firstFrame := firstNonEmptyString(body, "image")
	lastFrame := firstNonEmptyString(body, "last_frame")

	var refs []interface{}
	seen := map[string]struct{}{}
	addURL := func(u string) {
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
	addItem := func(item interface{}) {
		switch x := item.(type) {
		case string:
			addURL(x)
		case map[string]interface{}:
			u := ""
			for _, key := range []string{"url", "image_url", "http_url", "uri", "src", "href"} {
				if s := strings.TrimSpace(asStringAny(x[key])); s != "" {
					u = s
					break
				}
			}
			if u == "" || u == firstFrame || u == lastFrame {
				return
			}
			if _, ok := seen[u]; ok {
				return
			}
			seen[u] = struct{}{}
			refs = append(refs, x)
		}
	}

	// Seed seen/refs from existing reference_images so merges dedupe.
	if existing, ok := body["reference_images"]; ok && existing != nil {
		switch t := existing.(type) {
		case []string:
			for _, s := range t {
				addURL(s)
			}
		case []interface{}:
			for _, item := range t {
				addItem(item)
			}
		case string:
			addURL(t)
		}
	}
	if md, ok := body["metadata"].(map[string]interface{}); ok && md != nil {
		if existing, ok := md["reference_images"]; ok && existing != nil {
			switch t := existing.(type) {
			case []string:
				for _, s := range t {
					addURL(s)
				}
			case []interface{}:
				for _, item := range t {
					addItem(item)
				}
			case string:
				addURL(t)
			}
			delete(md, "reference_images")
		}
	}

	for _, key := range []string{
		"referenceImages",
		"images", "image_urls", "image_url",
		"input_reference",
	} {
		v, ok := body[key]
		if !ok || v == nil {
			continue
		}
		switch t := v.(type) {
		case string:
			addURL(t)
		case []string:
			for _, s := range t {
				addURL(s)
			}
		case []interface{}:
			for _, item := range t {
				addItem(item)
			}
		case map[string]interface{}:
			addItem(t)
		}
	}

	// Drop aliases so upstream only sees ZZDH fields.
	for _, key := range []string{
		"referenceImages",
		"images", "image_urls", "image_url", "input_reference",
		"first_image", "first_frame", "last_image", "last_frame_image",
	} {
		delete(body, key)
	}

	if len(refs) > 0 {
		body["reference_images"] = refs
	} else {
		delete(body, "reference_images")
	}
}

func applyImageWithRoles(body map[string]interface{}, roles interface{}) {
	items, ok := roles.([]interface{})
	if !ok {
		return
	}
	var refs []interface{}
	for _, item := range items {
		m, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		u := ""
		for _, key := range []string{"url", "image_url", "http_url", "uri", "src", "href"} {
			if s := strings.TrimSpace(asStringAny(m[key])); s != "" {
				u = s
				break
			}
		}
		if u == "" {
			continue
		}
		role := strings.ToLower(strings.TrimSpace(asStringAny(m["role"])))
		switch role {
		case "first_frame", "first_image":
			if firstNonEmptyString(body, "image") == "" {
				body["image"] = u
			}
		case "last_frame", "last_image":
			if firstNonEmptyString(body, "last_frame") == "" {
				body["last_frame"] = u
			}
		default:
			refs = append(refs, m)
		}
	}
	if len(refs) == 0 {
		return
	}
	if existing, ok := body["reference_images"]; ok && existing != nil {
		switch t := existing.(type) {
		case []interface{}:
			body["reference_images"] = append(append([]interface{}{}, t...), refs...)
		case []string:
			merged := make([]interface{}, 0, len(t)+len(refs))
			for _, s := range t {
				merged = append(merged, s)
			}
			body["reference_images"] = append(merged, refs...)
		default:
			body["reference_images"] = refs
		}
	} else {
		body["reference_images"] = refs
	}
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
					if u := strings.TrimSpace(asStringAny(x[key])); u != "" {
						out = append(out, u)
						break
					}
				}
			}
		}
		return out
	case map[string]interface{}:
		for _, key := range []string{"url", "image_url", "http_url", "uri", "src", "href"} {
			if u := strings.TrimSpace(asStringAny(t[key])); u != "" {
				return []string{u}
			}
		}
	}
	return nil
}

func asStringAny(v interface{}) string {
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

func resolutionFromModel(modelName string) string {
	compact := strings.ToLower(strings.TrimSpace(modelName))
	switch {
	case strings.HasSuffix(compact, "-480p") || strings.Contains(compact, "h3-480p"):
		return "480P"
	case strings.HasSuffix(compact, "-720p") || strings.Contains(compact, "h3-720p"):
		return "720P"
	case strings.HasSuffix(compact, "-1080p") || strings.Contains(compact, "h3-1080p"):
		return "1080P"
	case strings.HasSuffix(compact, "-2k") || strings.Contains(compact, "h3-2k"):
		return "2K"
	default:
		return ""
	}
}

func firstNonEmptyString(body map[string]interface{}, key string) string {
	v, ok := body[key]
	if !ok || v == nil {
		return ""
	}
	switch x := v.(type) {
	case string:
		return strings.TrimSpace(x)
	default:
		return strings.TrimSpace(fmt.Sprint(x))
	}
}

func asPositiveInt(v interface{}) int {
	switch x := v.(type) {
	case int:
		return x
	case int64:
		return int(x)
	case float64:
		return int(x)
	case float32:
		return int(x)
	case string:
		n, err := strconv.Atoi(strings.TrimSpace(x))
		if err != nil {
			return 0
		}
		return n
	default:
		return 0
	}
}

func durationFromBody(body map[string]interface{}) int {
	if body == nil {
		return 0
	}
	if d := asPositiveInt(body["duration"]); d > 0 {
		return d
	}
	return asPositiveInt(body["seconds"])
}
