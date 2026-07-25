package controller

import (
	"bytes"
	"encoding/csv"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestExportLogsCSVUsesSelfScopeAndEscapesSpreadsheetFormulas(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Log{}))

	originalLogDB := model.LOG_DB
	originalLogDatabaseType := common.LogDatabaseType()
	model.LOG_DB = db
	common.SetLogDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		model.LOG_DB = originalLogDB
		common.SetLogDatabaseType(originalLogDatabaseType)
	})

	require.NoError(t, db.Create(&[]model.Log{
		{
			UserId: 42, CreatedAt: 200, Type: model.LogTypeConsume, Username: "=root", TokenName: "prod",
			ModelName: "+danger", Group: "  @vip", Ip: "+127.0.0.1", RequestId: "=req-1",
			UpstreamRequestId: "up-1", Content: "@SUM(1,1)", Other: "-2+3", Quota: 50,
			PromptTokens: 3, CompletionTokens: 4, ChannelId: 9, TokenId: 11, IsStream: true,
		},
		{UserId: 99, CreatedAt: 200, Type: model.LogTypeConsume, Username: "other", ModelName: "+danger"},
		{UserId: 42, CreatedAt: 200, Type: model.LogTypeConsume, Username: "=root", ModelName: "other-model"},
	}).Error)

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(
		http.MethodGet,
		"/api/log/export?scope=self&model_name=%2Bdanger&model_name_mode=exact&username=other&channel=123",
		nil,
	)
	ctx.Set("id", 42)

	ExportLogsCSV(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "text/csv; charset=utf-8", recorder.Header().Get("Content-Type"))
	assert.Contains(t, recorder.Header().Get("Content-Disposition"), "usage-logs-")

	output := recorder.Body.Bytes()
	require.True(t, bytes.HasPrefix(output, []byte{0xef, 0xbb, 0xbf}))
	records, err := csv.NewReader(bytes.NewReader(output[3:])).ReadAll()
	require.NoError(t, err)
	require.Len(t, records, 2)
	require.Len(t, records[1], 21)
	assert.Equal(t, "'=root", records[1][4])
	assert.Equal(t, "'+danger", records[1][6])
	assert.Equal(t, "50", records[1][7])
	assert.Equal(t, "7", records[1][10])
	assert.Equal(t, "'  @vip", records[1][15])
	assert.Equal(t, "'+127.0.0.1", records[1][16])
	assert.Equal(t, "'=req-1", records[1][17])
	assert.Equal(t, "'@SUM(1,1)", records[1][19])
	assert.Equal(t, "'-2+3", records[1][20])
}

func TestSanitizeCSVTextLeavesOrdinaryTextUnchanged(t *testing.T) {
	assert.Equal(t, "model-name", sanitizeCSVText("model-name"))
	assert.Equal(t, "", sanitizeCSVText(""))
	assert.Equal(t, "'\t=command", sanitizeCSVText("\t=command"))
}
