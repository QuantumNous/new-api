package governorlab

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type MockConfig struct {
	Delay        time.Duration
	ResponseText string
	DefaultModel string
	Models       []string
}

func (cfg MockConfig) normalized() MockConfig {
	if cfg.ResponseText == "" {
		cfg.ResponseText = "ok"
	}
	if cfg.DefaultModel == "" {
		cfg.DefaultModel = "gpt-4o-mini"
	}
	if len(cfg.Models) == 0 {
		cfg.Models = []string{cfg.DefaultModel}
	}
	return cfg
}

func NewMockHandler(cfg MockConfig) http.Handler {
	cfg = cfg.normalized()

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		writeMockJSON(w, http.StatusOK, map[string]any{
			"ok": true,
		})
	})
	mux.HandleFunc("/v1/models", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeMockJSON(w, http.StatusMethodNotAllowed, map[string]any{
				"error": map[string]any{"message": "method not allowed"},
			})
			return
		}
		now := time.Now().Unix()
		data := make([]map[string]any, 0, len(cfg.Models))
		for _, modelName := range cfg.Models {
			data = append(data, map[string]any{
				"id":       modelName,
				"object":   "model",
				"created":  now,
				"owned_by": "governorlab",
			})
		}
		writeMockJSON(w, http.StatusOK, map[string]any{
			"object": "list",
			"data":   data,
		})
	})
	mux.HandleFunc("/v1/chat/completions", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeMockJSON(w, http.StatusMethodNotAllowed, map[string]any{
				"error": map[string]any{"message": "method not allowed"},
			})
			return
		}

		var request struct {
			Model  string `json:"model"`
			Stream bool   `json:"stream"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			writeMockJSON(w, http.StatusBadRequest, map[string]any{
				"error": map[string]any{"message": "invalid JSON request body"},
			})
			return
		}

		modelName := request.Model
		if modelName == "" {
			modelName = cfg.DefaultModel
		}
		if cfg.Delay > 0 {
			time.Sleep(cfg.Delay)
		}

		if request.Stream {
			writeMockStreamResponse(w, modelName, cfg.ResponseText)
			return
		}

		writeMockJSON(w, http.StatusOK, buildMockChatCompletion(modelName, cfg.ResponseText))
	})

	return mux
}

func buildMockChatCompletion(modelName, responseText string) map[string]any {
	now := time.Now().Unix()
	return map[string]any{
		"id":      fmt.Sprintf("chatcmpl-mock-%d", now),
		"object":  "chat.completion",
		"created": now,
		"model":   modelName,
		"choices": []map[string]any{
			{
				"index": 0,
				"message": map[string]any{
					"role":    "assistant",
					"content": responseText,
				},
				"finish_reason": "stop",
			},
		},
		"usage": map[string]int{
			"prompt_tokens":     8,
			"completion_tokens": 4,
			"total_tokens":      12,
		},
	}
}

func writeMockStreamResponse(w http.ResponseWriter, modelName, responseText string) {
	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeMockJSON(w, http.StatusInternalServerError, map[string]any{
			"error": map[string]any{"message": "streaming not supported"},
		})
		return
	}

	now := time.Now().Unix()
	chunks := []map[string]any{
		{
			"id":      fmt.Sprintf("chatcmpl-mock-%d", now),
			"object":  "chat.completion.chunk",
			"created": now,
			"model":   modelName,
			"choices": []map[string]any{
				{
					"index": 0,
					"delta": map[string]any{
						"role":    "assistant",
						"content": responseText,
					},
					"finish_reason": nil,
				},
			},
		},
		{
			"id":      fmt.Sprintf("chatcmpl-mock-%d", now),
			"object":  "chat.completion.chunk",
			"created": now,
			"model":   modelName,
			"choices": []map[string]any{
				{
					"index":         0,
					"delta":         map[string]any{},
					"finish_reason": "stop",
				},
			},
		},
	}

	for _, chunk := range chunks {
		payload, _ := json.Marshal(chunk)
		_, _ = fmt.Fprintf(w, "data: %s\n\n", payload)
		flusher.Flush()
	}
	_, _ = fmt.Fprint(w, "data: [DONE]\n\n")
	flusher.Flush()
}

func writeMockJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func SplitCSV(value string) []string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			result = append(result, part)
		}
	}
	return result
}
