package openaivideo

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

type TaskAdaptor struct {
	taskcommon.BaseBilling
	ChannelType int
	apiKey      string
	baseURL     string
	prov        provider
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = info.ChannelBaseUrl
	a.apiKey = info.ApiKey
	a.prov = getProviderForRelayInfo(info)
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) (taskErr *dto.TaskError) {
	if info.Action == constant.TaskActionRemix {
		return validateRemixRequest(c)
	}
	return relaycommon.ValidateMultipartDirect(c, info)
}

func validateRemixRequest(c *gin.Context) *dto.TaskError {
	var req relaycommon.TaskSubmitReq
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	if strings.TrimSpace(req.Prompt) == "" {
		return service.TaskErrorWrapperLocal(fmt.Errorf("field prompt is required"), "invalid_request", http.StatusBadRequest)
	}
	c.Set("task_request", req)
	return nil
}

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	if info.Action == constant.TaskActionRemix {
		return nil
	}

	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}

	seconds, _ := strconv.Atoi(req.Seconds)
	if seconds == 0 {
		seconds = req.Duration
	}
	if seconds <= 0 {
		seconds = 8
	}
	if _, ok := a.prov.(*xbSoraProvider); ok {
		seconds = normalizeXBSoraDuration(seconds, info.UpstreamModelName)
	}

	ratios := map[string]float64{
		"seconds": float64(seconds),
		"size":    1,
	}
	size := req.Size
	if size == "1792x1024" || size == "1024x1792" {
		ratios["size"] = 1.666667
	}
	return ratios
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return a.prov.submitURL(a.baseURL), nil
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	if headerSetter, ok := a.prov.(requestHeaderSetter); ok {
		headerSetter.setupRequestHeader(req, a.apiKey)
	} else {
		req.Header.Set("Authorization", "Bearer "+a.apiKey)
	}
	req.Header.Set("Content-Type", c.Request.Header.Get("Content-Type"))
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, errors.Wrap(err, "get_request_body_failed")
	}
	cachedBody, err := storage.Bytes()
	if err != nil {
		return nil, errors.Wrap(err, "read_body_bytes_failed")
	}
	contentType := c.GetHeader("Content-Type")

	if strings.HasPrefix(contentType, "application/json") {
		var bodyMap map[string]interface{}
		if err := common.Unmarshal(cachedBody, &bodyMap); err == nil {
			imageCount := countRequestImages(bodyMap)
			hasImages := imageCount > 0
			bodyMap["model"] = a.prov.mapModelForImages(info.UpstreamModelName, hasImages)
			if normalizer, ok := a.prov.(requestNormalizer); ok {
				normalizer.normalizeJSONRequest(bodyMap, info.OriginModelName, info.UpstreamModelName, imageCount)
			}

			if a.prov.needsMultipart() {
				return a.jsonToMultipart(c, bodyMap)
			}

			if newBody, err := common.Marshal(bodyMap); err == nil {
				return bytes.NewReader(newBody), nil
			}
		}
		return bytes.NewReader(cachedBody), nil
	}

	if strings.Contains(contentType, "multipart/form-data") {
		formData, err := common.ParseMultipartFormReusable(c)
		if err != nil {
			return bytes.NewReader(cachedBody), nil
		}
		hasImages := len(formData.Value["images"]) > 0 || len(formData.Value["image"]) > 0 || len(formData.File["images"]) > 0 || len(formData.File["image"]) > 0
		imageCount := len(formData.Value["images"]) + len(formData.Value["image"]) + len(formData.File["images"]) + len(formData.File["image"])
		mappedModel := a.prov.mapModelForImages(info.UpstreamModelName, hasImages)
		if normalizer, ok := a.prov.(requestNormalizer); ok {
			formData.Value["model"] = []string{mappedModel}
			normalizer.normalizeMultipartRequest(formData.Value, info.OriginModelName, mappedModel, imageCount)
			if modelValue := firstValue(formData.Value["model"]); modelValue != "" {
				mappedModel = modelValue
			}
		}
		if jsonProvider, ok := a.prov.(jsonBodyProvider); ok && jsonProvider.forceJSONBody() {
			if len(formData.File) > 0 {
				return nil, fmt.Errorf("multipart file upload is not supported by this video provider; use image URLs")
			}
			bodyMap := multipartValuesToMap(formData.Value)
			bodyMap["model"] = mappedModel
			newBody, err := common.Marshal(bodyMap)
			if err != nil {
				return nil, err
			}
			c.Request.Header.Set("Content-Type", "application/json")
			return bytes.NewReader(newBody), nil
		}
		var buf bytes.Buffer
		writer := multipart.NewWriter(&buf)
		writer.WriteField("model", mappedModel)
		for key, values := range formData.Value {
			if key == "model" {
				continue
			}
			for _, v := range values {
				writer.WriteField(key, v)
			}
		}
		for fieldName, fileHeaders := range formData.File {
			for _, fh := range fileHeaders {
				f, err := fh.Open()
				if err != nil {
					continue
				}
				ct := fh.Header.Get("Content-Type")
				if ct == "" || ct == "application/octet-stream" {
					buf512 := make([]byte, 512)
					n, _ := io.ReadFull(f, buf512)
					ct = http.DetectContentType(buf512[:n])
					f.Close()
					f, err = fh.Open()
					if err != nil {
						continue
					}
				}
				h := make(textproto.MIMEHeader)
				h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, fieldName, fh.Filename))
				h.Set("Content-Type", ct)
				part, err := writer.CreatePart(h)
				if err != nil {
					f.Close()
					continue
				}
				io.Copy(part, f)
				f.Close()
			}
		}
		writer.Close()
		c.Request.Header.Set("Content-Type", writer.FormDataContentType())
		return &buf, nil
	}

	return common.ReaderOnly(storage), nil
}

func countRequestImages(bodyMap map[string]interface{}) int {
	count := 0
	for _, key := range []string{"images", "image", "image_urls", "reference_images", "reference_image_urls", "image_url", "file_paths"} {
		if value, ok := bodyMap[key]; ok {
			count += countImageValue(value)
		}
	}
	if refs, ok := bodyMap["image_reference"]; ok {
		count += countImageValue(refs)
	}
	return count
}

func countImageValue(value interface{}) int {
	switch v := value.(type) {
	case []interface{}:
		count := 0
		for _, item := range v {
			if countImageValue(item) > 0 {
				count++
			}
		}
		return count
	case []string:
		count := 0
		for _, item := range v {
			if strings.TrimSpace(item) != "" {
				count++
			}
		}
		return count
	case map[string]interface{}:
		if imageURL, ok := v["image_url"].(map[string]interface{}); ok {
			if url, ok := imageURL["url"].(string); ok && strings.TrimSpace(url) != "" {
				return 1
			}
		}
		if url, ok := v["url"].(string); ok && strings.TrimSpace(url) != "" {
			return 1
		}
	case string:
		if strings.TrimSpace(v) != "" {
			return 1
		}
	}
	return 0
}

func (a *TaskAdaptor) jsonToMultipart(c *gin.Context, bodyMap map[string]interface{}) (io.Reader, error) {
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	for key, val := range bodyMap {
		switch v := val.(type) {
		case string:
			writer.WriteField(key, v)
		case float64, int, int64:
			writer.WriteField(key, fmt.Sprintf("%v", v))
		case bool:
			writer.WriteField(key, fmt.Sprintf("%v", v))
		default:
			b, _ := common.Marshal(v)
			writer.WriteField(key, string(b))
		}
	}

	writer.Close()
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	return &buf, nil
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}
	_ = resp.Body.Close()

	upstreamID, err := a.prov.parseSubmitResponse(responseBody)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusOK, a.prov.buildSubmitResponseBody(info, upstreamID))
	return upstreamID, responseBody, nil
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}

	prov := getProviderForTaskFetch(baseUrl, body)
	uri := prov.queryURL(baseUrl, taskID)

	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}

	if headerSetter, ok := prov.(requestHeaderSetter); ok {
		headerSetter.setupRequestHeader(req, key)
	} else {
		req.Header.Set("Authorization", "Bearer "+key)
	}

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func multipartValuesToMap(values map[string][]string) map[string]interface{} {
	bodyMap := make(map[string]interface{}, len(values))
	for key, vals := range values {
		if len(vals) == 0 {
			continue
		}
		if len(vals) == 1 {
			bodyMap[key] = vals[0]
			continue
		}
		copied := make([]string, len(vals))
		copy(copied, vals)
		bodyMap[key] = copied
	}
	return bodyMap
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	return a.prov.parseQueryResponse(respBody)
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	video := dto.NewOpenAIVideo()
	video.ID = task.TaskID
	video.Model = task.Properties.OriginModelName
	if video.Model == "" {
		video.Model = task.Properties.UpstreamModelName
	}
	video.Status = task.Status.ToVideoStatus()
	video.SetProgressStr(task.Progress)
	video.VideoURL = task.GetResultURL()
	if strings.HasPrefix(video.VideoURL, "runway:") || isXBSoraProtectedResultURL(video.VideoURL) || isLK888ResultURL(video.VideoURL) {
		video.VideoURL = taskcommon.BuildProxyURL(task.TaskID)
	}
	video.CreatedAt = task.CreatedAt
	if task.FinishTime > 0 {
		video.CompletedAt = task.FinishTime
	} else if task.UpdatedAt > 0 {
		video.CompletedAt = task.UpdatedAt
	}

	return common.Marshal(video)
}
