package service

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/require"
)

func setRecallEmailDeliverabilityOptions(t *testing.T, replyTo string, unsubscribeMailto string) {
	t.Helper()
	previous := operation_setting.GetRecallCampaignSetting()
	apply := func(reply string, mailto string) {
		require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
			"recall_campaign_setting.enabled":            boolString(previous.Enabled),
			"recall_campaign_setting.batch_size":         fmt.Sprintf("%d", previous.BatchSize),
			"recall_campaign_setting.tick_seconds":       fmt.Sprintf("%d", previous.TickSeconds),
			"recall_campaign_setting.email_hourly_limit": fmt.Sprintf("%d", previous.EmailHourlyLimit),
			"recall_campaign_setting.reply_to":           reply,
			"recall_campaign_setting.unsubscribe_mailto": mailto,
		}))
	}
	apply(replyTo, unsubscribeMailto)
	t.Cleanup(func() { apply(previous.ReplyTo, previous.UnsubscribeMailto) })
}

func setRecallEmailServerAddress(t *testing.T, address string) {
	t.Helper()
	original := system_setting.ServerAddress
	t.Cleanup(func() { system_setting.ServerAddress = original })
	system_setting.ServerAddress = address
}

// Gmail and Outlook read one-click unsubscribe from the header, not the body
// link, so the worker must hand the URL to the transport.
func TestRecallEmailPassesOneClickUnsubscribeHeaderToSender(t *testing.T) {
	setRecallEmailServerAddress(t, "https://console.flatkey.ai")
	setRecallEmailDeliverabilityOptions(t, "support@flatkey.ai", "mailto:unsubscribe@mg.flatkey.ai")

	var captured common.EmailOptions
	var capturedBody string
	fixture := newRecallEmailFixture(t, 1, nil)
	fixture.worker.sender = func(_ common.SMTPConfig, _, _, content, _ string, options common.EmailOptions) error {
		captured = options
		capturedBody = content
		return nil
	}

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))

	require.True(t, strings.HasPrefix(captured.ListUnsubscribeURL, "https://console.flatkey.ai/api/recall/unsubscribe?token="))
	require.Equal(t, "mailto:unsubscribe@mg.flatkey.ai", captured.ListUnsubscribeMailto)
	require.Equal(t, "support@flatkey.ai", captured.ReplyTo)
	// Bulk mail needs a text/plain alternative; HTML-only is a spam signal.
	require.True(t, captured.Multipart)

	// The header token must be the same one the body link carries, so both
	// unsubscribe paths revoke the same recipient.
	require.Equal(t, recallEmailRawUnsubscribeToken(t, capturedBody), unsubscribeTokenFromURL(t, captured.ListUnsubscribeURL))
}

func TestRecallEmailOmitsDeliverabilityOptionsWhenUnconfigured(t *testing.T) {
	setRecallEmailServerAddress(t, "https://console.flatkey.ai")
	setRecallEmailDeliverabilityOptions(t, "", "")

	var captured common.EmailOptions
	fixture := newRecallEmailFixture(t, 1, nil)
	fixture.worker.sender = func(_ common.SMTPConfig, _, _, _, _ string, options common.EmailOptions) error {
		captured = options
		return nil
	}

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))

	require.Empty(t, captured.ListUnsubscribeMailto)
	require.Empty(t, captured.ReplyTo)
	// One-click still works from the always-present HTTPS endpoint.
	require.NotEmpty(t, captured.ListUnsubscribeURL)
	require.True(t, captured.Multipart)
}

func unsubscribeTokenFromURL(t *testing.T, rawURL string) string {
	t.Helper()
	_, query, found := strings.Cut(rawURL, "token=")
	require.True(t, found, "unsubscribe URL has no token: %q", rawURL)
	return query
}
