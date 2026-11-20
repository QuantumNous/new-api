package oaicache

import (
	"encoding/json"
	"fmt"
	"maps"
	"slices"

	"github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
)

func OptionsToResponses(raw json.RawMessage) (json.RawMessage, error) {
	return convertOptions(raw, "responses")
}

func OptionsToChat(raw json.RawMessage) (json.RawMessage, error) {
	return convertOptions(raw, "chat")
}

// convertOptions maps only request-level settings that both endpoints can
// express. Content-level prompt_cache_breakpoint translation is separate.
func convertOptions(raw json.RawMessage, target string) (json.RawMessage, error) {
	if len(raw) == 0 {
		return nil, nil
	}

	var source map[string]json.RawMessage
	if err := kitutil.Unmarshal(raw, &source); err != nil {
		return nil, fmt.Errorf("invalid prompt_cache_options: %w", err)
	}
	var options struct {
		Mode string `json:"mode,omitempty"`
		TTL  string `json:"ttl,omitempty"`
	}
	for _, key := range slices.Sorted(maps.Keys(source)) {
		value := source[key]
		switch key {
		case "mode":
			if err := kitutil.Unmarshal(value, &options.Mode); err != nil {
				return nil, fmt.Errorf("invalid prompt_cache_options.mode: %w", err)
			}
			if options.Mode == "explicit" {
				return nil, fmt.Errorf("conversion to %s does not support prompt_cache_options.mode=explicit: prompt cache breakpoints are not converted", target)
			}
			if options.Mode != "implicit" {
				return nil, fmt.Errorf("invalid prompt_cache_options.mode: expected implicit or explicit")
			}
		case "ttl":
			if err := kitutil.Unmarshal(value, &options.TTL); err != nil {
				return nil, fmt.Errorf("invalid prompt_cache_options.ttl: %w", err)
			}
			if options.TTL == "12h" && target == "chat" {
				return nil, fmt.Errorf("conversion to chat does not support prompt_cache_options.ttl=12h")
			}
			if options.TTL != "30m" {
				return nil, fmt.Errorf("invalid prompt_cache_options.ttl: expected 30m")
			}
		case "prewarm":
			if target != "chat" {
				return nil, fmt.Errorf("invalid chat prompt_cache_options: unsupported field %q", key)
			}
			var prewarm *bool
			if err := kitutil.Unmarshal(value, &prewarm); err != nil {
				return nil, fmt.Errorf("invalid prompt_cache_options.prewarm: %w", err)
			}
			if prewarm == nil {
				return nil, fmt.Errorf("invalid prompt_cache_options.prewarm: expected a boolean")
			}
			// true suppresses generation; dropping it would generate a response.
			if *prewarm {
				return nil, fmt.Errorf("conversion to chat does not support prompt_cache_options.prewarm")
			}
		case "comparison_response_id":
			if target != "chat" {
				return nil, fmt.Errorf("invalid chat prompt_cache_options: unsupported field %q", key)
			}
			if kitutil.GetJsonType(value) != "null" {
				return nil, fmt.Errorf("conversion to chat does not support prompt_cache_options.comparison_response_id")
			}
		default:
			return nil, fmt.Errorf("invalid prompt_cache_options: unsupported field %q", key)
		}
	}
	if options.Mode == "" && options.TTL == "" {
		return nil, nil
	}
	return kitutil.Marshal(options)
}
