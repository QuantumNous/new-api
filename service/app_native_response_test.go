package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	taskdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	pluginruntime "github.com/QuantumNous/new-api/pkg/jsplugin"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	hosttypes "github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func nativeAppResponseCandidate() model.AppExecutionModel {
	return model.AppExecutionModel{
		PublicModel:    "registered-native",
		ActualModel:    "gpt-native",
		ExecutionKind:  model.AppExecutionModelKindNativeResponse,
		Protocol:       "openai_responses",
		ChannelType:    constant.ChannelTypeOpenAI,
		APIType:        constant.APITypeOpenAI,
		RequestProfile: appResponsesTextProfileV1,
	}
}

func TestPrepareAppResponseRequestBuildsExactFrozenOutbound(t *testing.T) {
	candidate := nativeAppResponseCandidate()
	for _, raw := range []string{
		`{"model":"registered-native","input":"hello","max_output_tokens":1024}`,
		`{"store":false,"max_output_tokens":1024,"input":"hello","stream":false,"model":"registered-native"}`,
	} {
		prepared, err := PrepareAppResponseRequest([]byte(raw), candidate)
		require.NoError(t, err)
		assert.Equal(t, "registered-native", prepared.PublicModel)
		assert.Equal(t, "gpt-native", prepared.ActualModel)
		assert.Equal(t, "hello", prepared.Input)
		assert.Equal(t, 1024, prepared.MaxOutputTokens)
		assert.Equal(t,
			`{"model":"gpt-native","input":"hello","max_output_tokens":1024,"stream":false,"store":false}`,
			string(prepared.Outbound),
		)
	}
}

func TestPrepareAppResponseRequestRejectsInvalidProfileBody(t *testing.T) {
	base := `{"model":"registered-native","input":"hello","max_output_tokens":1024`
	for _, tc := range []struct {
		name string
		raw  string
	}{
		{"missing model", `{"input":"hello","max_output_tokens":1024}`},
		{"missing input", `{"model":"registered-native","max_output_tokens":1024}`},
		{"missing max output", `{"model":"registered-native","input":"hello"}`},
		{"empty model", `{"model":"","input":"hello","max_output_tokens":1024}`},
		{"wrong public model", `{"model":"gpt-native","input":"hello","max_output_tokens":1024}`},
		{"empty input", `{"model":"registered-native","input":"","max_output_tokens":1024}`},
		{"blank input", `{"model":"registered-native","input":" \n\t","max_output_tokens":1024}`},
		{"object input", `{"model":"registered-native","input":{},"max_output_tokens":1024}`},
		{"array input", `{"model":"registered-native","input":[],"max_output_tokens":1024}`},
		{"null input", `{"model":"registered-native","input":null,"max_output_tokens":1024}`},
		{"zero max output", `{"model":"registered-native","input":"hello","max_output_tokens":0}`},
		{"negative max output", `{"model":"registered-native","input":"hello","max_output_tokens":-1}`},
		{"fractional max output", `{"model":"registered-native","input":"hello","max_output_tokens":1.5}`},
		{"string max output", `{"model":"registered-native","input":"hello","max_output_tokens":"1024"}`},
		{"null max output", `{"model":"registered-native","input":"hello","max_output_tokens":null}`},
		{"oversized max output", fmt.Sprintf(
			`{"model":"registered-native","input":"hello","max_output_tokens":%d}`,
			constant.MaxTokensLimit+1,
		)},
		{"stream true", base + `,"stream":true}`},
		{"stream null", base + `,"stream":null}`},
		{"store true", base + `,"store":true}`},
		{"store null", base + `,"store":null}`},
		{"duplicate field", base + `,"model":"registered-native"}`},
		{"escaped duplicate field", base + `,"\u006dodel":"registered-native"}`},
		{"escaped field name", `{"\u006dodel":"registered-native","input":"hello","max_output_tokens":1024}`},
		{"wrong case", base + `,"Model":"registered-native"}`},
		{"trailing value", base + `} {}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := PrepareAppResponseRequest([]byte(tc.raw), nativeAppResponseCandidate())
			require.Error(t, err)
			assert.Equal(t, "invalid_request", err.Error())
		})
	}
}

func TestPrepareAppResponseRequestRejectsEveryAdditionalField(t *testing.T) {
	for _, field := range []string{
		"background", "previous_response_id", "conversation", "prompt",
		"instructions", "tools", "tool_choice", "file_ids", "image_url",
		"metadata", "service_tier", "user", "safety_identifier", "reasoning",
		"include", "temperature", "top_p", "truncation", "client_metadata",
		"prompt_cache_key", "stream_options", "provider_extension",
	} {
		t.Run(field, func(t *testing.T) {
			raw := fmt.Sprintf(
				`{"model":"registered-native","input":"hello","max_output_tokens":1024,%q":false}`,
				field,
			)
			_, err := PrepareAppResponseRequest([]byte(raw), nativeAppResponseCandidate())
			require.Error(t, err)
			assert.Equal(t, "invalid_request", err.Error())
		})
	}
}

func TestPrepareAppResponseRequestRejectsInvalidCandidateAndOversizedBody(t *testing.T) {
	raw := []byte(`{"model":"registered-native","input":"hello","max_output_tokens":1024}`)
	for _, mutate := range []func(*model.AppExecutionModel){
		func(candidate *model.AppExecutionModel) {
			candidate.ExecutionKind = model.AppExecutionModelKindTaskBacked
		},
		func(candidate *model.AppExecutionModel) { candidate.Protocol = "openai_video" },
		func(candidate *model.AppExecutionModel) { candidate.RequestProfile = "" },
		func(candidate *model.AppExecutionModel) { candidate.ChannelType = constant.ChannelTypeAzure },
		func(candidate *model.AppExecutionModel) { candidate.APIType = constant.APITypeAnthropic },
		func(candidate *model.AppExecutionModel) { candidate.PublicModel = "" },
		func(candidate *model.AppExecutionModel) { candidate.ActualModel = "" },
	} {
		candidate := nativeAppResponseCandidate()
		mutate(&candidate)
		_, err := PrepareAppResponseRequest(raw, candidate)
		require.Error(t, err)
		assert.Equal(t, "invalid_grant", err.Error())
	}

	oversized := []byte(fmt.Sprintf(
		`{"model":"registered-native","input":%q,"max_output_tokens":1024}`,
		strings.Repeat("x", 64*1024),
	))
	_, err := PrepareAppResponseRequest(oversized, nativeAppResponseCandidate())
	require.Error(t, err)
	assert.Equal(t, "invalid_request", err.Error())

	invalidUTF8 := []byte(`{"model":"registered-native","input":"hello`)
	invalidUTF8 = append(invalidUTF8, 0xff)
	invalidUTF8 = append(invalidUTF8, []byte(`","max_output_tokens":1024}`)...)
	_, err = PrepareAppResponseRequest(invalidUTF8, nativeAppResponseCandidate())
	require.Error(t, err)
	assert.Equal(t, "invalid_request", err.Error())
}

func TestParseAppResponseCapturesCompletedEvidence(t *testing.T) {
	body := []byte(`{"id":"resp_1","object":"response","status":"completed","model":"gpt-native","error":null,"incomplete_details":null,"output":[{"type":"message"}],"usage":{"input_tokens":100,"input_tokens_details":{"cached_tokens":20,"cached_creation_tokens":5,"cache_write_tokens":7,"text_tokens":73,"audio_tokens":0,"image_tokens":0},"output_tokens":30,"output_tokens_details":{"text_tokens":20,"audio_tokens":5,"image_tokens":0,"reasoning_tokens":5},"total_tokens":130}}`)
	headers := http.Header{
		"Content-Type":       {"application/json; charset=utf-8"},
		"Openai-Request-Id":  {"openai-request"},
		"X-Request-Id":       {"gateway-request"},
		"Set-Cookie":         {"session=secret"},
		"Authorization":      {"Bearer secret"},
		"Transfer-Encoding":  {"chunked"},
		"X-Untrusted-Header": {"drop-me"},
	}

	captured, err := ParseAppResponse(200, headers, body, "gpt-native")
	require.NoError(t, err)
	assert.False(t, captured.Rejected)
	assert.Equal(t, 200, captured.HTTPStatus)
	assert.Equal(t, body, captured.Body)
	digest := sha256.Sum256(body)
	assert.Equal(t, hex.EncodeToString(digest[:]), captured.BodySHA256)
	assert.Equal(t, "resp_1", captured.ResponseID)
	assert.Equal(t, "gpt-native", captured.ProviderModel)
	assert.Equal(t, "completed", captured.ProviderStatus)
	assert.Equal(t,
		`{"Content-Type":["application/json; charset=utf-8"],"OpenAI-Request-ID":["openai-request"],"X-Request-ID":["gateway-request"]}`,
		captured.SafeHeadersJSON,
	)
	assert.JSONEq(t,
		`{"input_tokens":100,"input_tokens_details":{"cached_tokens":20,"cached_creation_tokens":5,"cache_write_tokens":7,"text_tokens":73,"audio_tokens":0,"image_tokens":0},"output_tokens":30,"output_tokens_details":{"text_tokens":20,"audio_tokens":5,"image_tokens":0,"reasoning_tokens":5},"total_tokens":130}`,
		captured.RawUsageJSON,
	)
	assert.Equal(t, AppResponseUsage{
		InputTokens:              100,
		OutputTokens:             30,
		TotalTokens:              130,
		CacheReadInputTokens:     20,
		CacheCreationInputTokens: 7,
		TextInputTokens:          73,
		AudioInputTokens:         0,
		ImageInputTokens:         0,
		TextOutputTokens:         20,
		AudioOutputTokens:        5,
		ImageOutputTokens:        0,
		ReasoningOutputTokens:    5,
	}, captured.Usage)
	assert.JSONEq(t, `{
		"input_tokens":100,
		"output_tokens":30,
		"total_tokens":130,
		"cache_read_input_tokens":20,
		"cache_creation_input_tokens":7,
		"text_input_tokens":73,
		"audio_input_tokens":0,
		"image_input_tokens":0,
		"text_output_tokens":20,
		"audio_output_tokens":5,
		"image_output_tokens":0,
		"reasoning_output_tokens":5
	}`, captured.NormalizedUsageJSON)

	body[0] = '!'
	headers.Set("X-Request-ID", "mutated")
	assert.Equal(t, byte('{'), captured.Body[0])
	assert.Contains(t, captured.SafeHeadersJSON, "gateway-request")
}

func TestParseAppResponseCapturesDefiniteRejection(t *testing.T) {
	body := []byte(`{"error":{"message":"rate limited"}}`)
	captured, err := ParseAppResponse(http.StatusTooManyRequests, http.Header{
		"Content-Type":      {"application/json"},
		"Openai-Request-Id": {"provider-id"},
		"Retry-After":       {"60"},
	}, body, "gpt-native")
	require.NoError(t, err)
	assert.True(t, captured.Rejected)
	assert.Equal(t, http.StatusTooManyRequests, captured.HTTPStatus)
	assert.Equal(t, body, captured.Body)
	assert.Empty(t, captured.ResponseID)
	assert.Empty(t, captured.RawUsageJSON)
	assert.Equal(t,
		`{"Content-Type":["application/json"],"OpenAI-Request-ID":["provider-id"]}`,
		captured.SafeHeadersJSON,
	)
}

func TestParseAppResponseAllowsOverlappingCacheCounters(t *testing.T) {
	body := []byte(`{"id":"resp_cache","status":"completed","model":"gpt-native","usage":{"input_tokens":10,"input_tokens_details":{"cached_tokens":8,"cache_write_tokens":7},"output_tokens":0,"total_tokens":10}}`)
	captured, err := ParseAppResponse(200, http.Header{"Content-Type": {"application/json"}}, body, "gpt-native")
	require.NoError(t, err)
	assert.Equal(t, 8, captured.Usage.CacheReadInputTokens)
	assert.Equal(t, 7, captured.Usage.CacheCreationInputTokens)
}

func TestParseAppResponseRejectsInvalidTransportEvidence(t *testing.T) {
	validBody := `{"id":"resp_1","status":"completed","model":"gpt-native","usage":{"input_tokens":1,"output_tokens":2,"total_tokens":3}}`
	oversizedSafeHeaders := http.Header{"Content-Type": {"application/json"}}
	for range 9 {
		oversizedSafeHeaders.Add("X-Request-ID", strings.Repeat("x", 8*1024))
	}
	for _, tc := range []struct {
		name    string
		status  int
		headers http.Header
		body    []byte
	}{
		{"informational status", 101, http.Header{"Content-Type": {"application/json"}}, []byte(validBody)},
		{"other success status", 201, http.Header{"Content-Type": {"application/json"}}, []byte(validBody)},
		{"missing content type", 200, http.Header{}, []byte(validBody)},
		{"duplicate content type", 200, http.Header{"Content-Type": {"application/json", "text/event-stream"}}, []byte(validBody)},
		{"event stream", 200, http.Header{"Content-Type": {"text/event-stream"}}, []byte(validBody)},
		{"non json content type", 200, http.Header{"Content-Type": {"text/plain"}}, []byte(validBody)},
		{"malformed content type", 200, http.Header{"Content-Type": {"application/json; charset"}}, []byte(validBody)},
		{"control byte header", 200, http.Header{"Content-Type": {"application/json"}, "X-Request-Id": {"bad\x01value"}}, []byte(validBody)},
		{"delete byte header", 200, http.Header{"Content-Type": {"application/json"}, "X-Request-Id": {"bad\x7fvalue"}}, []byte(validBody)},
		{"empty body", 200, http.Header{"Content-Type": {"application/json"}}, nil},
		{"malformed json", 200, http.Header{"Content-Type": {"application/json"}}, []byte(`{"id":`)},
		{"multiple json values", 200, http.Header{"Content-Type": {"application/json"}}, []byte(validBody + `{}`)},
		{"oversized body", 200, http.Header{"Content-Type": {"application/json"}}, []byte(strings.Repeat("x", 64*1024+1))},
		{"oversized safe headers", 200, oversizedSafeHeaders, []byte(validBody)},
		{"invalid utf8", 200, http.Header{"Content-Type": {"application/json"}}, append(
			[]byte(`{"id":"resp_`), append([]byte{0xff}, []byte(`","status":"completed","model":"gpt-native","usage":{"input_tokens":1,"output_tokens":2,"total_tokens":3}}`)...,
			)...,
		)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := ParseAppResponse(tc.status, tc.headers, tc.body, "gpt-native")
			require.Error(t, err)
			assert.Equal(t, "invalid_upstream_response", err.Error())
		})
	}
}

func TestParseAppResponseRejectsInvalidEnvelope(t *testing.T) {
	validUsage := `{"input_tokens":1,"output_tokens":2,"total_tokens":3}`
	for _, tc := range []struct {
		name string
		body string
	}{
		{"missing id", `{"status":"completed","model":"gpt-native","usage":` + validUsage + `}`},
		{"empty id", `{"id":"","status":"completed","model":"gpt-native","usage":` + validUsage + `}`},
		{"oversized id", fmt.Sprintf(`{"id":%q,"status":"completed","model":"gpt-native","usage":%s}`, strings.Repeat("x", 256), validUsage)},
		{"missing model", `{"id":"resp_1","status":"completed","usage":` + validUsage + `}`},
		{"model mismatch", `{"id":"resp_1","status":"completed","model":"other","usage":` + validUsage + `}`},
		{"missing status", `{"id":"resp_1","model":"gpt-native","usage":` + validUsage + `}`},
		{"queued status", `{"id":"resp_1","status":"queued","model":"gpt-native","usage":` + validUsage + `}`},
		{"error object", `{"id":"resp_1","status":"completed","model":"gpt-native","error":{"message":"bad"},"usage":` + validUsage + `}`},
		{"incomplete details", `{"id":"resp_1","status":"completed","model":"gpt-native","incomplete_details":{"reason":"max_output_tokens"},"usage":` + validUsage + `}`},
		{"missing usage", `{"id":"resp_1","status":"completed","model":"gpt-native"}`},
		{"null usage", `{"id":"resp_1","status":"completed","model":"gpt-native","usage":null}`},
		{"duplicate id", `{"id":"resp_1","id":"resp_2","status":"completed","model":"gpt-native","usage":` + validUsage + `}`},
		{"escaped duplicate model", `{"id":"resp_1","status":"completed","model":"gpt-native","\u006dodel":"gpt-native","usage":` + validUsage + `}`},
		{"nested duplicate usage", `{"id":"resp_1","status":"completed","model":"gpt-native","usage":{"input_tokens":1,"\u0069nput_tokens":1,"output_tokens":2,"total_tokens":3}}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := ParseAppResponse(200, http.Header{"Content-Type": {"application/json"}}, []byte(tc.body), "gpt-native")
			require.Error(t, err)
			assert.Equal(t, "invalid_upstream_response", err.Error())
		})
	}
}

func TestParseAppResponseRejectsInconsistentUsage(t *testing.T) {
	for _, usage := range []string{
		`{"output_tokens":2,"total_tokens":3}`,
		`{"input_tokens":1,"total_tokens":3}`,
		`{"input_tokens":1,"output_tokens":2}`,
		`{"input_tokens":null,"output_tokens":2,"total_tokens":3}`,
		`{"input_tokens":1.5,"output_tokens":2,"total_tokens":3}`,
		`{"input_tokens":-1,"output_tokens":2,"total_tokens":3}`,
		fmt.Sprintf(`{"input_tokens":%d,"output_tokens":0,"total_tokens":%d}`, common.MaxQuota+1, common.MaxQuota+1),
		`{"input_tokens":2,"output_tokens":2,"total_tokens":3}`,
		`{"input_tokens":10,"input_tokens_details":{"cached_tokens":11},"output_tokens":2,"total_tokens":12}`,
		`{"input_tokens":10,"input_tokens_details":{"cached_tokens":null},"output_tokens":2,"total_tokens":12}`,
		`{"input_tokens":10,"input_tokens_details":{"audio_tokens":-1},"output_tokens":2,"total_tokens":12}`,
		`{"input_tokens":10,"input_tokens_details":{"text_tokens":8,"image_tokens":3},"output_tokens":2,"total_tokens":12}`,
		`{"input_tokens":10,"output_tokens":2,"output_tokens_details":{"audio_tokens":3},"total_tokens":12}`,
		`{"input_tokens":10,"output_tokens":2,"output_tokens_details":{"text_tokens":2,"audio_tokens":1},"total_tokens":12}`,
		`{"input_tokens":10,"output_tokens":2,"output_tokens_details":{"reasoning_tokens":-1},"total_tokens":12}`,
	} {
		body := fmt.Sprintf(
			`{"id":"resp_1","status":"completed","model":"gpt-native","usage":%s}`,
			usage,
		)
		_, err := ParseAppResponse(200, http.Header{"Content-Type": {"application/json"}}, []byte(body), "gpt-native")
		require.Error(t, err, usage)
		assert.Equal(t, "invalid_upstream_response", err.Error())
	}
}

func TestComputeAppResponseQuotaUsesFrozenPerRequestPrice(t *testing.T) {
	snapshot := nativeAppResponseCandidate()
	snapshot.BillingBasis = billingexpr.BillingBasisRequest
	snapshot.GroupRatio = 2
	snapshot.QuotaPerUnit = 500_000
	snapshot.Price = model.PricingValues{"ModelPrice": float64(0.02)}
	facts := AppResponseRequestFacts{EstimatedInputTokens: 100, MaxOutputTokens: 50}

	maximum, err := ComputeAppResponseMaximumQuota(snapshot, facts, 1_700_000_000)
	require.NoError(t, err)
	assert.Equal(t, 20_000, maximum.Quota)

	final, err := ComputeAppResponseFinalQuota(snapshot, facts, AppResponseUsage{
		InputTokens: 80, OutputTokens: 20, TotalTokens: 100,
	}, maximum.Quota, 1_700_000_000)
	require.NoError(t, err)
	assert.Equal(t, maximum, final)
}

func TestComputeAppResponseQuotaUsesFrozenRatioDetails(t *testing.T) {
	snapshot := nativeAppResponseCandidate()
	snapshot.BillingBasis = billingexpr.BillingBasisToken
	snapshot.GroupRatio = 0.5
	snapshot.QuotaPerUnit = 500_000
	snapshot.Price = model.PricingValues{
		"ModelRatio":           float64(2),
		"CompletionRatio":      float64(2),
		"CacheRatio":           float64(0.5),
		"CreateCacheRatio":     float64(1.25),
		"ImageRatio":           float64(3),
		"AudioRatio":           float64(4),
		"AudioCompletionRatio": float64(5),
	}
	facts := AppResponseRequestFacts{EstimatedInputTokens: 100, MaxOutputTokens: 50}

	maximum, err := ComputeAppResponseMaximumQuota(snapshot, facts, 1_700_000_000)
	require.NoError(t, err)
	assert.Equal(t, 2_175, maximum.Quota)

	final, err := ComputeAppResponseFinalQuota(snapshot, facts, AppResponseUsage{
		InputTokens:              100,
		OutputTokens:             40,
		TotalTokens:              140,
		CacheReadInputTokens:     20,
		CacheCreationInputTokens: 10,
		ImageInputTokens:         10,
		AudioInputTokens:         10,
		ImageOutputTokens:        5,
		AudioOutputTokens:        5,
	}, maximum.Quota, 1_700_000_000)
	require.NoError(t, err)
	assert.Equal(t, 333, final.Quota)
}

func TestComputeAppResponseRatioMaximumUsesDecimalRounding(t *testing.T) {
	snapshot := nativeAppResponseCandidate()
	snapshot.BillingBasis = billingexpr.BillingBasisToken
	snapshot.GroupRatio = 1
	snapshot.QuotaPerUnit = 500_000
	snapshot.Price = model.PricingValues{
		"ModelRatio":           float64(1),
		"CompletionRatio":      float64(0),
		"CacheRatio":           float64(0.6),
		"CreateCacheRatio":     float64(0.7),
		"ImageRatio":           float64(0),
		"AudioRatio":           float64(0),
		"AudioCompletionRatio": float64(0),
	}
	facts := AppResponseRequestFacts{EstimatedInputTokens: 5, MaxOutputTokens: 1}

	maximum, err := ComputeAppResponseMaximumQuota(snapshot, facts, 1_700_000_000)
	require.NoError(t, err)
	assert.Equal(t, 7, maximum.Quota)

	final, err := ComputeAppResponseFinalQuota(snapshot, facts, AppResponseUsage{
		InputTokens:              5,
		TotalTokens:              5,
		CacheReadInputTokens:     5,
		CacheCreationInputTokens: 5,
	}, maximum.Quota, 1_700_000_000)
	require.NoError(t, err)
	assert.Equal(t, 7, final.Quota)
}

func TestComputeAppResponseQuotaUsesFrozenTieredExpression(t *testing.T) {
	expression := `v1:tier("base", p * 1.5 + c * 6 + cr * 0.25 + ai * 2 + ao * 8)`
	snapshot := nativeAppResponseCandidate()
	snapshot.BillingBasis = billingexpr.BillingBasisToken
	snapshot.ExprVersion = billingexpr.ExprVersion(expression)
	snapshot.GroupRatio = 2
	snapshot.QuotaPerUnit = 500_000
	snapshot.Price = model.PricingValues{
		"billing_setting.billing_mode":        "tiered_expr",
		"billing_setting.billing_expr":        expression,
		"billing_setting.billing_expr_sha256": billingexpr.ExprHashString(expression),
	}
	facts := AppResponseRequestFacts{EstimatedInputTokens: 100, MaxOutputTokens: 50}

	maximum, err := ComputeAppResponseMaximumQuota(snapshot, facts, 1_700_000_000)
	require.NoError(t, err)
	assert.Equal(t, 1_075, maximum.Quota)
	assert.Equal(t, "base", maximum.MatchedTier)

	final, err := ComputeAppResponseFinalQuota(snapshot, facts, AppResponseUsage{
		InputTokens:          80,
		OutputTokens:         20,
		TotalTokens:          100,
		CacheReadInputTokens: 20,
		AudioInputTokens:     10,
		AudioOutputTokens:    5,
	}, maximum.Quota, 1_700_000_000)
	require.NoError(t, err)
	assert.Equal(t, 230, final.Quota)
	assert.Equal(t, "base", final.MatchedTier)
}

func TestComputeAppResponseQuotaRejectsInvalidFrozenEvidence(t *testing.T) {
	valid := nativeAppResponseCandidate()
	valid.BillingBasis = billingexpr.BillingBasisRequest
	valid.GroupRatio = 1
	valid.QuotaPerUnit = 500_000
	valid.Price = model.PricingValues{"ModelPrice": float64(0.02)}
	validFacts := AppResponseRequestFacts{EstimatedInputTokens: 100, MaxOutputTokens: 50}

	for _, tc := range []struct {
		name     string
		snapshot model.AppExecutionModel
		facts    AppResponseRequestFacts
		pricedAt int64
	}{
		{"missing price", func() model.AppExecutionModel {
			value := valid
			value.Price = nil
			return value
		}(), validFacts, 1_700_000_000},
		{"extra price field", func() model.AppExecutionModel {
			value := valid
			value.Price = model.PricingValues{"ModelPrice": float64(0.02), "ModelRatio": float64(1)}
			return value
		}(), validFacts, 1_700_000_000},
		{"not finite", func() model.AppExecutionModel {
			value := valid
			value.Price = model.PricingValues{"ModelPrice": math.Inf(1)}
			return value
		}(), validFacts, 1_700_000_000},
		{"saturating price", func() model.AppExecutionModel {
			value := valid
			value.Price = model.PricingValues{"ModelPrice": math.MaxFloat64}
			return value
		}(), validFacts, 1_700_000_000},
		{"unexpected expression version", func() model.AppExecutionModel {
			value := valid
			value.ExprVersion = 1
			return value
		}(), validFacts, 1_700_000_000},
		{"invalid group", func() model.AppExecutionModel {
			value := valid
			value.GroupRatio = -1
			return value
		}(), validFacts, 1_700_000_000},
		{"invalid quota unit", func() model.AppExecutionModel {
			value := valid
			value.QuotaPerUnit = 0
			return value
		}(), validFacts, 1_700_000_000},
		{"invalid estimate", valid, AppResponseRequestFacts{EstimatedInputTokens: -1, MaxOutputTokens: 50}, 1_700_000_000},
		{"zero estimate", valid, AppResponseRequestFacts{EstimatedInputTokens: 0, MaxOutputTokens: 50}, 1_700_000_000},
		{"invalid max output", valid, AppResponseRequestFacts{EstimatedInputTokens: 100, MaxOutputTokens: 0}, 1_700_000_000},
		{"invalid pricing time", valid, validFacts, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := ComputeAppResponseMaximumQuota(tc.snapshot, tc.facts, tc.pricedAt)
			require.Error(t, err)
			assert.Equal(t, "pricing_not_supported", err.Error())
		})
	}

	tiered := nativeAppResponseCandidate()
	tiered.BillingBasis = billingexpr.BillingBasisToken
	tiered.ExprVersion = 1
	tiered.GroupRatio = 1
	tiered.QuotaPerUnit = 1_000_000
	tiered.Price = model.PricingValues{
		"billing_setting.billing_mode":        "tiered_expr",
		"billing_setting.billing_expr":        "v1:p + c",
		"billing_setting.billing_expr_sha256": strings.Repeat("0", 64),
	}
	_, err := ComputeAppResponseMaximumQuota(tiered, validFacts, 1_700_000_000)
	require.Error(t, err)
	assert.Equal(t, "pricing_not_supported", err.Error())

	ratio := nativeAppResponseCandidate()
	ratio.BillingBasis = billingexpr.BillingBasisToken
	ratio.GroupRatio = 1
	ratio.QuotaPerUnit = 500_000
	ratio.Price = model.PricingValues{
		"ModelRatio":           float64(1),
		"CompletionRatio":      float64(1),
		"CacheRatio":           float64(1),
		"CreateCacheRatio":     float64(1),
		"ImageRatio":           float64(1),
		"AudioRatio":           math.MaxFloat64,
		"AudioCompletionRatio": math.MaxFloat64,
	}
	assert.NotPanics(t, func() {
		_, err = ComputeAppResponseMaximumQuota(ratio, validFacts, 1_700_000_000)
	})
	require.Error(t, err)
	assert.Equal(t, "pricing_not_supported", err.Error())
}

func TestComputeAppResponseFinalQuotaEnforcesProvenCeiling(t *testing.T) {
	expression := `v1:p + c`
	snapshot := nativeAppResponseCandidate()
	snapshot.BillingBasis = billingexpr.BillingBasisToken
	snapshot.ExprVersion = 1
	snapshot.GroupRatio = 1
	snapshot.QuotaPerUnit = 1_000_000
	snapshot.Price = model.PricingValues{
		"billing_setting.billing_mode":        "tiered_expr",
		"billing_setting.billing_expr":        expression,
		"billing_setting.billing_expr_sha256": billingexpr.ExprHashString(expression),
	}
	facts := AppResponseRequestFacts{EstimatedInputTokens: 100, MaxOutputTokens: 50}
	maximum, err := ComputeAppResponseMaximumQuota(snapshot, facts, 1_700_000_000)
	require.NoError(t, err)
	require.Equal(t, 150, maximum.Quota)

	for _, tc := range []struct {
		name     string
		usage    AppResponseUsage
		reserved int
	}{
		{"input exceeds request fact", AppResponseUsage{InputTokens: 101, TotalTokens: 101}, maximum.Quota},
		{"output exceeds request fact", AppResponseUsage{OutputTokens: 51, TotalTokens: 51}, maximum.Quota},
		{"inconsistent normalized usage", AppResponseUsage{InputTokens: 10, CacheReadInputTokens: 11, TotalTokens: 10}, maximum.Quota},
		{"reservation mismatch", AppResponseUsage{InputTokens: 10, TotalTokens: 10}, maximum.Quota + 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := ComputeAppResponseFinalQuota(snapshot, facts, tc.usage, tc.reserved, 1_700_000_000)
			require.Error(t, err)
			assert.Equal(t, "invalid_usage_evidence", err.Error())
		})
	}
}

func TestComputeAppResponseMaximumQuotaCoversEveryTieredBranch(t *testing.T) {
	expression := `v1:p == 50 ? tier("peak", 1000) : tier("base", 1)`
	snapshot := nativeAppResponseCandidate()
	snapshot.BillingBasis = billingexpr.BillingBasisToken
	snapshot.ExprVersion = 1
	snapshot.GroupRatio = 1
	snapshot.QuotaPerUnit = 1_000_000
	snapshot.Price = model.PricingValues{
		"billing_setting.billing_mode":        "tiered_expr",
		"billing_setting.billing_expr":        expression,
		"billing_setting.billing_expr_sha256": billingexpr.ExprHashString(expression),
	}
	facts := AppResponseRequestFacts{EstimatedInputTokens: 100, MaxOutputTokens: 50}

	maximum, err := ComputeAppResponseMaximumQuota(snapshot, facts, 1_700_000_000)
	require.NoError(t, err)
	assert.Equal(t, 1_000, maximum.Quota)

	final, err := ComputeAppResponseFinalQuota(snapshot, facts, AppResponseUsage{
		InputTokens: 50, TotalTokens: 50,
	}, maximum.Quota, 1_700_000_000)
	require.NoError(t, err)
	assert.Equal(t, 1_000, final.Quota)
	assert.Equal(t, "peak", final.MatchedTier)
}

func TestFreezeNativeAppExecutionPriceRejectsUnfrozenRequestProbes(t *testing.T) {
	for _, expression := range []string{
		`v1:p * (param("service_tier") == "fast" ? 2 : 1)`,
		`v1:p * (header("x-service-tier") == "fast" ? 2 : 1)`,
		`v1:p * (hour("UTC") == 1 ? 2 : 1)`,
	} {
		_, _, _, ok := freezeNativeAppExecutionPrice(model.PricingValues{
			"billing_setting.billing_mode": "tiered_expr",
			"billing_setting.billing_expr": expression,
		})
		assert.False(t, ok, expression)
	}
}

func TestFreezeNativeAppExecutionPriceRequiresProvableDivision(t *testing.T) {
	for _, tc := range []struct {
		expression string
		want       bool
	}{
		{`v1:p / 1000000 + c / 1000000`, true},
		{`v1:p / (c + 1)`, false},
		{`v1:p - c`, false},
		{`v1:p <= 1000000 ? 1 : 1 - p / 2`, false},
		{`v1:(p - 2000000) * (p - 3000000)`, false},
	} {
		_, _, _, ok := freezeNativeAppExecutionPrice(model.PricingValues{
			"billing_setting.billing_mode": "tiered_expr",
			"billing_setting.billing_expr": tc.expression,
		})
		assert.Equal(t, tc.want, ok, tc.expression)
	}
}

func TestFreezeNativeAppExecutionPriceRejectsMalformedBillingMode(t *testing.T) {
	for _, mode := range []any{nil, true, float64(1), "", "request"} {
		_, _, _, ok := freezeNativeAppExecutionPrice(model.PricingValues{
			"billing_setting.billing_mode": mode,
			"ModelPrice":                   float64(0.02),
			"ModelRatio":                   float64(1),
		})
		assert.False(t, ok, "%#v", mode)
	}
}

func TestFreezeNativeAppExecutionPriceAcceptsOutputImageOnlyExpression(t *testing.T) {
	expression := `v1:img_o * 2`
	price, basis, version, ok := freezeNativeAppExecutionPrice(model.PricingValues{
		"billing_setting.billing_mode": "tiered_expr",
		"billing_setting.billing_expr": expression,
	})
	require.True(t, ok)
	assert.Equal(t, billingexpr.BillingBasisToken, basis)
	assert.Equal(t, 1, version)
	assert.Equal(t, billingexpr.ExprHashString(expression), price["billing_setting.billing_expr_sha256"])
}

func issueNativeAppResponseGrant(t *testing.T) (*appExecutionFixture, AppExecutionGrantResult, model.Channel) {
	return issueNativeAppResponseGrantAt(t, "https://native-http.example/v1")
}

func issueNativeAppResponseGrantAt(t *testing.T, baseURL string, secondChannel ...bool) (*appExecutionFixture, AppExecutionGrantResult, model.Channel) {
	return issueNativeAppResponseGrantConfigured(t, baseURL, len(secondChannel) != 0 && secondChannel[0], "", nil, nil)
}

func issueNativeAppResponseGrantConfigured(t *testing.T, baseURL string, secondChannel bool,
	key string, organization *string, pricing []model.Option,
) (*appExecutionFixture, AppExecutionGrantResult, model.Channel) {
	t.Helper()
	pluginEnabled, grantsEnabled, seedanceEnabled := operation_setting.AppPluginV1Enabled,
		operation_setting.AppExecutionGrantsEnabled, operation_setting.AppPluginSeedanceEnabled
	operation_setting.AppPluginV1Enabled, operation_setting.AppExecutionGrantsEnabled,
		operation_setting.AppPluginSeedanceEnabled = true, true, true
	t.Cleanup(func() {
		operation_setting.AppPluginV1Enabled, operation_setting.AppExecutionGrantsEnabled,
			operation_setting.AppPluginSeedanceEnabled = pluginEnabled, grantsEnabled, seedanceEnabled
	})
	f := newAppExecutionFixture(t)
	const publicModel = "registered-native-http"
	mapping := `{"` + publicModel + `":"gpt-native-http"}`
	if key == "" {
		key = "native-http-secret"
	}
	channel := model.Channel{
		Type: constant.ChannelTypeOpenAI, Name: "native-http", Key: key,
		BaseURL: common.GetPointer(baseURL), ModelMapping: &mapping,
		OpenAIOrganization: organization, Status: common.ChannelStatusEnabled,
		Group: "default", Models: publicModel,
	}
	require.NoError(t, f.db.Create(&channel).Error)
	require.NoError(t, channel.AddAbilities(f.db))
	if secondChannel {
		another := channel
		another.Id, another.Name = 0, "native-http-secondary"
		require.NoError(t, f.db.Create(&another).Error)
		require.NoError(t, another.AddAbilities(f.db))
	}
	if len(pricing) == 0 {
		require.NoError(t, f.db.Model(&model.Option{}).Where(map[string]any{"key": "ModelPrice"}).
			Update("value", `{"`+appExecutionTestModel+`":0.01,"`+publicModel+`":0.02}`).Error)
	} else {
		require.NoError(t, f.db.Model(&model.Option{}).Where(map[string]any{"key": "ModelPrice"}).
			Update("value", `{"`+appExecutionTestModel+`":0.01}`).Error)
		require.NoError(t, f.db.Create(&pricing).Error)
	}
	policy := AppModelInvokePolicy{Operations: map[string]AppModelOperationPolicy{
		"model.generate": {
			Models: []AppModelAdmission{{
				PublicModel: publicModel, ActualModel: "gpt-native-http",
				Protocol: "openai_responses", ExecutionKind: appExecutionKindNativeResponse,
				ChannelTypes: []int{constant.ChannelTypeOpenAI}, RequestProfile: appResponsesTextProfileV1,
			}},
			Strategies: []string{"stable"}, ConversionPolicies: []string{"strict"},
			PassthroughRules: []AppPassthroughRule{},
		},
	}}
	raw, err := common.Marshal(policy)
	require.NoError(t, err)
	f.request.ModelPolicyVersion, err = PublishAppModelInvokePolicy(
		t.Context(), f.db, f.publisher, raw, f.options.Now(),
	)
	require.NoError(t, err)
	f.request.RequestID = uuid.NewString()
	f.request.RequestedModels = []string{publicModel}
	result, err := f.execution.IssueExecutionGrant(t.Context(), f.serviceID, f.request)
	require.NoError(t, err)
	return f, result, channel
}

func TestAuthenticateAppRelaySelectsNativeResponseProfile(t *testing.T) {
	f, issued, _ := issueNativeAppResponseGrantAt(t, "https://native-http.example/v1", true)
	omitted := []byte(`{"model":"registered-native-http","input":"hello","max_output_tokens":32}`)
	explicit := []byte(`{"store":false,"stream":false,"max_output_tokens":32,"input":"hello","model":"registered-native-http"}`)

	first, user, err := f.execution.AuthenticateAppRelay(
		t.Context(), issued.GrantToken, "openai_responses", omitted,
	)
	require.NoError(t, err)
	assert.Equal(t, f.user.Id, user.Id)
	assert.Equal(t, model.AppExecutionModelKindNativeResponse, first.ExecutionKind)
	assert.Equal(t, "registered-native-http", first.PublicModel)
	assert.Empty(t, first.AssetInputs)

	second, _, err := f.execution.AuthenticateAppRelay(
		t.Context(), issued.GrantToken, "openai_responses", explicit,
	)
	require.NoError(t, err)
	assert.Equal(t, first.SubmissionHash, second.SubmissionHash)

	_, _, err = f.execution.AuthenticateAppRelay(
		t.Context(), issued.GrantToken, "openai_responses",
		[]byte(`{"model":"registered-native-http","input":"hello","max_output_tokens":32,"tools":[]}`),
	)
	require.ErrorContains(t, err, "invalid_request")
}

func TestAuthenticateAppRelayMapsGrantQueryFailures(t *testing.T) {
	for _, test := range []struct {
		name   string
		failAt int32
	}{
		{name: "initial grant lookup", failAt: 1},
		{name: "current grant reread", failAt: 2},
	} {
		t.Run(test.name, func(t *testing.T) {
			f, issued, _ := issueNativeAppResponseGrant(t)
			privateError := "private grant storage failure: " + test.name
			callbackName := "test:native-grant-query-failure:" + uuid.NewString()
			var grantReads atomic.Int32
			require.NoError(t, f.db.Callback().Query().Before("gorm:query").
				Register(callbackName, func(tx *gorm.DB) {
					if tx.Statement.Table == "app_execution_grants" &&
						grantReads.Add(1) == test.failAt {
						tx.AddError(errors.New(privateError))
					}
				}))
			t.Cleanup(func() {
				require.NoError(t, f.db.Callback().Query().Remove(callbackName))
			})

			_, _, err := f.execution.AuthenticateAppRelay(
				t.Context(), issued.GrantToken, "openai_responses",
				[]byte(`{"model":"registered-native-http","input":"hello","max_output_tokens":32}`),
			)

			var authErr *AppPluginAuthError
			require.ErrorAs(t, err, &authErr)
			assert.Equal(t, "service_unavailable", authErr.Code)
			assert.Equal(t, http.StatusServiceUnavailable, AppRelayErrorStatus(err))
			assert.NotContains(t, err.Error(), privateError)
			assert.Equal(t, test.failAt, grantReads.Load())
		})
	}
}

func TestAuthenticateAppRelayKeepsInvalidExpiredAndRevokedGrantsNonRetryable(t *testing.T) {
	raw := []byte(`{"model":"registered-native-http","input":"hello","max_output_tokens":32}`)
	for _, test := range []struct {
		name     string
		mutate   func(*testing.T, *appExecutionFixture, AppExecutionGrantResult)
		token    func(AppExecutionGrantResult) string
		wantCode string
	}{
		{
			name: "invalid token",
			token: func(issued AppExecutionGrantResult) string {
				return issued.GrantToken[:len(issued.GrantToken)-1]
			},
			wantCode: "invalid_grant",
		},
		{
			name: "missing grant",
			mutate: func(t *testing.T, f *appExecutionFixture, issued AppExecutionGrantResult) {
				require.NoError(t, f.db.Where("grant_id = ?", issued.GrantID).
					Delete(&model.AppExecutionGrant{}).Error)
			},
			wantCode: "invalid_grant",
		},
		{
			name: "expired grant",
			mutate: func(_ *testing.T, f *appExecutionFixture, issued AppExecutionGrantResult) {
				f.execution.options.Now = func() time.Time { return issued.ExpiresAt.Add(time.Second) }
			},
			wantCode: "execution_grant_expired",
		},
		{
			name: "revoked session",
			mutate: func(t *testing.T, f *appExecutionFixture, _ AppExecutionGrantResult) {
				require.NoError(t, f.db.Model(&model.AppPluginSession{}).
					Where("app_session_id = ?", f.appSession.AppSessionID).
					Update("revoked_at", f.options.Now().UnixNano()).Error)
			},
			wantCode: "unauthenticated",
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			f, issued, _ := issueNativeAppResponseGrant(t)
			if test.mutate != nil {
				test.mutate(t, f, issued)
			}
			token := issued.GrantToken
			if test.token != nil {
				token = test.token(issued)
			}

			_, _, err := f.execution.AuthenticateAppRelay(
				t.Context(), token, "openai_responses", raw,
			)

			var authErr *AppPluginAuthError
			require.ErrorAs(t, err, &authErr)
			assert.Equal(t, test.wantCode, authErr.Code)
			assert.Equal(t, http.StatusUnauthorized, AppRelayErrorStatus(err))
		})
	}
}

func TestAuthenticateAppRelayMapsTransactionBeginAndCommitFailuresToServiceUnavailable(t *testing.T) {
	raw := []byte(`{"model":"registered-native-http","input":"hello","max_output_tokens":32}`)
	for _, test := range []struct {
		name      string
		beginErr  error
		commitErr error
	}{
		{name: "begin", beginErr: errors.New("private relay begin detail")},
		{name: "commit", commitErr: errors.New("private relay commit detail")},
	} {
		t.Run(test.name, func(t *testing.T) {
			f, issued, _ := issueNativeAppResponseGrant(t)
			faultDB := appExecutionDBWithTransactionFault(t, f.db, test.beginErr, test.commitErr)
			execution := NewAppExecutionService(faultDB, f.options)

			_, _, err := execution.AuthenticateAppRelay(
				t.Context(), issued.GrantToken, "openai_responses", raw,
			)

			var authErr *AppPluginAuthError
			require.ErrorAs(t, err, &authErr)
			assert.Equal(t, "service_unavailable", authErr.Code)
			assert.Equal(t, http.StatusServiceUnavailable, AppRelayErrorStatus(err))
			assert.NotContains(t, err.Error(), "private")
		})
	}
}

func TestSelectAppRelayChannelAbortsOnStorageFaults(t *testing.T) {
	for _, test := range []struct {
		name       string
		table      string
		occurrence int32
	}{
		{name: "policy", table: "options", occurrence: 2},
		{name: "groups", table: "options", occurrence: 3},
		{name: "channel", table: "channels", occurrence: 1},
		{name: "ability", table: "abilities", occurrence: 1},
	} {
		t.Run(test.name, func(t *testing.T) {
			f, issued, _ := issueNativeAppResponseGrant(t)
			raw := []byte(`{"model":"registered-native-http","input":"hello","max_output_tokens":32}`)
			subject, _, err := f.execution.AuthenticateAppRelay(
				t.Context(), issued.GrantToken, "openai_responses", raw,
			)
			require.NoError(t, err)
			privateDetail := "private candidate " + test.name + " storage detail"
			failed := registerAppExecutionDBFault(
				t, f.db, "query", test.table, test.occurrence, errors.New(privateDetail),
			)

			channel, _, err := f.execution.SelectAppRelayChannel(
				t.Context(), subject, &taskdto.ChannelConstraints{},
			)

			require.True(t, failed.Load(), "the intended candidate query must be exercised")
			assert.Nil(t, channel)
			var authErr *AppPluginAuthError
			require.ErrorAs(t, err, &authErr)
			assert.Equal(t, "service_unavailable", authErr.Code)
			assert.Equal(t, http.StatusServiceUnavailable, AppRelayErrorStatus(err))
			assert.NotContains(t, err.Error(), privateDetail)
		})
	}
}

func TestSelectTaskBackedAppRelayChannelAbortsOnStorageFaults(t *testing.T) {
	for _, test := range []struct {
		name       string
		table      string
		occurrence int32
	}{
		{name: "policy", table: "options", occurrence: 2},
		{name: "groups", table: "options", occurrence: 3},
		{name: "channel", table: "channels", occurrence: 1},
		{name: "ability", table: "abilities", occurrence: 1},
	} {
		t.Run(test.name, func(t *testing.T) {
			f := newAppExecutionFixture(t)
			issued, err := f.execution.IssueExecutionGrant(t.Context(), f.serviceID, f.request)
			require.NoError(t, err)
			subject, _, err := f.execution.AuthenticateAppRelay(
				t.Context(), issued.GrantToken, "openai_video",
				[]byte(`{"model":"`+appExecutionTestModel+`","prompt":"hello"}`),
			)
			require.NoError(t, err)
			privateDetail := "private task candidate " + test.name + " storage detail"
			failed := registerAppExecutionDBFault(
				t, f.db, "query", test.table, test.occurrence, errors.New(privateDetail),
			)

			channel, _, err := f.execution.SelectAppRelayChannel(
				t.Context(), subject, &taskdto.ChannelConstraints{},
			)

			require.True(t, failed.Load(), "the intended task candidate query must be exercised")
			assert.Nil(t, channel)
			var authErr *AppPluginAuthError
			require.ErrorAs(t, err, &authErr)
			assert.Equal(t, "service_unavailable", authErr.Code)
			assert.Equal(t, http.StatusServiceUnavailable, AppRelayErrorStatus(err))
			assert.NotContains(t, err.Error(), privateDetail)
		})
	}
}

func TestSelectAppRelayChannelMapsTransactionBeginAndCommitFailuresToServiceUnavailable(t *testing.T) {
	raw := []byte(`{"model":"registered-native-http","input":"hello","max_output_tokens":32}`)
	for _, test := range []struct {
		name      string
		beginErr  error
		commitErr error
	}{
		{name: "begin", beginErr: errors.New("private selection begin detail")},
		{name: "commit", commitErr: errors.New("private selection commit detail")},
	} {
		t.Run(test.name, func(t *testing.T) {
			f, issued, _ := issueNativeAppResponseGrant(t)
			subject, _, err := f.execution.AuthenticateAppRelay(
				t.Context(), issued.GrantToken, "openai_responses", raw,
			)
			require.NoError(t, err)
			faultDB := appExecutionDBWithTransactionFault(t, f.db, test.beginErr, test.commitErr)
			execution := NewAppExecutionService(faultDB, f.options)

			channel, _, err := execution.SelectAppRelayChannel(
				t.Context(), subject, &taskdto.ChannelConstraints{},
			)

			assert.Nil(t, channel)
			var authErr *AppPluginAuthError
			require.ErrorAs(t, err, &authErr)
			assert.Equal(t, "service_unavailable", authErr.Code)
			assert.Equal(t, http.StatusServiceUnavailable, AppRelayErrorStatus(err))
			assert.NotContains(t, err.Error(), "private")
		})
	}
}

func TestPrepareAppTaskPassthroughDistinguishesMissingGrantFromStorageFailure(t *testing.T) {
	for _, test := range []struct {
		name       string
		inject     bool
		wantCode   string
		wantStatus int
	}{
		{name: "missing", wantCode: "invalid_grant", wantStatus: http.StatusUnauthorized},
		{name: "storage failure", inject: true, wantCode: "service_unavailable", wantStatus: http.StatusServiceUnavailable},
	} {
		t.Run(test.name, func(t *testing.T) {
			f := newAppExecutionFixture(t)
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", nil)
			info := &relaycommon.RelayInfo{AppSubject: &hosttypes.AppRelaySubject{
				GrantID: "missing-grant",
			}}
			if test.inject {
				registerAppExecutionDBFault(
					t, f.db, "query", "app_execution_grants", 1,
					errors.New("private passthrough storage detail"),
				)
			}

			err := PrepareAppTaskPassthrough(c, info)

			var authErr *AppPluginAuthError
			require.ErrorAs(t, err, &authErr)
			assert.Equal(t, test.wantCode, authErr.Code)
			assert.Equal(t, test.wantStatus, AppRelayErrorStatus(err))
			assert.NotContains(t, err.Error(), "private")
		})
	}
}

func acceptedAppTaskRetrievalFixture(t *testing.T) (*appExecutionFixture, AppExecutionGrantResult, model.AppTaskExecution) {
	t.Helper()
	f := newAppExecutionFixture(t)
	issued, err := f.execution.IssueExecutionGrant(t.Context(), f.serviceID, f.request)
	require.NoError(t, err)
	var grant model.AppExecutionGrant
	require.NoError(t, f.db.Where("grant_id = ?", issued.GrantID).First(&grant).Error)
	var candidates []model.AppExecutionModel
	require.NoError(t, common.UnmarshalJsonStr(grant.ModelsJSON, &candidates))
	require.NotEmpty(t, candidates)
	candidate := candidates[0]
	execution := model.AppTaskExecution{
		ExecutionKind: model.AppExecutionKindTask,
		LogicalHash:   serviceDigest("retrieval-logical"),
		TaskID:        "task-retrieval",
		GrantID:       grant.GrantID,
		AppKey:        grant.AppKey, InstallationID: grant.InstallationID,
		AppSessionID: grant.AppSessionID, Subject: grant.Subject, UserID: grant.UserID,
		RunID: grant.RunID, ExecutionRequestID: grant.ExecutionRequestID, Operation: grant.Operation,
		SubmissionHash: "retrieval-submission",
		PublicModel:    candidate.PublicModel, ActualModel: candidate.ActualModel,
		ActualGroup: candidate.Group, ChannelID: candidate.ChannelID,
		PluginKey: candidate.PluginKey, PluginVersion: candidate.PluginVersion,
		PluginSHA256: candidate.PluginSHA256, Protocol: candidate.Protocol,
		ProviderTaskID: "cgt-retrieval", ProviderAccepted: true,
		Status: "accepted", ProviderState: "queued", BillingState: "reserved",
		FundingSource: grant.FundingSource, FundingRef: grant.FundingRef,
		UpdatedAt: f.options.Now().Unix(), CreatedAt: f.options.Now().Unix(),
	}
	require.NoError(t, f.db.Create(&execution).Error)
	projection := model.Task{
		TaskID: execution.TaskID, Platform: constant.TaskPlatform(execution.PluginKey),
		UserId: execution.UserID, Group: execution.ActualGroup, ChannelId: execution.ChannelID,
		Status: model.TaskStatusQueued, ExecutionMode: model.TaskExecutionModeAppManaged,
		Properties: model.Properties{
			OriginModelName: execution.PublicModel, UpstreamModelName: execution.ActualModel,
		},
		PrivateData: model.TaskPrivateData{UpstreamTaskID: execution.ProviderTaskID},
	}
	require.NoError(t, f.db.Create(&projection).Error)
	return f, issued, execution
}

func TestAuthenticateAppTaskRetrievalDistinguishesStorageFaultsFromMissingResources(t *testing.T) {
	for _, test := range []struct {
		name       string
		table      string
		occurrence int32
	}{
		{name: "execution lookup", table: "app_task_executions", occurrence: 1},
		{name: "scoped task lookup", table: "app_task_executions", occurrence: 2},
		{name: "projection lookup", table: "tasks", occurrence: 1},
	} {
		t.Run(test.name+" storage failure", func(t *testing.T) {
			f, issued, execution := acceptedAppTaskRetrievalFixture(t)
			privateDetail := "private retrieval " + test.name + " storage detail"
			failed := registerAppExecutionDBFault(
				t, f.db, "query", test.table, test.occurrence, errors.New(privateDetail),
			)

			_, _, err := f.execution.AuthenticateAppTaskRetrieval(
				t.Context(), issued.GrantToken, execution.Protocol, execution.TaskID,
			)

			require.True(t, failed.Load(), "the intended retrieval query must be exercised")
			var authErr *AppPluginAuthError
			require.ErrorAs(t, err, &authErr)
			assert.Equal(t, "service_unavailable", authErr.Code)
			assert.Equal(t, http.StatusServiceUnavailable, AppRelayErrorStatus(err))
			assert.NotContains(t, err.Error(), privateDetail)
		})
	}

	t.Run("missing execution", func(t *testing.T) {
		f, issued, execution := acceptedAppTaskRetrievalFixture(t)
		require.NoError(t, f.db.Where("id = ?", execution.ID).
			Delete(&model.AppTaskExecution{}).Error)

		_, _, err := f.execution.AuthenticateAppTaskRetrieval(
			t.Context(), issued.GrantToken, execution.Protocol, execution.TaskID,
		)

		var authErr *AppPluginAuthError
		require.ErrorAs(t, err, &authErr)
		assert.Equal(t, "not_found", authErr.Code)
		assert.Equal(t, http.StatusNotFound, AppRelayErrorStatus(err))
	})

	t.Run("missing projection", func(t *testing.T) {
		f, issued, execution := acceptedAppTaskRetrievalFixture(t)
		require.NoError(t, f.db.Where("task_id = ?", execution.TaskID).
			Delete(&model.Task{}).Error)

		_, _, err := f.execution.AuthenticateAppTaskRetrieval(
			t.Context(), issued.GrantToken, execution.Protocol, execution.TaskID,
		)

		var authErr *AppPluginAuthError
		require.ErrorAs(t, err, &authErr)
		assert.Equal(t, "not_found", authErr.Code)
		assert.Equal(t, http.StatusNotFound, AppRelayErrorStatus(err))
	})
}

func TestAuthenticateAppRelayLocksInstallationBeforeGrant(t *testing.T) {
	f, issued, _ := issueNativeAppResponseGrant(t)
	type queryLock struct {
		table  string
		locked bool
	}
	queries := []queryLock{}
	previousDatabaseType := common.MainDatabaseType()
	common.SetMainDatabaseType(common.DatabaseTypePostgreSQL)
	t.Cleanup(func() { common.SetMainDatabaseType(previousDatabaseType) })
	require.NoError(t, f.db.Callback().Query().Before("gorm:query").
		Register("app-native-lock-order", func(tx *gorm.DB) {
			_, locked := tx.Statement.Clauses["FOR"]
			queries = append(queries, queryLock{table: tx.Statement.Table, locked: locked})
			delete(tx.Statement.Clauses, "FOR")
		}))
	t.Cleanup(func() { _ = f.db.Callback().Query().Remove("app-native-lock-order") })

	_, _, err := f.execution.AuthenticateAppRelay(
		t.Context(), issued.GrantToken, "openai_responses",
		[]byte(`{"model":"registered-native-http","input":"hello","max_output_tokens":32}`),
	)
	require.NoError(t, err)
	firstOwnerLock, firstGrantLock := -1, -1
	for index, query := range queries {
		if !query.locked {
			continue
		}
		if query.table == "app_route_claims" && firstOwnerLock < 0 {
			firstOwnerLock = index
		}
		if query.table == "app_execution_grants" && firstGrantLock < 0 {
			firstGrantLock = index
		}
	}
	require.NotEqual(t, -1, firstOwnerLock)
	require.NotEqual(t, -1, firstGrantLock)
	assert.Greater(t, firstGrantLock, firstOwnerLock,
		"execution must use the issuance lock order: installation ownership before grant")
}

func TestSelectAppRelayChannelRevalidatesNativeSnapshot(t *testing.T) {
	for _, testCase := range []struct {
		name   string
		mutate func(*testing.T, *appExecutionFixture, model.Channel)
	}{
		{"unchanged", func(*testing.T, *appExecutionFixture, model.Channel) {}},
		{"credential", func(t *testing.T, f *appExecutionFixture, channel model.Channel) {
			require.NoError(t, f.db.Model(&channel).Update("key", "rotated").Error)
		}},
		{"base URL", func(t *testing.T, f *appExecutionFixture, channel model.Channel) {
			require.NoError(t, f.db.Model(&channel).Update("base_url", "https://moved.example/v1").Error)
		}},
		{"mapping", func(t *testing.T, f *appExecutionFixture, channel model.Channel) {
			require.NoError(t, f.db.Model(&channel).Update("model_mapping",
				`{"registered-native-http":"other"}`).Error)
		}},
		{"settings", func(t *testing.T, f *appExecutionFixture, channel model.Channel) {
			require.NoError(t, f.db.Model(&channel).Update("setting", `{"proxy":"http://proxy.example"}`).Error)
		}},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			f, issued, channel := issueNativeAppResponseGrant(t)
			raw := []byte(`{"model":"registered-native-http","input":"hello","max_output_tokens":32}`)
			subject, _, err := f.execution.AuthenticateAppRelay(
				t.Context(), issued.GrantToken, "openai_responses", raw,
			)
			require.NoError(t, err)
			testCase.mutate(t, f, channel)
			selectedChannel, candidate, err := f.execution.SelectAppRelayChannel(
				t.Context(), subject, &taskdto.ChannelConstraints{},
			)
			if testCase.name == "unchanged" {
				require.NoError(t, err)
				require.NotNil(t, selectedChannel)
				assert.Equal(t, channel.Id, selectedChannel.Id)
				assert.Equal(t, model.AppExecutionModelKindNativeResponse, candidate.ExecutionKind)
				return
			}
			require.Error(t, err)
			assert.Nil(t, selectedChannel)
		})
	}
}

func TestAuthenticateAppRelayPreservesTaskBackedFlow(t *testing.T) {
	enabled, grants := operation_setting.AppPluginV1Enabled, operation_setting.AppExecutionGrantsEnabled
	operation_setting.AppPluginV1Enabled, operation_setting.AppExecutionGrantsEnabled = true, true
	t.Cleanup(func() {
		operation_setting.AppPluginV1Enabled, operation_setting.AppExecutionGrantsEnabled = enabled, grants
	})
	f := newAppExecutionFixture(t)
	issued, err := f.execution.IssueExecutionGrant(t.Context(), f.serviceID, f.request)
	require.NoError(t, err)
	subject, _, err := f.execution.AuthenticateAppRelay(
		t.Context(), issued.GrantToken, "openai_video",
		[]byte(`{"model":"`+appExecutionTestModel+`","prompt":"hello"}`),
	)
	require.NoError(t, err)
	assert.Equal(t, model.AppExecutionModelKindTaskBacked, subject.ExecutionKind)
	assert.NotEmpty(t, subject.SubmissionHash)
	assert.Equal(t, hosttypes.AppRelaySubject{
		GrantID: subject.GrantID, TokenHash: subject.TokenHash, UserID: subject.UserID,
		Protocol: subject.Protocol, PublicModel: subject.PublicModel,
		ExecutionKind: subject.ExecutionKind, SubmissionHash: subject.SubmissionHash,
		Strategy: subject.Strategy, ConversionPolicy: subject.ConversionPolicy,
		AssetInputs: subject.AssetInputs,
	}, subject)
}

func appTaskBillingCaptureFixture(t *testing.T) (*appExecutionFixture, *gin.Context, *relaycommon.RelayInfo) {
	t.Helper()
	f := newAppExecutionFixture(t)
	issued, err := f.execution.IssueExecutionGrant(t.Context(), f.serviceID, f.request)
	require.NoError(t, err)
	raw := []byte(`{"model":"` + appExecutionTestModel + `","prompt":"hello"}`)
	subject, _, err := f.execution.AuthenticateAppRelay(
		t.Context(), issued.GrantToken, "openai_video", raw,
	)
	require.NoError(t, err)
	_, selected, err := f.execution.SelectAppRelayChannel(
		t.Context(), subject, &taskdto.ChannelConstraints{},
	)
	require.NoError(t, err)
	subject.ChannelID, subject.Group = selected.ChannelID, selected.Group
	subject.PluginSHA256 = selected.PluginSHA256

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", bytes.NewReader(raw))
	c.Set(pluginruntime.ContextKeyProtocolRequest, pluginruntime.ProtocolRequestContext{
		RouteRequestContext: pluginruntime.RouteRequestContext{
			Body: map[string]any{
				"kind":  "json",
				"value": map[string]any{"model": appExecutionTestModel, "prompt": "hello"},
			},
		},
		Protocol: "openai_video",
		Model:    appExecutionTestModel,
	})
	return f, c, &relaycommon.RelayInfo{AppSubject: &subject}
}

type appTaskBillingGrantReadBarrier struct {
	reached     chan struct{}
	release     chan struct{}
	releaseOnce sync.Once
}

func (b *appTaskBillingGrantReadBarrier) unblock() {
	b.releaseOnce.Do(func() {
		close(b.release)
	})
}

func registerAppTaskBillingGrantReadBarrier(
	t *testing.T,
	db *gorm.DB,
	occurrence int32,
) *appTaskBillingGrantReadBarrier {
	t.Helper()
	var reads atomic.Int32
	barrier := &appTaskBillingGrantReadBarrier{
		reached: make(chan struct{}),
		release: make(chan struct{}),
	}
	callbackName := "test:billing-grant-read-barrier:" + uuid.NewString()
	require.NoError(t, db.Callback().Query().Before("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table != "app_execution_grants" || reads.Add(1) != occurrence {
			return
		}
		close(barrier.reached)
		<-barrier.release
	}))
	t.Cleanup(func() {
		barrier.unblock()
		require.NoError(t, db.Callback().Query().Remove(callbackName))
	})
	return barrier
}

func TestCaptureAppTaskBillingInputsClassifiesStorageAndInputFailures(t *testing.T) {
	t.Run("grant disappears before billing reread", func(t *testing.T) {
		f, c, info := appTaskBillingCaptureFixture(t)
		barrier := registerAppTaskBillingGrantReadBarrier(t, f.db, 1)
		result := make(chan error, 1)
		go func() {
			_, err := CaptureAppTaskBillingInputs(c, info, map[string]any{"tokens": float64(1)})
			result <- err
		}()
		select {
		case <-barrier.reached:
		case <-time.After(5 * time.Second):
			t.Fatal("billing grant reread did not reach the deletion barrier")
		}
		require.NoError(t, f.db.Where("grant_id = ?", info.AppSubject.GrantID).
			Delete(&model.AppExecutionGrant{}).Error)
		barrier.unblock()

		var err error
		select {
		case err = <-result:
		case <-time.After(5 * time.Second):
			t.Fatal("billing input capture did not finish after deleting the grant")
		}
		var authErr *AppPluginAuthError
		require.ErrorAs(t, err, &authErr)
		assert.Equal(t, "invalid_grant", authErr.Code)
		assert.Equal(t, http.StatusUnauthorized, AppRelayErrorStatus(err))
	})

	t.Run("grant query storage failure", func(t *testing.T) {
		f, c, info := appTaskBillingCaptureFixture(t)
		const privateDetail = "private billing input grant query detail"
		failed := registerAppExecutionDBFault(
			t, f.db, "query", "app_execution_grants", 1, errors.New(privateDetail),
		)

		_, err := CaptureAppTaskBillingInputs(c, info, map[string]any{"tokens": float64(1)})

		require.True(t, failed.Load(), "billing input capture must read the frozen grant")
		var authErr *AppPluginAuthError
		require.ErrorAs(t, err, &authErr)
		assert.Equal(t, "service_unavailable", authErr.Code)
		assert.NotContains(t, err.Error(), privateDetail)
	})

	t.Run("invalid request price fact", func(t *testing.T) {
		f, c, info := appTaskBillingCaptureFixture(t)
		var grant model.AppExecutionGrant
		require.NoError(t, f.db.Where("grant_id = ?", info.AppSubject.GrantID).First(&grant).Error)
		var candidates []model.AppExecutionModel
		require.NoError(t, common.UnmarshalJsonStr(grant.ModelsJSON, &candidates))
		require.Len(t, candidates, 1)
		candidates[0].BillingBasis = billingexpr.BillingBasisTask
		candidates[0].Price = model.PricingValues{
			"billing_setting.billing_expr": `v1:tier("base", u("tokens") * 9.8 / 1000000) * ` +
				`(header("x-service-tier") == "fast" ? 2 : 1)`,
		}
		modelsJSON, err := common.Marshal(candidates)
		require.NoError(t, err)
		grant.ModelsJSON = string(modelsJSON)
		require.NoError(t, f.db.Model(&grant).Update("models_json", grant.ModelsJSON).Error)
		c.Request.Header["X-Service-Tier"] = []string{"fast", "slow"}

		_, err = CaptureAppTaskBillingInputs(c, info, map[string]any{"tokens": float64(1)})

		var authErr *AppPluginAuthError
		require.ErrorAs(t, err, &authErr)
		assert.Equal(t, "invalid_price_inputs", authErr.Code)
	})
}

func TestAppBillingSessionReleaseBeforeDispatchRefundsAndAllowsRetry(t *testing.T) {
	f, c, session, inputs, outbound := appTaskClaimFixture(t)
	var before model.User
	require.NoError(t, f.db.First(&before, session.info.AppSubject.UserID).Error)

	execution, won, err := session.Claim(c, inputs, outbound)

	require.NoError(t, err)
	require.True(t, won)
	require.Positive(t, execution.ReservedQuota)
	var reserved model.User
	require.NoError(t, f.db.First(&reserved, before.Id).Error)
	assert.EqualValues(t, int64(before.Quota)-execution.ReservedQuota, reserved.Quota)

	require.NoError(t, session.ReleaseBeforeDispatch(c.Request.Context()))

	var executionCount, reconcileCount int64
	require.NoError(t, f.db.Model(&model.AppTaskExecution{}).
		Where("id = ?", execution.ID).Count(&executionCount).Error)
	require.NoError(t, f.db.Model(&model.AppTaskReconcile{}).
		Where("execution_id = ?", execution.ID).Count(&reconcileCount).Error)
	assert.Zero(t, executionCount)
	assert.Zero(t, reconcileCount)
	var restored model.User
	require.NoError(t, f.db.First(&restored, before.Id).Error)
	assert.Equal(t, before.Quota, restored.Quota)

	retry, retryWon, retryErr := session.Claim(c, inputs, outbound)
	require.NoError(t, retryErr)
	assert.True(t, retryWon)
	assert.NotZero(t, retry.ID)
}

func appTaskClaimFixture(t *testing.T) (
	*appExecutionFixture,
	*gin.Context,
	*AppBillingSession,
	AppTaskBillingInputs,
	[]byte,
) {
	t.Helper()
	f, c, info := appTaskBillingCaptureFixture(t)
	var channel model.Channel
	require.NoError(t, f.db.First(&channel, info.AppSubject.ChannelID).Error)
	baseURL := channel.GetBaseURL()
	if baseURL == "" {
		baseURL = constant.GetChannelBaseURL(channel.Type)
	}
	info.UserId = info.AppSubject.UserID
	info.OriginModelName = info.AppSubject.PublicModel
	info.ChannelMeta = &relaycommon.ChannelMeta{
		ChannelId:            channel.Id,
		ChannelBaseUrl:       baseURL,
		ApiKey:               channel.Key,
		ChannelMultiKeyIndex: 0,
		ChannelSetting:       channel.GetSetting(),
		UpstreamModelName:    info.AppSubject.PublicModel,
	}
	inputs, err := CaptureAppTaskBillingInputs(
		c, info, map[string]any{"tokens": float64(1)},
	)
	require.NoError(t, err)
	outbound, err := common.Marshal(map[string]any{
		"model": info.AppSubject.PublicModel,
		"content": []any{
			map[string]any{"type": "text", "text": "hello"},
		},
	})
	require.NoError(t, err)
	return f, c, &AppBillingSession{service: f.execution, info: info}, inputs, outbound
}

func TestAppBillingSessionClaimClassifiesBusinessAndStorageFailures(t *testing.T) {
	t.Run("insufficient quota", func(t *testing.T) {
		f, c, session, inputs, outbound := appTaskClaimFixture(t)
		require.NoError(t, f.db.Model(&model.User{}).
			Where("id = ?", session.info.AppSubject.UserID).Update("quota", 0).Error)

		_, _, err := session.Claim(c, inputs, outbound)

		var authErr *AppPluginAuthError
		require.ErrorAs(t, err, &authErr)
		assert.Equal(t, "insufficient_quota", authErr.Code)
		assert.Equal(t, http.StatusPaymentRequired, AppRelayErrorStatus(err))
	})

	t.Run("grant expires after authority revalidation", func(t *testing.T) {
		f, c, session, inputs, outbound := appTaskClaimFixture(t)
		var reads atomic.Int32
		var expired atomic.Bool
		callbackName := "test:claim-grant-expiry:" + uuid.NewString()
		require.NoError(t, f.db.Callback().Query().After("gorm:query").
			Register(callbackName, func(tx *gorm.DB) {
				if tx.Statement.Table != "app_execution_grants" || reads.Add(1) != 3 {
					return
				}
				grant, ok := tx.Statement.Dest.(*model.AppExecutionGrant)
				if !ok {
					return
				}
				grant.ExpiresAt = f.options.Now().Add(-time.Minute).Unix()
				expired.Store(true)
			}))
		t.Cleanup(func() {
			require.NoError(t, f.db.Callback().Query().Remove(callbackName))
		})

		_, _, err := session.Claim(c, inputs, outbound)

		require.True(t, expired.Load(), "grant must expire at the durable claim read")
		var authErr *AppPluginAuthError
		require.ErrorAs(t, err, &authErr)
		assert.Equal(t, "execution_grant_expired", authErr.Code)
		assert.Equal(t, http.StatusUnauthorized, AppRelayErrorStatus(err))
	})

	for _, failure := range []struct {
		name       string
		operation  string
		table      string
		occurrence int32
	}{
		{name: "claim grant query", operation: "query", table: "app_execution_grants", occurrence: 3},
		{name: "funding write", operation: "update", table: "users", occurrence: 1},
		{name: "execution create", operation: "create", table: "app_task_executions", occurrence: 1},
	} {
		t.Run(failure.name, func(t *testing.T) {
			f, c, session, inputs, outbound := appTaskClaimFixture(t)
			privateDetail := "private " + failure.name + " detail"
			failed := registerAppExecutionDBFault(
				t, f.db, failure.operation, failure.table, failure.occurrence,
				errors.New(privateDetail),
			)

			_, _, err := session.Claim(c, inputs, outbound)

			require.True(t, failed.Load(), "the intended claim boundary must be exercised")
			var authErr *AppPluginAuthError
			require.ErrorAs(t, err, &authErr)
			assert.Equal(t, "service_unavailable", authErr.Code)
			assert.Equal(t, http.StatusServiceUnavailable, AppRelayErrorStatus(err))
			assert.NotContains(t, err.Error(), privateDetail)
		})
	}

	for _, boundary := range []struct {
		name      string
		beginErr  error
		commitErr error
	}{
		{name: "begin", beginErr: errors.New("private claim begin detail")},
		{name: "commit", commitErr: errors.New("private claim commit detail")},
	} {
		t.Run(boundary.name, func(t *testing.T) {
			f, c, session, inputs, outbound := appTaskClaimFixture(t)
			session.service = NewAppExecutionService(
				appExecutionDBWithTransactionFault(t, f.db, boundary.beginErr, boundary.commitErr),
				f.options,
			)

			_, _, err := session.Claim(c, inputs, outbound)

			var authErr *AppPluginAuthError
			require.ErrorAs(t, err, &authErr)
			assert.Equal(t, "service_unavailable", authErr.Code)
			assert.Equal(t, http.StatusServiceUnavailable, AppRelayErrorStatus(err))
			assert.NotContains(t, err.Error(), "private")
		})
	}
}

type appResponseRoundTripFunc func(*http.Request) (*http.Response, error)

func (fn appResponseRoundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

type appResponseErrorReader struct{}

func (appResponseErrorReader) Read([]byte) (int, error) {
	return 0, errors.New("response read failed")
}

func (appResponseErrorReader) Close() error {
	return nil
}

func selectedNativeAppResponseSubject(t *testing.T, f *appExecutionFixture,
	issued AppExecutionGrantResult, raw []byte) hosttypes.AppRelaySubject {
	t.Helper()
	subject, _, err := f.execution.AuthenticateAppRelay(
		t.Context(), issued.GrantToken, "openai_responses", raw,
	)
	require.NoError(t, err)
	_, candidate, err := f.execution.SelectAppRelayChannel(
		t.Context(), subject, &taskdto.ChannelConstraints{},
	)
	require.NoError(t, err)
	subject.ChannelID, subject.Group = candidate.ChannelID, candidate.Group
	return subject
}

func TestExecuteAppResponseSendsOnceAndReplaysCommittedBytes(t *testing.T) {
	var sends atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		sends.Add(1)
		assert.Equal(t, http.MethodPost, request.Method)
		assert.Equal(t, "/v1/responses", request.URL.Path)
		assert.Equal(t, 1, request.ProtoMajor)
		assert.Equal(t, "Bearer native-http-secret", request.Header.Get("Authorization"))
		assert.Equal(t, "application/json", request.Header.Get("Content-Type"))
		assert.Empty(t, request.Header.Get("Idempotency-Key"))
		body, err := io.ReadAll(request.Body)
		require.NoError(t, err)
		assert.JSONEq(t, `{"model":"gpt-native-http","input":"hello","max_output_tokens":32,"stream":false,"store":false}`, string(body))
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("OpenAI-Request-ID", "provider-request")
		_, _ = io.WriteString(w, `{"id":"resp_native","status":"completed","model":"gpt-native-http","error":null,"incomplete_details":null,"usage":{"input_tokens":1,"output_tokens":2,"total_tokens":3}}`)
	}))
	t.Cleanup(server.Close)

	f, issued, _ := issueNativeAppResponseGrantAt(t, server.URL+"/v1")
	raw := []byte(`{"model":"registered-native-http","input":"hello","max_output_tokens":32}`)
	subject := selectedNativeAppResponseSubject(t, f, issued, raw)
	f.execution.ResponseRoundTripper = appResponseRoundTripFunc(func(request *http.Request) (*http.Response, error) {
		assert.Nil(t, request.GetBody)
		assert.True(t, request.Close)
		return http.DefaultTransport.RoundTrip(request)
	})

	first, err := f.execution.ExecuteAppResponse(t.Context(), subject, raw)
	require.NoError(t, err)
	assert.False(t, first.Replayed)
	assert.Equal(t, http.StatusOK, first.Result.HTTPStatus)
	assert.Equal(t, "resp_native", first.Result.ResponseID)
	assert.Equal(t, int32(1), sends.Load())

	second, err := f.execution.ExecuteAppResponse(t.Context(), subject, raw)
	require.NoError(t, err)
	assert.True(t, second.Replayed)
	assert.Equal(t, first.Result.BodySHA256, second.Result.BodySHA256)
	assert.Equal(t, int32(1), sends.Load(), "committed replay never reaches provider")
}

func TestExecuteAppResponseReplaysCapturedBytesAfterLiveChannelDrift(t *testing.T) {
	for _, testCase := range []struct {
		name   string
		mutate func(*testing.T, *appExecutionFixture, model.Channel)
	}{
		{"credential rotation", func(t *testing.T, f *appExecutionFixture, channel model.Channel) {
			require.NoError(t, f.db.Model(&channel).Update("key", "rotated").Error)
		}},
		{"channel disabled", func(t *testing.T, f *appExecutionFixture, channel model.Channel) {
			require.NoError(t, f.db.Model(&channel).
				Update("status", common.ChannelStatusManuallyDisabled).Error)
		}},
		{"policy advanced", func(t *testing.T, f *appExecutionFixture, _ model.Channel) {
			var head model.AppExecutionPolicyVersion
			require.NoError(t, model.RunAppPluginTransaction(f.db, func(tx *gorm.DB) error {
				var err error
				head, err = model.GetAppExecutionPolicyTx(tx, model.AppModelInvokePolicyKey)
				return err
			}))
			require.NoError(t, model.RunAppPluginTransaction(f.db, func(tx *gorm.DB) error {
				_, err := model.PublishAppExecutionPolicyTx(
					tx, model.AppModelInvokePolicyKey, head.CanonicalJSON,
					f.publisher.UserID, f.options.Now().Add(time.Second),
				)
				return err
			}))
		}},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			f, issued, channel := issueNativeAppResponseGrant(t)
			raw := []byte(`{"model":"registered-native-http","input":"hello","max_output_tokens":32}`)
			subject := selectedNativeAppResponseSubject(t, f, issued, raw)
			var sends atomic.Int32
			f.execution.ResponseRoundTripper = appResponseRoundTripFunc(func(*http.Request) (*http.Response, error) {
				sends.Add(1)
				return &http.Response{
					StatusCode: http.StatusOK,
					Header:     http.Header{"Content-Type": {"application/json"}},
					Body: io.NopCloser(strings.NewReader(
						`{"id":"resp_before_drift","status":"completed","model":"gpt-native-http","usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}`,
					)),
				}, nil
			})
			first, err := f.execution.ExecuteAppResponse(t.Context(), subject, raw)
			require.NoError(t, err)
			testCase.mutate(t, f, channel)

			restarted := NewAppExecutionService(f.db, f.options)
			restarted.ResponseRoundTripper = appResponseRoundTripFunc(func(*http.Request) (*http.Response, error) {
				sends.Add(1)
				return nil, errors.New("captured replay reached provider")
			})
			replaySubject, _, err := restarted.AuthenticateAppRelay(
				t.Context(), issued.GrantToken, "openai_responses", raw,
			)
			require.NoError(t, err)
			replaySubject.ChannelID, replaySubject.Group = subject.ChannelID, subject.Group
			second, err := restarted.ExecuteAppResponse(t.Context(), replaySubject, raw)
			require.NoError(t, err)
			assert.True(t, second.Replayed)
			assert.Equal(t, first.Result.BodySHA256, second.Result.BodySHA256)
			assert.Equal(t, int32(1), sends.Load())
		})
	}
}

func TestExecuteAppResponseReservesConservativeInputTokenCeiling(t *testing.T) {
	input := "界"
	f, issued, _ := issueNativeAppResponseGrantConfigured(
		t, "https://native-http.example/v1", false, "", nil,
		[]model.Option{{Key: "ModelRatio", Value: `{"registered-native-http":1}`}},
	)
	raw := []byte(fmt.Sprintf(
		`{"model":"registered-native-http","input":%q,"max_output_tokens":1}`, input,
	))
	subject := selectedNativeAppResponseSubject(t, f, issued, raw)
	f.execution.ResponseRoundTripper = appResponseRoundTripFunc(func(*http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": {"application/json"}},
			Body: io.NopCloser(strings.NewReader(
				`{"id":"resp_long_input","status":"completed","model":"gpt-native-http","usage":{"input_tokens":4,"output_tokens":1,"total_tokens":5}}`,
			)),
		}, nil
	})

	result, err := f.execution.ExecuteAppResponse(t.Context(), subject, raw)
	require.NoError(t, err)
	assert.Equal(t, "completed", result.Result.ProviderStatus)
	var facts AppResponseRequestFacts
	require.NoError(t, common.UnmarshalJsonStr(result.Execution.RequestFactsJSON, &facts))
	assert.Greater(t, facts.EstimatedInputTokens, len(input))
	assert.Equal(t, len(`{"model":"gpt-native-http","input":"界","max_output_tokens":1,"stream":false,"store":false}`),
		facts.EstimatedInputTokens)
}

func TestExecuteAppResponseDoesNotSendBeforeDurableReservation(t *testing.T) {
	var sends atomic.Int32
	f, issued, _ := issueNativeAppResponseGrant(t)
	raw := []byte(`{"model":"registered-native-http","input":"hello","max_output_tokens":32}`)
	subject := selectedNativeAppResponseSubject(t, f, issued, raw)
	require.NoError(t, f.db.Model(&model.User{}).Where("id = ?", subject.UserID).Update("quota", 0).Error)
	f.execution.ResponseRoundTripper = appResponseRoundTripFunc(func(*http.Request) (*http.Response, error) {
		sends.Add(1)
		return nil, errors.New("must not send")
	})

	_, err := f.execution.ExecuteAppResponse(t.Context(), subject, raw)
	require.ErrorContains(t, err, "insufficient_quota")
	assert.Zero(t, sends.Load())
	var executions int64
	require.NoError(t, f.db.Model(&model.AppTaskExecution{}).Count(&executions).Error)
	assert.Zero(t, executions)
}

func TestExecuteAppResponseMapsClaimAndCandidateStorageFaultsToServiceUnavailable(t *testing.T) {
	for _, test := range []struct {
		name       string
		operation  string
		table      string
		occurrence int32
	}{
		{name: "execution lookup", operation: "query", table: "app_task_executions", occurrence: 1},
		{name: "candidate policy", operation: "query", table: "options", occurrence: 2},
		{name: "candidate groups", operation: "query", table: "options", occurrence: 3},
		{name: "candidate channel", operation: "query", table: "channels", occurrence: 1},
		{name: "candidate ability", operation: "query", table: "abilities", occurrence: 1},
		{name: "claim grant", operation: "query", table: "app_execution_grants", occurrence: 4},
		{name: "claim replay", operation: "query", table: "app_task_executions", occurrence: 2},
		{name: "funding read", operation: "query", table: "users", occurrence: 2},
		{name: "funding write", operation: "update", table: "users", occurrence: 1},
		{name: "execution create", operation: "create", table: "app_task_executions", occurrence: 1},
	} {
		t.Run(test.name, func(t *testing.T) {
			f, issued, _ := issueNativeAppResponseGrant(t)
			raw := []byte(`{"model":"registered-native-http","input":"hello","max_output_tokens":32}`)
			subject := selectedNativeAppResponseSubject(t, f, issued, raw)
			privateDetail := "private response " + test.name + " storage detail"
			failed := registerAppExecutionDBFault(
				t, f.db, test.operation, test.table, test.occurrence, errors.New(privateDetail),
			)
			var sends atomic.Int32
			f.execution.ResponseRoundTripper = appResponseRoundTripFunc(func(*http.Request) (*http.Response, error) {
				sends.Add(1)
				return nil, errors.New("storage failure reached provider")
			})

			_, err := f.execution.ExecuteAppResponse(t.Context(), subject, raw)

			require.True(t, failed.Load(), "the intended execution boundary must be exercised")
			var authErr *AppPluginAuthError
			require.ErrorAs(t, err, &authErr)
			assert.Equal(t, "service_unavailable", authErr.Code)
			assert.Equal(t, http.StatusServiceUnavailable, AppRelayErrorStatus(err))
			assert.NotContains(t, err.Error(), privateDetail)
			assert.Zero(t, sends.Load())
		})
	}
}

func TestExecuteAppResponseMapsClaimTransactionBeginAndCommitFailuresToServiceUnavailable(t *testing.T) {
	for _, test := range []struct {
		name      string
		beginErr  error
		commitErr error
	}{
		{name: "begin", beginErr: errors.New("private response begin detail")},
		{name: "commit", commitErr: errors.New("private response claim commit detail")},
	} {
		t.Run(test.name, func(t *testing.T) {
			f, issued, _ := issueNativeAppResponseGrant(t)
			raw := []byte(`{"model":"registered-native-http","input":"hello","max_output_tokens":32}`)
			subject := selectedNativeAppResponseSubject(t, f, issued, raw)
			faultDB := appExecutionDBWithTransactionFault(t, f.db, test.beginErr, test.commitErr)
			execution := NewAppExecutionService(faultDB, f.options)
			var sends atomic.Int32
			execution.ResponseRoundTripper = appResponseRoundTripFunc(func(*http.Request) (*http.Response, error) {
				sends.Add(1)
				return nil, errors.New("failed transaction reached provider")
			})

			_, err := execution.ExecuteAppResponse(t.Context(), subject, raw)

			var authErr *AppPluginAuthError
			require.ErrorAs(t, err, &authErr)
			assert.Equal(t, "service_unavailable", authErr.Code)
			assert.Equal(t, http.StatusServiceUnavailable, AppRelayErrorStatus(err))
			assert.NotContains(t, err.Error(), "private")
			assert.Zero(t, sends.Load())
		})
	}
}

func TestExecuteAppResponseDistinguishesReplayResultStorageFailureFromMissingResult(t *testing.T) {
	for _, test := range []struct {
		name        string
		injectError bool
		wantCode    string
		wantStatus  int
	}{
		{name: "query failure", injectError: true, wantCode: "service_unavailable", wantStatus: http.StatusServiceUnavailable},
		{name: "missing result", wantCode: "execution_outcome_unknown", wantStatus: http.StatusConflict},
	} {
		t.Run(test.name, func(t *testing.T) {
			f, issued, _ := issueNativeAppResponseGrant(t)
			raw := []byte(`{"model":"registered-native-http","input":"hello","max_output_tokens":32}`)
			subject := selectedNativeAppResponseSubject(t, f, issued, raw)
			f.execution.ResponseRoundTripper = appResponseRoundTripFunc(func(*http.Request) (*http.Response, error) {
				return &http.Response{
					StatusCode: http.StatusOK,
					Header:     http.Header{"Content-Type": {"application/json"}},
					Body: io.NopCloser(strings.NewReader(
						`{"id":"resp_replay_taxonomy","status":"completed","model":"gpt-native-http","usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}`,
					)),
				}, nil
			})
			first, err := f.execution.ExecuteAppResponse(t.Context(), subject, raw)
			require.NoError(t, err)
			if test.injectError {
				registerAppExecutionDBFault(
					t, f.db, "query", "app_response_results", 1,
					errors.New("private replay result storage detail"),
				)
			} else {
				require.NoError(t, f.db.Where("execution_id = ?", first.Execution.ID).
					Delete(&model.AppResponseResult{}).Error)
			}

			_, err = f.execution.ExecuteAppResponse(t.Context(), subject, raw)

			var authErr *AppPluginAuthError
			require.ErrorAs(t, err, &authErr)
			assert.Equal(t, test.wantCode, authErr.Code)
			assert.Equal(t, test.wantStatus, AppRelayErrorStatus(err))
			assert.NotContains(t, err.Error(), "private")
		})
	}
}

func TestExecuteAppResponseRejectsInvalidChannelHeadersBeforeClaim(t *testing.T) {
	for _, testCase := range []struct {
		name         string
		key          string
		organization *string
	}{
		{name: "credential", key: "native\rsecret"},
		{name: "organization", organization: common.GetPointer("org\rbroken")},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			var sends atomic.Int32
			f, issued, _ := issueNativeAppResponseGrantConfigured(
				t, "https://native-http.example/v1", false,
				testCase.key, testCase.organization, nil,
			)
			raw := []byte(`{"model":"registered-native-http","input":"hello","max_output_tokens":32}`)
			subject := selectedNativeAppResponseSubject(t, f, issued, raw)
			f.execution.ResponseRoundTripper = appResponseRoundTripFunc(func(*http.Request) (*http.Response, error) {
				sends.Add(1)
				return &http.Response{
					StatusCode: http.StatusTooManyRequests,
					Header:     http.Header{"Content-Type": {"application/json"}},
					Body:       io.NopCloser(strings.NewReader(`{"error":"rejected"}`)),
				}, nil
			})

			_, err := f.execution.ExecuteAppResponse(t.Context(), subject, raw)
			require.ErrorContains(t, err, "channel_changed")
			assert.Zero(t, sends.Load())
			var executions int64
			require.NoError(t, f.db.Model(&model.AppTaskExecution{}).Count(&executions).Error)
			assert.Zero(t, executions)
			var payer model.User
			require.NoError(t, f.db.First(&payer, subject.UserID).Error)
			assert.Equal(t, 1000000, payer.Quota)
		})
	}
}

func TestExecuteAppResponseRevalidatesLiveChannelBeforeNewClaim(t *testing.T) {
	var sends atomic.Int32
	f, issued, channel := issueNativeAppResponseGrant(t)
	raw := []byte(`{"model":"registered-native-http","input":"hello","max_output_tokens":32}`)
	subject, _, err := f.execution.AuthenticateAppRelay(
		t.Context(), issued.GrantToken, "openai_responses", raw,
	)
	require.NoError(t, err)
	require.NoError(t, f.db.Model(&channel).
		Update("status", common.ChannelStatusManuallyDisabled).Error)
	f.execution.ResponseRoundTripper = appResponseRoundTripFunc(func(*http.Request) (*http.Response, error) {
		sends.Add(1)
		return nil, errors.New("disabled channel reached provider")
	})

	_, err = f.execution.ExecuteAppResponse(t.Context(), subject, raw)
	require.ErrorContains(t, err, "model_not_supported")
	assert.Zero(t, sends.Load())
	var executions int64
	require.NoError(t, f.db.Model(&model.AppTaskExecution{}).Count(&executions).Error)
	assert.Zero(t, executions)
}

func TestExecuteAppResponseUnknownOutcomeNeverRefundsOrResends(t *testing.T) {
	for _, testCase := range []struct {
		name      string
		roundTrip appResponseRoundTripFunc
	}{
		{"send error", func(*http.Request) (*http.Response, error) {
			return nil, errors.New("connection reset")
		}},
		{"malformed success", func(*http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: http.StatusOK,
				Header: http.Header{"Content-Type": {"application/json"}},
				Body:   io.NopCloser(strings.NewReader(`{"id":`))}, nil
		}},
		{"oversized success", func(*http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: http.StatusOK,
				Header: http.Header{"Content-Type": {"application/json"}},
				Body:   io.NopCloser(bytes.NewReader(bytes.Repeat([]byte("x"), 64*1024+1)))}, nil
		}},
		{"body read error", func(*http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: http.StatusOK,
				Header: http.Header{"Content-Type": {"application/json"}},
				Body:   appResponseErrorReader{}}, nil
		}},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			var sends atomic.Int32
			f, issued, _ := issueNativeAppResponseGrant(t)
			raw := []byte(`{"model":"registered-native-http","input":"hello","max_output_tokens":32}`)
			subject := selectedNativeAppResponseSubject(t, f, issued, raw)
			f.execution.ResponseRoundTripper = appResponseRoundTripFunc(func(request *http.Request) (*http.Response, error) {
				sends.Add(1)
				return testCase.roundTrip(request)
			})

			_, err := f.execution.ExecuteAppResponse(t.Context(), subject, raw)
			require.ErrorContains(t, err, "execution_outcome_unknown")
			_, err = f.execution.ExecuteAppResponse(t.Context(), subject, raw)
			require.ErrorContains(t, err, "execution_outcome_unknown")
			assert.Equal(t, int32(1), sends.Load())

			var execution model.AppTaskExecution
			require.NoError(t, f.db.Where("grant_id = ?", issued.GrantID).First(&execution).Error)
			assert.Equal(t, "acceptance_unknown", execution.Status)
			assert.Equal(t, "reserved", execution.BillingState)
			var payer model.User
			require.NoError(t, f.db.First(&payer, subject.UserID).Error)
			assert.Equal(t, 990000, payer.Quota)
		})
	}
}

func TestExecuteAppResponseRestartKeepsUnknownAfterChannelDrift(t *testing.T) {
	var sends atomic.Int32
	f, issued, channel := issueNativeAppResponseGrant(t)
	raw := []byte(`{"model":"registered-native-http","input":"hello","max_output_tokens":32}`)
	subject := selectedNativeAppResponseSubject(t, f, issued, raw)
	f.execution.ResponseRoundTripper = appResponseRoundTripFunc(func(*http.Request) (*http.Response, error) {
		sends.Add(1)
		return nil, errors.New("connection reset")
	})
	_, err := f.execution.ExecuteAppResponse(t.Context(), subject, raw)
	require.ErrorContains(t, err, "execution_outcome_unknown")
	require.NoError(t, f.db.Model(&channel).
		Update("status", common.ChannelStatusManuallyDisabled).Error)

	restarted := NewAppExecutionService(f.db, f.options)
	restarted.ResponseRoundTripper = appResponseRoundTripFunc(func(*http.Request) (*http.Response, error) {
		sends.Add(1)
		return nil, errors.New("unknown execution reached provider")
	})
	_, err = restarted.ExecuteAppResponse(t.Context(), subject, raw)
	require.ErrorContains(t, err, "execution_outcome_unknown")
	assert.Equal(t, int32(1), sends.Load())
}

func TestExecuteAppResponseConcurrentClaimsSendOnceAcrossServices(t *testing.T) {
	f, issued, _ := issueNativeAppResponseGrant(t)
	raw := []byte(`{"model":"registered-native-http","input":"hello","max_output_tokens":32}`)
	subject := selectedNativeAppResponseSubject(t, f, issued, raw)
	started, release := make(chan struct{}), make(chan struct{})
	var sends atomic.Int32
	roundTrip := appResponseRoundTripFunc(func(*http.Request) (*http.Response, error) {
		if sends.Add(1) == 1 {
			close(started)
			<-release
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": {"application/json"}},
			Body: io.NopCloser(strings.NewReader(
				`{"id":"resp_concurrent","status":"completed","model":"gpt-native-http","usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}`,
			)),
		}, nil
	})
	f.execution.ResponseRoundTripper = roundTrip
	firstDone := make(chan error, 1)
	go func() {
		_, err := f.execution.ExecuteAppResponse(t.Context(), subject, raw)
		firstDone <- err
	}()
	<-started

	competing := NewAppExecutionService(f.db, f.options)
	competing.ResponseRoundTripper = roundTrip
	_, err := competing.ExecuteAppResponse(t.Context(), subject, raw)
	require.ErrorContains(t, err, "execution_outcome_unknown")
	assert.Equal(t, int32(1), sends.Load())
	close(release)
	require.NoError(t, <-firstDone)
	assert.Equal(t, int32(1), sends.Load())
}

func TestExecuteAppResponsePersistsDefiniteRejectionAndRefunds(t *testing.T) {
	for _, body := range []string{`{"error":{"message":"rate limited"}}`, ""} {
		t.Run(map[bool]string{false: "json body", true: "empty body"}[body == ""], func(t *testing.T) {
			var sends atomic.Int32
			f, issued, _ := issueNativeAppResponseGrant(t)
			raw := []byte(`{"model":"registered-native-http","input":"hello","max_output_tokens":32}`)
			subject := selectedNativeAppResponseSubject(t, f, issued, raw)
			f.execution.ResponseRoundTripper = appResponseRoundTripFunc(func(*http.Request) (*http.Response, error) {
				sends.Add(1)
				return &http.Response{
					StatusCode: http.StatusTooManyRequests,
					Header:     http.Header{"Content-Type": {"application/json"}},
					Body:       io.NopCloser(strings.NewReader(body)),
				}, nil
			})

			first, err := f.execution.ExecuteAppResponse(t.Context(), subject, raw)
			require.NoError(t, err)
			assert.Equal(t, http.StatusTooManyRequests, first.Result.HTTPStatus)
			assert.Equal(t, []byte(body), first.Result.Body)
			assert.False(t, first.Replayed)
			second, err := f.execution.ExecuteAppResponse(t.Context(), subject, raw)
			require.NoError(t, err)
			assert.True(t, second.Replayed)
			assert.Equal(t, first.Result.BodySHA256, second.Result.BodySHA256)
			assert.Equal(t, int32(1), sends.Load())
			var payer model.User
			require.NoError(t, f.db.First(&payer, subject.UserID).Error)
			assert.Equal(t, 1000000, payer.Quota)
		})
	}
}

func TestExecuteAppResponseFinalizeStorageFailuresReturnServiceUnavailable(t *testing.T) {
	for _, test := range []struct {
		name       string
		operation  string
		table      string
		occurrence int32
	}{
		{name: "locator read", operation: "query", table: "app_task_executions", occurrence: 3},
		{name: "funding read", operation: "query", table: "users", occurrence: 3},
		{name: "execution reread", operation: "query", table: "app_task_executions", occurrence: 4},
		{name: "settlement read", operation: "query", table: "app_task_settlements", occurrence: 1},
		{name: "result write", operation: "create", table: "app_response_results", occurrence: 1},
		{name: "execution write", operation: "update", table: "app_task_executions", occurrence: 1},
		{name: "funding write", operation: "update", table: "users", occurrence: 2},
		{name: "channel write", operation: "update", table: "channels", occurrence: 1},
		{name: "settlement write", operation: "create", table: "app_task_settlements", occurrence: 1},
		{name: "outbox write", operation: "create", table: "app_task_outboxes", occurrence: 1},
	} {
		t.Run(test.name, func(t *testing.T) {
			var sends atomic.Int32
			f, issued, _ := issueNativeAppResponseGrant(t)
			raw := []byte(`{"model":"registered-native-http","input":"hello","max_output_tokens":32}`)
			subject := selectedNativeAppResponseSubject(t, f, issued, raw)
			f.execution.ResponseRoundTripper = appResponseRoundTripFunc(func(*http.Request) (*http.Response, error) {
				sends.Add(1)
				return &http.Response{StatusCode: http.StatusOK,
					Header: http.Header{"Content-Type": {"application/json"}},
					Body: io.NopCloser(strings.NewReader(
						`{"id":"resp_persist_failure","status":"completed","model":"gpt-native-http","usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}`,
					))}, nil
			})
			privateDetail := "private finalize " + test.name + " storage detail"
			failed := registerAppExecutionDBFault(
				t, f.db, test.operation, test.table, test.occurrence, errors.New(privateDetail),
			)

			_, err := f.execution.ExecuteAppResponse(t.Context(), subject, raw)

			require.True(t, failed.Load(), "the intended finalize boundary must be exercised")
			var authErr *AppPluginAuthError
			require.ErrorAs(t, err, &authErr)
			assert.Equal(t, "service_unavailable", authErr.Code)
			assert.Equal(t, http.StatusServiceUnavailable, AppRelayErrorStatus(err))
			assert.NotContains(t, err.Error(), privateDetail)
			assert.Equal(t, int32(1), sends.Load())
			var execution model.AppTaskExecution
			require.NoError(t, f.db.Where("grant_id = ?", issued.GrantID).First(&execution).Error)
			assert.Equal(t, "acceptance_unknown", execution.Status)
			assert.Equal(t, "reserved", execution.BillingState)
			var resultCount int64
			require.NoError(t, f.db.Model(&model.AppResponseResult{}).Count(&resultCount).Error)
			assert.Zero(t, resultCount)
		})
	}
}

func TestExecuteAppResponseFinalizeCommitFailureReturnsServiceUnavailable(t *testing.T) {
	f, issued, _ := issueNativeAppResponseGrant(t)
	raw := []byte(`{"model":"registered-native-http","input":"hello","max_output_tokens":32}`)
	subject := selectedNativeAppResponseSubject(t, f, issued, raw)
	faultDB := appExecutionDBWithTransactionFaultAt(
		t, f.db, nil, errors.New("private finalize commit detail"), 2,
	)
	executionService := NewAppExecutionService(faultDB, f.options)
	executionService.ResponseRoundTripper = appResponseRoundTripFunc(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK,
			Header: http.Header{"Content-Type": {"application/json"}},
			Body: io.NopCloser(strings.NewReader(
				`{"id":"resp_commit_failure","status":"completed","model":"gpt-native-http","usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}`,
			))}, nil
	})

	_, err := executionService.ExecuteAppResponse(t.Context(), subject, raw)

	var authErr *AppPluginAuthError
	require.ErrorAs(t, err, &authErr)
	assert.Equal(t, "service_unavailable", authErr.Code)
	assert.Equal(t, http.StatusServiceUnavailable, AppRelayErrorStatus(err))
	assert.NotContains(t, err.Error(), "private")
	var execution model.AppTaskExecution
	require.NoError(t, f.db.Where("grant_id = ?", issued.GrantID).First(&execution).Error)
	assert.Equal(t, "acceptance_unknown", execution.Status)
}

func TestMarkAppResponseUnknownRequiresSuccessfulPersistence(t *testing.T) {
	t.Run("write failure", func(t *testing.T) {
		f, issued, _ := issueNativeAppResponseGrant(t)
		raw := []byte(`{"model":"registered-native-http","input":"hello","max_output_tokens":32}`)
		subject := selectedNativeAppResponseSubject(t, f, issued, raw)
		f.execution.ResponseRoundTripper = appResponseRoundTripFunc(func(*http.Request) (*http.Response, error) {
			return nil, errors.New("provider outcome unknown")
		})
		failed := registerAppExecutionDBFault(
			t, f.db, "update", "app_task_executions", 1,
			errors.New("private unknown write storage detail"),
		)

		_, err := f.execution.ExecuteAppResponse(t.Context(), subject, raw)

		require.True(t, failed.Load())
		var authErr *AppPluginAuthError
		require.ErrorAs(t, err, &authErr)
		assert.Equal(t, "service_unavailable", authErr.Code)
		assert.Equal(t, http.StatusServiceUnavailable, AppRelayErrorStatus(err))
		assert.NotContains(t, err.Error(), "private")
		var execution model.AppTaskExecution
		require.NoError(t, f.db.Where("grant_id = ?", issued.GrantID).First(&execution).Error)
		assert.Equal(t, "dispatching", execution.Status)
	})

	t.Run("commit failure", func(t *testing.T) {
		f, issued, _ := issueNativeAppResponseGrant(t)
		raw := []byte(`{"model":"registered-native-http","input":"hello","max_output_tokens":32}`)
		subject := selectedNativeAppResponseSubject(t, f, issued, raw)
		faultDB := appExecutionDBWithTransactionFaultAt(
			t, f.db, nil, errors.New("private unknown commit detail"), 2,
		)
		executionService := NewAppExecutionService(faultDB, f.options)
		executionService.ResponseRoundTripper = appResponseRoundTripFunc(func(*http.Request) (*http.Response, error) {
			return nil, errors.New("provider outcome unknown")
		})

		_, err := executionService.ExecuteAppResponse(t.Context(), subject, raw)

		var authErr *AppPluginAuthError
		require.ErrorAs(t, err, &authErr)
		assert.Equal(t, "service_unavailable", authErr.Code)
		assert.Equal(t, http.StatusServiceUnavailable, AppRelayErrorStatus(err))
		assert.NotContains(t, err.Error(), "private")
		var execution model.AppTaskExecution
		require.NoError(t, f.db.Where("grant_id = ?", issued.GrantID).First(&execution).Error)
		assert.Equal(t, "dispatching", execution.Status)
	})
}

func TestExecuteAppResponseIgnoresClientCancellationAfterClaim(t *testing.T) {
	started := make(chan struct{})
	release := make(chan struct{})
	t.Cleanup(func() { close(release) })
	f, issued, _ := issueNativeAppResponseGrant(t)
	raw := []byte(`{"model":"registered-native-http","input":"hello","max_output_tokens":32}`)
	subject := selectedNativeAppResponseSubject(t, f, issued, raw)
	f.execution.ResponseRoundTripper = appResponseRoundTripFunc(func(request *http.Request) (*http.Response, error) {
		close(started)
		select {
		case <-request.Context().Done():
			return nil, request.Context().Err()
		case <-release:
			return &http.Response{StatusCode: http.StatusOK,
				Header: http.Header{"Content-Type": {"application/json"}},
				Body:   io.NopCloser(strings.NewReader(`{"id":"resp_after_disconnect","status":"completed","model":"gpt-native-http","usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}`))}, nil
		}
	})
	ctx, cancel := context.WithCancel(t.Context())
	done := make(chan error, 1)
	go func() {
		_, err := f.execution.ExecuteAppResponse(ctx, subject, raw)
		done <- err
	}()
	<-started
	cancel()
	release <- struct{}{}
	require.NoError(t, <-done)
}
