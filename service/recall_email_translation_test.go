package service

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/require"
)

var recallEmailTranslationTestLanguages = []string{"zh", "es", "fr", "pt", "ru", "ja", "vi"}

func TestRecallEmailTranslatorTranslatesMultipleStagesInOneStructuredRequest(t *testing.T) {
	allowRecallEmailTranslationTestServer(t)
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		require.Equal(t, http.MethodPost, r.Method)
		require.Equal(t, "/custom/responses", r.URL.Path)
		require.Equal(t, "Bearer sk-translation", r.Header.Get("Authorization"))

		var request map[string]any
		require.NoError(t, common.DecodeJson(r.Body, &request))
		require.Equal(t, "gpt-translation", request["model"])
		require.EqualValues(t, 32768, request["max_output_tokens"])
		requestJSON, err := common.Marshal(request)
		require.NoError(t, err)
		requestText := string(requestJSON)
		require.Contains(t, requestText, `"type":"json_schema"`)
		require.Contains(t, requestText, `"strict":true`)
		require.Contains(t, requestText, `"additionalProperties":false`)
		for _, language := range recallEmailTranslationTestLanguages {
			require.Contains(t, requestText, `"`+language+`"`)
		}
		require.Contains(t, requestText, "First subject")
		require.Contains(t, requestText, "Second body")

		writeRecallEmailTranslationResponse(t, w, validRecallEmailTranslationResultFromRequest(t, request, []int{1, 2}))
	}))
	defer server.Close()

	translator := NewRecallEmailTranslator(RecallEmailTranslatorOptions{
		APIKey:  "sk-translation",
		BaseURL: server.URL + "/custom/",
		Model:   "gpt-translation",
		Client:  server.Client(),
	})
	translated, err := translator.Translate(context.Background(), []RecallEmailStage{
		{StageNo: 1, Templates: map[string]RecallEmailTemplate{"en": {Subject: "First subject", BodyText: "First body"}}},
		{StageNo: 2, Templates: map[string]RecallEmailTemplate{"en": {Subject: "Second subject", BodyText: "Second body"}}},
	})

	require.NoError(t, err)
	require.EqualValues(t, 1, requests.Load())
	require.Len(t, translated, 2)
	require.Equal(t, "zh subject 1", translated[1]["zh"].Subject)
	require.Equal(t, "vi body 2", translated[2]["vi"].BodyText)
}

func TestRecallEmailTranslationSendsOnlyVisibleHTMLSegments(t *testing.T) {
	allowRecallEmailTranslationTestServer(t)
	htmlBody := recallEmailTranslationHTMLWithAttributes()
	expectedHTMLSegments := recallEmailTranslationHTMLSegments(t, htmlBody)
	require.Equal(t, []string{
		"Flatkey logo",
		"Hello {{.RecipientName}}",
		"{{.PromotionCodeMasked}} · {{.ProductSummary}} · {{.ExpiresAt}}",
		"Claim offer",
		"Support center",
		"Get help",
		"Help",
		"Unsubscribe",
	}, expectedHTMLSegments)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request map[string]any
		require.NoError(t, common.DecodeJson(r.Body, &request))
		requestStrings := recallEmailTranslationRequestStrings(request)
		forbidden := []string{
			"<html", "<a", "href=", "style=",
			"https://flatkey.ai/logo.png", "https://flatkey.ai/help",
			"{{.ClaimURL}}", "{{.UnsubscribeURL}}",
		}
		for _, value := range requestStrings {
			lower := strings.ToLower(value)
			for _, token := range forbidden {
				require.NotContains(t, lower, strings.ToLower(token), "request string leaked protected markup/url/action: %q", value)
			}
		}

		stages := recallEmailTranslationRequestStages(t, request)
		require.Len(t, stages, 2)
		requireRecallEmailTranslationStageRequest(t, stages[0], 1, "HTML subject", expectedHTMLSegments)
		requireRecallEmailTranslationStageRequest(t, stages[1], 2, "Legacy subject", []string{"Legacy plain body"})

		writeRecallEmailTranslationResponse(t, w, recallEmailTranslationSegmentsResult(map[int][]string{
			1: recallEmailTranslationRequestBodySegments(t, stages[0]),
			2: recallEmailTranslationRequestBodySegments(t, stages[1]),
		}))
	}))
	defer server.Close()

	translator := newRecallEmailTranslationTestTranslator(server, RecallEmailTranslatorOptions{})
	translated, err := translator.Translate(context.Background(), []RecallEmailStage{
		{StageNo: 1, Templates: map[string]RecallEmailTemplate{"en": {Subject: "HTML subject", BodyHTML: htmlBody}}},
		{StageNo: 2, Templates: map[string]RecallEmailTemplate{"en": {Subject: "Legacy subject", BodyText: "Legacy plain body"}}},
	})

	require.NoError(t, err)
	htmlTemplate := translated[1]["zh"]
	require.Empty(t, htmlTemplate.BodyText)
	require.NotEmpty(t, htmlTemplate.BodyHTML)
	require.Contains(t, htmlTemplate.BodyHTML, "<html")
	require.Contains(t, htmlTemplate.BodyHTML, `<style>.cta{background:#111;color:#fff}</style>`)
	require.Contains(t, htmlTemplate.BodyHTML, `src="https://flatkey.ai/logo.png"`)
	require.Contains(t, htmlTemplate.BodyHTML, `href="{{.ClaimURL}}"`)
	require.Contains(t, htmlTemplate.BodyHTML, `href="https://flatkey.ai/help"`)
	require.Contains(t, htmlTemplate.BodyHTML, `href="{{.UnsubscribeURL}}"`)
	require.NotContains(t, htmlTemplate.BodyHTML, "__RECALL_EMAIL_SEGMENT_")
	require.Equal(t, 6, strings.Count(htmlTemplate.BodyHTML, "{{."))
	require.Contains(t, htmlTemplate.BodyHTML, `title="zh:Support center"`)
	require.Contains(t, htmlTemplate.BodyHTML, `aria-label="zh:Get help"`)
	require.Contains(t, htmlTemplate.BodyHTML, ">zh:Claim offer</a>")
	require.Equal(t, RecallEmailTemplate{Subject: "zh:Legacy subject", BodyText: "zh:Legacy plain body"}, translated[2]["zh"])
	require.NotContains(t, translated[2]["zh"].BodyText, "__RECALL_EMAIL_SEGMENT_")
}

func TestRecallEmailTranslationRejectsWrongBodySegmentCount(t *testing.T) {
	allowRecallEmailTranslationTestServer(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		writeRecallEmailTranslationResponse(t, w, recallEmailTranslationSegmentsResult(map[int][]string{
			1: []string{"only one"},
		}))
	}))
	defer server.Close()

	translator := newRecallEmailTranslationTestTranslator(server, RecallEmailTranslatorOptions{})
	_, err := translator.Translate(context.Background(), []RecallEmailStage{{
		StageNo:   1,
		Templates: map[string]RecallEmailTemplate{"en": {Subject: "HTML subject", BodyHTML: validRecallHTML}},
	}})

	require.ErrorContains(t, err, "invalid recall email translation output: stage 1 language zh returned 1 body segments; expected 5")
}

func TestRecallEmailTranslationRejectsChangedMarkerFreeSegmentIdentity(t *testing.T) {
	allowRecallEmailTranslationTestServer(t)
	tests := []struct {
		name   string
		mutate func([]string)
		want   string
	}{
		{name: "swapped", mutate: func(segments []string) {
			segments[0], segments[3] = segments[3], segments[0]
		}, want: "segment identity changed"},
		{name: "duplicated", mutate: func(segments []string) {
			segments[3] = segments[0]
		}, want: "segment identity changed"},
		{name: "emptied", mutate: func(segments []string) {
			segments[3] = recallEmailTranslationExtractSegmentIdentityForTest(segments[3])
		}, want: "body segment 4 is empty"},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				var request map[string]any
				require.NoError(t, common.DecodeJson(r.Body, &request))
				stages := recallEmailTranslationRequestStages(t, request)
				segments := recallEmailTranslationRequestBodySegments(t, stages[0])
				testCase.mutate(segments)
				writeRecallEmailTranslationResponse(t, w, recallEmailTranslationSegmentsResult(map[int][]string{1: segments}))
			}))
			defer server.Close()

			translator := newRecallEmailTranslationTestTranslator(server, RecallEmailTranslatorOptions{})
			_, err := translator.Translate(context.Background(), []RecallEmailStage{{
				StageNo: 1,
				Templates: map[string]RecallEmailTemplate{"en": {
					Subject:  "HTML subject",
					BodyHTML: recallEmailTranslationHTMLWithAttributes(),
				}},
			}})

			require.ErrorContains(t, err, testCase.want)
		})
	}
}

func TestRecallEmailTranslationRejectsProtectedValueChangesAcrossHTMLSegments(t *testing.T) {
	allowRecallEmailTranslationTestServer(t)
	tests := []struct {
		name   string
		mutate func([]string, []string)
	}{
		{name: "moved", mutate: func(segments []string, sentinels []string) {
			sourceIndex := recallEmailTranslationSegmentIndexContainingForTest(segments, sentinels[0])
			targetIndex := recallEmailTranslationSegmentIndexContainingForTest(segments, sentinels[1])
			segments[sourceIndex] = strings.ReplaceAll(segments[sourceIndex], sentinels[0], "")
			segments[targetIndex] += " " + sentinels[0]
		}},
		{name: "deleted", mutate: func(segments []string, sentinels []string) {
			sourceIndex := recallEmailTranslationSegmentIndexContainingForTest(segments, sentinels[0])
			segments[sourceIndex] = strings.ReplaceAll(segments[sourceIndex], sentinels[0], "")
		}},
		{name: "copied", mutate: func(segments []string, sentinels []string) {
			targetIndex := recallEmailTranslationSegmentIndexContainingForTest(segments, sentinels[1])
			segments[targetIndex] += " " + sentinels[0]
		}},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				var request map[string]any
				require.NoError(t, common.DecodeJson(r.Body, &request))
				stages := recallEmailTranslationRequestStages(t, request)
				segments := recallEmailTranslationRequestBodySegments(t, stages[0])
				sentinels := regexp.MustCompile(`__RECALL_EMAIL_PROTECTED_[0-9a-f]{32}_[0-9]{4}__`).FindAllString(strings.Join(segments, "\n"), -1)
				require.GreaterOrEqual(t, len(sentinels), 2)
				testCase.mutate(segments, sentinels)
				writeRecallEmailTranslationResponse(t, w, recallEmailTranslationSegmentsResult(map[int][]string{1: segments}))
			}))
			defer server.Close()

			translator := newRecallEmailTranslationTestTranslator(server, RecallEmailTranslatorOptions{})
			_, err := translator.Translate(context.Background(), []RecallEmailStage{{
				StageNo:   1,
				Templates: map[string]RecallEmailTemplate{"en": {Subject: "HTML subject", BodyHTML: validRecallHTML}},
			}})

			require.ErrorContains(t, err, "protected marker sequence changed")
		})
	}
}

func TestRecallEmailTranslationPreflightLimitsBeforeProviderRequest(t *testing.T) {
	allowRecallEmailTranslationTestServer(t)
	tests := []struct {
		name         string
		bodyHTML     string
		wantErr      string
		wantRequests int32
	}{
		{name: "segment count limit", bodyHTML: recallEmailTranslationHTMLWithTextSegments(118, "x"), wantRequests: 1},
		{name: "segment count over limit", bodyHTML: recallEmailTranslationHTMLWithTextSegments(119, "x"), wantErr: "segment count limit"},
		{name: "source bytes limit", bodyHTML: recallEmailTranslationHTMLWithTextSegments(2, strings.Repeat("x", 9999)), wantRequests: 1},
		{name: "source bytes over limit", bodyHTML: recallEmailTranslationHTMLWithTextSegments(2, strings.Repeat("x", 10000)), wantErr: "source translatable bytes limit"},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			var requests atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				requests.Add(1)
				var request map[string]any
				require.NoError(t, common.DecodeJson(r.Body, &request))
				stages := recallEmailTranslationRequestStages(t, request)
				writeRecallEmailTranslationResponse(t, w, recallEmailTranslationSegmentsResult(map[int][]string{
					1: recallEmailTranslationRequestBodySegments(t, stages[0]),
				}))
			}))
			defer server.Close()

			translator := newRecallEmailTranslationTestTranslator(server, RecallEmailTranslatorOptions{})
			_, err := translator.Translate(context.Background(), []RecallEmailStage{{
				StageNo:   1,
				Templates: map[string]RecallEmailTemplate{"en": {Subject: "HTML subject", BodyHTML: testCase.bodyHTML}},
			}})

			if testCase.wantErr == "" {
				require.NoError(t, err)
			} else {
				require.ErrorContains(t, err, testCase.wantErr)
			}
			require.Equal(t, testCase.wantRequests, requests.Load())
		})
	}
}

func TestRecallEmailTranslationRejectsChangedProtectedActionsInSegments(t *testing.T) {
	allowRecallEmailTranslationTestServer(t)
	tests := []struct {
		name  string
		reply func([]string) string
	}{
		{name: "missing", reply: func(sentinels []string) string {
			return "body " + sentinels[0]
		}},
		{name: "duplicated", reply: func(sentinels []string) string {
			return "body " + sentinels[0] + " then " + sentinels[0]
		}},
		{name: "reordered", reply: func(sentinels []string) string {
			return "body " + sentinels[1] + " then " + sentinels[0]
		}},
		{name: "modified", reply: func([]string) string {
			return "body __RECALL_EMAIL_PROTECTED_00000000000000000000000000000000_9999__"
		}},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			sentinelPattern := regexp.MustCompile(`__RECALL_EMAIL_PROTECTED_[0-9a-f]{32}_[0-9]{4}__`)
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				raw, err := io.ReadAll(r.Body)
				require.NoError(t, err)
				sentinels := sentinelPattern.FindAllString(string(raw), -1)
				require.GreaterOrEqual(t, len(sentinels), 2)

				writeRecallEmailTranslationResponse(t, w, recallEmailTranslationSegmentsResult(map[int][]string{
					1: []string{testCase.reply(sentinels)},
				}))
			}))
			defer server.Close()

			translator := newRecallEmailTranslationTestTranslator(server, RecallEmailTranslatorOptions{})
			_, err := translator.Translate(context.Background(), []RecallEmailStage{{
				StageNo: 1,
				Templates: map[string]RecallEmailTemplate{"en": {
					Subject:  "Subject {{name}}",
					BodyText: "Body {{first}} then {{second}}",
				}},
			}})

			require.ErrorContains(t, err, "protected marker sequence changed")
		})
	}
}

func TestRecallEmailTranslatorFromMonitorSettingsResolvesUpdatedConfigPerTranslate(t *testing.T) {
	allowRecallEmailTranslationTestServer(t)
	preserveRecallEmailTranslationMonitorSettings(t)
	var firstRequests atomic.Int32
	firstServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		firstRequests.Add(1)
		require.Equal(t, "Bearer sk-monitor-first", r.Header.Get("Authorization"))
		var request map[string]any
		require.NoError(t, common.DecodeJson(r.Body, &request))
		require.Equal(t, "gpt-monitor-first", request["model"])
		writeRecallEmailTranslationResponse(t, w, validRecallEmailTranslationResultFromRequest(t, request, []int{1}))
	}))
	defer firstServer.Close()
	var secondRequests atomic.Int32
	secondServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		secondRequests.Add(1)
		require.Equal(t, "Bearer sk-monitor-second", r.Header.Get("Authorization"))
		var request map[string]any
		require.NoError(t, common.DecodeJson(r.Body, &request))
		require.Equal(t, "gpt-monitor-second", request["model"])
		writeRecallEmailTranslationResponse(t, w, validRecallEmailTranslationResultFromRequest(t, request, []int{1}))
	}))
	defer secondServer.Close()

	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"monitor_setting.ai_analysis_api_key":  "sk-monitor-first",
		"monitor_setting.ai_analysis_base_url": firstServer.URL + "/v1",
		"monitor_setting.ai_analysis_model":    "gpt-monitor-first",
	}))
	translator := NewRecallEmailTranslatorFromMonitorSettings(RecallEmailTranslatorOptions{Client: firstServer.Client()})
	_, err := translator.Translate(context.Background(), recallEmailTranslationTestStages())
	require.NoError(t, err)

	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"monitor_setting.ai_analysis_api_key":  "sk-monitor-second",
		"monitor_setting.ai_analysis_base_url": secondServer.URL + "/v1",
		"monitor_setting.ai_analysis_model":    "gpt-monitor-second",
	}))
	_, err = translator.Translate(context.Background(), recallEmailTranslationTestStages())

	require.NoError(t, err)
	require.EqualValues(t, 1, firstRequests.Load())
	require.EqualValues(t, 1, secondRequests.Load())
}

func TestRecallEmailTranslatorExplicitOptionsRemainStaticAfterMonitorSettingsChange(t *testing.T) {
	allowRecallEmailTranslationTestServer(t)
	preserveRecallEmailTranslationMonitorSettings(t)
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		require.Equal(t, "Bearer sk-explicit", r.Header.Get("Authorization"))
		var request map[string]any
		require.NoError(t, common.DecodeJson(r.Body, &request))
		require.Equal(t, "gpt-explicit", request["model"])
		writeRecallEmailTranslationResponse(t, w, validRecallEmailTranslationResultFromRequest(t, request, []int{1}))
	}))
	defer server.Close()
	translator := NewRecallEmailTranslator(RecallEmailTranslatorOptions{
		APIKey:  "sk-explicit",
		BaseURL: server.URL + "/v1",
		Model:   "gpt-explicit",
		Client:  server.Client(),
	})

	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"monitor_setting.ai_analysis_api_key":  "sk-monitor-other",
		"monitor_setting.ai_analysis_base_url": "https://monitor.invalid/v1",
		"monitor_setting.ai_analysis_model":    "gpt-monitor-other",
	}))
	_, err := translator.Translate(context.Background(), recallEmailTranslationTestStages())

	require.NoError(t, err)
	require.EqualValues(t, 1, requests.Load())
}

func TestRecallEmailTranslatorRejectsMissingAPIKey(t *testing.T) {
	translator := NewRecallEmailTranslator(RecallEmailTranslatorOptions{})
	_, err := translator.Translate(context.Background(), recallEmailTranslationTestStages())
	require.Error(t, err)
	require.Contains(t, strings.ToLower(err.Error()), "api key")
}

func TestRecallEmailTranslatorDoesNotRetryPermanentHTTPFailuresAndRedactsBody(t *testing.T) {
	allowRecallEmailTranslationTestServer(t)
	for _, status := range []int{http.StatusBadRequest, http.StatusUnauthorized, 600} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			var requests atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				requests.Add(1)
				w.WriteHeader(status)
				_, _ = w.Write([]byte(`{"error":"Authorization: Bearer sk-secret provider details"}`))
			}))
			defer server.Close()

			translator := newRecallEmailTranslationTestTranslator(server, RecallEmailTranslatorOptions{})
			_, err := translator.Translate(context.Background(), recallEmailTranslationTestStages())

			require.Error(t, err)
			require.EqualValues(t, 1, requests.Load())
			require.Contains(t, err.Error(), "status "+strconv.Itoa(status))
			require.NotContains(t, err.Error(), "sk-secret")
			require.NotContains(t, err.Error(), "provider details")
		})
	}
}

func TestRecallEmailTranslatorRetriesTemporaryHTTPFailures(t *testing.T) {
	allowRecallEmailTranslationTestServer(t)
	for _, status := range []int{http.StatusRequestTimeout, http.StatusTooManyRequests, http.StatusInternalServerError, http.StatusBadGateway, http.StatusServiceUnavailable, http.StatusGatewayTimeout} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			var requests atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				attempt := requests.Add(1)
				if attempt < 3 {
					w.Header().Set("Retry-After", "0")
					w.WriteHeader(status)
					return
				}
				var request map[string]any
				require.NoError(t, common.DecodeJson(r.Body, &request))
				writeRecallEmailTranslationResponse(t, w, validRecallEmailTranslationResultFromRequest(t, request, []int{1}))
			}))
			defer server.Close()

			translator := newRecallEmailTranslationTestTranslator(server, RecallEmailTranslatorOptions{})
			translated, err := translator.Translate(context.Background(), recallEmailTranslationTestStages())

			require.NoError(t, err)
			require.EqualValues(t, 3, requests.Load())
			require.Equal(t, "fr body 1", translated[1]["fr"].BodyText)
		})
	}
}

func TestRecallEmailTranslatorRetriesTemporaryNetworkFailures(t *testing.T) {
	var requests atomic.Int32
	client := &http.Client{Transport: recallEmailTranslationRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		attempt := requests.Add(1)
		if attempt < 3 {
			return nil, temporaryTranslationNetworkError{}
		}
		var request map[string]any
		require.NoError(t, common.DecodeJson(r.Body, &request))
		payload := recallEmailTranslationHTTPPayload(t, validRecallEmailTranslationResultFromRequest(t, request, []int{1}))
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     make(http.Header),
			Body:       io.NopCloser(strings.NewReader(string(payload))),
		}, nil
	})}
	translator := NewRecallEmailTranslator(RecallEmailTranslatorOptions{
		APIKey: "sk-test", BaseURL: "https://example.com/v1", Model: "gpt-test", Client: client,
		sleep: func(context.Context, time.Duration) error { return nil },
	})

	_, err := translator.Translate(context.Background(), recallEmailTranslationTestStages())
	require.NoError(t, err)
	require.EqualValues(t, 3, requests.Load())
}

func TestRecallEmailTranslatorRejectsOversizeAndMalformedResponses(t *testing.T) {
	allowRecallEmailTranslationTestServer(t)
	tests := []struct {
		name     string
		maxBytes int64
		body     string
	}{
		{name: "oversize", maxBytes: 16, body: strings.Repeat("x", 17)},
		{name: "malformed envelope", maxBytes: 1024, body: `{not-json`},
		{name: "malformed output", maxBytes: 1024, body: `{"output_text":"not-json"}`},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				_, _ = w.Write([]byte(test.body))
			}))
			defer server.Close()
			translator := newRecallEmailTranslationTestTranslator(server, RecallEmailTranslatorOptions{MaxBytes: test.maxBytes})
			_, err := translator.Translate(context.Background(), recallEmailTranslationTestStages())
			require.Error(t, err)
		})
	}
}

func TestRecallEmailTranslationValidatesStructuredOutput(t *testing.T) {
	allowRecallEmailTranslationTestServer(t)
	tests := []struct {
		name   string
		result map[string]any
	}{
		{name: "extra root field", result: func() map[string]any {
			result := validRecallEmailTranslationResult([]int{1})
			result["unexpected"] = "value"
			return result
		}()},
		{name: "extra stage field", result: func() map[string]any {
			result := validRecallEmailTranslationResult([]int{1})
			result["stages"].([]map[string]any)[0]["unexpected"] = "value"
			return result
		}()},
		{name: "extra template field", result: func() map[string]any {
			result := validRecallEmailTranslationResult([]int{1})
			translations := result["stages"].([]map[string]any)[0]["translations"].(map[string]recallEmailTranslatedTemplate)
			result["stages"].([]map[string]any)[0]["translations"] = map[string]any{
				"zh": map[string]any{"subject": "zh subject 1", "body_segments": []string{"zh body 1"}, "unexpected": "value"},
				"es": translations["es"], "fr": translations["fr"], "pt": translations["pt"],
				"ru": translations["ru"], "ja": translations["ja"], "vi": translations["vi"],
			}
			return result
		}()},
		{name: "missing language", result: func() map[string]any {
			result := validRecallEmailTranslationResult([]int{1})
			delete(result["stages"].([]map[string]any)[0]["translations"].(map[string]recallEmailTranslatedTemplate), "vi")
			return result
		}()},
		{name: "extra language", result: func() map[string]any {
			result := validRecallEmailTranslationResult([]int{1})
			result["stages"].([]map[string]any)[0]["translations"].(map[string]recallEmailTranslatedTemplate)["de"] = recallEmailTranslatedTemplate{Subject: "Hallo", BodySegments: []string{"Text"}}
			return result
		}()},
		{name: "wrong stage", result: validRecallEmailTranslationResult([]int{2})},
		{name: "duplicate stage", result: func() map[string]any {
			result := validRecallEmailTranslationResult([]int{1, 1})
			return result
		}()},
		{name: "empty field", result: func() map[string]any {
			result := validRecallEmailTranslationResult([]int{1})
			translations := result["stages"].([]map[string]any)[0]["translations"].(map[string]recallEmailTranslatedTemplate)
			translations["zh"] = recallEmailTranslatedTemplate{Subject: "", BodySegments: []string{"body"}}
			return result
		}()},
		{name: "multiline subject", result: func() map[string]any {
			result := validRecallEmailTranslationResult([]int{1})
			translations := result["stages"].([]map[string]any)[0]["translations"].(map[string]recallEmailTranslatedTemplate)
			translations["zh"] = recallEmailTranslatedTemplate{Subject: "line one\r\nline two", BodySegments: []string{"body"}}
			return result
		}()},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				writeRecallEmailTranslationResponse(t, w, test.result)
			}))
			defer server.Close()
			translator := newRecallEmailTranslationTestTranslator(server, RecallEmailTranslatorOptions{})
			_, err := translator.Translate(context.Background(), recallEmailTranslationTestStages())
			require.Error(t, err)
		})
	}
}

func TestRecallEmailTranslationProtectsAndRestoresTokensAndURLs(t *testing.T) {
	allowRecallEmailTranslationTestServer(t)
	sentinelPattern := regexp.MustCompile(`__RECALL_EMAIL_PROTECTED_[0-9a-f]{32}_[0-9]{4}__`)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		requestText := string(raw)
		require.NotContains(t, requestText, "{{name}}")
		require.NotContains(t, requestText, "https://example.com/pay?code=${code}")
		require.NotContains(t, requestText, "{{coupon}}")
		sentinels := sentinelPattern.FindAllString(requestText, -1)
		require.GreaterOrEqual(t, len(sentinels), 3)
		var request map[string]any
		require.NoError(t, common.Unmarshal(raw, &request))
		stages := recallEmailTranslationRequestStages(t, request)
		bodyMarker := recallEmailTranslationExtractSegmentIdentityForTest(recallEmailTranslationRequestBodySegments(t, stages[0])[0])
		require.NotEmpty(t, bodyMarker)

		translations := make(map[string]recallEmailTranslatedTemplate, len(recallEmailTranslationTestLanguages))
		for _, language := range recallEmailTranslationTestLanguages {
			translations[language] = recallEmailTranslatedTemplate{
				Subject:      language + " hello " + sentinels[0],
				BodySegments: []string{bodyMarker + " " + language + " visit " + sentinels[1] + " use " + sentinels[2]},
			}
		}
		writeRecallEmailTranslationResponse(t, w, map[string]any{"stages": []map[string]any{{"stage_no": 1, "translations": translations}}})
	}))
	defer server.Close()

	translator := newRecallEmailTranslationTestTranslator(server, RecallEmailTranslatorOptions{})
	translated, err := translator.Translate(context.Background(), []RecallEmailStage{{
		StageNo: 1,
		Templates: map[string]RecallEmailTemplate{"en": {
			Subject:  "Hello {{name}}",
			BodyText: "Visit https://example.com/pay?code=${code} and use {{coupon}}",
		}},
	}})

	require.NoError(t, err)
	require.Equal(t, "zh hello {{name}}", translated[1]["zh"].Subject)
	require.Equal(t, "zh visit https://example.com/pay?code=${code} use {{coupon}}", translated[1]["zh"].BodyText)
}

func TestRecallEmailTranslationDoesNotRecursivelyRestoreSentinelLikeText(t *testing.T) {
	allowRecallEmailTranslationTestServer(t)
	sentinelPattern := regexp.MustCompile(`__RECALL_EMAIL_PROTECTED_[0-9a-f]{32}_[0-9]{4}__`)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		sentinels := sentinelPattern.FindAllString(string(raw), -1)
		require.Len(t, sentinels, 2)
		var request map[string]any
		require.NoError(t, common.Unmarshal(raw, &request))
		stages := recallEmailTranslationRequestStages(t, request)
		bodyMarker := recallEmailTranslationExtractSegmentIdentityForTest(recallEmailTranslationRequestBodySegments(t, stages[0])[0])
		require.NotEmpty(t, bodyMarker)

		translations := make(map[string]recallEmailTranslatedTemplate, len(recallEmailTranslationTestLanguages))
		for _, language := range recallEmailTranslationTestLanguages {
			translations[language] = recallEmailTranslatedTemplate{
				Subject:      language + " subject",
				BodySegments: []string{bodyMarker + " " + sentinels[0] + " then " + sentinels[1]},
			}
		}
		writeRecallEmailTranslationResponse(t, w, map[string]any{"stages": []map[string]any{{"stage_no": 1, "translations": translations}}})
	}))
	defer server.Close()

	translator := newRecallEmailTranslationTestTranslator(server, RecallEmailTranslatorOptions{})
	translated, err := translator.Translate(context.Background(), []RecallEmailStage{{
		StageNo: 1,
		Templates: map[string]RecallEmailTemplate{"en": {
			Subject:  "English subject",
			BodyText: "https://example.com/__RECALL_EMAIL_PROTECTED_0002__ then {{name}}",
		}},
	}})

	require.NoError(t, err)
	require.Equal(t, "https://example.com/__RECALL_EMAIL_PROTECTED_0002__ then {{name}}", translated[1]["zh"].BodyText)
}

func TestRecallEmailTranslationValidatesEnglishTemplateRuneLimitsBeforeRequest(t *testing.T) {
	allowRecallEmailTranslationTestServer(t)
	tests := []struct {
		name         string
		subject      string
		body         string
		wantError    bool
		wantRequests int32
	}{
		{name: "maximum lengths", subject: strings.Repeat("界", 200), body: strings.Repeat("界", 2000), wantRequests: 1},
		{name: "subject too long", subject: strings.Repeat("界", 201), body: "body", wantError: true},
		{name: "body too long", subject: "subject", body: strings.Repeat("界", 2001), wantError: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			var requests atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				requests.Add(1)
				var request map[string]any
				require.NoError(t, common.DecodeJson(r.Body, &request))
				writeRecallEmailTranslationResponse(t, w, validRecallEmailTranslationResultFromRequest(t, request, []int{1}))
			}))
			defer server.Close()

			translator := newRecallEmailTranslationTestTranslator(server, RecallEmailTranslatorOptions{})
			_, err := translator.Translate(context.Background(), []RecallEmailStage{{
				StageNo:   1,
				Templates: map[string]RecallEmailTemplate{"en": {Subject: test.subject, BodyText: test.body}},
			}})

			if test.wantError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
			require.Equal(t, test.wantRequests, requests.Load())
		})
	}
}

func TestRecallEmailTranslationRejectsDamagedProtectedSequence(t *testing.T) {
	allowRecallEmailTranslationTestServer(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		translations := make(map[string]recallEmailTranslatedTemplate, len(recallEmailTranslationTestLanguages))
		for _, language := range recallEmailTranslationTestLanguages {
			translations[language] = recallEmailTranslatedTemplate{Subject: language + " __RECALL_EMAIL_PROTECTED_9999__", BodySegments: []string{language + " body"}}
		}
		writeRecallEmailTranslationResponse(t, w, map[string]any{"stages": []map[string]any{{"stage_no": 1, "translations": translations}}})
	}))
	defer server.Close()

	translator := newRecallEmailTranslationTestTranslator(server, RecallEmailTranslatorOptions{})
	_, err := translator.Translate(context.Background(), []RecallEmailStage{{StageNo: 1, Templates: map[string]RecallEmailTemplate{
		"en": {Subject: "Hello {{name}}", BodyText: "Body"},
	}}})
	require.Error(t, err)
	require.Contains(t, strings.ToLower(err.Error()), "protected")
}

func TestRecallEmailTranslatorStopsImmediatelyWhenContextCancelled(t *testing.T) {
	var requests atomic.Int32
	client := &http.Client{Transport: recallEmailTranslationRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		requests.Add(1)
		return nil, r.Context().Err()
	})}
	translator := NewRecallEmailTranslator(RecallEmailTranslatorOptions{
		APIKey: "sk-test", BaseURL: "https://example.com/v1", Model: "gpt-test", Client: client,
		sleep: func(context.Context, time.Duration) error { return nil },
	})
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := translator.Translate(ctx, recallEmailTranslationTestStages())
	require.ErrorIs(t, err, context.Canceled)
	require.LessOrEqual(t, requests.Load(), int32(1))
}

func recallEmailTranslationTestStages() []RecallEmailStage {
	return []RecallEmailStage{{
		StageNo: 1,
		Templates: map[string]RecallEmailTemplate{
			"en": {Subject: "English subject", BodyText: "English body"},
		},
	}}
}

func validRecallEmailTranslationResult(stageNumbers []int) map[string]any {
	stages := make([]map[string]any, 0, len(stageNumbers))
	for _, stageNo := range stageNumbers {
		translations := make(map[string]recallEmailTranslatedTemplate, len(recallEmailTranslationTestLanguages))
		for _, language := range recallEmailTranslationTestLanguages {
			translations[language] = recallEmailTranslatedTemplate{
				Subject:      language + " subject " + strconv.Itoa(stageNo),
				BodySegments: []string{language + " body " + strconv.Itoa(stageNo)},
			}
		}
		stages = append(stages, map[string]any{"stage_no": stageNo, "translations": translations})
	}
	return map[string]any{"stages": stages}
}

func validRecallEmailTranslationResultFromRequest(t *testing.T, request map[string]any, stageNumbers []int) map[string]any {
	t.Helper()
	requestStages := recallEmailTranslationRequestStages(t, request)
	requestByStage := make(map[int]map[string]any, len(requestStages))
	for _, stage := range requestStages {
		stageNo, ok := stage["stage_no"].(float64)
		require.True(t, ok)
		requestByStage[int(stageNo)] = stage
	}

	stages := make([]map[string]any, 0, len(stageNumbers))
	for _, stageNo := range stageNumbers {
		requestStage, exists := requestByStage[stageNo]
		require.True(t, exists)
		requestSegments := recallEmailTranslationRequestBodySegments(t, requestStage)
		translations := make(map[string]recallEmailTranslatedTemplate, len(recallEmailTranslationTestLanguages))
		for _, language := range recallEmailTranslationTestLanguages {
			bodySegments := make([]string, len(requestSegments))
			for index, segment := range requestSegments {
				marker := recallEmailTranslationExtractSegmentIdentityForTest(segment)
				require.NotEmpty(t, marker)
				bodySegments[index] = marker + " " + language + " body " + strconv.Itoa(stageNo)
			}
			translations[language] = recallEmailTranslatedTemplate{
				Subject:      language + " subject " + strconv.Itoa(stageNo),
				BodySegments: bodySegments,
			}
		}
		stages = append(stages, map[string]any{"stage_no": stageNo, "translations": translations})
	}
	return map[string]any{"stages": stages}
}

func recallEmailTranslationSegmentsResult(stageSegments map[int][]string) map[string]any {
	stages := make([]map[string]any, 0, len(stageSegments))
	for stageNo, segments := range stageSegments {
		translations := make(map[string]any, len(recallEmailTranslationTestLanguages))
		for _, language := range recallEmailTranslationTestLanguages {
			localizedSegments := make([]string, len(segments))
			for index, segment := range segments {
				if recallEmailTranslationSegmentIsOnlyIdentityForTest(segment) {
					localizedSegments[index] = segment
					continue
				}
				if marker := recallEmailTranslationExtractSegmentIdentityForTest(segment); marker != "" {
					withoutMarker := strings.TrimSpace(strings.Replace(segment, marker, "", 1))
					localizedSegments[index] = marker + " " + language + ":" + withoutMarker
					continue
				}
				localizedSegments[index] = language + ":" + segment
			}
			translations[language] = map[string]any{
				"subject":       language + ":" + recallEmailTranslationSubjectForStage(stageNo),
				"body_segments": localizedSegments,
			}
		}
		stages = append(stages, map[string]any{"stage_no": stageNo, "translations": translations})
	}
	return map[string]any{"stages": stages}
}

func recallEmailTranslationSubjectForStage(stageNo int) string {
	switch stageNo {
	case 1:
		return "HTML subject"
	case 2:
		return "Legacy subject"
	default:
		return "subject " + strconv.Itoa(stageNo)
	}
}

func recallEmailTranslationHTMLWithAttributes() string {
	withImage := strings.Replace(
		validRecallHTML,
		`<p>Hello {{.RecipientName}}</p>`,
		`<img src="https://flatkey.ai/logo.png" alt="Flatkey logo"><p>Hello {{.RecipientName}}</p>`,
		1,
	)
	return strings.Replace(
		withImage,
		`<a href="https://flatkey.ai/help">Help</a>`,
		`<a href="https://flatkey.ai/help" title="Support center" aria-label="Get help">Help</a>`,
		1,
	)
}

func recallEmailTranslationHTMLWithTextSegments(count int, text string) string {
	var builder strings.Builder
	builder.WriteString(`<!doctype html><html><head><style>.cta{background:#111;color:#fff}</style></head><body>`)
	for i := 0; i < count; i++ {
		builder.WriteString("<p>")
		builder.WriteString(text)
		builder.WriteString("</p>")
	}
	builder.WriteString(`<a class="cta" href="{{.ClaimURL}}">C</a><a href="{{.UnsubscribeURL}}">U</a></body></html>`)
	return builder.String()
}

func recallEmailTranslationHTMLSegments(t *testing.T, body string) []string {
	t.Helper()
	document, err := parseRecallEmailHTML(body)
	require.NoError(t, err)
	return document.TranslationSegments()
}

func recallEmailTranslationRequestStrings(value any) []string {
	switch typed := value.(type) {
	case string:
		return []string{typed}
	case []any:
		values := make([]string, 0)
		for _, item := range typed {
			values = append(values, recallEmailTranslationRequestStrings(item)...)
		}
		return values
	case map[string]any:
		values := make([]string, 0)
		for key, item := range typed {
			values = append(values, key)
			values = append(values, recallEmailTranslationRequestStrings(item)...)
		}
		return values
	default:
		return nil
	}
}

func recallEmailTranslationRequestStages(t *testing.T, request map[string]any) []map[string]any {
	t.Helper()
	input, ok := request["input"].([]any)
	require.True(t, ok)
	for _, item := range input {
		message, ok := item.(map[string]any)
		require.True(t, ok)
		if message["role"] != "user" {
			continue
		}
		content, ok := message["content"].(string)
		require.True(t, ok)
		_, stagesJSON, found := strings.Cut(content, "\n")
		require.True(t, found)
		var stages []map[string]any
		require.NoError(t, common.Unmarshal([]byte(stagesJSON), &stages))
		return stages
	}
	t.Fatalf("user message missing from translation request")
	return nil
}

func requireRecallEmailTranslationStageRequest(t *testing.T, stage map[string]any, stageNo int, subject string, segments []string) {
	t.Helper()
	require.ElementsMatch(t, []string{"stage_no", "subject", "body_segments"}, recallEmailTranslationMapKeys(stage))
	require.EqualValues(t, stageNo, stage["stage_no"])
	require.Equal(t, subject, stage["subject"])
	rawSegments, ok := stage["body_segments"].([]any)
	require.True(t, ok)
	require.Len(t, rawSegments, len(segments))
	for index, segment := range segments {
		value, ok := rawSegments[index].(string)
		require.True(t, ok)
		require.Equal(t, recallEmailTranslationNormalizeProtectedForTest(segment), recallEmailTranslationNormalizeProtectedForTest(value))
	}
}

func recallEmailTranslationRequestBodySegments(t *testing.T, stage map[string]any) []string {
	t.Helper()
	rawSegments, ok := stage["body_segments"].([]any)
	require.True(t, ok)
	segments := make([]string, len(rawSegments))
	for index, rawSegment := range rawSegments {
		segment, ok := rawSegment.(string)
		require.True(t, ok)
		segments[index] = segment
	}
	return segments
}

func recallEmailTranslationExtractSegmentIdentityForTest(segment string) string {
	marker := regexp.MustCompile(`__RECALL_EMAIL_SEGMENT_[0-9a-f]{32}_S[0-9]{4}_I[0-9]{4}__`).FindString(segment)
	return marker
}

func recallEmailTranslationSegmentIsOnlyIdentityForTest(segment string) bool {
	marker := recallEmailTranslationExtractSegmentIdentityForTest(segment)
	return marker != "" && strings.TrimSpace(segment) == marker
}

func recallEmailTranslationSegmentIndexContainingForTest(segments []string, token string) int {
	for index, segment := range segments {
		if strings.Contains(segment, token) {
			return index
		}
	}
	return -1
}

func recallEmailTranslationNormalizeProtectedForTest(value string) string {
	templateAction := regexp.MustCompile(`\{\{[^{}\r\n]+\}\}|\$\{[^{}\r\n]+\}|https?://[^\s<>"']+`)
	value = templateAction.ReplaceAllString(value, "{PROTECTED}")
	value = regexp.MustCompile(`__RECALL_EMAIL_PROTECTED_[0-9a-f]{32}_[0-9]{4}__`).ReplaceAllString(value, "{PROTECTED}")
	value = regexp.MustCompile(`__RECALL_EMAIL_SEGMENT_[0-9a-f]{32}_S[0-9]{4}_I[0-9]{4}__`).ReplaceAllString(value, "")
	return strings.TrimSpace(value)
}

func recallEmailTranslationMapKeys(object map[string]any) []string {
	keys := make([]string, 0, len(object))
	for key := range object {
		keys = append(keys, key)
	}
	return keys
}

func writeRecallEmailTranslationResponse(t *testing.T, w http.ResponseWriter, result map[string]any) {
	t.Helper()
	payload := recallEmailTranslationHTTPPayload(t, result)
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(payload)
}

func recallEmailTranslationHTTPPayload(t *testing.T, result map[string]any) []byte {
	t.Helper()
	resultJSON, err := common.Marshal(result)
	require.NoError(t, err)
	payload, err := common.Marshal(map[string]any{"output_text": string(resultJSON)})
	require.NoError(t, err)
	return payload
}

func newRecallEmailTranslationTestTranslator(server *httptest.Server, options RecallEmailTranslatorOptions) RecallEmailTranslator {
	options.APIKey = "sk-test"
	options.BaseURL = server.URL + "/v1"
	options.Model = "gpt-test"
	options.Client = server.Client()
	options.sleep = func(context.Context, time.Duration) error { return nil }
	return NewRecallEmailTranslator(options)
}

func allowRecallEmailTranslationTestServer(t *testing.T) {
	t.Helper()
	original := *system_setting.GetFetchSetting()
	t.Cleanup(func() { *system_setting.GetFetchSetting() = original })
	system_setting.GetFetchSetting().EnableSSRFProtection = false
}

func preserveRecallEmailTranslationMonitorSettings(t *testing.T) {
	t.Helper()
	original := config.GlobalConfig.ExportAllConfigs()
	saved := map[string]string{
		"monitor_setting.ai_analysis_api_key":  original["monitor_setting.ai_analysis_api_key"],
		"monitor_setting.ai_analysis_base_url": original["monitor_setting.ai_analysis_base_url"],
		"monitor_setting.ai_analysis_model":    original["monitor_setting.ai_analysis_model"],
	}
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})
}

type temporaryTranslationNetworkError struct{}

func (temporaryTranslationNetworkError) Error() string   { return "temporary network error" }
func (temporaryTranslationNetworkError) Timeout() bool   { return true }
func (temporaryTranslationNetworkError) Temporary() bool { return true }

var _ interface {
	Timeout() bool
	Temporary() bool
} = temporaryTranslationNetworkError{}

type recallEmailTranslationRoundTripFunc func(*http.Request) (*http.Response, error)

func (fn recallEmailTranslationRoundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}
