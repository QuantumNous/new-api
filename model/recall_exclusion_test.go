package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRecallExclusionUserIDSnapshotIsSortedUniqueAndGzipped(t *testing.T) {
	snapshot, err := EncodeRecallExclusionUserIDs([]int{42, 7, 42, 0, -1, 9})
	require.NoError(t, err)
	require.NotEmpty(t, snapshot)
	require.NotEqual(t, byte('['), snapshot[0])

	userIDs, err := DecodeRecallExclusionUserIDs(snapshot)
	require.NoError(t, err)
	require.Equal(t, []int{7, 9, 42}, userIDs)
}

func TestRecallExclusionBatchSchemaDoesNotAddBlockingErrorColumn(t *testing.T) {
	db, _ := setupRecallRepositoryDB(t)

	require.True(t, db.Migrator().HasTable(&RecallExclusionBatch{}))
	require.False(t, db.Migrator().HasColumn(&RecallExclusionBatch{}, "BlockingErrorCount"))
}
