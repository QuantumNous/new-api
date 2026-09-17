package dto

import (
	"fmt"
	"net/http"
	"slices"
	"strings"
)

// ChannelRouteRestriction limits client entry paths, before upstream conversion.
// A nil restriction preserves the existing routing behavior; an empty one denies
// requests and is rejected when saving channel settings.
type ChannelRouteRestriction struct {
	AllowedPaths []string `json:"allowed_paths"`
}

// ChannelRoutePaths contains the built-in submission routes exposed by the host.
// Dynamic segments are fixed templates, not administrator-supplied wildcards.
func ChannelRoutePaths() []string {
	return []string{
		"/v1/chat/completions", "/v1/completions", "/v1/messages",
		"/v1/responses", "/v1/responses/compact", "/v1/alpha/search",
		"/v1/embeddings", "/v1/moderations", "/v1/edits",
		"/v1/images/generations", "/v1/images/edits",
		"/v1/audio/speech", "/v1/audio/transcriptions", "/v1/audio/translations",
		"/v1/rerank", "/v1/realtime",
		"/v1beta/models/{model}:generateContent",
		"/v1beta/models/{model}:streamGenerateContent",
		"/v1beta/models/{model}:embedContent",
		"/v1beta/models/{model}:batchEmbedContents",
		"/v1/videos", "/v1/video/generations", "/v1/videos/{video_id}/remix",
		"/v1/tasks/{plugin}",
		"/mj/submit/action", "/mj/submit/shorten", "/mj/submit/modal",
		"/mj/submit/imagine", "/mj/submit/change", "/mj/submit/simple-change",
		"/mj/submit/describe", "/mj/submit/blend", "/mj/submit/edits",
		"/mj/submit/video", "/mj/insight-face/swap", "/mj/submit/upload-discord-images",
	}
}

func (r *ChannelRouteRestriction) Validate() error {
	if r == nil {
		return nil
	}
	paths := ChannelRoutePaths()
	if len(r.AllowedPaths) == 0 || len(r.AllowedPaths) > len(paths) {
		return fmt.Errorf("route_restriction.allowed_paths must contain between 1 and %d routes", len(paths))
	}
	for i, path := range r.AllowedPaths {
		if !slices.Contains(paths, path) {
			return fmt.Errorf("route_restriction.allowed_paths contains an unsupported path: %s", path)
		}
		if slices.Contains(r.AllowedPaths[:i], path) {
			return fmt.Errorf("route_restriction.allowed_paths contains a duplicate path: %s", path)
		}
	}
	return nil
}

func (r *ChannelRouteRestriction) AllowsRequest(method, path string) bool {
	if r == nil {
		return true
	}
	// Existing task retrieval/cancellation must survive changes to submission
	// policy. A remix or a submission referencing an origin task is still new work.
	if (method == http.MethodGet || method == http.MethodDelete || method == http.MethodHead) &&
		(strings.HasPrefix(path, "/v1/videos/") || strings.HasPrefix(path, "/v1/video/generations/") ||
			strings.HasPrefix(path, "/v1/responses/") && path != "/v1/responses/compact" || strings.HasPrefix(path, "/v1/tasks/")) {
		return true
	}
	// The optional Midjourney mode is an alias of the same host entry route.
	if rest, found := strings.CutPrefix(path, "/"); found && !strings.HasPrefix(rest, "mj/") {
		_, suffix, _ := strings.Cut(rest, "/")
		if strings.HasPrefix(suffix, "mj/") {
			path = "/" + suffix
		}
	}
	if method == http.MethodGet && strings.HasPrefix(path, "/mj/task/") ||
		method == http.MethodPost && path == "/mj/task/list-by-condition" {
		return true
	}
	if r.Validate() != nil {
		return false
	}
	switch {
	case path == "/pg/chat/completions":
		path = "/v1/chat/completions"
	case strings.HasPrefix(path, "/v1/engines/") && strings.HasSuffix(path, "/embeddings"):
		model := strings.TrimSuffix(strings.TrimPrefix(path, "/v1/engines/"), "/embeddings")
		if model != "" && !strings.Contains(model, "/") {
			path = "/v1/embeddings"
		}
	case strings.HasPrefix(path, "/v1beta/models/") || strings.HasPrefix(path, "/v1/models/"):
		modelAction := strings.TrimPrefix(strings.TrimPrefix(path, "/v1beta/models/"), "/v1/models/")
		model, action, found := strings.Cut(modelAction, ":")
		if found && model != "" && !strings.Contains(model, "/") {
			path = "/v1beta/models/{model}:" + action
		}
	case strings.HasPrefix(path, "/v1/tasks/"):
		plugin := strings.TrimPrefix(path, "/v1/tasks/")
		if plugin != "" && !strings.Contains(plugin, "/") {
			path = "/v1/tasks/{plugin}"
		}
	case strings.HasPrefix(path, "/v1/videos/") && strings.HasSuffix(path, "/remix"):
		id := strings.TrimSuffix(strings.TrimPrefix(path, "/v1/videos/"), "/remix")
		if id != "" && !strings.Contains(id, "/") {
			path = "/v1/videos/{video_id}/remix"
		}
	}
	return slices.Contains(r.AllowedPaths, path)
}
