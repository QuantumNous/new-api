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
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

const (
	playgroundRecordID       = "550e8400-e29b-41d4-a716-446655440000"
	playgroundConversationID = "550e8400-e29b-41d4-a716-446655440001"
)

func setupPlaygroundControllerDB(t *testing.T, userIDs ...int) {
	t.Helper()

	previous := model.DB
	db, err := gorm.Open(
		sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"),
		&gorm.Config{},
	)
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.PlaygroundRecord{}))
	model.DB = db
	t.Cleanup(func() {
		model.DB = previous
	})

	for _, userID := range userIDs {
		require.NoError(t, db.Create(&model.User{
			Id:       userID,
			Username: fmt.Sprintf("playground-controller-%d", userID),
			AffCode:  fmt.Sprintf("playground-controller-aff-%d", userID),
		}).Error)
	}
}

func playgroundRecordTestContext(t *testing.T, userID int, method, body string) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(method, "/api/playground/records", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("id", userID)
	return c, recorder
}

func validPlaygroundRecordBody() string {
	return `{
		"record_id":"550e8400-e29b-41d4-a716-446655440000",
		"conversation_id":"550e8400-e29b-41d4-a716-446655440001",
		"user_message":{"key":"u","from":"user","versions":[{"id":"uv","content":"hello"}]},
		"request_messages":[{"role":"user","content":"hello"}],
		"assistant_message":{"key":"a","from":"assistant","versions":[{"id":"av","content":"world"}],"status":"complete"},
		"reasoning_content":"thinking",
		"input_text":"hello",
		"output_text":"world",
		"model_name":"gpt-test",
		"group_name":"plg",
		"parameters":{"temperature":0.7},
		"status":"complete",
		"error_code":"",
		"error_message":"",
		"relay_request_id":"request-1",
		"prompt_tokens":2,
		"completion_tokens":3,
		"total_tokens":5,
		"latency_ms":120,
		"messages_snapshot":[{"key":"u","from":"user","versions":[{"id":"uv","content":"hello"}]},{"key":"a","from":"assistant","versions":[{"id":"av","content":"world"}],"status":"complete"}],
		"client_completed_at":1000
	}`
}

func TestSavePlaygroundRecordPersistsAuthenticatedUser(t *testing.T) {
	setupPlaygroundControllerDB(t, 201, 202)
	body := strings.Replace(validPlaygroundRecordBody(), "{", `{"user_id":202,`, 1)
	c, recorder := playgroundRecordTestContext(t, 201, http.MethodPost, body)

	SavePlaygroundRecord(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.JSONEq(t, `{"success":true,"message":"","data":null}`, recorder.Body.String())
	var stored model.PlaygroundRecord
	require.NoError(t, model.DB.Where("record_id = ?", playgroundRecordID).First(&stored).Error)
	require.Equal(t, 201, stored.UserID)
	require.Equal(t, "world", string(stored.OutputText))
	require.Equal(t, 5, stored.TotalTokens)
}

func TestSavePlaygroundRecordRejectsBase64Media(t *testing.T) {
	setupPlaygroundControllerDB(t, 203)
	body := strings.Replace(
		validPlaygroundRecordBody(),
		`"content":"hello"`,
		`"content":[{"type":"image_url","image_url":{"url":"data:image/png;base64,AAAA"}}]`,
		1,
	)
	c, recorder := playgroundRecordTestContext(t, 203, http.MethodPost, body)

	SavePlaygroundRecord(c)

	require.Equal(t, http.StatusBadRequest, recorder.Code)
	var count int64
	require.NoError(t, model.DB.Model(&model.PlaygroundRecord{}).Count(&count).Error)
	require.Zero(t, count)
}

func TestSavePlaygroundRecordAcceptsURLMedia(t *testing.T) {
	setupPlaygroundControllerDB(t, 204)
	body := strings.Replace(
		validPlaygroundRecordBody(),
		`"content":"hello"`,
		`"content":[{"type":"text","text":"hello"},{"type":"image_url","image_url":{"url":"https://example.com/image.png"}}]`,
		1,
	)
	c, recorder := playgroundRecordTestContext(t, 204, http.MethodPost, body)

	SavePlaygroundRecord(c)

	require.Equal(t, http.StatusOK, recorder.Code)
}

func TestSavePlaygroundRecordRejectsInvalidIdentityAndStatus(t *testing.T) {
	setupPlaygroundControllerDB(t, 205)
	tests := []struct {
		name string
		body string
	}{
		{
			name: "record uuid",
			body: strings.Replace(validPlaygroundRecordBody(), playgroundRecordID, "not-a-uuid", 1),
		},
		{
			name: "conversation uuid",
			body: strings.Replace(validPlaygroundRecordBody(), playgroundConversationID, "not-a-uuid", 1),
		},
		{
			name: "status",
			body: strings.Replace(
				validPlaygroundRecordBody(),
				"\n\t\t\"status\":\"complete\",\n\t\t\"error_code\"",
				"\n\t\t\"status\":\"cleared\",\n\t\t\"error_code\"",
				1,
			),
		},
		{
			name: "completion time",
			body: strings.Replace(validPlaygroundRecordBody(), `"client_completed_at":1000`, `"client_completed_at":0`, 1),
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			c, recorder := playgroundRecordTestContext(t, 205, http.MethodPost, test.body)
			SavePlaygroundRecord(c)
			require.Equal(t, http.StatusBadRequest, recorder.Code)
		})
	}
}

func TestSavePlaygroundRecordRejectsExcessiveJSONDepth(t *testing.T) {
	setupPlaygroundControllerDB(t, 206)
	nested := any("leaf")
	for range 33 {
		nested = map[string]any{"nested": nested}
	}
	parameters, err := common.Marshal(nested)
	require.NoError(t, err)
	body := strings.Replace(
		validPlaygroundRecordBody(),
		`{"temperature":0.7}`,
		string(parameters),
		1,
	)
	c, recorder := playgroundRecordTestContext(t, 206, http.MethodPost, body)

	SavePlaygroundRecord(c)

	require.Equal(t, http.StatusBadRequest, recorder.Code)
}

func TestSavePlaygroundRecordRejectsOversizedBody(t *testing.T) {
	setupPlaygroundControllerDB(t, 207)
	body := strings.Replace(
		validPlaygroundRecordBody(),
		`"error_message":""`,
		`"error_message":"`+strings.Repeat("x", (16<<20)+1)+`"`,
		1,
	)
	c, recorder := playgroundRecordTestContext(t, 207, http.MethodPost, body)

	SavePlaygroundRecord(c)

	require.Equal(t, http.StatusBadRequest, recorder.Code)
}

func TestGetCurrentPlaygroundRecordUsesAuthenticatedUser(t *testing.T) {
	setupPlaygroundControllerDB(t, 208, 209)
	record := &model.PlaygroundRecord{
		UserID:            208,
		RecordID:          playgroundRecordID,
		RecordType:        model.PlaygroundRecordTypeTurn,
		ConversationID:    playgroundConversationID,
		Status:            model.PlaygroundStatusComplete,
		MessagesSnapshot:  `[{"key":"owned-by-208"}]`,
		ClientCompletedAt: 1000,
	}
	require.NoError(t, model.SavePlaygroundRecord(record))
	c, recorder := playgroundRecordTestContext(t, 209, http.MethodGet, "")

	GetCurrentPlaygroundRecord(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.JSONEq(t, `{"success":true,"message":"","data":null}`, recorder.Body.String())
}

func TestClearPlaygroundRecordRemovesCurrentAndKeepsHistory(t *testing.T) {
	setupPlaygroundControllerDB(t, 210)
	record := &model.PlaygroundRecord{
		UserID:            210,
		RecordID:          playgroundRecordID,
		RecordType:        model.PlaygroundRecordTypeTurn,
		ConversationID:    playgroundConversationID,
		Status:            model.PlaygroundStatusComplete,
		OutputText:        "durable output",
		MessagesSnapshot:  `[{"key":"durable"}]`,
		ClientCompletedAt: 1000,
	}
	require.NoError(t, model.SavePlaygroundRecord(record))
	clearBody := `{"record_id":"550e8400-e29b-41d4-a716-446655440002","conversation_id":"550e8400-e29b-41d4-a716-446655440001","client_completed_at":2000}`
	c, recorder := playgroundRecordTestContext(t, 210, http.MethodPost, clearBody)

	ClearPlaygroundRecord(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	current, err := model.GetCurrentPlaygroundRecord(210)
	require.NoError(t, err)
	require.Nil(t, current)
	var stored model.PlaygroundRecord
	require.NoError(t, model.DB.Where("user_id = ? AND record_id = ?", 210, playgroundRecordID).First(&stored).Error)
	require.Equal(t, "durable output", string(stored.OutputText))
	require.NotEmpty(t, stored.MessagesSnapshot)
}
