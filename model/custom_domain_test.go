package model

import (
	"errors"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/go-sql-driver/mysql"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestNormalizeCustomDomainLabelAcceptsOneDNSLabelAndRejectsReservedOrMalformedValues(t *testing.T) {
	reserved := map[string]struct{}{
		"admin": {},
		"www":   {},
	}

	label, err := NormalizeCustomDomainLabel("  Customer-42  ", reserved)
	require.NoError(t, err)
	assert.Equal(t, "customer-42", label)

	for _, input := range []string{"", "-customer", "customer-", "customer.domain", "customer_42", strings.Repeat("a", 64)} {
		_, err := NormalizeCustomDomainLabel(input, reserved)
		assert.ErrorIs(t, err, ErrCustomDomainInvalidLabel, input)
	}

	_, err = NormalizeCustomDomainLabel("WWW", reserved)
	assert.ErrorIs(t, err, ErrCustomDomainReservedLabel)
}

func TestCustomDomainLifecycleKeepsTombstoneOwnerAndAllowsOnlyOneActiveDomain(t *testing.T) {
	truncateTables(t)
	t.Cleanup(func() { DB.Exec("DELETE FROM custom_domains") })

	ownerA := User{Username: "custom-domain-owner-a", AffCode: "custom-domain-aff-a", Status: common.UserStatusEnabled}
	ownerB := User{Username: "custom-domain-owner-b", AffCode: "custom-domain-aff-b", Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&ownerA).Error)
	require.NoError(t, DB.Create(&ownerB).Error)

	alpha, err := CreateCustomDomain("Alpha", ownerA.Id)
	require.NoError(t, err)
	assert.Equal(t, "alpha", alpha.Label)
	assert.False(t, alpha.Enabled)
	assert.Nil(t, alpha.ActiveOwnerID)

	alpha, err = EnableCustomDomain("alpha")
	require.NoError(t, err)
	assert.True(t, alpha.Enabled)
	require.NotNil(t, alpha.ActiveOwnerID)
	assert.Equal(t, ownerA.Id, *alpha.ActiveOwnerID)

	_, err = CreateCustomDomain("Beta", ownerA.Id)
	require.NoError(t, err)
	_, err = EnableCustomDomain("beta")
	assert.ErrorIs(t, err, ErrCustomDomainOwnerAlreadyActive)

	alpha, err = DisableCustomDomain("alpha")
	require.NoError(t, err)
	assert.False(t, alpha.Enabled)
	assert.Nil(t, alpha.ActiveOwnerID)
	require.NotNil(t, alpha.DisabledAt)

	beta, err := EnableCustomDomain("beta")
	require.NoError(t, err)
	assert.True(t, beta.Enabled)

	_, err = CreateCustomDomain("alpha", ownerB.Id)
	assert.ErrorIs(t, err, ErrCustomDomainAlreadyAssigned)

	persisted, err := GetCustomDomainByLabel("ALPHA")
	require.NoError(t, err)
	assert.Equal(t, ownerA.Id, persisted.OwnerUserID)
}

func TestCustomDomainDuplicateKeyDetectionUsesTheCurrentDatabaseDialect(t *testing.T) {
	truncateTables(t)
	owner := User{Username: "duplicate-domain-owner", AffCode: "duplicate-domain-aff", Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&owner).Error)
	require.NoError(t, DB.Create(&CustomDomain{Label: "duplicate", OwnerUserID: owner.Id}).Error)
	err := DB.Create(&CustomDomain{Label: "duplicate", OwnerUserID: owner.Id}).Error
	require.Error(t, err)
	assert.False(t, errors.Is(err, gorm.ErrDuplicatedKey), "the test database intentionally leaves global GORM translation disabled")
	assert.True(t, isDatabaseDuplicatedKey(DB, err))
	assert.True(t, isDatabaseDuplicatedKey(DB, &mysql.MySQLError{Number: 1062, Message: "duplicate"}))
	assert.False(t, isDatabaseDuplicatedKey(DB, errors.New("database unavailable")))
}
