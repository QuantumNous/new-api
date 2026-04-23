package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

func newServer(cfg Config) http.Handler {
	mux := http.NewServeMux()
	client := &http.Client{Timeout: 60 * time.Second}

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	})
	mux.HandleFunc("/api/v3/contents/generations/tasks", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed")
			return
		}
		handleCreateTask(w, r, client, cfg)
	})
	mux.HandleFunc("/api/v3/contents/generations/tasks/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed")
			return
		}
		handleGetTask(w, r, client, cfg)
	})

	return mux
}

func handleCreateTask(w http.ResponseWriter, r *http.Request, client *http.Client, cfg Config) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "failed to read request body")
		return
	}

	newAPIReq, err := BuildNewAPIRequestFromSeedance(body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}

	reqBody, err := json.Marshal(newAPIReq)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to encode upstream request")
		return
	}

	upstreamReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost, cfg.NewAPIBaseURL+"/v1/video/generations", bytes.NewReader(reqBody))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to create upstream request")
		return
	}
	copyHeaders(r.Header, upstreamReq.Header)
	upstreamReq.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(upstreamReq)
	if err != nil {
		writeError(w, http.StatusBadGateway, "upstream_error", "failed to reach NewAPI")
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		writeError(w, http.StatusBadGateway, "upstream_error", "failed to read NewAPI response")
		return
	}
	if resp.StatusCode >= 400 {
		forwardRawJSON(w, resp.StatusCode, respBody)
		return
	}

	translated, err := BuildSeedanceSubmitResponseFromNewAPI(respBody)
	if err != nil {
		writeError(w, http.StatusBadGateway, "upstream_error", "failed to translate NewAPI response")
		return
	}
	forwardRawJSON(w, http.StatusOK, translated)
}

func handleGetTask(w http.ResponseWriter, r *http.Request, client *http.Client, cfg Config) {
	taskID := strings.TrimPrefix(r.URL.Path, "/api/v3/contents/generations/tasks/")
	taskID = strings.TrimSpace(taskID)
	if taskID == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "task id is required")
		return
	}

	upstreamReq, err := http.NewRequestWithContext(r.Context(), http.MethodGet, cfg.NewAPIBaseURL+"/v1/video/generations/"+taskID, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to create upstream request")
		return
	}
	copyHeaders(r.Header, upstreamReq.Header)

	resp, err := client.Do(upstreamReq)
	if err != nil {
		writeError(w, http.StatusBadGateway, "upstream_error", "failed to reach NewAPI")
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		writeError(w, http.StatusBadGateway, "upstream_error", "failed to read NewAPI response")
		return
	}
	if resp.StatusCode >= 400 {
		forwardRawJSON(w, resp.StatusCode, respBody)
		return
	}
	translated, err := BuildSeedanceTaskResponseFromNewAPI(respBody)
	if err != nil {
		writeError(w, http.StatusBadGateway, "upstream_error", "failed to translate NewAPI response")
		return
	}
	forwardRawJSON(w, http.StatusOK, translated)
}

func copyHeaders(src, dst http.Header) {
	for key, values := range src {
		if strings.EqualFold(key, "Content-Length") {
			continue
		}
		for _, value := range values {
			dst.Add(key, value)
		}
	}
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{
		"code":    code,
		"message": message,
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	body, _ := json.Marshal(v)
	forwardRawJSON(w, status, body)
}

func forwardRawJSON(w http.ResponseWriter, status int, body []byte) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(body)
}

func mustString(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}
