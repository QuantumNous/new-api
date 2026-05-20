package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"

	"github.com/stretchr/testify/require"
)

// buildOpenAIChannelWithAdminKey creates an in-memory OpenAI channel pointing at the given baseURL.
// adminKey is stored inside ChannelOtherSettings.OpenAIAdminKey. If empty, the field is omitted.
func buildOpenAIChannelWithAdminKey(t *testing.T, baseURL, adminKey string) *model.Channel {
	t.Helper()
	require.NoError(t, model.DB.AutoMigrate(&model.Channel{}))
	settings := dto.ChannelOtherSettings{}
	if adminKey != "" {
		settings.OpenAIAdminKey = adminKey
	}
	encoded, err := common.Marshal(settings)
	require.NoError(t, err)
	bURL := baseURL
	ch := &model.Channel{
		Type:          constant.ChannelTypeOpenAI,
		Key:           "sk-fake-inference-key",
		Status:        1,
		Name:          "test-openai",
		BaseURL:       &bURL,
		OtherSettings: string(encoded),
	}
	require.NoError(t, model.DB.Create(ch).Error)
	return ch
}

// firstDayOfCurrentMonthUTC returns the Unix timestamp of the 1st day of the current month at 00:00 UTC.
func firstDayOfCurrentMonthUTC() int64 {
	now := time.Now().UTC()
	return time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC).Unix()
}

func TestUpdateChannelOpenAIBalance_SingleBucket(t *testing.T) {
	_ = openTokenControllerTestDB(t)

	var capturedAuth string
	var capturedQuery url.Values
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedAuth = r.Header.Get("Authorization")
		capturedQuery = r.URL.Query()
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprint(w, `{
			"object": "page",
			"data": [
				{
					"object": "bucket",
					"start_time": 1747008000,
					"end_time": 1747094400,
					"results": [
						{"object": "organization.costs.result", "amount": {"value": 10.5, "currency": "usd"}}
					]
				}
			],
			"has_more": false,
			"next_page": ""
		}`)
	}))
	defer ts.Close()

	ch := buildOpenAIChannelWithAdminKey(t, ts.URL, "sk-admin-test")

	balance, err := updateChannelOpenAIBalance(ch)
	require.NoError(t, err)
	require.InDelta(t, 10.5, balance, 0.001)
	require.Equal(t, "Bearer sk-admin-test", capturedAuth)
	require.Equal(t, strconv.FormatInt(firstDayOfCurrentMonthUTC(), 10), capturedQuery.Get("start_time"))

	var fresh model.Channel
	require.NoError(t, model.DB.First(&fresh, ch.Id).Error)
	require.InDelta(t, 10.5, fresh.Balance, 0.001)
}

func TestUpdateChannelOpenAIBalance_Pagination(t *testing.T) {
	_ = openTokenControllerTestDB(t)

	callCount := 0
	var capturedTokenOnSecondCall string
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		w.Header().Set("Content-Type", "application/json")
		if callCount == 1 {
			_, _ = fmt.Fprint(w, `{
				"object": "page",
				"data": [{"object": "bucket","start_time": 1747008000,"end_time": 1747094400,
					"results": [{"object": "organization.costs.result","amount": {"value": 5.0,"currency": "usd"}}]}],
				"has_more": true,
				"next_page": "page-token-2"
			}`)
			return
		}
		capturedTokenOnSecondCall = r.URL.Query().Get("page")
		_, _ = fmt.Fprint(w, `{
			"object": "page",
			"data": [{"object": "bucket","start_time": 1747094400,"end_time": 1747180800,
				"results": [{"object": "organization.costs.result","amount": {"value": 7.25,"currency": "usd"}}]}],
			"has_more": false,
			"next_page": ""
		}`)
	}))
	defer ts.Close()

	ch := buildOpenAIChannelWithAdminKey(t, ts.URL, "sk-admin-test")

	balance, err := updateChannelOpenAIBalance(ch)
	require.NoError(t, err)
	require.Equal(t, 2, callCount)
	require.Equal(t, "page-token-2", capturedTokenOnSecondCall)
	require.InDelta(t, 12.25, balance, 0.001)
}

func TestUpdateChannelOpenAIBalance_NoAdminKey(t *testing.T) {
	_ = openTokenControllerTestDB(t)
	ch := buildOpenAIChannelWithAdminKey(t, "http://unused", "")

	balance, err := updateChannelOpenAIBalance(ch)
	require.Error(t, err)
	require.Contains(t, err.Error(), "openai admin key is not set")
	require.Equal(t, float64(0), balance)

	var fresh model.Channel
	require.NoError(t, model.DB.First(&fresh, ch.Id).Error)
	require.Equal(t, float64(0), fresh.Balance)
}

func TestUpdateChannelOpenAIBalance_Upstream403(t *testing.T) {
	_ = openTokenControllerTestDB(t)

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		_, _ = fmt.Fprint(w, `{"error":{"message":"missing scope","type":"insufficient_permissions"}}`)
	}))
	defer ts.Close()

	ch := buildOpenAIChannelWithAdminKey(t, ts.URL, "sk-admin-test")

	balance, err := updateChannelOpenAIBalance(ch)
	require.Error(t, err)
	require.Contains(t, err.Error(), "status code: 403")
	require.Equal(t, float64(0), balance)

	var fresh model.Channel
	require.NoError(t, model.DB.First(&fresh, ch.Id).Error)
	require.Equal(t, float64(0), fresh.Balance)
}

func TestUpdateChannelOpenAIBalance_BadJSON(t *testing.T) {
	_ = openTokenControllerTestDB(t)

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprint(w, `not-json-garbage`)
	}))
	defer ts.Close()

	ch := buildOpenAIChannelWithAdminKey(t, ts.URL, "sk-admin-test")

	balance, err := updateChannelOpenAIBalance(ch)
	require.Error(t, err)
	require.Contains(t, err.Error(), "parse openai usage")
	require.Equal(t, float64(0), balance)
}

func TestUpdateChannelOpenAIBalance_StartTimeIsFirstOfMonthUTC(t *testing.T) {
	_ = openTokenControllerTestDB(t)

	var got url.Values
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = r.URL.Query()
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprint(w, `{"object":"page","data":[],"has_more":false,"next_page":""}`)
	}))
	defer ts.Close()

	ch := buildOpenAIChannelWithAdminKey(t, ts.URL, "sk-admin-test")
	_, err := updateChannelOpenAIBalance(ch)
	require.NoError(t, err)

	now := time.Now().UTC()
	wantStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC).Unix()
	require.Equal(t, strconv.FormatInt(wantStart, 10), got.Get("start_time"))

	endStr := got.Get("end_time")
	require.NotEmpty(t, endStr)
	endParsed, err := strconv.ParseInt(endStr, 10, 64)
	require.NoError(t, err)
	require.GreaterOrEqual(t, endParsed, wantStart)
	require.LessOrEqual(t, endParsed-now.Unix(), int64(5))

	require.Equal(t, "31", got.Get("limit"))
}

func TestUpdateChannelOpenAIBalance_PrepaidRemaining(t *testing.T) {
	_ = openTokenControllerTestDB(t)

	var capturedQuery url.Values
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedQuery = r.URL.Query()
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprint(w, `{
            "object": "page",
            "data": [{"object": "bucket","start_time": 0,"end_time": 0,
                "results": [{"object": "organization.costs.result","amount": {"value": 3.25,"currency": "usd"}}]}],
            "has_more": false,
            "next_page": ""
        }`)
	}))
	defer ts.Close()

	settings := dto.ChannelOtherSettings{
		OpenAIAdminKey:      "sk-admin-test",
		OpenAIPrepaidAmount: 20.0,
		OpenAIPrepaidSince:  1700000000,
	}
	require.NoError(t, model.DB.AutoMigrate(&model.Channel{}))
	encoded, _ := common.Marshal(settings)
	bURL := ts.URL
	ch := &model.Channel{
		Type: constant.ChannelTypeOpenAI, Key: "sk-fake",
		Status: 1, Name: "test", BaseURL: &bURL,
		OtherSettings: string(encoded),
	}
	require.NoError(t, model.DB.Create(ch).Error)

	balance, err := updateChannelOpenAIBalance(ch)
	require.NoError(t, err)
	require.InDelta(t, 16.75, balance, 0.001) // 20.0 - 3.25 remaining
	require.Equal(t, "1700000000", capturedQuery.Get("start_time"))
}

func TestUpdateChannelOpenAIBalance_PrepaidExhausted(t *testing.T) {
	_ = openTokenControllerTestDB(t)

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprint(w, `{
            "object": "page",
            "data": [{"object": "bucket","start_time": 0,"end_time": 0,
                "results": [{"object": "organization.costs.result","amount": {"value": 25.0,"currency": "usd"}}]}],
            "has_more": false,
            "next_page": ""
        }`)
	}))
	defer ts.Close()

	settings := dto.ChannelOtherSettings{
		OpenAIAdminKey: "sk-admin-test", OpenAIPrepaidAmount: 20.0, OpenAIPrepaidSince: 1700000000,
	}
	require.NoError(t, model.DB.AutoMigrate(&model.Channel{}))
	encoded, _ := common.Marshal(settings)
	bURL := ts.URL
	ch := &model.Channel{
		Type: constant.ChannelTypeOpenAI, Key: "sk-fake",
		Status: 1, Name: "test", BaseURL: &bURL,
		OtherSettings: string(encoded),
	}
	require.NoError(t, model.DB.Create(ch).Error)

	balance, err := updateChannelOpenAIBalance(ch)
	require.NoError(t, err)
	require.Equal(t, float64(0), balance) // cost > prepaid: clamp to 0
}

func TestUpdateChannelOpenAIBalance_PrepaidPartialUnsetFallsBackToMTD(t *testing.T) {
	_ = openTokenControllerTestDB(t)

	var capturedQuery url.Values
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedQuery = r.URL.Query()
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprint(w, `{
            "object": "page",
            "data": [],
            "has_more": false,
            "next_page": ""
        }`)
	}))
	defer ts.Close()

	// Only prepaid_amount set, NOT prepaid_since — should fall back to MTD
	settings := dto.ChannelOtherSettings{
		OpenAIAdminKey: "sk-admin-test", OpenAIPrepaidAmount: 20.0, // OpenAIPrepaidSince: 0 (unset)
	}
	require.NoError(t, model.DB.AutoMigrate(&model.Channel{}))
	encoded, _ := common.Marshal(settings)
	bURL := ts.URL
	ch := &model.Channel{
		Type: constant.ChannelTypeOpenAI, Key: "sk-fake",
		Status: 1, Name: "test", BaseURL: &bURL,
		OtherSettings: string(encoded),
	}
	require.NoError(t, model.DB.Create(ch).Error)

	_, err := updateChannelOpenAIBalance(ch)
	require.NoError(t, err)
	// start_time should be 1st of current month UTC (fallback path)
	require.Equal(t, strconv.FormatInt(firstDayOfCurrentMonthUTC(), 10), capturedQuery.Get("start_time"))
}

// TestChannelClean_RemovesOpenAIAdminKey verifies that Channel.Clean zeroes out the inference
// Key column AND the OpenAIAdminKey nested in OtherSettings JSON. This is the core masking
// guarantee that prevents the admin key from being exposed in GET /api/channel/<id> responses
// or in the channel list / search payloads.
func TestChannelClean_RemovesOpenAIAdminKey(t *testing.T) {
	_ = openTokenControllerTestDB(t)
	settingsBytes, err := common.Marshal(dto.ChannelOtherSettings{OpenAIAdminKey: "sk-admin-secret"})
	require.NoError(t, err)
	bURL := "http://x"
	ch := &model.Channel{
		Type:          constant.ChannelTypeOpenAI,
		Key:           "sk-secret",
		Status:        1,
		BaseURL:       &bURL,
		OtherSettings: string(settingsBytes),
	}

	ch.Clean()

	require.Equal(t, "", ch.Key, "inference key must be masked")
	other := ch.GetOtherSettings()
	require.Equal(t, "", other.OpenAIAdminKey, "openai admin key must be stripped from OtherSettings")
}
