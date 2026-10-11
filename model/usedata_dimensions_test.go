package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

// GetQuotaDataDimensionsFast serves the dashboard key/model pickers. The
// per-user read joins tokens, and that join brings tokens.user_id into scope:
// a bare user_id there is an ambiguous column on Postgres (SQLSTATE 42702),
// which turned the self dimensions endpoint into a 500 and emptied the
// pickers for every logged-in user. These tests pin the per-user scoping and
// the active-only key list together so neither can regress.

func seedDimensionsForReadTests(t *testing.T) {
	t.Helper()
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&QuotaDataDimension{}))
	// truncateTables knows nothing about this table, so it needs its own
	// cleanup alongside the tokens it references.
	t.Cleanup(func() { DB.Exec("DELETE FROM quota_data_dimensions") })

	require.NoError(t, DB.Create(&Token{Id: 11, UserId: 1, Key: "sk-own", Name: "active-key", Status: common.TokenStatusEnabled}).Error)
	require.NoError(t, DB.Create(&Token{Id: 12, UserId: 1, Key: "sk-disabled", Name: "disabled-key", Status: common.TokenStatusDisabled}).Error)
	// A different user may legitimately reuse a key name.
	require.NoError(t, DB.Create(&Token{Id: 13, UserId: 2, Key: "sk-shared", Name: "shared-name", Status: common.TokenStatusEnabled}).Error)

	require.NoError(t, DB.Create(&QuotaDataDimension{UserID: 1, TokenName: "active-key", TokenNameID: 11, ModelName: "gpt-a", LastSeenAt: 100}).Error)
	require.NoError(t, DB.Create(&QuotaDataDimension{UserID: 1, TokenName: "disabled-key", TokenNameID: 12, ModelName: "gpt-a", LastSeenAt: 100}).Error)
	// Historical rows can outlive their token; they carry no name match.
	require.NoError(t, DB.Create(&QuotaDataDimension{UserID: 1, TokenName: "gone-key", TokenNameID: 999, ModelName: "gpt-a", LastSeenAt: 100}).Error)
	require.NoError(t, DB.Create(&QuotaDataDimension{UserID: 2, TokenName: "shared-name", TokenNameID: 13, ModelName: "gpt-b", LastSeenAt: 100}).Error)
}

func TestQuotaDataDimensionsFastScopesKeysToTheCallingUser(t *testing.T) {
	seedDimensionsForReadTests(t)

	dims, err := GetQuotaDataDimensionsFast(1)
	require.NoError(t, err, "the per-user query must not error on Postgres or SQLite")
	require.Equal(t, []string{"active-key"}, dims.Keys)
	require.Equal(t, []string{"gpt-a"}, dims.Models)

	mine, err := GetQuotaDataDimensionsFast(2)
	require.NoError(t, err)
	require.Equal(t, []string{"shared-name"}, mine.Keys)
	require.Equal(t, []string{"gpt-b"}, mine.Models)
}

func TestQuotaDataDimensionsFastFeedsEveryActiveKeyToAdmin(t *testing.T) {
	seedDimensionsForReadTests(t)

	// Admin (user_id=0) reads across users. Disabled tokens and rows whose
	// token has since vanished drop out of the key list; the model list has no
	// token join and still reports the disabled key's model.
	dims, err := GetQuotaDataDimensionsFast(0)
	require.NoError(t, err)
	require.ElementsMatch(t, []string{"active-key", "shared-name"}, dims.Keys)
	require.Equal(t, []string{"gpt-a", "gpt-b"}, dims.Models)
}
