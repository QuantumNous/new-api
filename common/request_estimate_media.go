package common

import (
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
)

const RequestEstimateMediaInfoContextKey = "request_estimate_media_info"

type RequestEstimateMediaInfo struct {
	Pointer        string
	PointerValue   string
	Field          string
	Index          int
	Type           string
	Width          int
	Height         int
	DurationSecond float64
}

func ParseRequestEstimateMediaInfo(raw json.RawMessage, body []byte) ([]RequestEstimateMediaInfo, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return nil, nil
	}
	var entries []map[string]json.RawMessage
	if err := Unmarshal(raw, &entries); err != nil || entries == nil {
		return nil, fmt.Errorf("media_info must be an array")
	}
	if len(entries) > 64 {
		return nil, fmt.Errorf("media_info has too many entries")
	}
	var jsonBody any
	if len(body) > 0 && Unmarshal(body, &jsonBody) != nil {
		jsonBody = nil
	}
	result := make([]RequestEstimateMediaInfo, 0, len(entries))
	seen := make(map[string]struct{}, len(entries))
	for _, entry := range entries {
		for key := range entry {
			if key != "pointer" && key != "field" && key != "index" && key != "type" && key != "width" && key != "height" && key != "duration_seconds" {
				return nil, fmt.Errorf("unsupported media_info field")
			}
		}
		var fact RequestEstimateMediaInfo
		if value := entry["pointer"]; len(value) > 0 {
			if err := Unmarshal(value, &fact.Pointer); err != nil || !strings.HasPrefix(fact.Pointer, "/") || len(fact.Pointer) > 4096 {
				return nil, fmt.Errorf("invalid media_info pointer")
			}
			var found bool
			fact.PointerValue, found = resolveEstimateJSONPointer(jsonBody, fact.Pointer)
			if !found || fact.PointerValue == "" {
				return nil, fmt.Errorf("media_info pointer must reference a non-empty string")
			}
		} else if value := entry["field"]; len(value) > 0 {
			if err := Unmarshal(value, &fact.Field); err != nil || fact.Field == "" || len(fact.Field) > 256 {
				return nil, fmt.Errorf("invalid media_info field")
			}
			if len(entry["index"]) == 0 || strings.TrimSpace(string(entry["index"])) == "null" || Unmarshal(entry["index"], &fact.Index) != nil || fact.Index < 0 {
				return nil, fmt.Errorf("invalid media_info index")
			}
		} else {
			return nil, fmt.Errorf("media_info must identify a JSON pointer or multipart field")
		}
		if fact.Pointer != "" && (len(entry["field"]) > 0 || len(entry["index"]) > 0) {
			return nil, fmt.Errorf("media_info has conflicting targets")
		}
		if err := Unmarshal(entry["type"], &fact.Type); err != nil || (fact.Type != "image" && fact.Type != "audio") {
			return nil, fmt.Errorf("unsupported media_info type")
		}
		switch fact.Type {
		case "image":
			if err := Unmarshal(entry["width"], &fact.Width); err != nil || fact.Width <= 0 || fact.Width > 32768 {
				return nil, fmt.Errorf("invalid media_info image width")
			}
			if err := Unmarshal(entry["height"], &fact.Height); err != nil || fact.Height <= 0 || fact.Height > 32768 || int64(fact.Width)*int64(fact.Height) > 1_000_000_000 {
				return nil, fmt.Errorf("invalid media_info image height")
			}
			if len(entry["duration_seconds"]) > 0 {
				return nil, fmt.Errorf("image media_info cannot contain duration")
			}
		case "audio":
			if strings.TrimSpace(string(entry["duration_seconds"])) == "null" {
				return nil, fmt.Errorf("invalid media_info audio duration")
			}
			if err := Unmarshal(entry["duration_seconds"], &fact.DurationSecond); err != nil || math.IsNaN(fact.DurationSecond) || math.IsInf(fact.DurationSecond, 0) || fact.DurationSecond < 0 || fact.DurationSecond > 3600 {
				return nil, fmt.Errorf("invalid media_info audio duration")
			}
			if len(entry["width"]) > 0 || len(entry["height"]) > 0 {
				return nil, fmt.Errorf("audio media_info cannot contain dimensions")
			}
		}
		key := fact.Pointer
		if key == "" {
			key = fact.Field + ":" + strconv.Itoa(fact.Index)
		}
		if _, exists := seen[key]; exists {
			return nil, fmt.Errorf("duplicate media_info target")
		}
		seen[key] = struct{}{}
		result = append(result, fact)
	}
	return result, nil
}

func resolveEstimateJSONPointer(root any, pointer string) (string, bool) {
	current := root
	for encodedPart := range strings.SplitSeq(strings.TrimPrefix(pointer, "/"), "/") {
		var part strings.Builder
		for index := 0; index < len(encodedPart); index++ {
			if encodedPart[index] != '~' {
				part.WriteByte(encodedPart[index])
				continue
			}
			index++
			if index == len(encodedPart) {
				return "", false
			}
			switch encodedPart[index] {
			case '0':
				part.WriteByte('~')
			case '1':
				part.WriteByte('/')
			default:
				return "", false
			}
		}
		decodedPart := part.String()
		switch value := current.(type) {
		case map[string]any:
			current, _ = value[decodedPart]
		case []any:
			index, err := strconv.Atoi(decodedPart)
			if err != nil || index < 0 || index >= len(value) {
				return "", false
			}
			current = value[index]
		default:
			return "", false
		}
	}
	value, ok := current.(string)
	return value, ok
}
