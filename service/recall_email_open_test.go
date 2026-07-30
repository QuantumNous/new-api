package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

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
