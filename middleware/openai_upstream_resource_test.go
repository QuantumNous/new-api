package middleware

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func newBatchUploadRequest(t *testing.T, purpose string, jsonl string, purposeAfterFile bool) (*http.Request, []byte) {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	writePurpose := func() {
		require.NoError(t, writer.WriteField("purpose", purpose))
	}
	if !purposeAfterFile {
		writePurpose()
	}
	file, err := writer.CreateFormFile("file", "batch.jsonl")
	require.NoError(t, err)
	_, err = file.Write([]byte(jsonl))
	require.NoError(t, err)
	if purposeAfterFile {
		writePurpose()
	}
	require.NoError(t, writer.Close())

	rawBody := append([]byte(nil), body.Bytes()...)
	request := httptest.NewRequest(http.MethodPost, "/v1/files", bytes.NewReader(rawBody))
	request.Header.Set("Content-Type", writer.FormDataContentType())
	return request, rawBody
}

func TestExtractOpenAIBatchUploadModel(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name             string
		purpose          string
		jsonl            string
		purposeAfterFile bool
		wantModel        string
		wantError        string
	}{
		{
			name:             "extracts model when purpose follows file",
			purpose:          "batch",
			jsonl:            "\n  {\"custom_id\":\"image-1\",\"method\":\"POST\",\"url\":\"/v1/images/generations\",\"body\":{\"model\":\"gpt-image-2\",\"prompt\":\"test\"}}\n",
			purposeAfterFile: true,
			wantModel:        "gpt-image-2",
		},
		{
			name:      "rejects non batch purpose",
			purpose:   "assistants",
			jsonl:     "{\"custom_id\":\"image-1\",\"method\":\"POST\",\"url\":\"/v1/images/generations\",\"body\":{\"model\":\"gpt-image-2\"}}\n",
			wantError: "purpose must be batch",
		},
		{
			name:      "rejects malformed JSONL",
			purpose:   "batch",
			jsonl:     "{not-json}\n",
			wantError: "invalid batch input file",
		},
		{
			name:      "rejects missing model",
			purpose:   "batch",
			jsonl:     "{\"custom_id\":\"image-1\",\"method\":\"POST\",\"url\":\"/v1/images/generations\",\"body\":{\"prompt\":\"test\"}}\n",
			wantError: "model is required",
		},
		{
			name:    "rejects a different model in a later request",
			purpose: "batch",
			jsonl: "{\"custom_id\":\"first\",\"method\":\"POST\",\"url\":\"/v1/images/generations\",\"body\":{\"model\":\"gpt-image-2\"}}\n" +
				"{\"custom_id\":\"second\",\"method\":\"POST\",\"url\":\"/v1/images/generations\",\"body\":{\"model\":\"gpt-image-1\"}}\n",
			wantError: "same model",
		},
		{
			name:    "rejects malformed later request",
			purpose: "batch",
			jsonl: "{\"custom_id\":\"first\",\"method\":\"POST\",\"url\":\"/v1/images/generations\",\"body\":{\"model\":\"gpt-image-2\"}}\n" +
				"{not-json}\n",
			wantError: "line 2",
		},
		{
			name:      "rejects unsupported endpoint",
			purpose:   "batch",
			jsonl:     "{\"custom_id\":\"first\",\"method\":\"POST\",\"url\":\"/v1/unknown\",\"body\":{\"model\":\"gpt-image-2\"}}\n",
			wantError: "unsupported batch endpoint",
		},
		{
			name:    "rejects duplicate custom ids",
			purpose: "batch",
			jsonl: "{\"custom_id\":\"same\",\"method\":\"POST\",\"url\":\"/v1/images/generations\",\"body\":{\"model\":\"gpt-image-2\"}}\n" +
				"{\"custom_id\":\"same\",\"method\":\"POST\",\"url\":\"/v1/images/generations\",\"body\":{\"model\":\"gpt-image-2\"}}\n",
			wantError: "custom_id must be unique",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			context, _ := gin.CreateTestContext(httptest.NewRecorder())
			request, rawBody := newBatchUploadRequest(t, test.purpose, test.jsonl, test.purposeAfterFile)
			context.Request = request

			got, err := extractOpenAIBatchUploadModel(context)
			if test.wantError != "" {
				require.ErrorContains(t, err, test.wantError)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, test.wantModel, got)

			bodyAfter, err := common.GetBodyStorage(context)
			require.NoError(t, err)
			bodyReader, err := bodyAfter.NewReader()
			require.NoError(t, err)
			defer bodyReader.Close()
			forwardedBody, err := io.ReadAll(bodyReader)
			require.NoError(t, err)
			assert.Equal(t, rawBody, forwardedBody)
		})
	}
}

func TestExtractOpenAIBatchUploadModelRejectsDuplicateFileParts(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("purpose", "batch"))
	for index, modelName := range []string{"gpt-image-2", "gpt-image-1"} {
		file, err := writer.CreateFormFile("file", fmt.Sprintf("batch-%d.jsonl", index))
		require.NoError(t, err)
		_, err = fmt.Fprintf(file, `{"custom_id":"image-%d","method":"POST","url":"/v1/images/generations","body":{"model":"%s"}}`+"\n", index, modelName)
		require.NoError(t, err)
	}
	require.NoError(t, writer.Close())

	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = httptest.NewRequest(http.MethodPost, "/v1/files", bytes.NewReader(body.Bytes()))
	context.Request.Header.Set("Content-Type", writer.FormDataContentType())

	_, err := extractOpenAIBatchUploadModel(context)
	require.ErrorContains(t, err, "duplicate file")
}

func TestExtractOpenAIBatchUploadModelRejectsDuplicatePurposeParts(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("purpose", "batch"))
	require.NoError(t, writer.WriteField("purpose", "batch"))
	file, err := writer.CreateFormFile("file", "batch.jsonl")
	require.NoError(t, err)
	_, err = io.WriteString(file, `{"custom_id":"image-1","method":"POST","url":"/v1/images/generations","body":{"model":"gpt-image-2"}}`+"\n")
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = httptest.NewRequest(http.MethodPost, "/v1/files", bytes.NewReader(body.Bytes()))
	context.Request.Header.Set("Content-Type", writer.FormDataContentType())

	_, err = extractOpenAIBatchUploadModel(context)
	require.ErrorContains(t, err, "duplicate purpose")
}

func TestExtractOpenAIBatchUploadModelRejectsMoreThanFiftyThousandRequests(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var jsonl strings.Builder
	for index := 0; index <= 50_000; index++ {
		_, err := fmt.Fprintf(&jsonl, `{"custom_id":"image-%d","method":"POST","url":"/v1/images/generations","body":{"model":"gpt-image-2"}}`+"\n", index)
		require.NoError(t, err)
	}

	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	request, _ := newBatchUploadRequest(t, "batch", jsonl.String(), false)
	context.Request = request

	_, err := extractOpenAIBatchUploadModel(context)
	require.ErrorContains(t, err, "must not exceed 50000 requests")
}

func setupOpenAIUpstreamResourceMiddlewareTest(t *testing.T) {
	t.Helper()
	previousDB := model.DB
	previousType := common.MainDatabaseType()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.OpenAIUpstreamResource{}))
	model.DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{"openai_batch_setting.enabled": "true"}))
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousType)
		_ = config.GlobalConfig.LoadFromDB(map[string]string{"openai_batch_setting.enabled": "false"})
	})
}

type readCountingBody struct {
	reads int
}

func (body *readCountingBody) Read(_ []byte) (int, error) {
	body.reads++
	return 0, io.EOF
}

func (body *readCountingBody) Close() error {
	return nil
}

func TestPrepareOpenAIUpstreamResourceIsDisabledByDefaultAndDoesNotReadBody(t *testing.T) {
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{"openai_batch_setting.enabled": "false"}))
	body := &readCountingBody{}
	handled := false
	router := gin.New()
	router.POST("/v1/files", PrepareOpenAIUpstreamResource(), func(c *gin.Context) {
		handled = true
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodPost, "/v1/files", body)
	request.Header.Set("Content-Type", "multipart/form-data; boundary=test")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	assert.Equal(t, http.StatusNotFound, response.Code)
	assert.False(t, handled)
	assert.Zero(t, body.reads)
}

func TestPrepareOpenAIUpstreamResourceReusesInputFileChannel(t *testing.T) {
	setupOpenAIUpstreamResourceMiddlewareTest(t)
	baseURL := "https://upstream.example"
	channel := &model.Channel{
		Id:      71,
		Type:    constant.ChannelTypeOpenAI,
		Key:     "sk-test",
		Status:  common.ChannelStatusEnabled,
		BaseURL: &baseURL,
	}
	channel.SetOtherSettings(dto.ChannelOtherSettings{NativeOpenAIBatch: true})
	require.NoError(t, model.DB.Create(channel).Error)
	require.NoError(t, model.SaveOpenAIUpstreamResources([]model.OpenAIUpstreamResource{{
		UserId:       101,
		ChannelId:    channel.Id,
		ResourceType: model.OpenAIUpstreamResourceTypeFile,
		ResourceId:   "file_input",
		Model:        "gpt-image-2",
	}}))

	router := gin.New()
	router.POST("/v1/batches", func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyUserId, 101)
		common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
	}, PrepareOpenAIUpstreamResource(), Distribute(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"channel_id": c.GetInt(string(constant.ContextKeyChannelId)),
			"model":      c.GetString(string(constant.ContextKeyOriginalModel)),
		})
	})

	requestBody := []byte(`{"input_file_id":"file_input","endpoint":"/v1/images/generations","completion_window":"24h"}`)
	request := httptest.NewRequest(http.MethodPost, "/v1/batches", bytes.NewReader(requestBody))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	var got struct {
		ChannelId int    `json:"channel_id"`
		Model     string `json:"model"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &got))
	assert.Equal(t, channel.Id, got.ChannelId)
	assert.Equal(t, "gpt-image-2", got.Model)
}

func TestPrepareOpenAIUpstreamResourceDoesNotExposeAnotherUsersFile(t *testing.T) {
	setupOpenAIUpstreamResourceMiddlewareTest(t)
	require.NoError(t, model.SaveOpenAIUpstreamResources([]model.OpenAIUpstreamResource{{
		UserId:       101,
		ChannelId:    71,
		ResourceType: model.OpenAIUpstreamResourceTypeFile,
		ResourceId:   "file_private",
		Model:        "gpt-image-2",
	}}))

	handled := false
	router := gin.New()
	router.POST("/v1/batches", func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyUserId, 202)
	}, PrepareOpenAIUpstreamResource(), func(c *gin.Context) {
		handled = true
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodPost, "/v1/batches", bytes.NewBufferString(`{"input_file_id":"file_private"}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	assert.Equal(t, http.StatusNotFound, response.Code)
	assert.False(t, handled)
}

func TestPrepareOpenAIUpstreamResourcePinsTheCreatingMultiKey(t *testing.T) {
	setupOpenAIUpstreamResourceMiddlewareTest(t)
	baseURL := "https://upstream.example"
	channel := &model.Channel{
		Id:      72,
		Type:    constant.ChannelTypeOpenAI,
		Key:     "key-a\nkey-b",
		Status:  common.ChannelStatusEnabled,
		BaseURL: &baseURL,
		ChannelInfo: model.ChannelInfo{
			IsMultiKey:   true,
			MultiKeySize: 2,
		},
	}
	channel.SetOtherSettings(dto.ChannelOtherSettings{NativeOpenAIBatch: true})
	require.NoError(t, model.DB.Create(channel).Error)
	require.NoError(t, model.SaveOpenAIUpstreamResources([]model.OpenAIUpstreamResource{{
		UserId:                101,
		ChannelId:             channel.Id,
		ChannelKeyIndex:       1,
		ChannelKeyFingerprint: model.ChannelKeyFingerprint("key-b"),
		ResourceType:          model.OpenAIUpstreamResourceTypeFile,
		ResourceId:            "file_key_b",
		Model:                 "gpt-image-2",
	}}))

	for range 2 {
		router := gin.New()
		router.POST("/v1/batches", func(c *gin.Context) {
			common.SetContextKey(c, constant.ContextKeyUserId, 101)
			common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
		}, PrepareOpenAIUpstreamResource(), Distribute(), func(c *gin.Context) {
			assert.Equal(t, "key-b", common.GetContextKeyString(c, constant.ContextKeyChannelKey))
			assert.Equal(t, 1, common.GetContextKeyInt(c, constant.ContextKeyChannelMultiKeyIndex))
			c.Status(http.StatusNoContent)
		})
		request := httptest.NewRequest(http.MethodPost, "/v1/batches", bytes.NewBufferString(`{"input_file_id":"file_key_b"}`))
		request.Header.Set("Content-Type", "application/json")
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		require.Equal(t, http.StatusNoContent, response.Code, response.Body.String())
	}
}

func TestPrepareOpenAIUpstreamResourceRejectsMissingPinnedKey(t *testing.T) {
	setupOpenAIUpstreamResourceMiddlewareTest(t)
	baseURL := "https://upstream.example"
	channel := &model.Channel{
		Id:      73,
		Type:    constant.ChannelTypeOpenAI,
		Key:     "current-key",
		Status:  common.ChannelStatusEnabled,
		BaseURL: &baseURL,
	}
	channel.SetOtherSettings(dto.ChannelOtherSettings{NativeOpenAIBatch: true})
	require.NoError(t, model.DB.Create(channel).Error)
	require.NoError(t, model.SaveOpenAIUpstreamResources([]model.OpenAIUpstreamResource{{
		UserId:                101,
		ChannelId:             channel.Id,
		ChannelKeyFingerprint: model.ChannelKeyFingerprint("removed-key"),
		ResourceType:          model.OpenAIUpstreamResourceTypeBatch,
		ResourceId:            "batch_removed_key",
		Model:                 "gpt-image-2",
	}}))

	handled := false
	router := gin.New()
	router.GET("/v1/batches/:id", func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyUserId, 101)
		common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
	}, PrepareOpenAIUpstreamResource(), Distribute(), func(c *gin.Context) {
		handled = true
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodGet, "/v1/batches/batch_removed_key", nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	assert.Equal(t, http.StatusServiceUnavailable, response.Code)
	assert.False(t, handled)
}

func TestChannelSupportsRequestPathRequiresNativeBatchOptIn(t *testing.T) {
	channel := &model.Channel{Type: constant.ChannelTypeOpenAI}

	assert.False(t, channelSupportsRequestPath(channel, "/v1/files", "gpt-image-2"))
	assert.True(t, channelSupportsRequestPath(channel, "/v1/chat/completions", "gpt-image-2"))

	channel.SetOtherSettings(dto.ChannelOtherSettings{NativeOpenAIBatch: true})
	assert.True(t, channelSupportsRequestPath(channel, "/v1/files", "gpt-image-2"))
	assert.True(t, channelSupportsRequestPath(channel, "/v1/batches/batch_123", "gpt-image-2"))

	channel.Type = constant.ChannelTypeAzure
	assert.False(t, channelSupportsRequestPath(channel, "/v1/files", "gpt-image-2"))
}
