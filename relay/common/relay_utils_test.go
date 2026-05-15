package common

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"golang.org/x/text/encoding/simplifiedchinese"
)

func TestValidateBasicTaskRequestDecodesGB18030JSONPrompt(t *testing.T) {
	gin.SetMode(gin.TestMode)
	body := `{"model":"doubao-seedance-2.0","prompt":"小猫在城市上空急速飞行","duration":5,"width":1280,"height":720}`
	encodedBody, err := simplifiedchinese.GB18030.NewEncoder().Bytes([]byte(body))
	require.NoError(t, err)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/video/generations", bytes.NewReader(encodedBody))
	ctx.Request.Header.Set("Content-Type", "application/json")

	info := &RelayInfo{TaskRelayInfo: &TaskRelayInfo{}}
	taskErr := ValidateBasicTaskRequest(ctx, info, constant.TaskActionGenerate)
	require.Nil(t, taskErr)

	req, err := GetTaskRequest(ctx)
	require.NoError(t, err)
	require.Equal(t, "小猫在城市上空急速飞行", req.Prompt)
	require.Equal(t, "doubao-seedance-2.0", req.Model)
	require.Equal(t, 5, req.Duration)
	require.Equal(t, 1280, req.Width)
	require.Equal(t, 720, req.Height)
}

func TestValidateBasicTaskRequestAcceptsImageObjects(t *testing.T) {
	gin.SetMode(gin.TestMode)
	body := `{
		"model":"doubao-seedance-2.0",
		"prompt":"hello",
		"images":[
			{"url":"https://example.com/first.jpeg","role":"first_frame"},
			{"image_url":{"url":"https://example.com/last.jpeg"},"role":"last_frame"}
		],
		"duration":5
	}`

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/video/generations", bytes.NewReader([]byte(body)))
	ctx.Request.Header.Set("Content-Type", "application/json")

	info := &RelayInfo{TaskRelayInfo: &TaskRelayInfo{}}
	taskErr := ValidateBasicTaskRequest(ctx, info, constant.TaskActionGenerate)
	require.Nil(t, taskErr)

	req, err := GetTaskRequest(ctx)
	require.NoError(t, err)
	require.Equal(t, []string{"https://example.com/first.jpeg", "https://example.com/last.jpeg"}, req.Images)
	require.Len(t, req.ImageInputs, 2)
	require.Equal(t, "first_frame", req.ImageInputs[0].Role)
	require.Equal(t, "last_frame", req.ImageInputs[1].Role)
}
