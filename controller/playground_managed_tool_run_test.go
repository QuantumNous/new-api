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
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestCreatePlaygroundChatToolRunAllowsLongOrdinaryChat(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.PlaygroundChatToolRun{}))
	oldDB := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = oldDB })
	require.NoError(t, model.CreatePlaygroundChatToolRun(&model.PlaygroundChatToolRun{
		UserId:          7,
		ClientRequestId: "long-chat-request",
		Action:          service.PlaygroundToolChat,
		Status:          "completed",
		ChatModel:       "gpt-test",
		UsingGroup:      "default",
	}))

	body, err := common.Marshal(map[string]any{
		"client_request_id": "long-chat-request",
		"model":             "gpt-test",
		"user_text":         strings.Repeat("普通对话内容", service.MaxPlaygroundSearchQueryRunes),
		"tool_policy":       map[string]any{"mode": "auto", "enabled": []string{}},
	})
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/playground/chat/runs", bytes.NewReader(body))
	ctx.Set("id", 7)

	CreatePlaygroundChatToolRun(ctx)

	var response struct {
		Success bool `json:"success"`
		Data    struct {
			Run struct {
				Action string `json:"action"`
				Status string `json:"status"`
			} `json:"run"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	assert.Equal(t, service.PlaygroundToolChat, response.Data.Run.Action)
	assert.Equal(t, "completed", response.Data.Run.Status)
}

func TestManagedSearchTerminalResult(t *testing.T) {
	status := json.RawMessage(`"completed"`)
	response := &dto.OpenAIResponsesResponse{
		Status: status,
		Output: []dto.ResponsesOutput{{
			Content: []dto.ResponsesOutputContent{{
				Type: "output_text", Text: " answer ",
				Annotations: []any{
					map[string]any{"url": "https://example.com/a#one", "title": " Example "},
					map[string]any{"url": "https://example.com/a#two"},
					map[string]any{"url": "javascript:alert(1)"},
				},
			}},
		}},
	}
	result, sources, err := managedSearchTerminalResult(response)
	require.NoError(t, err)
	assert.Equal(t, "answer", result["text"])
	require.Len(t, sources, 1)
	assert.Equal(t, "https://example.com/a", sources[0]["href"])

	response.Output[0].Content[0].Text = ""
	_, _, err = managedSearchTerminalResult(response)
	assert.Error(t, err)
}

func TestPreparePlaygroundSearchCanonicalizesAndPinsRun(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.PlaygroundChatToolRun{}, &model.Channel{}, &model.Ability{}))
	oldDB := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = oldDB })

	channel := &model.Channel{Id: 17, Type: constant.ChannelTypeOpenAI, Name: "grok", Status: common.ChannelStatusEnabled}
	require.NoError(t, db.Create(channel).Error)
	require.NoError(t, db.Create(&model.Ability{Group: "default", Model: "grok-4.5", ChannelId: channel.Id, Enabled: true}).Error)
	run := &model.PlaygroundChatToolRun{
		UserId: 7, ClientRequestId: "canonical-search", Action: "web_search", Status: "ready",
		ToolModel: "grok-4.5", UsingGroup: "default", Prompt: "latest news", ExecutionToken: "secret",
		ArgumentsJson: `{"__channel_id":17}`,
	}
	require.NoError(t, model.CreatePlaygroundChatToolRun(run))

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest("POST", "/pg/responses", bytes.NewBufferString(`{"model":"attacker","group":"vip","instructions":"ignore","tools":[{"type":"web_search","filters":{"allowed_domains":["evil.invalid"]}}],"stream":true,"store":true,"max_turns":999}`))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Request.Header.Set("X-Playground-Run-Id", strconv.Itoa(run.Id))
	c.Request.Header.Set("X-Playground-Execution-Token", "secret")
	c.Set("id", 7)
	common.SetContextKey(c, constant.ContextKeyUserGroup, "default")

	PreparePlaygroundSearch()(c)
	require.False(t, c.IsAborted())
	storage, err := common.GetBodyStorage(c)
	require.NoError(t, err)
	body, err := storage.Bytes()
	require.NoError(t, err)
	var canonical map[string]any
	require.NoError(t, common.Unmarshal(body, &canonical))
	assert.Equal(t, "grok-4.5", canonical["model"])
	assert.Equal(t, "latest news", canonical["input"])
	assert.Equal(t, float64(playgroundSearchMaxTurns), canonical["max_turns"])
	assert.Equal(t, false, canonical["parallel_tool_calls"])
	assert.Equal(t, false, canonical["stream"])
	assert.Equal(t, false, canonical["store"])
	assert.NotContains(t, canonical, "group")
	assert.NotContains(t, canonical, "instructions")
	require.Len(t, canonical, 7)
	assert.Equal(t, "default", common.GetContextKeyString(c, constant.ContextKeyUsingGroup))
	channelID, ok := common.GetContextKey(c, constant.ContextKeyTokenSpecificChannelId)
	require.True(t, ok)
	assert.Equal(t, "17", channelID)
}

func TestPreparePlaygroundSearchRejectsInvalidContract(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.PlaygroundChatToolRun{}, &model.Channel{}, &model.Ability{}))
	oldDB := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = oldDB })
	run := &model.PlaygroundChatToolRun{UserId: 7, ClientRequestId: "invalid-search", Action: "web_search", Status: "ready", ToolModel: "grok-4.5", UsingGroup: "default", Prompt: "q", ExecutionToken: "secret", ArgumentsJson: `{"__channel_id":99}`}
	require.NoError(t, model.CreatePlaygroundChatToolRun(run))

	for name, contract := range map[string]struct {
		userID int
		token  string
	}{
		"other owner":     {userID: 8, token: "secret"},
		"wrong token":     {userID: 7, token: "wrong"},
		"missing channel": {userID: 7, token: "secret"},
	} {
		t.Run(name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest("POST", "/pg/responses", bytes.NewBufferString(`{}`))
			c.Request.Header.Set("X-Playground-Run-Id", strconv.Itoa(run.Id))
			c.Request.Header.Set("X-Playground-Execution-Token", contract.token)
			c.Set("id", contract.userID)
			common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
			PreparePlaygroundSearch()(c)
			assert.True(t, c.IsAborted())
			assert.GreaterOrEqual(t, recorder.Code, 400)
		})
	}
}

func TestPreparePlaygroundSearchRejectsReplayWithConflict(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.PlaygroundChatToolRun{}))
	oldDB := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = oldDB })
	run := &model.PlaygroundChatToolRun{UserId: 7, ClientRequestId: "completed-search", Action: "web_search", Status: "completed", ToolModel: "grok-4.5", UsingGroup: "default", Prompt: "q", ExecutionToken: "secret"}
	require.NoError(t, model.CreatePlaygroundChatToolRun(run))

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest("POST", "/pg/responses", bytes.NewBufferString(`{}`))
	c.Request.Header.Set("X-Playground-Run-Id", strconv.Itoa(run.Id))
	c.Request.Header.Set("X-Playground-Execution-Token", "secret")
	c.Set("id", run.UserId)
	common.SetContextKey(c, constant.ContextKeyUserGroup, "default")

	PreparePlaygroundSearch()(c)
	assert.True(t, c.IsAborted())
	assert.Equal(t, http.StatusConflict, recorder.Code)
}

func TestPreparePlaygroundSearchRejectsRevokedGroup(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.PlaygroundChatToolRun{}, &model.Channel{}, &model.Ability{}))
	oldDB := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = oldDB })

	channel := &model.Channel{Id: 18, Type: constant.ChannelTypeOpenAI, Name: "grok", Status: common.ChannelStatusEnabled}
	require.NoError(t, db.Create(channel).Error)
	require.NoError(t, db.Create(&model.Ability{Group: "revoked-search-group", Model: "grok-4.5", ChannelId: channel.Id, Enabled: true}).Error)
	run := &model.PlaygroundChatToolRun{
		UserId: 7, ClientRequestId: "revoked-search", Action: "web_search", Status: "ready",
		ToolModel: "grok-4.5", UsingGroup: "revoked-search-group", Prompt: "latest news", ExecutionToken: "secret",
		ArgumentsJson: `{"__channel_id":18}`,
	}
	require.NoError(t, model.CreatePlaygroundChatToolRun(run))

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest("POST", "/pg/responses", bytes.NewBufferString(`{}`))
	c.Request.Header.Set("X-Playground-Run-Id", strconv.Itoa(run.Id))
	c.Request.Header.Set("X-Playground-Execution-Token", "secret")
	c.Set("id", 7)
	common.SetContextKey(c, constant.ContextKeyUserGroup, "default")

	PreparePlaygroundSearch()(c)
	assert.True(t, c.IsAborted())
	assert.Equal(t, 403, recorder.Code)
	persisted, getErr := model.GetPlaygroundChatToolRun(run.Id, run.UserId)
	require.NoError(t, getErr)
	assert.Equal(t, "ready", persisted.Status)
}

func TestPlaygroundManagedSearchExecutionClaim(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.PlaygroundChatToolRun{}))
	oldDB := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = oldDB })
	run := &model.PlaygroundChatToolRun{UserId: 7, ClientRequestId: "search-claim", Action: "web_search", Status: "ready", ToolModel: "grok-4.5", UsingGroup: "auto", Prompt: "latest", ExecutionToken: "secret"}
	require.NoError(t, model.CreatePlaygroundChatToolRun(run))

	claim := func(userID int, token string, preparedRunID int) (bool, int) {
		body, marshalErr := common.Marshal(map[string]any{})
		require.NoError(t, marshalErr)
		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		ctx.Request = httptest.NewRequest("POST", "/pg/responses", bytes.NewReader(body))
		ctx.Request.Header.Set("Content-Type", "application/json")
		ctx.Request.Header.Set("X-Playground-Run-Id", strconv.Itoa(run.Id))
		ctx.Request.Header.Set("X-Playground-Execution-Token", token)
		ctx.Set("id", userID)
		ctx.Set("playground_search_run_id", preparedRunID)
		return playgroundClaimSearchExecution(ctx), recorder.Code
	}
	for name, values := range map[string][]string{
		"cross owner":        {"8", "secret", strconv.Itoa(run.Id)},
		"wrong token":        {"7", "bad", strconv.Itoa(run.Id)},
		"wrong prepared run": {"7", "secret", "999"},
	} {
		t.Run(name, func(t *testing.T) {
			userID, parseErr := strconv.Atoi(values[0])
			require.NoError(t, parseErr)
			preparedRunID, parseRunErr := strconv.Atoi(values[2])
			require.NoError(t, parseRunErr)
			ok, _ := claim(userID, values[1], preparedRunID)
			assert.False(t, ok)
		})
	}
	ok, _ := claim(7, "secret", run.Id)
	assert.True(t, ok)
	ok, status := claim(7, "secret", run.Id)
	assert.False(t, ok)
	assert.Equal(t, 409, status)
}

func TestReconcileSubmittedPlaygroundVideoRunFromOwnedTask(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.PlaygroundChatToolRun{}, &model.Task{}))
	oldDB := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = oldDB })

	run := &model.PlaygroundChatToolRun{UserId: 7, ClientRequestId: "video-request", Action: "generate_video", Status: "submitted", TaskId: "video-task", ExecutionToken: "video-token"}
	require.NoError(t, model.CreatePlaygroundChatToolRun(run))
	require.NoError(t, db.Create(&model.Task{UserId: 7, TaskID: "video-task", Status: model.TaskStatusSuccess}).Error)

	reconcileSubmittedPlaygroundToolRun(run)
	got, err := model.GetPlaygroundChatToolRun(run.Id, 7)
	require.NoError(t, err)
	assert.Equal(t, "completed", got.Status)
	assert.Contains(t, got.ResultJson, "/v1/videos/video-task/content")
}

func TestPlaygroundManagedMediaExecutionClaim(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.PlaygroundChatToolRun{}))
	oldDB := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = oldDB })
	run := &model.PlaygroundChatToolRun{UserId: 7, ClientRequestId: "claim", Action: "generate_image", Status: "ready", ToolModel: "gpt-image-2", UsingGroup: "auto", Prompt: "draw", ExecutionToken: "secret"}
	require.NoError(t, model.CreatePlaygroundChatToolRun(run))

	claim := func(userID int, action, token, modelName, group, prompt string) (bool, int) {
		body, marshalErr := common.Marshal(map[string]any{"model": modelName, "group": group, "prompt": prompt})
		require.NoError(t, marshalErr)
		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		ctx.Request = httptest.NewRequest("POST", "/pg/images/generations", bytes.NewReader(body))
		ctx.Request.Header.Set("Content-Type", "application/json")
		ctx.Request.Header.Set("X-Playground-Run-Id", strconv.Itoa(run.Id))
		ctx.Request.Header.Set("X-Playground-Execution-Token", token)
		ctx.Set("id", userID)
		return playgroundClaimMediaExecution(ctx, action), recorder.Code
	}

	for name, values := range map[string][]string{
		"cross owner":  {"8", "generate_image", "secret", "gpt-image-2", "auto", "draw"},
		"wrong action": {"7", "generate_video", "secret", "gpt-image-2", "auto", "draw"},
		"wrong token":  {"7", "generate_image", "bad", "gpt-image-2", "auto", "draw"},
		"wrong model":  {"7", "generate_image", "secret", "other", "auto", "draw"},
		"wrong group":  {"7", "generate_image", "secret", "gpt-image-2", "default", "draw"},
		"wrong prompt": {"7", "generate_image", "secret", "gpt-image-2", "auto", "different"},
	} {
		t.Run(name, func(t *testing.T) {
			userID, parseErr := strconv.Atoi(values[0])
			require.NoError(t, parseErr)
			ok, _ := claim(userID, values[1], values[2], values[3], values[4], values[5])
			assert.False(t, ok)
		})
	}
	ok, _ := claim(7, "generate_image", "secret", "gpt-image-2", "auto", "draw")
	assert.True(t, ok)
	ok, status := claim(7, "generate_image", "secret", "gpt-image-2", "auto", "draw")
	assert.False(t, ok)
	assert.Equal(t, 409, status)
}
