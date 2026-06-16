package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupCodexModelGovernanceControllerDB(t *testing.T) {
	t.Helper()
	originalDB := model.DB
	t.Cleanup(func() {
		model.DB = originalDB
	})
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	model.DB = db
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}, &model.CodexModelGovernanceRecord{}))
}

func TestTestCodexModelGovernanceRuleReturnsExtractedModel(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/rules/test", TestCodexModelGovernanceRule)
	body := []byte(`{"message":"The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT account.","patterns":["The '([^']+)' model is not supported when using Codex with a ChatGPT account\\."]}`)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/rules/test", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"success":true`)
	require.Contains(t, w.Body.String(), `"matched":true`)
	require.Contains(t, w.Body.String(), `"model_name":"gpt-5.3-codex"`)
}

func TestBuildCodexModelGovernanceRecordResponseIncludesDisabledChannelIDs(t *testing.T) {
	response := buildCodexModelGovernanceRecordResponse(model.CodexModelGovernanceRecord{
		ModelName:          "gpt-5.3-codex",
		Status:             model.CodexModelGovernanceStatusUnsupportedPendingReview,
		AffectedChannelIDs: "11,12",
		DisabledChannelIDs: "11",
		AbilitiesDisabled:  true,
	})

	require.Equal(t, []int{11, 12}, response.AffectedChannelIDs)
	require.Equal(t, []int{11}, response.DisabledChannelIDs)
	require.True(t, response.AbilitiesDisabled)
}

func TestReviewCodexModelGovernanceRecordHandler(t *testing.T) {
	setupCodexModelGovernanceControllerDB(t)
	gin.SetMode(gin.TestMode)
	channel := model.Channel{
		Id:     11,
		Type:   constant.ChannelTypeCodex,
		Status: common.ChannelStatusEnabled,
		Name:   "codex",
		Models: "gpt-5.3-codex,gpt-5.5-codex",
		Group:  "default",
		Key:    `{"access_token":"token","account_id":"acct"}`,
	}
	require.NoError(t, model.DB.Create(&channel).Error)
	require.NoError(t, channel.AddAbilities(nil))
	record, err := model.UpsertCodexModelGovernancePending(model.CodexModelGovernancePendingInput{
		ModelName: "gpt-5.3-codex",
		Source:    model.CodexModelGovernanceSourceProbe,
	})
	require.NoError(t, err)

	router := gin.New()
	router.POST("/:id/review", func(c *gin.Context) {
		c.Set("id", 1001)
		ReviewCodexModelGovernanceRecord(c)
	})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/1/review", bytes.NewReader([]byte(`{"action":"confirm_remove","note":"checked"}`)))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"success":true`)
	updated, err := model.GetCodexModelGovernanceRecord(record.ID)
	require.NoError(t, err)
	require.Equal(t, model.CodexModelGovernanceStatusRemoved, updated.Status)
}
