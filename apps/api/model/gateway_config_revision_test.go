package model

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// resetGatewayRevision restores the singleton watermark and empties the outbox
// so each case starts from a known committed state.
func resetGatewayRevision(t *testing.T, revision int64) {
	t.Helper()
	require.NoError(t, DB.Exec("DELETE FROM gateway_config_outboxes").Error)
	require.NoError(t, DB.Exec("DELETE FROM gateway_config_revisions").Error)
	require.NoError(t, DB.Create(&GatewayConfigRevision{ID: gatewayConfigRevisionID, RoutingRevision: revision}).Error)
	t.Cleanup(func() {
		DB.Exec("DELETE FROM gateway_config_outboxes")
		DB.Exec("DELETE FROM gateway_config_revisions")
	})
}

func currentGatewayRevision(t *testing.T) int64 {
	t.Helper()
	var row GatewayConfigRevision
	require.NoError(t, DB.Where("id = ?", gatewayConfigRevisionID).Take(&row).Error)
	return row.RoutingRevision
}

func outboxRevisions(t *testing.T) []int64 {
	t.Helper()
	var revisions []int64
	require.NoError(t, DB.Model(&GatewayConfigOutbox{}).
		Order("routing_revision asc").
		Pluck("routing_revision", &revisions).Error)
	return revisions
}

func TestGatewayConfigRevisionInitializeKeepsExistingWatermark(t *testing.T) {
	require.NoError(t, DB.Exec("DELETE FROM gateway_config_outboxes").Error)
	require.NoError(t, DB.Exec("DELETE FROM gateway_config_revisions").Error)
	t.Cleanup(func() {
		DB.Exec("DELETE FROM gateway_config_outboxes")
		DB.Exec("DELETE FROM gateway_config_revisions")
	})

	require.NoError(t, InitializeGatewayConfigRevision())
	assert.Equal(t, int64(1), currentGatewayRevision(t), "empty database starts at revision 1")

	_, err := MutateGatewayRouting(func(tx *gorm.DB) error { return nil })
	require.NoError(t, err)
	require.Equal(t, int64(2), currentGatewayRevision(t))

	require.NoError(t, InitializeGatewayConfigRevision())
	assert.Equal(t, int64(2), currentGatewayRevision(t), "re-initialisation must never reset a live watermark")

	var rows int64
	require.NoError(t, DB.Model(&GatewayConfigRevision{}).Count(&rows).Error)
	assert.Equal(t, int64(1), rows, "revision table stays a singleton")
}

func TestGatewayConfigRevisionInitializeRejectsNonCanonicalRow(t *testing.T) {
	require.NoError(t, DB.Exec("DELETE FROM gateway_config_outboxes").Error)
	require.NoError(t, DB.Exec("DELETE FROM gateway_config_revisions").Error)
	t.Cleanup(func() {
		DB.Exec("DELETE FROM gateway_config_outboxes")
		DB.Exec("DELETE FROM gateway_config_revisions")
	})
	require.NoError(t, DB.Create(&GatewayConfigRevision{ID: 9, RoutingRevision: 42}).Error)

	err := InitializeGatewayConfigRevision()
	require.ErrorIs(t, err, ErrGatewayRevisionMissing)

	var rows []GatewayConfigRevision
	require.NoError(t, DB.Order("id asc").Find(&rows).Error)
	require.Len(t, rows, 1, "initialisation must not add a second watermark next to an existing row")
	assert.Equal(t, int64(42), rows[0].RoutingRevision)
}

func TestGatewayConfigRevisionCommitsDomainRowRevisionAndOutboxTogether(t *testing.T) {
	resetGatewayRevision(t, 7)

	revision, err := MutateGatewayRouting(func(tx *gorm.DB) error {
		return tx.Create(&Channel{Key: "gateway-revision-commit-probe", Name: "revision-probe"}).Error
	})
	require.NoError(t, err)
	t.Cleanup(func() { DB.Where("name = ?", "revision-probe").Delete(&Channel{}) })

	assert.Equal(t, int64(8), revision)
	assert.Equal(t, int64(8), currentGatewayRevision(t))
	assert.Equal(t, []int64{8}, outboxRevisions(t), "one mutation publishes exactly one revision")

	var channel Channel
	require.NoError(t, DB.Where("name = ?", "revision-probe").Take(&channel).Error)
	assert.Equal(t, "gateway-revision-commit-probe", channel.Key)

	var outbox GatewayConfigOutbox
	require.NoError(t, DB.Where("routing_revision = ?", revision).Take(&outbox).Error)
	assert.Nil(t, outbox.PublishedAt, "a committed revision is not published yet")
	assert.Zero(t, outbox.PublishAttempts)
	assert.Empty(t, outbox.LastPublishErrorClass)
	assert.False(t, outbox.CreatedAt.IsZero())
}

func TestGatewayConfigRevisionRollsBackEverythingOnMutatorFailure(t *testing.T) {
	resetGatewayRevision(t, 4)
	mutatorErr := errors.New("domain write rejected")

	revision, err := MutateGatewayRouting(func(tx *gorm.DB) error {
		if err := tx.Create(&Channel{Key: "gateway-revision-rollback-probe", Name: "revision-rollback-probe"}).Error; err != nil {
			return err
		}
		return mutatorErr
	})
	require.ErrorIs(t, err, mutatorErr)
	assert.Zero(t, revision)

	assert.Equal(t, int64(4), currentGatewayRevision(t), "failed mutation must not advance the watermark")
	assert.Empty(t, outboxRevisions(t))

	var found int64
	require.NoError(t, DB.Model(&Channel{}).Where("name = ?", "revision-rollback-probe").Count(&found).Error)
	assert.Zero(t, found, "domain write rolls back with the revision")
}

func TestGatewayConfigRevisionRejectsMissingSingletonRow(t *testing.T) {
	require.NoError(t, DB.Exec("DELETE FROM gateway_config_outboxes").Error)
	require.NoError(t, DB.Exec("DELETE FROM gateway_config_revisions").Error)
	t.Cleanup(func() {
		DB.Exec("DELETE FROM gateway_config_outboxes")
		DB.Exec("DELETE FROM gateway_config_revisions")
	})

	revision, err := MutateGatewayRouting(func(tx *gorm.DB) error { return nil })
	require.ErrorIs(t, err, ErrGatewayRevisionMissing)
	assert.Zero(t, revision, "a missing row must never degrade to revision 0")
	assert.Empty(t, outboxRevisions(t))
}

func TestGatewayConfigRevisionRejectsNonPositiveStoredWatermark(t *testing.T) {
	resetGatewayRevision(t, -1)

	revision, err := MutateGatewayRouting(func(tx *gorm.DB) error { return nil })
	require.ErrorIs(t, err, ErrGatewayRevisionInvalid)
	assert.Zero(t, revision)
	assert.Equal(t, int64(-1), currentGatewayRevision(t), "invalid watermark rolls back untouched")
	assert.Empty(t, outboxRevisions(t))
}

func TestGatewayConfigRevisionRequiresTransactionAndMutator(t *testing.T) {
	resetGatewayRevision(t, 3)

	revision, err := BumpGatewayRoutingRevision(nil)
	require.Error(t, err)
	assert.Zero(t, revision)

	revision, err = MutateGatewayRouting(nil)
	require.Error(t, err)
	assert.Zero(t, revision)
	assert.Equal(t, int64(3), currentGatewayRevision(t))
	assert.Empty(t, outboxRevisions(t))
}

func TestGatewayConfigRevisionSequentialMutationsAreStrictlyIncreasing(t *testing.T) {
	resetGatewayRevision(t, 1)

	var got []int64
	for range 5 {
		revision, err := MutateGatewayRouting(func(tx *gorm.DB) error { return nil })
		require.NoError(t, err)
		got = append(got, revision)
	}

	assert.Equal(t, []int64{2, 3, 4, 5, 6}, got, "each mutation advances the watermark exactly once")
	assert.Equal(t, got, outboxRevisions(t), "outbox revisions are unique and ordered")
}

func TestGatewayConfigOutboxRejectsDuplicateRevision(t *testing.T) {
	resetGatewayRevision(t, 1)

	revision, err := MutateGatewayRouting(func(tx *gorm.DB) error { return nil })
	require.NoError(t, err)

	err = DB.Create(&GatewayConfigOutbox{RoutingRevision: revision}).Error
	require.Error(t, err, "routing_revision is unique so a revision cannot be announced twice")
	assert.Equal(t, []int64{revision}, outboxRevisions(t))
}
