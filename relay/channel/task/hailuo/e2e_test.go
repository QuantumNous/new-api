package hailuo

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// v2E2ERecorder 记录 httptest 上游收到的创建/查询请求，供端到端断言使用。
type v2E2ERecorder struct {
	mu                sync.Mutex
	taskID            string
	createPath        string
	createBody        []byte
	createAuth        string
	createContentType string
	queryPath         string
	queryAuth         string
}

// newV2E2EServer 模拟 MiniMax H3 V2 上游：创建任务 + 查询任务。
func newV2E2EServer(t *testing.T, taskID string) (*httptest.Server, *v2E2ERecorder) {
	t.Helper()
	rec := &v2E2ERecorder{taskID: taskID}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == VideoGenerationV2Endpoint:
			body, _ := io.ReadAll(r.Body)
			rec.mu.Lock()
			rec.createPath = r.URL.Path
			rec.createBody = body
			rec.createAuth = r.Header.Get("Authorization")
			rec.createContentType = r.Header.Get("Content-Type")
			rec.mu.Unlock()
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"task_id":"`+taskID+`"}`)
		case r.Method == http.MethodGet && strings.HasPrefix(r.URL.Path, QueryTaskV2Endpoint+"/"):
			rec.mu.Lock()
			rec.queryPath = r.URL.Path
			rec.queryAuth = r.Header.Get("Authorization")
			rec.mu.Unlock()
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"task":{"id":"`+taskID+`","status":"succeeded","content":{"url":"https://cdn.example.com/h3.mp4"},"usage":{"total_seconds":5}}}`)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)
	return srv, rec
}

func newV2E2EInfo(srv *httptest.Server, originModel string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{PublicTaskID: "task_pub_1"},
		OriginModelName: originModel,
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey:            "sk-test",
			ChannelBaseUrl:    srv.URL,
			UpstreamModelName: "MiniMax-H3",
		},
	}
}

// TestEndToEndV2SubmitPollConvert 覆盖完整链路：映射别名校验 -> 真实 HTTP 提交 ->
// 响应解析 -> 轮询 -> 任务结果解析 -> OpenAI 视频格式转换。
func TestEndToEndV2SubmitPollConvert(t *testing.T) {
	const upstreamTaskID = "upstream_001"
	srv, rec := newV2E2EServer(t, upstreamTaskID)

	c := newV2TestContext(t, `{"model":"h3","prompt":"a boy playing basketball"}`)
	c.Set("model_mapping", `{"h3":"MiniMax-H3"}`)
	info := newV2E2EInfo(srv, "h3")

	adaptor := &TaskAdaptor{}
	adaptor.Init(info)

	// 1. 校验：渠道模型映射别名 h3 -> MiniMax-H3 必须走 V2 校验。
	taskErr := adaptor.ValidateRequestAndSetAction(c, info)
	require.Nil(t, taskErr)

	// 2. 构建请求体并真实提交。
	body, err := adaptor.BuildRequestBody(c, info)
	require.NoError(t, err)
	resp, err := adaptor.DoRequest(c, info, body)
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	// 3. 断言提交请求：路径、认证头、请求体形状。
	rec.mu.Lock()
	require.Equal(t, VideoGenerationV2Endpoint, rec.createPath)
	require.Equal(t, "Bearer sk-test", rec.createAuth)
	require.Equal(t, "application/json", rec.createContentType)
	createBody := append([]byte(nil), rec.createBody...)
	rec.mu.Unlock()

	var payload VideoGenerationV2Request
	require.NoError(t, common.Unmarshal(createBody, &payload))
	assert.Equal(t, "MiniMax-H3", payload.Model)
	assert.Equal(t, Resolution768P, payload.Resolution)
	assert.Equal(t, V2DefaultDuration, payload.Duration)
	assert.Equal(t, V2DefaultRatio, payload.Ratio)
	require.Len(t, payload.Content, 1)
	assert.Equal(t, "text", payload.Content[0].Type)
	assert.Equal(t, "a boy playing basketball", payload.Content[0].Text)

	// 4. DoResponse 解析出上游 task_id 并写 OpenAI 格式响应。
	taskID, taskData, taskErr := adaptor.DoResponse(c, resp, info)
	require.Nil(t, taskErr)
	assert.Equal(t, upstreamTaskID, taskID)
	require.NotEmpty(t, taskData)

	// 5. 轮询：按映射后的模型名打到 V2 查询端点。
	pollResp, err := adaptor.FetchTask(srv.URL, "sk-test", map[string]any{
		"task_id": taskID,
		"model":   "MiniMax-H3",
	}, "")
	require.NoError(t, err)
	defer pollResp.Body.Close()
	pollBody, err := io.ReadAll(pollResp.Body)
	require.NoError(t, err)

	rec.mu.Lock()
	require.Equal(t, QueryTaskV2Endpoint+"/"+upstreamTaskID, rec.queryPath)
	require.Equal(t, "Bearer sk-test", rec.queryAuth)
	rec.mu.Unlock()

	// 6. 解析查询结果为任务终态 + URL。
	ti, err := adaptor.ParseTaskResult(pollBody)
	require.NoError(t, err)
	assert.Equal(t, string(model.TaskStatusSuccess), string(ti.Status))
	assert.Equal(t, "https://cdn.example.com/h3.mp4", ti.Url)

	// 7. 转换为最终 OpenAI 视频格式。
	task := &model.Task{
		TaskID:     "task_pub_1",
		Status:     model.TaskStatusSuccess,
		Properties: model.Properties{OriginModelName: "h3"},
		Data:       pollBody,
	}
	ovData, err := adaptor.ConvertToOpenAIVideo(task)
	require.NoError(t, err)
	var ov dto.OpenAIVideo
	require.NoError(t, common.Unmarshal(ovData, &ov))
	assert.Equal(t, dto.VideoStatusCompleted, ov.Status)
}

// TestEndToEndV2SubmitFirstLastFrame 覆盖图生视频（首尾帧 + 2K）提交链路：
// content 三项、ratio 自适应为 adaptive、resolution 归一化为 2K。
func TestEndToEndV2SubmitFirstLastFrame(t *testing.T) {
	srv, rec := newV2E2EServer(t, "upstream_002")

	c := newV2TestContext(t, `{"model":"MiniMax-H3","prompt":"smooth camera move","duration":5,"size":"2K","images":["first.png","last.png"]}`)
	info := newV2E2EInfo(srv, "MiniMax-H3")

	adaptor := &TaskAdaptor{}
	adaptor.Init(info)

	taskErr := adaptor.ValidateRequestAndSetAction(c, info)
	require.Nil(t, taskErr)

	body, err := adaptor.BuildRequestBody(c, info)
	require.NoError(t, err)
	resp, err := adaptor.DoRequest(c, info, body)
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	rec.mu.Lock()
	require.Equal(t, VideoGenerationV2Endpoint, rec.createPath)
	createBody := append([]byte(nil), rec.createBody...)
	rec.mu.Unlock()

	var payload VideoGenerationV2Request
	require.NoError(t, common.Unmarshal(createBody, &payload))
	assert.Equal(t, "2K", payload.Resolution)
	assert.Equal(t, "adaptive", payload.Ratio)
	require.Len(t, payload.Content, 3)
	assert.Equal(t, "text", payload.Content[0].Type)
	assert.Equal(t, "first_frame", payload.Content[1].Role)
	assert.Equal(t, "first.png", payload.Content[1].ImageURL.URL)
	assert.Equal(t, "last_frame", payload.Content[2].Role)
	assert.Equal(t, "last.png", payload.Content[2].ImageURL.URL)

	_, _, taskErr = adaptor.DoResponse(c, resp, info)
	require.Nil(t, taskErr)
}
