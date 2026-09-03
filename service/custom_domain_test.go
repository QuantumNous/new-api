package service

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestCustomDomainResolverClassifiesOnlyTrustedHosts(t *testing.T) {
	previousDB := model.DB
	previousDatabaseType := common.MainDatabaseType()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.CustomDomain{}))
	model.DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousDatabaseType)
	})

	owner := model.User{Username: "domain-resolver-owner", AffCode: "domain-resolver-aff", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&owner).Error)
	_, err = model.CreateCustomDomain("alpha", owner.Id)
	require.NoError(t, err)
	_, err = model.EnableCustomDomain("alpha")
	require.NoError(t, err)
	_, err = model.CreateCustomDomain("disabled", owner.Id)
	require.NoError(t, err)

	settings, err := common.ParseCustomDomainSettingsWithMainOrigins("true", "yeschoy.io", "https://yeschoy.com", "https://yeschoy.com,https://yeschoy.pro,https://future.example", "5", "")
	require.NoError(t, err)
	resolver, err := NewCustomDomainResolver(settings)
	require.NoError(t, err)

	tests := []struct {
		name           string
		host           string
		kind           CustomDomainKind
		isCallbackHost bool
	}{
		{name: "callback main host with standard port", host: "yeschoy.com:443", kind: CustomDomainKindMain, isCallbackHost: true},
		{name: "peer main host", host: "yeschoy.pro", kind: CustomDomainKindMain},
		{name: "future peer main host", host: "FUTURE.EXAMPLE.", kind: CustomDomainKindMain},
		{name: "apex is rejected", host: "yeschoy.io", kind: CustomDomainKindApex},
		{name: "active custom host", host: "ALPHA.yeschoy.io.", kind: CustomDomainKindCustom},
		{name: "disabled custom host", host: "disabled.yeschoy.io", kind: CustomDomainKindDisabled},
		{name: "unknown custom host", host: "missing.yeschoy.io", kind: CustomDomainKindUnknown},
		{name: "nested custom host", host: "nested.alpha.yeschoy.io", kind: CustomDomainKindInvalid},
		{name: "host userinfo pollution", host: "user@alpha.yeschoy.io", kind: CustomDomainKindInvalid},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			context, err := resolver.ResolveHost(test.host)
			require.NoError(t, err)
			assert.Equal(t, test.kind, context.Kind)
			assert.Equal(t, test.isCallbackHost, context.IsCallbackHost)
		})
	}

	context, err := resolver.ResolveHost("alpha.yeschoy.io")
	require.NoError(t, err)
	assert.Equal(t, owner.Id, context.OwnerUserID)
	assert.True(t, context.Enabled)
}

func TestCustomDomainResolverRejectsMainOriginInsideTheCustomDomainSuffix(t *testing.T) {
	_, err := NewCustomDomainResolver(common.CustomDomainSettings{
		Enabled:         true,
		Suffix:          "yeschoy.io",
		MainOrigin:      "https://auth.yeschoy.io",
		CacheTTLSeconds: 5,
		ReservedLabels:  map[string]struct{}{},
	})
	assert.Error(t, err)
}

func TestCustomDomainResolverValidatesStoredMainAndPromotionOrigins(t *testing.T) {
	previousDB := model.DB
	previousDatabaseType := common.MainDatabaseType()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.CustomDomain{}))
	model.DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousDatabaseType)
	})

	owner := model.User{Username: "stored-origin-owner", AffCode: "stored-origin-aff", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&owner).Error)
	domain, err := model.CreateCustomDomain("alpha", owner.Id)
	require.NoError(t, err)
	domain, err = model.EnableCustomDomain(domain.Label)
	require.NoError(t, err)

	settings, err := common.ParseCustomDomainSettingsWithMainOrigins(
		"true",
		"yeschoy.io",
		"https://yeschoy.com",
		"https://yeschoy.com,https://yeschoy.pro,https://future.example",
		"5",
		"",
	)
	require.NoError(t, err)
	resolver, err := NewCustomDomainResolver(settings)
	require.NoError(t, err)

	for _, test := range []struct {
		name     string
		domainID int64
		host     string
		kind     CustomDomainKind
	}{
		{name: "peer main", host: "yeschoy.pro", kind: CustomDomainKindMain},
		{name: "future peer main", host: "future.example", kind: CustomDomainKindMain},
		{name: "promotion", domainID: domain.Id, host: "alpha.yeschoy.io", kind: CustomDomainKindCustom},
	} {
		t.Run(test.name, func(t *testing.T) {
			context, err := resolver.ResolveStoredOrigin(test.domainID, test.host)
			require.NoError(t, err)
			assert.Equal(t, test.kind, context.Kind)
			assert.Equal(t, test.host, context.Host)
		})
	}

	for _, test := range []struct {
		name     string
		domainID int64
		host     string
	}{
		{name: "main with promotion id", domainID: domain.Id, host: "yeschoy.pro"},
		{name: "promotion without id", host: "alpha.yeschoy.io"},
		{name: "promotion with wrong id", domainID: domain.Id + 1, host: "alpha.yeschoy.io"},
		{name: "unknown main", host: "evil.example"},
	} {
		t.Run(test.name, func(t *testing.T) {
			_, err := resolver.ResolveStoredOrigin(test.domainID, test.host)
			assert.ErrorIs(t, err, ErrCustomDomainOriginInvalid)
		})
	}
}

func TestCustomDomainResolverRechecksCachedDomainAfterItsTTL(t *testing.T) {
	previousDB := model.DB
	previousDatabaseType := common.MainDatabaseType()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.CustomDomain{}))
	model.DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousDatabaseType)
	})

	owner := model.User{Username: "domain-cache-owner", AffCode: "domain-cache-aff", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&owner).Error)
	_, err = model.CreateCustomDomain("alpha", owner.Id)
	require.NoError(t, err)
	_, err = model.EnableCustomDomain("alpha")
	require.NoError(t, err)

	settings, err := common.ParseCustomDomainSettings("true", "yeschoy.io", "https://yeschoy.com", "5", "")
	require.NoError(t, err)
	now := time.Date(2026, time.September, 2, 0, 0, 0, 0, time.UTC)
	resolver, err := NewCustomDomainResolverWithClock(settings, func() time.Time { return now })
	require.NoError(t, err)

	context, err := resolver.ResolveHost("alpha.yeschoy.io")
	require.NoError(t, err)
	assert.Equal(t, CustomDomainKindCustom, context.Kind)

	_, err = model.DisableCustomDomain("alpha")
	require.NoError(t, err)
	context, err = resolver.ResolveHost("alpha.yeschoy.io")
	require.NoError(t, err)
	assert.Equal(t, CustomDomainKindCustom, context.Kind)

	now = now.Add(6 * time.Second)
	context, err = resolver.ResolveHost("alpha.yeschoy.io")
	require.NoError(t, err)
	assert.Equal(t, CustomDomainKindDisabled, context.Kind)
}
