package yike

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relaykitdto "github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConvertRequestTextToVideo(t *testing.T) {
	req := relaycommon.TaskSubmitReq{
		Prompt:   "一只柯基在草地上玩耍",
		Duration: 5,
		Size:     "1280x720",
	}

	jobType, query, err := convertRequest(req, "happyhorse-1.1", "task_public")
	require.NoError(t, err)
	assert.Equal(t, "text_to_video", jobType)
	assert.Equal(t, "happyhorse-1.1", query.Get("Model"))
	assert.Equal(t, "720P", query.Get("Resolution"))
	assert.Equal(t, "16:9", query.Get("AspectRatio"))
	assert.Equal(t, "task_public", query.Get("ClientToken"))
	assert.Equal(t, "1", query.Get("N"))
	assert.Empty(t, query.Get("JobParameters"))

	var input upstreamInput
	require.NoError(t, json.Unmarshal([]byte(query.Get("Input")), &input))
	assert.Equal(t, req.Prompt, input.Prompt)
	assert.Empty(t, input.Medias)
}

func TestFetchAccountCreditUsesReadOnlySignedRequest(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPost, r.Method)
		assert.Equal(t, "/", r.URL.Path)
		assert.Empty(t, r.URL.RawQuery)
		assert.Equal(t, accountCreditAction, r.Header.Get("x-acs-action"))
		assert.Equal(t, apiVersion, r.Header.Get("x-acs-version"))
		assert.Contains(t, r.Header.Get("Authorization"), "Credential=test-access-key")
		assert.Zero(t, r.ContentLength)
		_, _ = w.Write([]byte(`{
  "RequestId":"request-id",
  "MembershipInfo":{"EndTime":"1784179281"},
  "CreditInfo":{
    "ResourceCreditQuota":10000,
    "PackCreditQuota":20000,
    "GrantedCreditQuota":200,
    "ResourceCreditQuotaUsage":2000,
    "PackCreditQuotaUsage":5000,
    "GrantedCreditQuotaUsage":0
  }
}`))
	}))
	defer server.Close()

	credit, err := FetchAccountCredit(context.Background(), server.URL, "test-access-key|test-access-secret", server.Client())
	require.NoError(t, err)
	assert.Equal(t, "7000", credit.Remaining.String())
	assert.Equal(t, "23200", credit.Used.String())
	assert.Equal(t, "30200", credit.Granted.String())
	assert.EqualValues(t, 1784179281, credit.ExpiresAt)
}

func TestFetchAccountCreditRejectsMissingCreditInfo(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"RequestId":"request-id"}`))
	}))
	defer server.Close()

	_, err := FetchAccountCredit(context.Background(), server.URL, "test-access-key|test-access-secret", server.Client())
	require.ErrorContains(t, err, "CreditInfo")
}

func TestFetchTaskRejectsNonSuccessHTTPStatus(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, getAction, r.Header.Get("x-acs-action"))
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = w.Write([]byte(`{"Code":"Throttling"}`))
	}))
	defer server.Close()

	adaptor := &TaskAdaptor{httpClient: server.Client()}
	response, err := adaptor.FetchTask(server.URL, "test-access-key|test-access-secret", map[string]any{"task_id": "job-1"}, "")

	require.Error(t, err)
	assert.Nil(t, response)
	assert.ErrorContains(t, err, "HTTP 429")
}

func TestConvertRequestImageToVideo(t *testing.T) {
	req := relaycommon.TaskSubmitReq{
		Prompt: "让图片动起来",
		Image:  "https://example.com/start.jpg",
		Size:   "1080x1920",
	}

	jobType, query, err := convertRequest(req, "wan2.7", "")
	require.NoError(t, err)
	assert.Equal(t, "image_to_video", jobType)
	assert.Equal(t, "1080P", query.Get("Resolution"))
	assert.Equal(t, "9:16", query.Get("AspectRatio"))

	var input upstreamInput
	require.NoError(t, json.Unmarshal([]byte(query.Get("Input")), &input))
	require.Len(t, input.Medias, 1)
	assert.Equal(t, "image", input.Medias[0].Type)
	assert.Equal(t, "https://example.com/start.jpg", input.Medias[0].URL)
	assert.Contains(t, query.Get("Input"), `"Url":"https://example.com/start.jpg"`)
	assert.NotContains(t, query.Get("Input"), `"URL"`)
}

func TestConvertRequestFirstLastFrameWithMetadata(t *testing.T) {
	req := relaycommon.TaskSubmitReq{
		Prompt: "镜头从白天过渡到夜晚",
		Metadata: map[string]interface{}{
			"job_type":     "first_last_frame",
			"resolution":   "1080P",
			"aspect_ratio": "4:3",
			"medias": []map[string]interface{}{
				{"type": "image", "url": "https://example.com/first.png"},
				{"type": "image", "media_id": "media-last"},
			},
		},
	}

	jobType, query, err := convertRequest(req, "Wonder-Standard", "")
	require.NoError(t, err)
	assert.Equal(t, "first_last_frame", jobType)
	assert.Equal(t, "1080P", query.Get("Resolution"))
	assert.Equal(t, "4:3", query.Get("AspectRatio"))

	var input upstreamInput
	require.NoError(t, json.Unmarshal([]byte(query.Get("Input")), &input))
	require.Len(t, input.Medias, 2)
	assert.Equal(t, "media-last", input.Medias[1].MediaID)
}

func TestConvertRequestReferenceToVideo(t *testing.T) {
	req := relaycommon.TaskSubmitReq{
		Prompt: "keep the subject identity",
		Metadata: map[string]any{
			"job_type": "reference_to_video",
			"medias": []map[string]any{
				{"type": "image", "media_id": "imported-face"},
				{"type": "video", "url": "https://example.com/action.mp4"},
			},
		},
	}

	jobType, query, err := convertRequest(req, "Wonder-Pro", "task-reference")

	require.NoError(t, err)
	assert.Equal(t, "reference_to_video", jobType)
	assert.Equal(t, "task-reference", query.Get("ClientToken"))
	var input upstreamInput
	require.NoError(t, json.Unmarshal([]byte(query.Get("Input")), &input))
	require.Len(t, input.Medias, 2)
	assert.Equal(t, "imported-face", input.Medias[0].MediaID)
	assert.Equal(t, "video", input.Medias[1].Type)
}

func TestConvertRequestValidation(t *testing.T) {
	tests := []struct {
		name string
		req  relaycommon.TaskSubmitReq
		want string
	}{
		{
			name: "prompt is required",
			req:  relaycommon.TaskSubmitReq{Prompt: "  "},
			want: "prompt is required",
		},
		{
			name: "multiple inputs require explicit job type",
			req: relaycommon.TaskSubmitReq{
				Prompt: "test",
				Images: []string{"https://example.com/1.png", "https://example.com/2.png"},
			},
			want: "metadata.job_type",
		},
		{
			name: "duration is bounded",
			req:  relaycommon.TaskSubmitReq{Prompt: "test", Duration: 16},
			want: "between 4 and 15",
		},
		{
			name: "data URL is rejected",
			req:  relaycommon.TaskSubmitReq{Prompt: "test", Image: "data:image/png;base64,abc"},
			want: "public HTTP(S) URL",
		},
		{
			name: "private URL is rejected",
			req:  relaycommon.TaskSubmitReq{Prompt: "test", Image: "http://127.0.0.1/start.png"},
			want: "public HTTP(S) URL",
		},
		{
			name: "unsupported size is rejected",
			req:  relaycommon.TaskSubmitReq{Prompt: "test", Size: "1024x768"},
			want: "unsupported Yike size",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, _, err := convertRequest(test.req, "wan2.7", "")
			require.Error(t, err)
			assert.Contains(t, err.Error(), test.want)
		})
	}
}

func TestConvertRequestRequiresNOneAndRejectsJobParameters(t *testing.T) {
	for _, n := range []int{0, 2, 4} {
		t.Run("n="+strconv.Itoa(n), func(t *testing.T) {
			req := relaycommon.TaskSubmitReq{Prompt: "test", Metadata: map[string]any{"n": n}}
			_, _, err := convertRequest(req, "wan2.7", "")
			require.ErrorContains(t, err, "exactly 1")
		})
	}

	_, query, err := convertRequest(relaycommon.TaskSubmitReq{Prompt: "test"}, "wan2.7", "")
	require.NoError(t, err)
	assert.Equal(t, "1", query.Get("N"))

	_, _, err = convertRequest(relaycommon.TaskSubmitReq{
		Prompt:   "test",
		Metadata: map[string]any{"job_parameters": map[string]any{"unsafe": true}},
	}, "wan2.7", "")
	require.ErrorContains(t, err, "job_parameters is not supported")

	_, query, err = convertRequest(relaycommon.TaskSubmitReq{
		Prompt:   "test",
		Metadata: map[string]any{"user_data": map[string]any{"private": true}},
	}, "wan2.7", "")
	require.NoError(t, err)
	assert.Empty(t, query.Get("UserData"))
}

func TestConvertMediaRequiresURLOrMediaIDExclusively(t *testing.T) {
	_, err := convertMedia(inputMedia{Type: "image", URL: "https://example.com/a.png", MediaID: "media-1"})
	require.ErrorContains(t, err, "exactly one")

	_, err = convertMedia(inputMedia{Type: "image"})
	require.ErrorContains(t, err, "exactly one")
}

func TestCredentialsAndEndpointValidation(t *testing.T) {
	for _, key := range []string{"ak", "ak|", "|sk", "ak|sk|extra", "ak|sk\nnext|secret"} {
		_, _, err := parseCredentials(key)
		require.Error(t, err, key)
	}
	ak, sk, err := parseCredentials(" ak | sk ")
	require.NoError(t, err)
	assert.Equal(t, "ak", ak)
	assert.Equal(t, "sk", sk)

	_, err = buildEndpoint("http://yike.example.test", nil)
	require.Error(t, err)
	endpoint, err := buildEndpoint("https://yike.example.test/custom/path?unsafe=1", url.Values{"JobId": {"job-1"}})
	require.NoError(t, err)
	parsed, err := url.Parse(endpoint)
	require.NoError(t, err)
	assert.Equal(t, "/", parsed.Path)
	assert.Empty(t, parsed.Query().Get("unsafe"))
	assert.Equal(t, "job-1", parsed.Query().Get("JobId"))

	require.NoError(t, ValidateChannelCredentials("ak-1|sk-1\r\nak-2|sk-2"))
	require.Error(t, ValidateChannelCredentials("ak-1|sk-1\nak-2|sk-2|extra"))
	require.NoError(t, ValidateChannelEndpoint("https://yike.ap-southeast-1.aliyuncs.com"))
}

func TestMappedModelIsRevalidatedAsUserError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", strings.NewReader(`{"model":"public-alias","prompt":"test"}`))
	c.Request.Header.Set("Content-Type", "application/json")
	info := &relaycommon.RelayInfo{
		OriginModelName: "public-alias",
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey: "ak|sk",
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
	}
	adaptor := &TaskAdaptor{}
	require.Nil(t, adaptor.ValidateRequestAndSetAction(c, info))

	info.UpstreamModelName = "not-a-yike-model"
	taskErr := adaptor.ValidateMappedModel(c, info)

	require.NotNil(t, taskErr)
	assert.Equal(t, http.StatusBadRequest, taskErr.StatusCode)
	assert.Contains(t, taskErr.Message, "unsupported Yike model")
}

func TestValidateRequestRejectsRemix(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos/task_origin/remix", strings.NewReader(`{"model":"wan2.7","prompt":"test"}`))
	c.Request.Header.Set("Content-Type", "application/json")
	info := &relaycommon.RelayInfo{
		ChannelMeta:   &relaycommon.ChannelMeta{ApiKey: "ak|sk"},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{Action: constant.TaskActionRemix},
	}

	taskErr := (&TaskAdaptor{}).ValidateRequestAndSetAction(c, info)

	require.NotNil(t, taskErr)
	assert.Equal(t, "unsupported_yike_remix", taskErr.Code)
	assert.Equal(t, http.StatusBadRequest, taskErr.StatusCode)
}

func TestMultipartAndBinaryInputsAreRejected(t *testing.T) {
	for _, contentType := range []string{"multipart/form-data; boundary=test", "application/octet-stream"} {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", strings.NewReader("binary"))
		c.Request.Header.Set("Content-Type", contentType)
		require.ErrorContains(t, rejectMultipartFiles(c), "does not support")
	}
}

func TestParseTaskResult(t *testing.T) {
	adaptor := &TaskAdaptor{}
	created, err := adaptor.ParseTaskResult([]byte(`{"RequestId":"req","VideoGenerationJob":{"JobId":"job","Status":"Created"}}`))
	require.NoError(t, err)
	assert.Equal(t, string(model.TaskStatusSubmitted), created.Status)

	queued, err := adaptor.ParseTaskResult([]byte(`{"RequestId":"req","VideoGenerationJob":{"JobId":"job","Status":"Queuing"}}`))
	require.NoError(t, err)
	assert.Equal(t, model.TaskStatusQueued, queued.Status)

	executing, err := adaptor.ParseTaskResult([]byte(`{"RequestId":"req","VideoGenerationJob":{"JobId":"job","Status":"Executing"}}`))
	require.NoError(t, err)
	assert.Equal(t, string(model.TaskStatusInProgress), executing.Status)

	finishedBody := []byte(`{"RequestId":"req","VideoGenerationJob":{"JobId":"job","Status":"Finished","Output":"{\"Medias\":[{\"MediaId\":\"m1\",\"OutputUrl\":\"https://example.com/1.mp4\"},{\"MediaId\":\"m2\",\"OutputUrl\":\"https://example.com/2.mp4\"}]}"}}`)
	finished, err := adaptor.ParseTaskResult(finishedBody)
	require.NoError(t, err)
	assert.Equal(t, model.TaskStatusSuccess, finished.Status)
	assert.Equal(t, "https://example.com/1.mp4", finished.Url)

	failed, err := adaptor.ParseTaskResult([]byte(`{"VideoGenerationJob":{"JobId":"job","Status":"Failed","ErrorMessage":"failed at https://oss.example.test/file.mp4?token=secret"}}`))
	require.NoError(t, err)
	assert.Equal(t, model.TaskStatusFailure, failed.Status)
	assert.NotContains(t, failed.Reason, "token=secret")

	_, err = adaptor.ParseTaskResult([]byte(`{"Code":"Throttling","Message":"try later"}`))
	require.ErrorContains(t, err, "Throttling")
}

func TestSanitizeErrorMessageMasksCredentials(t *testing.T) {
	got := sanitizeErrorMessage("AccessKeyId=LTAI-secret AccessKeySecret=very-secret Authorization:ACS3-secret Signature=abc")
	assert.NotContains(t, got, "LTAI-secret")
	assert.NotContains(t, got, "very-secret")
	assert.NotContains(t, got, "ACS3-secret")
	assert.NotContains(t, got, "Signature=abc")
}

func TestDoResponseReturnsPublicTaskID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(`{"RequestId":"req","JobId":"upstream-job"}`)),
	}
	info := &relaycommon.RelayInfo{
		OriginModelName: "wan2.7",
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"},
	}

	upstreamTaskID, rawBody, taskErr := (&TaskAdaptor{}).DoResponse(c, resp, info)

	require.Nil(t, taskErr)
	assert.Equal(t, "upstream-job", upstreamTaskID)
	assert.JSONEq(t, `{"RequestId":"req","JobId":"upstream-job"}`, string(rawBody))
	var video relaykitdto.OpenAIVideo
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &video))
	assert.Equal(t, "task_public", video.ID)
	assert.Equal(t, "task_public", video.TaskID)
	assert.Equal(t, "wan2.7", video.Model)
	assert.Equal(t, relaykitdto.VideoStatusQueued, video.Status)
}

func TestConvertToOpenAIVideoReturnsOnlyProxyURL(t *testing.T) {
	task := &model.Task{
		TaskID:     "task_public",
		Status:     model.TaskStatusSuccess,
		Progress:   "100%",
		CreatedAt:  100,
		UpdatedAt:  200,
		Properties: model.Properties{OriginModelName: "Wonder-Pro"},
		Data:       json.RawMessage(`{"VideoGenerationJob":{"JobId":"upstream-job","Status":"Finished","Output":"{\"Medias\":[{\"OutputUrl\":\"https://example.com/1.mp4\"},{\"OutputUrl\":\"https://example.com/2.mp4\"}]}"}}`),
	}

	body, err := (&TaskAdaptor{}).ConvertToOpenAIVideo(task)

	require.NoError(t, err)
	var video relaykitdto.OpenAIVideo
	require.NoError(t, json.Unmarshal(body, &video))
	assert.Equal(t, relaykitdto.VideoStatusCompleted, video.Status)
	assert.Contains(t, video.Metadata["url"], "/v1/videos/task_public/content")
	assert.NotContains(t, string(body), "https://example.com/1.mp4")
	assert.NotContains(t, video.Metadata, "urls")
}

func TestFetchTaskSignsGetVideoGenerationJob(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPost, r.Method)
		assert.Equal(t, "GetVideoGenerationJob", r.Header.Get("x-acs-action"))
		assert.Equal(t, apiVersion, r.Header.Get("x-acs-version"))
		assert.Equal(t, "job-123", r.URL.Query().Get("JobId"))
		assert.Contains(t, r.Header.Get("Authorization"), "Credential=ak-test")
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"VideoGenerationJob":{"JobId":"job-123","Status":"Executing"}}`)
	}))
	defer server.Close()

	adaptor := &TaskAdaptor{httpClient: server.Client(), signer: &v3Signer{
		now: func() time.Time { return time.Date(2026, 7, 15, 8, 30, 45, 0, time.UTC) },
		nonce: func() (string, error) {
			return "nonce", nil
		},
	}}
	resp, err := adaptor.FetchTask(server.URL, "ak-test|sk-test", map[string]any{"task_id": "job-123"}, "")
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}
