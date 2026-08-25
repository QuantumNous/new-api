package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestParseStatusFilterSupportsBanned(t *testing.T) {
	require.Equal(t, common.ChannelStatusBanned, parseStatusFilter("banned"))
	require.Equal(t, common.ChannelStatusBanned, parseStatusFilter("4"))
}

func TestApplyChannelStatusFilterSupportsBanned(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	query := applyChannelStatusFilter(db.Model(&struct{ Status int }{}), common.ChannelStatusBanned)
	require.Contains(t, query.ToSQL(func(tx *gorm.DB) *gorm.DB { return tx.Find(&struct{ Status int }{}) }), "status = 4")
}
