package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupChannelCodexFingerprintSeedTestDB(t *testing.T) {
	t.Helper()

	originalDB := model.DB
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL

	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/channel-codex-fingerprint-seed.db"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}, &model.CodexModelGovernanceRecord{}))
	sqlDB, err := db.DB()
	require.NoError(t, err)

	model.DB = db
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	gin.SetMode(gin.TestMode)

	t.Cleanup(func() {
		model.DB = originalDB
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		require.NoError(t, sqlDB.Close())
	})
}

func newChannelSeedJSONContext(method string, target string, body string) (*gin.Context, *httptest.ResponseRecorder) {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(method, target, bytes.NewBufferString(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	return ctx, recorder
}

func requireChannelSeedAPIStatus(t *testing.T, recorder *httptest.ResponseRecorder) {
	t.Helper()

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success, response.Message)
}

func requireCodexSeed(t *testing.T, seed string) {
	t.Helper()

	require.NotEmpty(t, seed)
	_, err := uuid.Parse(seed)
	require.NoError(t, err)
}

func codexChannelCreateBody(extra string) string {
	if extra != "" {
		extra = "," + extra
	}
	return `{"mode":"single","channel":{"type":` + strconv.Itoa(constant.ChannelTypeCodex) + `,"key":"{\"access_token\":\"at\",\"account_id\":\"acct\"}","name":"codex","status":1,"models":"gpt-5-codex","group":"default"` + extra + `}}`
}

func storedCodexSeedChannel(t *testing.T, id int) model.Channel {
	t.Helper()

	var channel model.Channel
	require.NoError(t, model.DB.First(&channel, "id = ?", id).Error)
	return channel
}

func TestCodexSeedLifecycleThroughCreateUpdateCopy(t *testing.T) {
	setupChannelCodexFingerprintSeedTestDB(t)

	ctx, recorder := newChannelSeedJSONContext(http.MethodPost, "/api/channel", codexChannelCreateBody(""))
	AddChannel(ctx)
	requireChannelSeedAPIStatus(t, recorder)

	var created model.Channel
	require.NoError(t, model.DB.First(&created, "type = ?", constant.ChannelTypeCodex).Error)
	requireCodexSeed(t, created.CodexFingerprintSeed)
	createdSeed := created.CodexFingerprintSeed

	updateBody := `{"id":` + strconv.Itoa(created.Id) + `,"type":` + strconv.Itoa(constant.ChannelTypeCodex) + `,"key":"{\"access_token\":\"at2\",\"account_id\":\"acct\"}","name":"codex edited","status":1,"models":"gpt-5-codex","group":"default","settings":"{\"codex_fingerprint_mode\":\"model\"}"}`
	ctx, recorder = newChannelSeedJSONContext(http.MethodPut, "/api/channel", updateBody)
	UpdateChannel(ctx)
	requireChannelSeedAPIStatus(t, recorder)
	require.Equal(t, createdSeed, storedCodexSeedChannel(t, created.Id).CodexFingerprintSeed)

	ctx, recorder = newChannelSeedJSONContext(http.MethodPut, "/api/channel", strings.Replace(updateBody, `"status":1`, `"status":2`, 1))
	UpdateChannel(ctx)
	requireChannelSeedAPIStatus(t, recorder)
	require.Equal(t, createdSeed, storedCodexSeedChannel(t, created.Id).CodexFingerprintSeed)

	ctx, recorder = newChannelSeedJSONContext(http.MethodPut, "/api/channel", updateBody)
	UpdateChannel(ctx)
	requireChannelSeedAPIStatus(t, recorder)
	require.Equal(t, createdSeed, storedCodexSeedChannel(t, created.Id).CodexFingerprintSeed)

	ctx, recorder = newChannelSeedJSONContext(http.MethodPost, "/api/channel/copy/"+strconv.Itoa(created.Id), "")
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(created.Id)}}
	CopyChannel(ctx)
	requireChannelSeedAPIStatus(t, recorder)

	var channels []model.Channel
	require.NoError(t, model.DB.Order("id ASC").Find(&channels).Error)
	require.Len(t, channels, 2)
	require.Equal(t, createdSeed, channels[0].CodexFingerprintSeed)
	requireCodexSeed(t, channels[1].CodexFingerprintSeed)
	require.NotEqual(t, createdSeed, channels[1].CodexFingerprintSeed)
}

func TestCodexSeedCannotBeSuppliedOrSerialized(t *testing.T) {
	setupChannelCodexFingerprintSeedTestDB(t)

	supplied := "11111111-1111-4111-8111-111111111111"
	ctx, recorder := newChannelSeedJSONContext(http.MethodPost, "/api/channel", codexChannelCreateBody(`"codex_fingerprint_seed":"`+supplied+`"`))
	AddChannel(ctx)
	requireChannelSeedAPIStatus(t, recorder)

	var stored model.Channel
	require.NoError(t, model.DB.First(&stored, "type = ?", constant.ChannelTypeCodex).Error)
	requireCodexSeed(t, stored.CodexFingerprintSeed)
	require.NotEqual(t, supplied, stored.CodexFingerprintSeed)

	payload, err := json.Marshal(stored)
	require.NoError(t, err)
	require.NotContains(t, string(payload), "codex_fingerprint_seed")
	require.NotContains(t, string(payload), stored.CodexFingerprintSeed)
}

func TestAddCodexChannelDefaultsFingerprintModeToFull(t *testing.T) {
	setupChannelCodexFingerprintSeedTestDB(t)

	ctx, recorder := newChannelSeedJSONContext(http.MethodPost, "/api/channel", codexChannelCreateBody(""))
	AddChannel(ctx)
	requireChannelSeedAPIStatus(t, recorder)

	var defaulted model.Channel
	require.NoError(t, model.DB.First(&defaulted, "type = ?", constant.ChannelTypeCodex).Error)
	require.Equal(t, "full", defaulted.GetSetting().CodexFingerprintMode)

	ctx, recorder = newChannelSeedJSONContext(http.MethodPost, "/api/channel", codexChannelCreateBody(`"setting":"{\"codex_fingerprint_mode\":\"session\"}"`))
	AddChannel(ctx)
	requireChannelSeedAPIStatus(t, recorder)

	var explicit model.Channel
	require.NoError(t, model.DB.Order("id DESC").First(&explicit, "type = ?", constant.ChannelTypeCodex).Error)
	require.Equal(t, "session", explicit.GetSetting().CodexFingerprintMode)

	ctx, recorder = newChannelSeedJSONContext(http.MethodPost, "/api/channel", codexChannelCreateBody(`"setting":"{\"codex_fingerprint_mode\":\"bogus\"}"`))
	AddChannel(ctx)
	requireChannelSeedAPIStatus(t, recorder)

	var invalid model.Channel
	require.NoError(t, model.DB.Order("id DESC").First(&invalid, "type = ?", constant.ChannelTypeCodex).Error)
	require.Equal(t, "full", invalid.GetSetting().CodexFingerprintMode)

	openAIBody := `{"mode":"single","channel":{"type":` + strconv.Itoa(constant.ChannelTypeOpenAI) + `,"key":"sk-test","name":"openai","status":1,"models":"gpt-4o","group":"default"}}`
	ctx, recorder = newChannelSeedJSONContext(http.MethodPost, "/api/channel", openAIBody)
	AddChannel(ctx)
	requireChannelSeedAPIStatus(t, recorder)

	var nonCodex model.Channel
	require.NoError(t, model.DB.First(&nonCodex, "type = ?", constant.ChannelTypeOpenAI).Error)
	require.Empty(t, nonCodex.GetSetting().CodexFingerprintMode)
}
