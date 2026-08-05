package byteplus

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/task/doubao"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

const moderationSceneHeader = "x-ark-moderation-scene"
const moderationSceneSkip = "skip-ark-moderation"

const (
	bytePlusAssetSubmitLeaseDefaultSeconds = int64(72 * 60 * 60)
	bytePlusAssetSubmitLeaseMaxSeconds     = int64(259200)
)

var bytePlusAssetLeaseNow = func() int64 { return time.Now().Unix() }

// TaskAdaptor reuses BytePlus Ark's protocol-compatible Seedance implementation
// while keeping BytePlus routing and server-controlled headers isolated from the
// existing Doubao and VolcEngine channels.
type TaskAdaptor struct {
	doubao.TaskAdaptor
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.TaskAdaptor.Init(info)
}

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	seedReq, err := taskcommon.GetSeedanceRequest(c)
	if err != nil {
		return nil
	}
	modelName := strings.TrimSpace(info.OriginModelName)
	if modelName == "" {
		modelName = seedReq.Model
	}
	ratio, ok := getVideoInputRatio(modelName, seedReq.Resolution, len(seedReq.Videos()) > 0)
	if !ok || ratio == 1.0 {
		return nil
	}
	return map[string]float64{"video_input": ratio}
}

func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	if info == nil {
		return errors.New("missing byteplus relay info")
	}
	creds, err := service.ParseBytePlusCredentials(info.ApiKey)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+creds.APIKey)
	req.Header.Set(moderationSceneHeader, moderationSceneSkip)
	return nil
}

// DoRequest must dispatch with the BytePlus receiver. Calling the embedded
// Doubao method would bind the helper to *doubao.TaskAdaptor and bypass this
// adapter's fixed moderation header.
func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	body, err := a.TaskAdaptor.BuildRequestBody(c, info)
	if err != nil {
		return nil, err
	}
	raw, err := io.ReadAll(body)
	if err != nil {
		return nil, err
	}
	rewriteMap, hasGeneralized := common.GetContextKeyType[map[string]string](c, constant.ContextKeyAssetRewriteMap)
	if !hasGeneralized {
		rewriteMap, _ = common.GetContextKeyType[map[string]string](c, constant.ContextKeyBytePlusAssetRewriteMap)
		if err := extendBytePlusAssetLeasesBeforeSubmit(c, raw, rewriteMap); err != nil {
			return nil, err
		}
	}
	rewritten, err := rewriteBytePlusAssetReferences(raw, rewriteMap)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(rewritten), nil
}

func extendBytePlusAssetLeasesBeforeSubmit(c *gin.Context, raw []byte, rewriteMap map[string]string) error {
	publicIDs, err := bytePlusLocalAssetReferencesInRequest(raw, rewriteMap)
	if err != nil || len(publicIDs) == 0 {
		return err
	}
	userID := common.GetContextKeyInt(c, constant.ContextKeyUserId)
	if userID == 0 {
		return nil
	}
	now := bytePlusAssetLeaseNow()
	_, err = model.ExtendBytePlusAssetLeasesForSubmit(userID, publicIDs, now+bytePlusAssetSubmitLeaseSeconds(raw), now)
	if err != nil {
		return fmt.Errorf("invalid byteplus asset reference")
	}
	return nil
}

func bytePlusAssetSubmitLeaseSeconds(raw []byte) int64 {
	seconds := bytePlusAssetSubmitLeaseDefaultSeconds
	var payload struct {
		ExecutionExpiresAfter *int `json:"execution_expires_after"`
	}
	if err := common.Unmarshal(raw, &payload); err == nil && payload.ExecutionExpiresAfter != nil {
		requested := int64(*payload.ExecutionExpiresAfter)
		if requested > seconds {
			seconds = requested
		}
	}
	if seconds > bytePlusAssetSubmitLeaseMaxSeconds {
		return bytePlusAssetSubmitLeaseMaxSeconds
	}
	return seconds
}

func bytePlusLocalAssetReferencesInRequest(raw []byte, rewriteMap map[string]string) ([]string, error) {
	if !bytes.Contains(bytes.ToLower(raw), []byte("asset:")) {
		return nil, nil
	}
	var payload map[string]any
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	if err := decoder.Decode(&payload); err != nil {
		return nil, err
	}
	content, ok := payload["content"].([]any)
	if !ok {
		return nil, nil
	}
	seen := map[string]struct{}{}
	var publicIDs []string
	for _, itemAny := range content {
		item, ok := itemAny.(map[string]any)
		if !ok {
			continue
		}
		for _, field := range []string{"image_url", "video_url", "audio_url"} {
			media, ok := item[field].(map[string]any)
			if !ok {
				continue
			}
			urlValue, ok := media["url"].(string)
			if !ok || !isBytePlusAssetSchemeURL(urlValue) {
				continue
			}
			if !service.IsStrictBytePlusAssetURI(urlValue) {
				return nil, fmt.Errorf("invalid byteplus asset reference")
			}
			if _, ok := rewriteMap[urlValue]; !ok {
				return nil, fmt.Errorf("invalid byteplus asset reference")
			}
			publicID := strings.TrimPrefix(urlValue, "asset://")
			if _, ok := seen[publicID]; ok {
				continue
			}
			seen[publicID] = struct{}{}
			publicIDs = append(publicIDs, publicID)
		}
	}
	return publicIDs, nil
}

func rewriteBytePlusAssetReferences(raw []byte, rewriteMap map[string]string) ([]byte, error) {
	if !bytes.Contains(bytes.ToLower(raw), []byte("asset:")) {
		return raw, nil
	}
	var payload map[string]json.RawMessage
	if err := common.Unmarshal(raw, &payload); err != nil {
		return nil, err
	}
	contentRaw, ok := payload["content"]
	if !ok {
		return raw, nil
	}
	var content []map[string]json.RawMessage
	if err := common.Unmarshal(contentRaw, &content); err != nil {
		return raw, nil
	}
	rewritten := false
	for itemIdx, item := range content {
		for _, field := range []string{"image_url", "video_url", "audio_url"} {
			mediaRaw, ok := item[field]
			if !ok {
				continue
			}
			var media map[string]json.RawMessage
			if err := common.Unmarshal(mediaRaw, &media); err != nil {
				continue
			}
			var urlValue string
			if err := common.Unmarshal(media["url"], &urlValue); err != nil || !isBytePlusAssetSchemeURL(urlValue) {
				continue
			}
			if !service.IsStrictBytePlusAssetURI(urlValue) {
				return nil, fmt.Errorf("invalid byteplus asset reference")
			}
			upstreamURL, ok := rewriteMap[urlValue]
			if !ok || strings.TrimSpace(upstreamURL) == "" {
				return nil, fmt.Errorf("invalid byteplus asset reference")
			}
			urlRaw, err := common.Marshal(upstreamURL)
			if err != nil {
				return nil, err
			}
			media["url"] = urlRaw
			updatedMedia, err := common.Marshal(media)
			if err != nil {
				return nil, err
			}
			content[itemIdx][field] = updatedMedia
			rewritten = true
		}
	}
	if !rewritten {
		return raw, nil
	}
	contentBytes, err := common.Marshal(content)
	if err != nil {
		return nil, err
	}
	payload["content"] = contentBytes
	return common.Marshal(payload)
}

func isBytePlusAssetSchemeURL(raw string) bool {
	return strings.HasPrefix(strings.ToLower(strings.TrimSpace(raw)), "asset:")
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	creds, err := service.ParseBytePlusCredentials(key)
	if err != nil {
		return nil, err
	}
	return a.TaskAdaptor.FetchTask(baseUrl, creds.APIKey, body, proxy)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", nil, service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
	}
	_ = resp.Body.Close()

	var submitResp struct {
		ID string `json:"id"`
	}
	if err := common.Unmarshal(responseBody, &submitResp); err != nil {
		return "", nil, service.TaskErrorWrapperLocal(
			errors.New("invalid upstream submit response"),
			"unmarshal_response_body_failed",
			http.StatusBadGateway,
		)
	}
	if submitResp.ID == "" {
		return "", nil, service.TaskErrorWrapperLocal(
			errors.New("invalid upstream submit response"),
			"invalid_response",
			http.StatusBadGateway,
		)
	}

	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName

	c.JSON(http.StatusOK, ov)
	return submitResp.ID, responseBody, nil
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	info, err := a.TaskAdaptor.ParseTaskResult(respBody)
	if err != nil || info == nil {
		return info, err
	}
	info.Reason = taskcommon.ScrubBrandedText(info.Reason)
	return info, nil
}

func ExtractUpstreamVideoURL(taskData []byte) string {
	if len(taskData) == 0 {
		return ""
	}
	var response struct {
		Content struct {
			VideoURL string `json:"video_url"`
		} `json:"content"`
	}
	if err := common.Unmarshal(taskData, &response); err != nil {
		return ""
	}
	return response.Content.VideoURL
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	video := dto.NewOpenAIVideo()
	video.ID = originTask.TaskID
	video.TaskID = originTask.TaskID
	video.Status = originTask.Status.ToVideoStatus()
	video.SetProgressStr(originTask.Progress)
	video.CreatedAt = originTask.CreatedAt
	video.CompletedAt = originTask.UpdatedAt
	video.Model = originTask.Properties.OriginModelName

	if originTask.Status == model.TaskStatusSuccess {
		video.SetMetadata("url", originTask.GetResultURL())
	}
	if originTask.Status == model.TaskStatusFailure {
		video.Error = &dto.OpenAIVideoError{
			Message: taskcommon.ScrubBrandedText(originTask.FailReason),
		}
	}
	return common.Marshal(video)
}
