package service

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestBuildUserTaskDtoRemovesInternalFields(t *testing.T) {
	secret := "sample-secret-value-123456"
	task := &model.Task{
		ID:         1,
		TaskID:     "task_public",
		Platform:   constant.TaskPlatformSuno,
		UserId:     12,
		Group:      "default",
		ChannelId:  0,
		Quota:      100,
		Action:     "generate",
		Status:     model.TaskStatusFailure,
		FailReason: "upstream channel failed Authorization: Bearer " + secret + " api_key=" + secret,
		Properties: model.Properties{
			OriginModelName:   "visible-model",
			UpstreamModelName: "hidden-upstream-model",
		},
		PrivateData: model.TaskPrivateData{
			Key:       secret,
			ResultURL: "https://cdn.example.com/result.mp4",
		},
		Data: json.RawMessage(`{"audio_url":"https://cdn.example.com/audio.mp3","api_key":"sample-secret-value-123456","upstream_model_name":"hidden","nested":{"relay":"retry-chain","title":"ok"}}`),
	}

	got := BuildUserTaskDto(task)
	bodyBytes, err := common.Marshal(got)
	require.NoError(t, err)
	body := string(bodyBytes)
	lowerBody := strings.ToLower(body)

	require.Contains(t, body, `"origin_model_name":"visible-model"`)
	require.Contains(t, body, `"audio_url":"https://cdn.example.com/audio.mp3"`)
	require.NotContains(t, lowerBody, "channel_id")
	require.NotContains(t, lowerBody, "upstream_model_name")
	require.NotContains(t, lowerBody, "upstream")
	require.NotContains(t, lowerBody, "relay")
	require.NotContains(t, lowerBody, "api_key")
	require.NotContains(t, lowerBody, "authorization")
	require.NotContains(t, lowerBody, "token")
	require.NotContains(t, body, secret)
	require.NotContains(t, strings.ToLower(got.FailReason), "channel")
	require.NotContains(t, strings.ToLower(got.FailReason), "upstream")
}

func TestBuildUserMidjourneyDtoSanitizesErrorFields(t *testing.T) {
	secret := "sample-secret-value-123456"
	task := &model.Midjourney{
		Id:          1,
		Code:        23,
		UserId:      12,
		Action:      "IMAGINE",
		MjId:        "mj_public",
		Prompt:      "user visible prompt",
		Description: "upstream channel failed Authorization: Bearer " + secret,
		Status:      "FAILURE",
		Progress:    "100%",
		FailReason:  "relay retry failed api_key=" + secret,
		Properties:  `{"discordInstanceId":"hidden-instance","finalPrompt":"visible"}`,
		Buttons:     `{"customId":"MJ::public"}`,
		ChannelId:   0,
	}

	got := BuildUserMidjourneyDto(task)
	bodyBytes, err := common.Marshal(got)
	require.NoError(t, err)
	body := string(bodyBytes)
	lowerBody := strings.ToLower(body)

	require.Contains(t, body, `"prompt":"user visible prompt"`)
	require.Contains(t, got.Properties, `"finalPrompt":"visible"`)
	require.NotContains(t, lowerBody, "channel_id")
	require.NotContains(t, lowerBody, "upstream")
	require.NotContains(t, lowerBody, "relay")
	require.NotContains(t, lowerBody, "api_key")
	require.NotContains(t, lowerBody, "authorization")
	require.NotContains(t, lowerBody, "discordinstance")
	require.NotContains(t, lowerBody, "token")
	require.NotContains(t, body, secret)
	require.NotContains(t, strings.ToLower(got.Description), "channel")
	require.NotContains(t, strings.ToLower(got.FailReason), "relay")
}

func TestSanitizeMidjourneyResponseForUserRemovesInternalFields(t *testing.T) {
	secret := "sample-secret-value-123456"
	resp := &dto.MidjourneyResponse{
		Code:        23,
		Description: "upstream channel failed Authorization: Bearer " + secret + " prompt=private",
		Result:      "relay=" + secret,
		Properties: map[string]any{
			"discordInstanceId": "hidden-instance",
			"numberOfQueues":    1,
			"api_key":           secret,
		},
	}

	got := SanitizeMidjourneyResponseForUser(resp, 400, secret)
	bodyBytes, err := common.Marshal(got)
	require.NoError(t, err)
	body := string(bodyBytes)
	lowerBody := strings.ToLower(body)

	require.Contains(t, body, `"code":23`)
	require.Contains(t, body, `"numberOfQueues":1`)
	require.NotContains(t, lowerBody, "upstream")
	require.NotContains(t, lowerBody, "channel")
	require.NotContains(t, lowerBody, "relay")
	require.NotContains(t, lowerBody, "api_key")
	require.NotContains(t, lowerBody, "authorization")
	require.NotContains(t, lowerBody, "discordinstance")
	require.NotContains(t, lowerBody, "prompt")
	require.NotContains(t, lowerBody, "token")
	require.NotContains(t, body, secret)
}
