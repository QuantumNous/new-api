package service

import (
	"bytes"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestRunCustomDomainCLIAssignsTransitionsAndListsDomains(t *testing.T) {
	previousDB := model.DB
	previousDatabaseType := common.MainDatabaseType()
	previousReservedLabels := common.CustomDomainReservedLabels
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.CustomDomain{}))
	model.DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.CustomDomainReservedLabels = map[string]struct{}{"www": {}}
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousDatabaseType)
		common.CustomDomainReservedLabels = previousReservedLabels
	})

	owner := model.User{Username: "domain-cli-owner", AffCode: "domain-cli-aff", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&owner).Error)

	var stdout, stderr bytes.Buffer
	assert.Equal(t, 0, RunCustomDomainCLI([]string{"assign", "Alpha", "--owner-user-id", strconv.Itoa(owner.Id)}, &stdout, &stderr))
	assert.Contains(t, stdout.String(), `"label":"alpha"`)
	assert.Empty(t, stderr.String())

	stdout.Reset()
	assert.Equal(t, 0, RunCustomDomainCLI([]string{"enable", "alpha"}, &stdout, &stderr))
	assert.Contains(t, stdout.String(), `"enabled":true`)

	stdout.Reset()
	assert.Equal(t, 0, RunCustomDomainCLI([]string{"list", "--enabled"}, &stdout, &stderr))
	assert.Contains(t, stdout.String(), `"label":"alpha"`)

	stdout.Reset()
	assert.Equal(t, 0, RunCustomDomainCLI([]string{"disable", "alpha"}, &stdout, &stderr))
	assert.Contains(t, stdout.String(), `"enabled":false`)

	stdout.Reset()
	assert.Equal(t, 2, RunCustomDomainCLI([]string{"assign", "www", "--owner-user-id", strconv.Itoa(owner.Id)}, &stdout, &stderr))
	assert.Contains(t, stderr.String(), "reserved")
}

func TestRunCustomDomainCLIShowsAndDisablesAnAssignedLabelThatBecomesReserved(t *testing.T) {
	previousDB := model.DB
	previousDatabaseType := common.MainDatabaseType()
	previousReservedLabels := common.CustomDomainReservedLabels
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.CustomDomain{}))
	model.DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.CustomDomainReservedLabels = map[string]struct{}{"alpha": {}}
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousDatabaseType)
		common.CustomDomainReservedLabels = previousReservedLabels
	})

	owner := model.User{Username: "reserved-domain-cli-owner", AffCode: "reserved-domain-cli-aff", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&owner).Error)
	domain, err := model.CreateCustomDomain("alpha", owner.Id)
	require.NoError(t, err)
	_, err = model.EnableCustomDomain(domain.Label)
	require.NoError(t, err)

	var stdout, stderr bytes.Buffer
	assert.Equal(t, 0, RunCustomDomainCLI([]string{"show", "alpha"}, &stdout, &stderr))
	assert.Contains(t, stdout.String(), `"label":"alpha"`)

	stdout.Reset()
	stderr.Reset()
	assert.Equal(t, 0, RunCustomDomainCLI([]string{"disable", "alpha"}, &stdout, &stderr))
	assert.Contains(t, stdout.String(), `"enabled":false`)

	stdout.Reset()
	stderr.Reset()
	assert.Equal(t, 2, RunCustomDomainCLI([]string{"enable", "alpha"}, &stdout, &stderr))
	assert.Contains(t, stderr.String(), "reserved")
}
