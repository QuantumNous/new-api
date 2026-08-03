package service

import (
	"encoding/base64"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestRecallMetricSnapshotTokenRejectsTamperAndCrossFilter(t *testing.T) {
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "recall-metric-token-test-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })

	query := model.RecallMetricQuery{
		CampaignID: 42,
		Metric:     "enrolled",
		Search:     "Ada@Example.com",
		Snapshot: model.RecallMetricSnapshot{
			AsOf:                   1_900,
			RecipientMaxID:         10,
			FactEventMaxID:         11,
			MessageStateEventMaxID: 12,
			ExclusionMaxID:         13,
			CampaignRunEventMaxID:  14,
		},
	}

	token, err := SignRecallMetricSnapshotToken(query, "identity", time.Unix(2_000, 0))
	require.NoError(t, err)
	verified, err := VerifyRecallMetricSnapshotToken(token, query, "identity", time.Unix(1_950, 0))
	require.NoError(t, err)
	require.Equal(t, query.Snapshot, verified)

	tampered := token[:len(token)-1] + "0"
	_, err = VerifyRecallMetricSnapshotToken(tampered, query, "identity", time.Unix(1_950, 0))
	require.ErrorIs(t, err, ErrRecallMetricStaleSnapshot)

	query.Search = "grace@example.com"
	_, err = VerifyRecallMetricSnapshotToken(token, query, "identity", time.Unix(1_950, 0))
	require.ErrorIs(t, err, ErrRecallMetricStaleSnapshot)
}

func TestRecallMetricSnapshotTokenRejectsLegacyVersionWithoutFinancialHighWater(t *testing.T) {
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "recall-metric-token-legacy-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })

	query := model.RecallMetricQuery{CampaignID: 42, Metric: "enrolled"}
	filterHash, err := model.RecallMetricFilterHash(query)
	require.NoError(t, err)
	claims := recallMetricTokenClaims{
		Version:                1,
		Kind:                   "snapshot",
		CampaignID:             42,
		Metric:                 "enrolled",
		AsOf:                   1_900,
		RecipientMaxID:         10,
		FactEventMaxID:         11,
		MessageStateEventMaxID: 12,
		ExclusionMaxID:         13,
		CampaignRunEventMaxID:  14,
		FilterHash:             filterHash,
		RowGrain:               "identity",
		ExpiresAt:              2_000,
	}
	payload, err := common.Marshal(claims)
	require.NoError(t, err)
	encoded := base64.RawURLEncoding.EncodeToString(payload)
	token := encoded + "." + common.GenerateHMAC(encoded)

	_, err = VerifyRecallMetricSnapshotToken(token, query, "identity", time.Unix(1_950, 0))
	require.ErrorIs(t, err, ErrRecallMetricStaleSnapshot)
}

func TestRecallMetricCursorTokenRejectsCrossMetric(t *testing.T) {
	originalSecret := common.CryptoSecret
	common.CryptoSecret = "recall-metric-cursor-test-secret"
	t.Cleanup(func() { common.CryptoSecret = originalSecret })

	query := model.RecallMetricQuery{
		CampaignID: 7,
		Metric:     "messages_failed",
		Cursor:     model.RecallMetricCursor{SortTime: 10, RowID: 20},
		Snapshot:   model.RecallMetricSnapshot{AsOf: 100, RecipientMaxID: 1, FactEventMaxID: 2, MessageStateEventMaxID: 3},
	}
	token, err := SignRecallMetricCursorToken(query, "message", time.Unix(200, 0))
	require.NoError(t, err)

	query.Metric = "messages_accepted"
	_, err = VerifyRecallMetricCursorToken(token, query, "message", time.Unix(150, 0))
	require.ErrorIs(t, err, ErrRecallMetricStaleSnapshot)
	require.False(t, strings.Contains(token, "recall-metric-cursor-test-secret"))
}
