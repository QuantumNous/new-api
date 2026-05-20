package controller

import (
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
