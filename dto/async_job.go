package dto

import "encoding/json"

type AsyncSubmitResponse struct {
	ID        string `json:"id"`
	Status    string `json:"status"`
	StatusURL string `json:"status_url"`
	ResultURL string `json:"result_url"`
}

type AsyncTaskError struct {
	Phase   string `json:"phase"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

type AsyncTaskStatusResponse struct {
	ID         string          `json:"id"`
	Status     string          `json:"status"`
	Progress   int             `json:"progress"`
	CreatedAt  int64           `json:"created_at"`
	StartedAt  *int64          `json:"started_at"`
	FinishedAt *int64          `json:"finished_at"`
	Error      *AsyncTaskError `json:"error"`
}

type AsyncArtifactResponse struct {
	ContentType string `json:"content_type"`
	SizeBytes   int64  `json:"size_bytes"`
	SHA256      string `json:"sha256"`
	ExpiresAt   int64  `json:"expires_at"`
	URL         string `json:"url"`
}

type AsyncTaskResultResponse struct {
	ID               string                  `json:"id"`
	Status           string                  `json:"status"`
	Response         json.RawMessage         `json:"response"`
	UpstreamResponse json.RawMessage         `json:"upstream_response,omitempty"`
	Artifacts        []AsyncArtifactResponse `json:"artifacts"`
}
