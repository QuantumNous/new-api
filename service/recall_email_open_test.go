package service

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestAppendRecallEmailOpenPixel(t *testing.T) {
	token := "open_token"
	trackingURL := "https://console.flatkey.ai/api/recall/open.gif?token=" + token
	pixel := `<img src="` + trackingURL + `" width="1" height="1" alt="" style="display:none!important" aria-hidden="true">`

	t.Run("inserts absolute tracking URL before last closing body", func(t *testing.T) {
		htmlBody := "<html><body>Hello</body></html>"

		got := appendRecallEmailOpenPixel(htmlBody, "https://console.flatkey.ai/", token)

		require.Equal(t, "<html><body>Hello"+pixel+"</body></html>", got)
		require.Equal(t, 1, strings.Count(got, trackingURL))
	})

	t.Run("uses the last case-insensitive closing body", func(t *testing.T) {
		htmlBody := "<html><body>First</BODY><div>Second</div></BoDy></html>"

		got := appendRecallEmailOpenPixel(htmlBody, "https://console.flatkey.ai", token)

		require.Equal(t, "<html><body>First</BODY><div>Second</div>"+pixel+"</BoDy></html>", got)
		require.Equal(t, 1, strings.Count(got, trackingURL))
	})

	t.Run("appends when closing body is missing", func(t *testing.T) {
		htmlBody := "<html><body>Hello"

		got := appendRecallEmailOpenPixel(htmlBody, "https://console.flatkey.ai", token)

		require.Equal(t, htmlBody+pixel, got)
		require.Equal(t, 1, strings.Count(got, trackingURL))
	})

	t.Run("preserves byte offsets when unicode case folding expands before closing body", func(t *testing.T) {
		htmlBody := "<html><body>Before \u0130</BODY></html>"

		got := appendRecallEmailOpenPixel(htmlBody, "https://console.flatkey.ai", token)

		require.Equal(t, "<html><body>Before \u0130"+pixel+"</BODY></html>", got)
		require.Equal(t, 1, strings.Count(got, trackingURL))
	})

	t.Run("valid IPv6 and IDN origins inject absolute URLs", func(t *testing.T) {
		htmlBody := "<html><body>Hello</body></html>"
		tests := []struct {
			name   string
			origin string
			want   string
		}{
			{
				name:   "IPv6 loopback with port",
				origin: "https://[::1]:8443/",
				want:   `src="https://[::1]:8443/api/recall/open.gif?token=` + token + `"`,
			},
			{
				name:   "IDN host",
				origin: "https://例え.テスト/",
				want:   `/api/recall/open.gif?token=` + token,
			},
		}
		for _, testCase := range tests {
			t.Run(testCase.name, func(t *testing.T) {
				got := appendRecallEmailOpenPixel(htmlBody, testCase.origin, token)

				require.Contains(t, got, testCase.want)
				require.Contains(t, got, `src="https://`)
				require.Equal(t, 1, strings.Count(got, "/api/recall/open.gif?token="))
			})
		}
	})

	t.Run("invalid origins and empty token are no-op", func(t *testing.T) {
		htmlBody := "<html><body>Hello</body></html>"
		tests := []struct {
			name   string
			origin string
			token  string
		}{
			{name: "empty origin", origin: "", token: token},
			{name: "relative origin", origin: "/console", token: token},
			{name: "non http scheme", origin: "mailto:ops@flatkey.ai", token: token},
			{name: "userinfo", origin: "https://user@console.flatkey.ai", token: token},
			{name: "path beyond root", origin: "https://console.flatkey.ai/console", token: token},
			{name: "query", origin: "https://console.flatkey.ai/?a=1", token: token},
			{name: "fragment", origin: "https://console.flatkey.ai/#app", token: token},
			{name: "malformed IPv6", origin: "https://[::1/", token: token},
			{name: "invalid port", origin: "https://console.flatkey.ai:bad/", token: token},
			{name: "zero port", origin: "https://console.flatkey.ai:0/", token: token},
			{name: "port above tcp range", origin: "https://console.flatkey.ai:65536/", token: token},
			{name: "empty token", origin: "https://console.flatkey.ai", token: ""},
		}
		for _, testCase := range tests {
			t.Run(testCase.name, func(t *testing.T) {
				require.Equal(t, htmlBody, appendRecallEmailOpenPixel(htmlBody, testCase.origin, testCase.token))
			})
		}
	})

	t.Run("preserves original when injected HTML would exceed max bytes", func(t *testing.T) {
		htmlBody := "<html><body>" + strings.Repeat("x", recallEmailHTMLMaxBytes-len([]byte(pixel))-len("<html><body></body></html>")+1) + "</body></html>"

		got := appendRecallEmailOpenPixel(htmlBody, "https://console.flatkey.ai", token)

		require.Equal(t, htmlBody, got)
	})

	t.Run("injects when result exactly fits max bytes", func(t *testing.T) {
		htmlBody := "<html><body>" + strings.Repeat("x", recallEmailHTMLMaxBytes-len([]byte(pixel))-len("<html><body></body></html>")) + "</body></html>"

		got := appendRecallEmailOpenPixel(htmlBody, "https://console.flatkey.ai", token)

		require.Len(t, []byte(got), recallEmailHTMLMaxBytes)
		require.Equal(t, 1, strings.Count(got, trackingURL))
	})
}

func TestRecallEmailOpenTokenRecordsRecipientOnce(t *testing.T) {
	setupRecallCampaignTestDB(t)
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	recipient := createRecallWorkerRecipient(t, campaign.Id, 7, model.RecallRecipientContacting)
	token, err := CreateRecallEmailOpenToken(recipient.Id)
	require.NoError(t, err)
	require.NotEmpty(t, token)

	require.NoError(t, RecordRecallEmailOpen(context.Background(), token, time.Unix(1_700_000_100, 0)))
	require.NoError(t, RecordRecallEmailOpen(context.Background(), token, time.Unix(1_700_000_200, 0)))

	var events []model.RecallEvent
	require.NoError(t, model.DB.
		Where("campaign_id = ? AND event_type = ?", campaign.Id, "email_open").
		Find(&events).Error)
	require.Len(t, events, 1)
	require.Equal(t, recipient.Id, events[0].RecipientId)
	require.Equal(t, int64(1_700_000_100), events[0].CreatedAt)
}

func TestRecallEmailOpenTokenConcurrentRecordsRecipientOnce(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	recipient := createRecallWorkerRecipient(t, campaign.Id, 7, model.RecallRecipientContacting)
	token, err := CreateRecallEmailOpenToken(recipient.Id)
	require.NoError(t, err)
	require.NotEmpty(t, token)

	const openAttempts = 16
	start := make(chan struct{})
	errs := make(chan error, openAttempts)
	var wg sync.WaitGroup
	wg.Add(openAttempts)
	for index := 0; index < openAttempts; index++ {
		openedAt := time.Unix(1_700_000_100+int64(index), 0)
		go func() {
			defer wg.Done()
			<-start
			errs <- RecordRecallEmailOpen(context.Background(), token, openedAt)
		}()
	}
	close(start)
	wg.Wait()
	close(errs)
	for err := range errs {
		require.NoError(t, err)
	}

	var events []model.RecallEvent
	require.NoError(t, model.DB.
		Where("campaign_id = ? AND recipient_id = ? AND event_type = ?", campaign.Id, recipient.Id, "email_open").
		Find(&events).Error)
	require.Len(t, events, 1)
	require.Equal(t, recipient.Id, events[0].RecipientId)
	require.NotEmpty(t, events[0].SourceEventId)
}

func TestRecallEmailOpenTokenRejectsTamperingWithoutDatabaseWrite(t *testing.T) {
	setupRecallCampaignTestDB(t)
	token, err := CreateRecallEmailOpenToken(99)
	require.NoError(t, err)

	err = RecordRecallEmailOpen(context.Background(), token+"tampered", time.Unix(1_700_000_100, 0))
	require.True(t, errors.Is(err, ErrRecallEmailOpenInvalid))

	var count int64
	require.NoError(t, model.DB.Model(&model.RecallEvent{}).
		Where("event_type = ?", "email_open").
		Count(&count).Error)
	require.Zero(t, count)
}
