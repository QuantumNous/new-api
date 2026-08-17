package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestQuotaLifecycleStateCycleAndSourceUse255CharacterColumns(t *testing.T) {
	setupRecallLifecycleTestDB(t)

	require.Equal(t, "varchar(255)", strings.ToLower(recallLifecycleSQLiteColumnType(t, "quota_lifecycle_states", "cycle")))
	require.Equal(t, "varchar(255)", strings.ToLower(recallLifecycleSQLiteColumnType(t, "quota_lifecycle_states", "source")))

	for name, db := range recallLifecycleDryRunDialects(t) {
		t.Run(name, func(t *testing.T) {
			requireLifecycleDataType(t, db, &QuotaLifecycleState{}, "Cycle", "varchar(255)")
			requireLifecycleDataType(t, db, &QuotaLifecycleState{}, "Source", "varchar(255)")
		})
	}
}
