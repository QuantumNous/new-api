package codex

import (
	"encoding/json"
	"fmt"
	"net/url"
	"path"
	"strings"
)

type remoteInputFileLoader func(fileURL string) (dataURL string, err error)

func rewriteRemoteInputFiles(input json.RawMessage, load remoteInputFileLoader) (json.RawMessage, error) {
	if len(input) == 0 {
		return input, nil
	}

	var value any
	if err := json.Unmarshal(input, &value); err != nil {
		return nil, fmt.Errorf("decode responses input: %w", err)
	}
	changed, err := rewriteRemoteInputFileValue(value, load)
	if err != nil {
		return nil, err
	}
	if !changed {
		return input, nil
	}

	rewritten, err := json.Marshal(value)
	if err != nil {
		return nil, fmt.Errorf("encode responses input: %w", err)
	}
	return rewritten, nil
}

func rewriteRemoteInputFileValue(value any, load remoteInputFileLoader) (bool, error) {
	switch node := value.(type) {
	case []any:
		changed := false
		for _, item := range node {
			itemChanged, err := rewriteRemoteInputFileValue(item, load)
			if err != nil {
				return false, err
			}
			changed = changed || itemChanged
		}
		return changed, nil
	case map[string]any:
		changed := false
		if node["type"] == "input_file" {
			fileURL, _ := node["file_url"].(string)
			fileURL = strings.TrimSpace(fileURL)
			if fileURL != "" {
				if load == nil {
					return false, fmt.Errorf("load remote input file: loader is nil")
				}
				dataURL, err := load(fileURL)
				if err != nil {
					return false, fmt.Errorf("load remote input file: %w", err)
				}
				node["file_data"] = dataURL
				delete(node, "file_url")
				if filename, _ := node["filename"].(string); strings.TrimSpace(filename) == "" {
					node["filename"] = filenameFromRemoteInputFileURL(fileURL)
				}
				changed = true
			}
		}
		for _, item := range node {
			itemChanged, err := rewriteRemoteInputFileValue(item, load)
			if err != nil {
				return false, err
			}
			changed = changed || itemChanged
		}
		return changed, nil
	default:
		return false, nil
	}
}

func filenameFromRemoteInputFileURL(fileURL string) string {
	parsed, err := url.Parse(fileURL)
	if err != nil {
		return "file"
	}
	filename, err := url.PathUnescape(path.Base(parsed.Path))
	if err != nil || filename == "" || filename == "." || filename == "/" {
		return "file"
	}
	return filename
}
