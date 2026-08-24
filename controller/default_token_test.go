package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupDefaultTokenTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	origDB := model.DB
	origSQLite := common.UsingSQLite
	origMySQL := common.UsingMySQL
	origPG := common.UsingPostgreSQL
	origGen := constant.GenerateDefaultToken
	t.Cleanup(func() {
		model.DB = origDB
		common.UsingSQLite = origSQLite
		common.UsingMySQL = origMySQL
		common.UsingPostgreSQL = origPG
		constant.GenerateDefaultToken = origGen
	})
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/default-token.db"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Token{}))
	model.DB = db
	return db
}

// A newly registered user must land with exactly one default key, and calling the
// helper again (e.g. email register + a retried OAuth callback) must NOT create a
// second one — the Rule-11 idempotency guarantee issue #406 depends on.
func TestEnsureDefaultUserTokenIdempotent(t *testing.T) {
	db := setupDefaultTokenTestDB(t)
	constant.GenerateDefaultToken = true
	user := model.User{Id: 301, Username: "alice", Group: "default"}
	require.NoError(t, db.Create(&user).Error)

	require.NoError(t, ensureDefaultUserToken(&user))
	require.NoError(t, ensureDefaultUserToken(&user)) // second call: no-op

	var count int64
	require.NoError(t, db.Model(&model.Token{}).Where("user_id = ?", user.Id).Count(&count).Error)
	require.EqualValues(t, 1, count, "exactly one default key per user")

	var tok model.Token
	require.NoError(t, db.Where("user_id = ?", user.Id).First(&tok).Error)
	require.NotEmpty(t, tok.Key)
	require.True(t, tok.UnlimitedQuota)
	require.EqualValues(t, -1, tok.ExpiredTime)
}

// When the feature flag is off, no key is created.
func TestEnsureDefaultUserTokenDisabled(t *testing.T) {
	db := setupDefaultTokenTestDB(t)
	constant.GenerateDefaultToken = false
	user := model.User{Id: 302, Username: "bob", Group: "default"}
	require.NoError(t, db.Create(&user).Error)

	require.NoError(t, ensureDefaultUserToken(&user))

	var count int64
	require.NoError(t, db.Model(&model.Token{}).Where("user_id = ?", user.Id).Count(&count).Error)
	require.EqualValues(t, 0, count)
}

// Guards: nil user / zero id are safe no-ops.
func TestEnsureDefaultUserTokenGuards(t *testing.T) {
	setupDefaultTokenTestDB(t)
	constant.GenerateDefaultToken = true
	require.NoError(t, ensureDefaultUserToken(nil))
	require.NoError(t, ensureDefaultUserToken(&model.User{Id: 0, Username: "x"}))
}
