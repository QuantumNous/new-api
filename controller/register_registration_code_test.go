package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupRegisterTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousRedisEnabled := common.RedisEnabled
	previousMainDatabaseType, previousLogDatabaseType := common.MainDatabaseType(), common.LogDatabaseType()
	previousRegister := common.RegisterEnabled
	previousPasswordRegister := common.PasswordRegisterEnabled
	previousRegistrationCode := common.RegistrationCodeEnabled
	previousEmailVerification := common.EmailVerificationEnabled
	common.RedisEnabled = false
	common.EmailVerificationEnabled = false
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB, model.LOG_DB = db, db
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Log{}, &model.RegistrationCode{}))

	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.RedisEnabled = previousRedisEnabled
		common.SetDatabaseTypes(previousMainDatabaseType, previousLogDatabaseType)
		common.RegisterEnabled = previousRegister
		common.PasswordRegisterEnabled = previousPasswordRegister
		common.RegistrationCodeEnabled = previousRegistrationCode
		common.EmailVerificationEnabled = previousEmailVerification
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func performRegisterRequest(t *testing.T, body string) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/user/register", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	Register(c)
	return recorder
}

func createTestRegistrationCode(t *testing.T, db *gorm.DB, key string) {
	t.Helper()
	require.NoError(t, db.Create(&model.RegistrationCode{
		Name:        "test-code",
		Key:         key,
		Status:      common.RegistrationCodeStatusUnused,
		CreatedTime: common.GetTimestamp(),
	}).Error)
}

const testRegistrationCodeKey = "40000000000000000000000000000001"

// The registration code gate stacks on top of the existing register switches;
// it must never bypass them.
func TestRegisterRegistrationCodeDoesNotBypassRegisterSwitches(t *testing.T) {
	db := setupRegisterTestDB(t)
	createTestRegistrationCode(t, db, testRegistrationCodeKey)
	common.RegistrationCodeEnabled = true

	body := fmt.Sprintf(`{"username":"newuser","password":"password123","registration_code":"%s"}`, testRegistrationCodeKey)

	common.RegisterEnabled = false
	common.PasswordRegisterEnabled = true
	recorder := performRegisterRequest(t, body)
	assert.Contains(t, recorder.Body.String(), `"success":false`)

	common.RegisterEnabled = true
	common.PasswordRegisterEnabled = false
	recorder = performRegisterRequest(t, body)
	assert.Contains(t, recorder.Body.String(), `"success":false`)

	var count int64
	require.NoError(t, db.Model(&model.User{}).Count(&count).Error)
	assert.Zero(t, count, "no user may be created while a register switch is off")

	var code model.RegistrationCode
	require.NoError(t, db.First(&code, "name = ?", "test-code").Error)
	assert.Equal(t, common.RegistrationCodeStatusUnused, code.Status, "code must stay unconsumed")
}

func TestRegisterRequiresAndConsumesRegistrationCode(t *testing.T) {
	db := setupRegisterTestDB(t)
	createTestRegistrationCode(t, db, testRegistrationCodeKey)
	common.RegisterEnabled = true
	common.PasswordRegisterEnabled = true
	common.RegistrationCodeEnabled = true

	// Missing code is rejected.
	recorder := performRegisterRequest(t, `{"username":"nocode","password":"password123"}`)
	assert.Contains(t, recorder.Body.String(), `"success":false`)

	// Invalid code is rejected without creating a user.
	recorder = performRegisterRequest(t, `{"username":"badcode","password":"password123","registration_code":"bogus"}`)
	assert.Contains(t, recorder.Body.String(), `"success":false`)
	var count int64
	require.NoError(t, db.Model(&model.User{}).Count(&count).Error)
	assert.Zero(t, count)

	// Valid code registers the user and consumes the code atomically.
	body := fmt.Sprintf(`{"username":"gooduser","password":"password123","registration_code":"%s"}`, testRegistrationCodeKey)
	recorder = performRegisterRequest(t, body)
	assert.Contains(t, recorder.Body.String(), `"success":true`)

	var user model.User
	require.NoError(t, db.First(&user, "username = ?", "gooduser").Error)
	var code model.RegistrationCode
	require.NoError(t, db.First(&code, "name = ?", "test-code").Error)
	assert.Equal(t, common.RegistrationCodeStatusUsed, code.Status)
	assert.Equal(t, user.Id, code.UsedUserId)

	// A used code cannot register a second account.
	recorder = performRegisterRequest(t, fmt.Sprintf(`{"username":"second","password":"password123","registration_code":"%s"}`, testRegistrationCodeKey))
	assert.Contains(t, recorder.Body.String(), `"success":false`)
	var second int64
	require.NoError(t, db.Model(&model.User{}).Where("username = ?", "second").Count(&second).Error)
	assert.Zero(t, second, "user creation must roll back when the code is already used")
}

// With the switch off, registration must behave exactly as before: no code
// needed, none consumed.
func TestRegisterWithSwitchOffIgnoresRegistrationCode(t *testing.T) {
	db := setupRegisterTestDB(t)
	createTestRegistrationCode(t, db, testRegistrationCodeKey)
	common.RegisterEnabled = true
	common.PasswordRegisterEnabled = true
	common.RegistrationCodeEnabled = false

	recorder := performRegisterRequest(t, `{"username":"plainuser","password":"password123"}`)
	assert.Contains(t, recorder.Body.String(), `"success":true`)

	var code model.RegistrationCode
	require.NoError(t, db.First(&code, "name = ?", "test-code").Error)
	assert.Equal(t, common.RegistrationCodeStatusUnused, code.Status)
}

func TestUpdateRegistrationCodeValidatesName(t *testing.T) {
	db := setupRegisterTestDB(t)
	createTestRegistrationCode(t, db, testRegistrationCodeKey)
	var created model.RegistrationCode
	require.NoError(t, db.First(&created, "name = ?", "test-code").Error)

	performUpdate := func(body string) *httptest.ResponseRecorder {
		gin.SetMode(gin.TestMode)
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Request = httptest.NewRequest(http.MethodPut, "/api/registration_code/", strings.NewReader(body))
		c.Request.Header.Set("Content-Type", "application/json")
		UpdateRegistrationCode(c)
		return recorder
	}

	// Empty and oversized names are rejected, mirroring create-time validation.
	recorder := performUpdate(fmt.Sprintf(`{"id":%d,"name":""}`, created.Id))
	assert.Contains(t, recorder.Body.String(), `"success":false`)
	recorder = performUpdate(fmt.Sprintf(`{"id":%d,"name":"%s"}`, created.Id, strings.Repeat("x", 21)))
	assert.Contains(t, recorder.Body.String(), `"success":false`)

	var unchanged model.RegistrationCode
	require.NoError(t, db.First(&unchanged, "id = ?", created.Id).Error)
	assert.Equal(t, "test-code", unchanged.Name)

	// A valid name still updates.
	recorder = performUpdate(fmt.Sprintf(`{"id":%d,"name":"renamed"}`, created.Id))
	assert.Contains(t, recorder.Body.String(), `"success":true`)
	require.NoError(t, db.First(&unchanged, "id = ?", created.Id).Error)
	assert.Equal(t, "renamed", unchanged.Name)
}
