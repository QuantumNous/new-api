package service

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/require"
)

func TestExtractCodexOfficialNoticeFindingsMatchesConfiguredModels(t *testing.T) {
	findings := ExtractCodexOfficialNoticeFindings(
		"Codex update: gpt-5.3-codex will be retired. gpt-5.4-codex remains available.",
		[]string{"gpt-5.3-codex", "gpt-5.4-codex"},
		[]string{"retired"},
	)

	require.Len(t, findings, 1)
	require.Equal(t, "gpt-5.3-codex", findings[0].ModelName)
	require.Equal(t, model.CodexModelGovernanceSourceOfficialCodexNotice, findings[0].Source)
	require.Equal(t, "retired", findings[0].MatchedRule)
	require.Contains(t, findings[0].LastError, "gpt-5.3-codex")
}

func TestExtractCodexOfficialNoticeFindingsByAIUsesStructuredResponse(t *testing.T) {
	allowCodexOfficialNoticeAITestServer(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)
		require.Equal(t, "/v1/responses", r.URL.Path)
		require.Equal(t, "Bearer sk-test", r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"output": [
				{
					"type": "message",
					"content": [
						{
							"type": "output_text",
							"text": "{\"findings\":[{\"model_name\":\"gpt-5.3-codex\",\"lifecycle_term\":\"retired\",\"evidence\":\"gpt-5.3-codex is retired for Codex users.\"}]}"
						}
					]
				}
			]
		}`))
	}))
	defer server.Close()
	useCodexOfficialNoticeHTTPClient(t, server.Client())

	t.Setenv("MONITOR_AI_ANALYSIS_BASE_URL", server.URL+"/v1")
	t.Setenv("MONITOR_AI_ANALYSIS_MODEL", "gpt-test")

	findings, err := ExtractCodexOfficialNoticeFindingsByAI(
		"Codex update: gpt-5.3-codex is retired for Codex users. gpt-5.4-codex remains available.",
		[]string{"gpt-5.3-codex", "gpt-5.4-codex"},
		"https://example.com/codex/changelog",
		"sk-test",
	)

	require.NoError(t, err)
	require.Len(t, findings, 1)
	require.Equal(t, "gpt-5.3-codex", findings[0].ModelName)
	require.Equal(t, model.CodexModelGovernanceSourceOfficialCodexNotice, findings[0].Source)
	require.Equal(t, "ai_analysis:retired", findings[0].MatchedRule)
	require.Contains(t, findings[0].LastError, "retired for Codex users")
}

func TestExtractCodexOfficialNoticeFindingsByAIUsesConfiguredEndpointAndModel(t *testing.T) {
	allowCodexOfficialNoticeAITestServer(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)
		require.Equal(t, "/custom/responses", r.URL.Path)
		require.Equal(t, "Bearer sk-test", r.Header.Get("Authorization"))

		var request codexOfficialNoticeAIRequest
		require.NoError(t, common.DecodeJson(r.Body, &request))
		require.Equal(t, "gpt-configured-monitor", request.Model)

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"output_text": "{\"findings\":[{\"model_name\":\"gpt-5.3-codex\",\"lifecycle_term\":\"retired\",\"evidence\":\"gpt-5.3-codex is retired for Codex users.\"}]}"
		}`))
	}))
	defer server.Close()
	useCodexOfficialNoticeHTTPClient(t, server.Client())

	t.Setenv("MONITOR_AI_ANALYSIS_BASE_URL", "http://127.0.0.1:9/env")
	t.Setenv("MONITOR_AI_ANALYSIS_MODEL", "gpt-env-monitor")

	findings, err := ExtractCodexOfficialNoticeFindingsByAIWithOptions(
		"Codex update: gpt-5.3-codex is retired for Codex users.",
		[]string{"gpt-5.3-codex"},
		"https://example.com/codex/changelog",
		CodexOfficialNoticeAIOptions{
			APIKey:  "sk-test",
			BaseURL: server.URL + "/custom",
			Model:   "gpt-configured-monitor",
		},
	)

	require.NoError(t, err)
	require.Len(t, findings, 1)
	require.Equal(t, "gpt-5.3-codex", findings[0].ModelName)
	require.Equal(t, "ai_analysis:retired", findings[0].MatchedRule)
}

func TestExtractCodexOfficialNoticeFindingsByAIIgnoresModelsOutsideCandidateList(t *testing.T) {
	allowCodexOfficialNoticeAITestServer(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"output_text": "{\"findings\":[{\"model_name\":\"gpt-invented-codex\",\"lifecycle_term\":\"retired\",\"evidence\":\"not in candidate list\"}]}"
		}`))
	}))
	defer server.Close()
	useCodexOfficialNoticeHTTPClient(t, server.Client())

	t.Setenv("MONITOR_AI_ANALYSIS_BASE_URL", server.URL+"/v1")
	t.Setenv("MONITOR_AI_ANALYSIS_MODEL", "gpt-test")

	findings, err := ExtractCodexOfficialNoticeFindingsByAI(
		"gpt-invented-codex is retired.",
		[]string{"gpt-5.3-codex"},
		"https://example.com/codex/changelog",
		"sk-test",
	)

	require.NoError(t, err)
	require.Empty(t, findings)
}

func TestExtractCodexOfficialNoticeFindingsByAITruncatesEvidence(t *testing.T) {
	allowCodexOfficialNoticeAITestServer(t)
	longEvidence := strings.Repeat("e", officialCodexNoticeExcerptMaxLength+50)
	payload, err := common.Marshal(codexOfficialNoticeAIHTTPResponse{
		OutputText: `{"findings":[{"model_name":"gpt-5.3-codex","lifecycle_term":"retired","evidence":"` + longEvidence + `"}]}`,
	})
	require.NoError(t, err)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(payload)
	}))
	defer server.Close()
	useCodexOfficialNoticeHTTPClient(t, server.Client())

	t.Setenv("MONITOR_AI_ANALYSIS_BASE_URL", server.URL+"/v1")
	t.Setenv("MONITOR_AI_ANALYSIS_MODEL", "gpt-test")

	findings, err := ExtractCodexOfficialNoticeFindingsByAI(
		"gpt-5.3-codex is retired.",
		[]string{"gpt-5.3-codex"},
		"https://example.com/codex/changelog",
		"sk-test",
	)

	require.NoError(t, err)
	require.Len(t, findings, 1)
	require.LessOrEqual(t, len([]rune(findings[0].LastError)), officialCodexNoticeExcerptMaxLength)
}

func TestExtractCodexOfficialNoticeFindingsByAIReturnsErrorOnMalformedResponse(t *testing.T) {
	allowCodexOfficialNoticeAITestServer(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"output_text":"not json"}`))
	}))
	defer server.Close()
	useCodexOfficialNoticeHTTPClient(t, server.Client())

	t.Setenv("MONITOR_AI_ANALYSIS_BASE_URL", server.URL+"/v1")
	t.Setenv("MONITOR_AI_ANALYSIS_MODEL", "gpt-test")

	_, err := ExtractCodexOfficialNoticeFindingsByAI(
		"gpt-5.3-codex is retired.",
		[]string{"gpt-5.3-codex"},
		"https://example.com/codex/changelog",
		"sk-test",
	)

	require.Error(t, err)
}

func TestExtractCodexOfficialNoticeFindingsWithOptionalAIDowngradesToRulesWhenAIUnavailable(t *testing.T) {
	allowCodexOfficialNoticeAITestServer(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":{"message":"temporary unavailable"}}`))
	}))
	defer server.Close()
	useCodexOfficialNoticeHTTPClient(t, server.Client())

	t.Setenv("MONITOR_AI_ANALYSIS_BASE_URL", server.URL+"/v1")
	t.Setenv("MONITOR_AI_ANALYSIS_MODEL", "gpt-test")

	findings, usedAI, err := ExtractCodexOfficialNoticeFindingsWithOptionalAI(
		"Codex update: gpt-5.3-codex will be retired.",
		[]string{"gpt-5.3-codex"},
		[]string{"retired"},
		"https://example.com/codex/changelog",
		"sk-test",
	)

	require.True(t, usedAI)
	require.Error(t, err)
	// AI failure degrades to the keyword path so coverage never pauses.
	// Official-notice findings only alert (never auto-disable), so the
	// coarser rules cannot cause a service impact.
	require.Len(t, findings, 1)
	require.Equal(t, "gpt-5.3-codex", findings[0].ModelName)
	require.Equal(t, "retired", findings[0].MatchedRule)
}

func TestExtractCodexOfficialNoticeFindingsWithOptionalAIUsesRulesWithoutAPIKey(t *testing.T) {
	findings, usedAI, err := ExtractCodexOfficialNoticeFindingsWithOptionalAI(
		"Codex update: gpt-5.3-codex will be retired.",
		[]string{"gpt-5.3-codex"},
		[]string{"retired"},
		"https://example.com/codex/changelog",
		"",
	)

	require.False(t, usedAI)
	require.NoError(t, err)
	require.Len(t, findings, 1)
	require.Equal(t, "gpt-5.3-codex", findings[0].ModelName)
}

func TestFetchCodexOfficialSourceFailsClosedWhenHTTPClientMissing(t *testing.T) {
	allowCodexOfficialNoticeAITestServer(t)
	useCodexOfficialNoticeHTTPClient(t, nil)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("gpt-5.3-codex retired"))
	}))
	defer server.Close()

	_, err := FetchCodexOfficialSource(server.URL)

	require.Error(t, err)
	require.Contains(t, err.Error(), "http client")
}

func TestExtractCodexOfficialNoticeFindingsByAIFailsClosedWhenHTTPClientMissing(t *testing.T) {
	allowCodexOfficialNoticeAITestServer(t)
	useCodexOfficialNoticeHTTPClient(t, nil)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"output_text":"{\"findings\":[]}"}`))
	}))
	defer server.Close()

	_, err := ExtractCodexOfficialNoticeFindingsByAIWithOptions(
		"gpt-5.3-codex retired",
		[]string{"gpt-5.3-codex"},
		"https://example.com/codex/changelog",
		CodexOfficialNoticeAIOptions{
			APIKey:  "sk-test",
			BaseURL: server.URL + "/v1",
			Model:   "gpt-test",
		},
	)

	require.Error(t, err)
	require.Contains(t, err.Error(), "http client")
}

func allowCodexOfficialNoticeAITestServer(t *testing.T) {
	t.Helper()
	original := *system_setting.GetFetchSetting()
	t.Cleanup(func() {
		*system_setting.GetFetchSetting() = original
	})
	system_setting.GetFetchSetting().EnableSSRFProtection = false
}

func useCodexOfficialNoticeHTTPClient(t *testing.T, client *http.Client) {
	t.Helper()
	original := httpClient
	httpClient = client
	t.Cleanup(func() {
		httpClient = original
	})
}
