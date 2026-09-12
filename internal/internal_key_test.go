package internal

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// setupTestDB points model.DB at a fresh in-memory SQLite database migrated
// for internal key tests, mirroring the enterprise module's test setup.
func setupTestDB(t *testing.T) {
	t.Helper()
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&InternalKey{}))

	model.DB = db
}

func TestValidateInternalKeyKeyIdFormat(t *testing.T) {
	tests := []struct {
		name  string
		keyId string
		want  bool
	}{
		{"plain word", "crm", true},
		{"hyphen and underscore", "bi-report_2", true},
		{"digits only", "123", true},
		{"max length", strings.Repeat("a", 64), true},
		{"empty", "", false},
		{"too long", strings.Repeat("a", 65), false},
		{"space", "has space", false},
		{"at sign", "user@example", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, ValidateInternalKeyKeyId(tt.keyId))
		})
	}
}

func TestValidateInternalKeyAuthenticatesConfiguredPair(t *testing.T) {
	setupTestDB(t)

	internalKey := &InternalKey{
		KeyId:       "test-system",
		Key:         "test-secret-value-123",
		Name:        "test",
		Status:      InternalKeyStatusEnabled,
		CreatedTime: common.GetTimestamp(),
	}
	require.NoError(t, internalKey.Insert())

	valid, err := ValidateInternalKey("test-system", "test-secret-value-123")
	require.NoError(t, err)
	assert.Equal(t, internalKey.Id, valid.Id)
	refetched, err := GetInternalKeyById(internalKey.Id)
	require.NoError(t, err)
	assert.Greater(t, refetched.AccessedTime, int64(0))

	_, err = ValidateInternalKey("test-system", "wrong-secret")
	assert.ErrorIs(t, err, ErrInternalKeyInvalid)

	_, err = ValidateInternalKey("unknown-system", "test-secret-value-123")
	assert.ErrorIs(t, err, ErrInternalKeyInvalid)

	disabled := &InternalKey{
		KeyId:       "off-system",
		Key:         "another-secret-456",
		Status:      InternalKeyStatusDisabled,
		CreatedTime: common.GetTimestamp(),
	}
	require.NoError(t, disabled.Insert())
	_, err = ValidateInternalKey("off-system", "another-secret-456")
	assert.ErrorIs(t, err, ErrInternalKeyDisabled)
}
