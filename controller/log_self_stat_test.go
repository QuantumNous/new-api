package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// model.SumUsedQuota only adds its `username = ?` predicate when the name is
// non-empty. GetLogsSelfStat therefore has to require an authenticated
// username: an empty or whitespace-only one silently turns a personal
// statistic into a tenant-wide total.

func setupSelfStatTestDB(t *testing.T) {
	t.Helper()
	db := openTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}))
	initSelfStatLogs(t)
}

func initSelfStatLogs(t *testing.T) {
	t.Helper()
	logs := []model.Log{
		{UserId: 7, Username: "owner", CreatedAt: 1782835242, Type: model.LogTypeConsume, ModelName: "gpt-image-2", Quota: 100, PromptTokens: 3, CompletionTokens: 4},
		{UserId: 8, Username: "victim", CreatedAt: 1782835242, Type: model.LogTypeConsume, ModelName: "gpt-image-2", Quota: 90000, PromptTokens: 9, CompletionTokens: 9},
	}
	require.NoError(t, model.LOG_DB.Create(&logs).Error)
}

type selfStatResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Code    string `json:"code"`
	Data    struct {
		Quota int `json:"quota"`
		Rpm   int `json:"rpm"`
		Tpm   int `json:"tpm"`
	} `json:"data"`
}

func serveSelfStat(t *testing.T, username string, setUsername bool) (*httptest.ResponseRecorder, selfStatResponse) {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet,
		"/api/log/self/stat?type=2&start_timestamp=1782835242&end_timestamp=1785899265", nil)
	if setUsername {
		ctx.Set("username", username)
	}

	GetLogsSelfStat(ctx)

	var response selfStatResponse
	require.NoError(t, decodeInto(recorder, &response), recorder.Body.String())
	return recorder, response
}

func TestGetLogsSelfStatFailsClosedWithoutAnAuthenticatedUsername(t *testing.T) {
	identities := []struct {
		name        string
		username    string
		setUsername bool
	}{
		{name: "username_absent", setUsername: false},
		{name: "username_empty", username: "", setUsername: true},
		{name: "username_spaces", username: "   ", setUsername: true},
		{name: "username_tab", username: "\t", setUsername: true},
		{name: "username_newline", username: "\n", setUsername: true},
	}

	for _, identity := range identities {
		t.Run(identity.name, func(t *testing.T) {
			setupSelfStatTestDB(t)

			recorder, response := serveSelfStat(t, identity.username, identity.setUsername)

			assert.Equal(t, http.StatusUnauthorized, recorder.Code)
			assert.False(t, response.Success)
			assert.Equal(t, "unauthorized", response.Code)
			// The refusal happens before any query, so no total is produced and
			// in particular the other tenant's 90000 never appears.
			assert.Zero(t, response.Data.Quota)
			assert.Zero(t, response.Data.Rpm)
			assert.Zero(t, response.Data.Tpm)
			assert.NotContains(t, recorder.Body.String(), "90000")
			assert.NotContains(t, recorder.Body.String(), "90100")
		})
	}
}

func TestGetLogsSelfStatReturnsOnlyTheAuthenticatedUsersTotal(t *testing.T) {
	setupSelfStatTestDB(t)

	recorder, response := serveSelfStat(t, "owner", true)

	assert.Equal(t, http.StatusOK, recorder.Code)
	require.True(t, response.Success, response.Message)
	// Exactly the owner's 100, never the sum of both users.
	assert.Equal(t, 100, response.Data.Quota)
	assert.NotEqual(t, 90100, response.Data.Quota)
}

// A surrounding-whitespace username is trimmed rather than rejected, so a
// legitimate caller is unaffected by the guard.
func TestGetLogsSelfStatTrimsTheAuthenticatedUsername(t *testing.T) {
	setupSelfStatTestDB(t)

	recorder, response := serveSelfStat(t, "  owner  ", true)

	assert.Equal(t, http.StatusOK, recorder.Code)
	require.True(t, response.Success, response.Message)
	assert.Equal(t, 100, response.Data.Quota)
}

// The admin statistic deliberately treats an empty username as "all users" and
// must keep doing so.
func TestGetLogsStatAdminPathIsUnchanged(t *testing.T) {
	setupSelfStatTestDB(t)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet,
		"/api/log/stat?type=2&start_timestamp=1782835242&end_timestamp=1785899265", nil)

	GetLogsStat(ctx)

	var response selfStatResponse
	require.NoError(t, decodeInto(recorder, &response), recorder.Body.String())
	assert.Equal(t, http.StatusOK, recorder.Code)
	require.True(t, response.Success, response.Message)
	assert.Equal(t, 90100, response.Data.Quota, "the admin total still spans every user")

	// An explicit username still narrows the admin total.
	scopedRecorder := httptest.NewRecorder()
	scopedCtx, _ := gin.CreateTestContext(scopedRecorder)
	scopedCtx.Request = httptest.NewRequest(http.MethodGet,
		"/api/log/stat?type=2&username=owner&start_timestamp=1782835242&end_timestamp=1785899265", nil)
	GetLogsStat(scopedCtx)
	var scoped selfStatResponse
	require.NoError(t, decodeInto(scopedRecorder, &scoped), scopedRecorder.Body.String())
	assert.Equal(t, 100, scoped.Data.Quota)
}

func TestGetUserLogsFailsClosedWithoutAnAuthenticatedId(t *testing.T) {
	for _, identity := range []struct {
		name   string
		userId int
		set    bool
	}{
		{name: "id_absent", set: false},
		{name: "id_zero", userId: 0, set: true},
		{name: "id_negative", userId: -1, set: true},
	} {
		t.Run(identity.name, func(t *testing.T) {
			setupSelfStatTestDB(t)

			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodGet, "/api/log/self?p=1&page_size=10", nil)
			if identity.set {
				ctx.Set("id", identity.userId)
			}

			GetUserLogs(ctx)

			assert.Equal(t, http.StatusUnauthorized, recorder.Code)
			var response selfStatResponse
			require.NoError(t, decodeInto(recorder, &response))
			assert.False(t, response.Success)
			assert.Equal(t, "unauthorized", response.Code)
			assert.NotContains(t, recorder.Body.String(), "victim")
		})
	}
}
