package service

import (
	"encoding/json"
	"errors"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// Accept the public URL-array form and the OpenAI-compatible image_url form.
// Never accept empty objects produced by JSON.stringify(Blob).
func JSONImageReferences(raw json.RawMessage) ([]string, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return nil, nil
	}
	var items []json.RawMessage
	if common.Unmarshal(raw, &items) != nil {
		return nil, errors.New("images must be an array of image URLs")
	}
	refs := make([]string, 0, len(items))
	for _, item := range items {
		var location string
		if common.Unmarshal(item, &location) != nil {
			var object struct {
				URL string `json:"image_url"`
			}
			if common.Unmarshal(item, &object) != nil {
				return nil, errors.New("invalid reference image")
			}
			location = object.URL
		}
		parsed, err := url.Parse(location)
		valid := err == nil && ((parsed.Scheme == "https" || parsed.Scheme == "http") && parsed.Host != "" || strings.HasPrefix(location, "data:image/"))
		if !valid {
			return nil, errors.New("reference image must be an HTTP(S) URL or image data URL; do not serialize Blob as an empty object")
		}
		refs = append(refs, location)
	}
	return refs, nil
}

func ValidateJSONImageReferences(raw json.RawMessage) (bool, error) {
	refs, err := JSONImageReferences(raw)
	return len(refs) > 0, err
}

// GoEasy documents a URL string array; CPA/OpenAI-compatible JSON edits use
// image_url objects. Size and quality are deliberately not changed here.
func AdaptJSONImageReferences(raw json.RawMessage, baseURL string) (json.RawMessage, error) {
	refs, err := JSONImageReferences(raw)
	if err != nil {
		return nil, err
	}
	if len(refs) == 0 {
		return raw, nil
	}
	base, err := url.Parse(baseURL)
	if err != nil {
		return nil, errors.New("invalid channel base URL")
	}
	host := strings.ToLower(base.Hostname())
	if host == "goeasyapi.xyz" || strings.HasSuffix(host, ".goeasyapi.xyz") {
		return common.Marshal(refs)
	}
	items := make([]map[string]string, 0, len(refs))
	for _, ref := range refs {
		items = append(items, map[string]string{"image_url": ref})
	}
	return common.Marshal(items)
}
