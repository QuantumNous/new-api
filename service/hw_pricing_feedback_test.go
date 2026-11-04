package service

import (
	"context"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func hwPricingFeedbackTestSetup(t *testing.T) (*[]string, *[]hwBureauIssueRequest) {
	t.Helper()
	require.NoError(t, model.DB.AutoMigrate(&model.HwPricingFeedback{}, &model.HwAssistantHit{}))
	require.NoError(t, model.DB.Where("1 = 1").Delete(&model.HwPricingFeedback{}).Error)
	require.NoError(t, model.DB.Where("1 = 1").Delete(&model.HwAssistantHit{}).Error)
	var mails []string
	var cards []hwBureauIssueRequest
	previousMail, previousCard := hwPricingFeedbackMailSend, hwPricingFeedbackPostCard
	hwPricingFeedbackMailSend = func(subject, receiver, content string) error {
		mails = append(mails, content)
		return nil
	}
	hwPricingFeedbackPostCard = func(_ context.Context, _ HwBureauCardConfig, issue hwBureauIssueRequest) (string, error) {
		cards = append(cards, issue)
		return "HIS-1", nil
	}
	t.Cleanup(func() { hwPricingFeedbackMailSend, hwPricingFeedbackPostCard = previousMail, previousCard })
	return &mails, &cards
}

func TestHwNormalizePricingFeedbackRejectsBadInput(t *testing.T) {
	long := strings.Repeat("a", model.HwPricingFeedbackMaxMessageRunes+1)
	cases := map[string]model.HwPricingFeedback{
		"unknown kind":        {Kind: "spam", Model: "gpt-5"},
		"price without model": {Kind: model.HwPricingFeedbackKindPrice},
		"other without text":  {Kind: model.HwPricingFeedbackKindOther},
		"message too long":    {Kind: model.HwPricingFeedbackKindPrice, Model: "gpt-5", Message: long},
		"ftp source":          {Kind: model.HwPricingFeedbackKindPrice, Model: "gpt-5", SourceURL: "ftp://x.example/p"},
		"javascript source":   {Kind: model.HwPricingFeedbackKindPrice, Model: "gpt-5", SourceURL: "javascript:alert(1)"},
		"userinfo source":     {Kind: model.HwPricingFeedbackKindPrice, Model: "gpt-5", SourceURL: "http://a:b@10.88.0.1/"},
		"bad email":           {Kind: model.HwPricingFeedbackKindPrice, Model: "gpt-5", Email: "a@b, c@d"},
		"header in model":     {Kind: model.HwPricingFeedbackKindPrice, Model: "gpt\r\nBcc: x"},
	}
	for name, row := range cases {
		t.Run(name, func(t *testing.T) {
			assert.ErrorIs(t, model.HwNormalizePricingFeedback(&row), model.ErrHwPricingFeedbackInvalid)
		})
	}
	ok := model.HwPricingFeedback{Kind: model.HwPricingFeedbackKindPrice, Model: " GPT-5 ", SourceURL: "https://openai.com/api/pricing/", Email: "a@example.com"}
	require.NoError(t, model.HwNormalizePricingFeedback(&ok))
	assert.Equal(t, "price_wrong|gpt-5", ok.DedupKey)
	assert.Equal(t, "tr", ok.Lang)
}

func TestHwPricingFeedbackMailsOnceAndBundlesOneCard(t *testing.T) {
	mails, cards := hwPricingFeedbackTestSetup(t)
	now := int64(1_800_000_000)
	for _, text := range []string{"<script>x</script>", "again"} {
		row := model.HwPricingFeedback{Kind: model.HwPricingFeedbackKindPrice, Model: "gpt-5", Message: text}
		require.NoError(t, model.HwNormalizePricingFeedback(&row))
		require.NoError(t, model.HwStorePricingFeedback(model.DB, &row, now))
		if !row.Duplicate {
			require.NoError(t, HwMailPricingFeedback(row, now))
		}
	}
	require.Len(t, *mails, 1, "the duplicate is stored but never mailed")
	assert.NotContains(t, (*mails)[0], "<script>")

	card, err := HwBundlePricingFeedback(context.Background(), HwBureauCardConfig{}, now)
	require.NoError(t, err)
	assert.Equal(t, "HIS-1", card)
	require.Len(t, *cards, 1)
	assert.Contains(t, (*cards)[0].Description, "Werkwijze")
	assert.Equal(t, HwBureauAgentModelverkenner, (*cards)[0].AssigneeAgentID)

	card, err = HwBundlePricingFeedback(context.Background(), HwBureauCardConfig{}, now)
	require.NoError(t, err)
	assert.Empty(t, card, "a carded report is never carded twice")
}

func TestHwBundlePricingFeedbackStopsAtFourCardsADay(t *testing.T) {
	_, cards := hwPricingFeedbackTestSetup(t)
	now := int64(1_800_000_000)
	for i := range HwPricingFeedbackCardsPerDay + 2 {
		row := model.HwPricingFeedback{Kind: model.HwPricingFeedbackKindMissing, Model: "model-" + string(rune('a'+i))}
		require.NoError(t, model.HwNormalizePricingFeedback(&row))
		require.NoError(t, model.HwStorePricingFeedback(model.DB, &row, now))
		_, err := HwBundlePricingFeedback(context.Background(), HwBureauCardConfig{}, now)
		require.NoError(t, err)
	}
	assert.Len(t, *cards, HwPricingFeedbackCardsPerDay)
}
