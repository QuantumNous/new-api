package governorlab

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
)

func TestRequiresPrivateIPAccess(t *testing.T) {
	t.Parallel()

	cases := []struct {
		baseURL string
		want    bool
	}{
		{baseURL: "http://127.0.0.1:8080", want: true},
		{baseURL: "http://localhost:8080", want: true},
		{baseURL: "http://172.22.240.24:8080", want: true},
		{baseURL: "https://api.openai.com", want: false},
	}

	for _, tc := range cases {
		got := RequiresPrivateIPAccess(tc.baseURL)
		if got != tc.want {
			t.Fatalf("RequiresPrivateIPAccess(%q) = %v, want %v", tc.baseURL, got, tc.want)
		}
	}
}

func TestBootstrapConfiguresLabViaHTTPAPI(t *testing.T) {
	type channelEntry struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	}
	type tokenEntry struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	}

	setupComplete := false
	channels := []channelEntry{{ID: 7, Name: "governor-lab-mock"}}
	tokens := []tokenEntry{{ID: 11, Name: "governor-lab-token"}}
	nextChannelID := 8
	nextTokenID := 12
	optionUpdates := make(map[string]string)
	var addedChannelPayload map[string]any
	var addedTokenPayload map[string]any
	fixChannelsCalls := 0

	writeEnvelope := func(w http.ResponseWriter, data any) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"success": true,
			"message": "",
			"data":    data,
		})
	}

	requireAuth := func(t *testing.T, w http.ResponseWriter, r *http.Request) bool {
		t.Helper()
		cookie, err := r.Cookie("session")
		if err != nil || cookie.Value != "test-session" {
			http.Error(w, `{"success":false,"message":"missing session"}`, http.StatusUnauthorized)
			return false
		}
		if got := r.Header.Get("New-Api-User"); got != "1" {
			http.Error(w, `{"success":false,"message":"missing New-Api-User"}`, http.StatusUnauthorized)
			return false
		}
		return true
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/api/setup":
			writeEnvelope(w, map[string]any{
				"status":        setupComplete,
				"root_init":     false,
				"database_type": "sqlite",
			})
		case r.Method == http.MethodPost && r.URL.Path == "/api/setup":
			setupComplete = true
			writeEnvelope(w, nil)
		case r.Method == http.MethodPost && r.URL.Path == "/api/user/login":
			http.SetCookie(w, &http.Cookie{Name: "session", Value: "test-session", Path: "/"})
			writeEnvelope(w, map[string]any{
				"id":           1,
				"username":     "rootlab",
				"display_name": "Root User",
				"role":         100,
				"status":       1,
				"group":        "default",
			})
		case r.Method == http.MethodPut && r.URL.Path == "/api/option/":
			if !requireAuth(t, w, r) {
				return
			}
			var payload struct {
				Key   string `json:"key"`
				Value any    `json:"value"`
			}
			if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
				t.Fatalf("expected valid option payload: %v", err)
			}
			optionUpdates[payload.Key] = stringifyValue(payload.Value)
			writeEnvelope(w, nil)
		case r.Method == http.MethodGet && r.URL.Path == "/api/channel/":
			if !requireAuth(t, w, r) {
				return
			}
			writeEnvelope(w, map[string]any{"items": channels})
		case r.Method == http.MethodDelete && strings.HasPrefix(r.URL.Path, "/api/channel/"):
			if !requireAuth(t, w, r) {
				return
			}
			idText := strings.TrimPrefix(r.URL.Path, "/api/channel/")
			id, err := strconv.Atoi(idText)
			if err != nil {
				t.Fatalf("expected numeric channel id, got %q", idText)
			}
			filtered := make([]channelEntry, 0, len(channels))
			for _, entry := range channels {
				if entry.ID != id {
					filtered = append(filtered, entry)
				}
			}
			channels = filtered
			writeEnvelope(w, nil)
		case r.Method == http.MethodPost && r.URL.Path == "/api/channel/":
			if !requireAuth(t, w, r) {
				return
			}
			if err := json.NewDecoder(r.Body).Decode(&addedChannelPayload); err != nil {
				t.Fatalf("expected valid channel payload: %v", err)
			}
			channels = append(channels, channelEntry{ID: nextChannelID, Name: "governor-lab-mock"})
			nextChannelID++
			writeEnvelope(w, nil)
		case r.Method == http.MethodPost && r.URL.Path == "/api/channel/fix":
			if !requireAuth(t, w, r) {
				return
			}
			fixChannelsCalls++
			writeEnvelope(w, map[string]any{"success": 1, "fails": 0})
		case r.Method == http.MethodGet && r.URL.Path == "/api/token/":
			if !requireAuth(t, w, r) {
				return
			}
			writeEnvelope(w, map[string]any{"items": tokens})
		case r.Method == http.MethodDelete && strings.HasPrefix(r.URL.Path, "/api/token/"):
			if !requireAuth(t, w, r) {
				return
			}
			idText := strings.TrimPrefix(r.URL.Path, "/api/token/")
			id, err := strconv.Atoi(idText)
			if err != nil {
				t.Fatalf("expected numeric token id, got %q", idText)
			}
			filtered := make([]tokenEntry, 0, len(tokens))
			for _, entry := range tokens {
				if entry.ID != id {
					filtered = append(filtered, entry)
				}
			}
			tokens = filtered
			writeEnvelope(w, nil)
		case r.Method == http.MethodPost && r.URL.Path == "/api/token/":
			if !requireAuth(t, w, r) {
				return
			}
			if err := json.NewDecoder(r.Body).Decode(&addedTokenPayload); err != nil {
				t.Fatalf("expected valid token payload: %v", err)
			}
			tokens = append(tokens, tokenEntry{ID: nextTokenID, Name: "governor-lab-token"})
			nextTokenID++
			writeEnvelope(w, nil)
		case r.Method == http.MethodPost && r.URL.Path == "/api/token/12/key":
			if !requireAuth(t, w, r) {
				return
			}
			writeEnvelope(w, map[string]any{"key": "sk-test-token"})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client, err := NewClient(server.URL)
	if err != nil {
		t.Fatalf("expected client initialization to succeed, got error: %v", err)
	}

	result, err := client.Bootstrap(context.Background(), BootstrapConfig{
		Username:           "rootlab",
		Password:           "rootpass123",
		SelfUseModeEnabled: true,
		DemoSiteEnabled:    false,
		ChannelName:        "governor-lab-mock",
		ChannelKey:         "mock-upstream-key",
		ChannelType:        1,
		ChannelModel:       "gpt-4o-mini",
		ChannelGroup:       "default",
		ChannelBaseURL:     "http://127.0.0.1:8080",
		ChannelSettings:    `{"governor":{"enabled":true,"key_max_concurrency":1}}`,
		TokenName:          "governor-lab-token",
		TokenGroup:         "default",
	})
	if err != nil {
		t.Fatalf("expected bootstrap to succeed, got error: %v", err)
	}

	if result.UserID != 1 {
		t.Fatalf("expected user id 1, got %d", result.UserID)
	}
	if result.ChannelID != 8 {
		t.Fatalf("expected recreated channel id 8, got %d", result.ChannelID)
	}
	if result.TokenID != 12 {
		t.Fatalf("expected recreated token id 12, got %d", result.TokenID)
	}
	if result.APIKey != "sk-test-token" {
		t.Fatalf("expected full token key, got %q", result.APIKey)
	}
	if result.Model != "gpt-4o-mini" {
		t.Fatalf("expected model gpt-4o-mini, got %q", result.Model)
	}
	if optionUpdates["fetch_setting.allow_private_ip"] != "true" {
		t.Fatalf("expected allow_private_ip to be enabled for local mock, got %q", optionUpdates["fetch_setting.allow_private_ip"])
	}

	channel, ok := addedChannelPayload["channel"].(map[string]any)
	if !ok {
		t.Fatalf("expected wrapped channel payload, got %#v", addedChannelPayload)
	}
	if got := channel["base_url"]; got != "http://127.0.0.1:8080" {
		t.Fatalf("expected mock base url to be forwarded, got %#v", got)
	}
	if got := channel["setting"]; got != `{"governor":{"enabled":true,"key_max_concurrency":1}}` {
		t.Fatalf("expected governor settings to be forwarded, got %#v", got)
	}
	if got := channel["models"]; got != "gpt-4o-mini" {
		t.Fatalf("expected model list to be forwarded, got %#v", got)
	}

	if got := addedTokenPayload["name"]; got != "governor-lab-token" {
		t.Fatalf("expected token name to be forwarded, got %#v", got)
	}
	if got := addedTokenPayload["group"]; got != "default" {
		t.Fatalf("expected token group to be forwarded, got %#v", got)
	}
	if fixChannelsCalls != 1 {
		t.Fatalf("expected bootstrap to rebuild channel abilities/cache once, got %d calls", fixChannelsCalls)
	}
}

func stringifyValue(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case bool:
		if typed {
			return "true"
		}
		return "false"
	default:
		return ""
	}
}
