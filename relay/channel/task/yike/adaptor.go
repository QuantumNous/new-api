package yike

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	taskdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
	"github.com/shopspring/decimal"
)

const (
	apiVersion          = "2026-07-07"
	submitAction        = "SubmitVideoGenerationJob"
	getAction           = "GetVideoGenerationJob"
	accountCreditAction = "GetYikeAccountCredit"

	accountCreditRequestTimeout = 15 * time.Second
)

var modelList = []string{
	"Wonder-Pro",
	"Wonder-Standard",
	"happyhorse-1.1",
	"happyhorse-1.0",
	"wan2.7",
}

type TaskAdaptor struct {
	taskcommon.BaseBilling
	baseURL         string
	accessKeyID     string
	accessKeySecret string
	submitQuery     url.Values
	signer          *v3Signer
	httpClient      *http.Client
}

type requestMetadata struct {
	JobType       string          `json:"job_type"`
	Medias        []inputMedia    `json:"medias"`
	Resolution    string          `json:"resolution"`
	AspectRatio   string          `json:"aspect_ratio"`
	N             *int            `json:"n"`
	Scene         string          `json:"scene"`
	JobParameters json.RawMessage `json:"job_parameters"`
}

type inputMedia struct {
	Type    string `json:"type"`
	URL     string `json:"url"`
	MediaID string `json:"media_id"`
}

type upstreamInput struct {
	Prompt string          `json:"Prompt"`
	Medias []upstreamMedia `json:"Medias,omitempty"`
}

type upstreamMedia struct {
	Type string `json:"Type"`
	// The live OpenAPI/SDK schema uses "Url"; the beta PDF's "URL" spelling is stale.
	URL     string `json:"Url,omitempty"`
	MediaID string `json:"MediaId,omitempty"`
}

type submitResponse struct {
	JobID   string `json:"JobId"`
	Code    string `json:"Code,omitempty"`
	Message string `json:"Message,omitempty"`
}

type getResponse struct {
	VideoGenerationJob *videoGenerationJob `json:"VideoGenerationJob,omitempty"`
	Code               string              `json:"Code,omitempty"`
	Message            string              `json:"Message,omitempty"`
}

type accountCreditResponse struct {
	Code           string                 `json:"Code,omitempty"`
	Message        string                 `json:"Message,omitempty"`
	CreditInfo     *accountCreditInfo     `json:"CreditInfo,omitempty"`
	MembershipInfo *accountMembershipInfo `json:"MembershipInfo,omitempty"`
}

type accountCreditInfo struct {
	ResourceCreditQuota      *decimal.Decimal `json:"ResourceCreditQuota,omitempty"`
	PackCreditQuota          *decimal.Decimal `json:"PackCreditQuota,omitempty"`
	GrantedCreditQuota       *decimal.Decimal `json:"GrantedCreditQuota,omitempty"`
	ResourceCreditQuotaUsage *decimal.Decimal `json:"ResourceCreditQuotaUsage,omitempty"`
	PackCreditQuotaUsage     *decimal.Decimal `json:"PackCreditQuotaUsage,omitempty"`
	GrantedCreditQuotaUsage  *decimal.Decimal `json:"GrantedCreditQuotaUsage,omitempty"`
}

type accountMembershipInfo struct {
	EndTime string `json:"EndTime,omitempty"`
}

// AccountCredit contains the normalized Yike primary-account credit totals.
type AccountCredit struct {
	Remaining decimal.Decimal
	Used      decimal.Decimal
	Granted   decimal.Decimal
	ExpiresAt int64
}

// AccountCreditError represents a provider error without exposing credentials.
type AccountCreditError struct {
	StatusCode int
	Code       string
	Message    string
}

func (err *AccountCreditError) Error() string {
	if err == nil {
		return ""
	}
	if err.Code != "" && err.Message != "" {
		return fmt.Sprintf("Yike account credit error %s: %s", err.Code, err.Message)
	}
	if err.Code != "" {
		return fmt.Sprintf("Yike account credit error %s", err.Code)
	}
	return fmt.Sprintf("Yike account credit returned status %d", err.StatusCode)
}

type videoGenerationJob struct {
	JobID        string `json:"JobId"`
	Status       string `json:"Status"`
	ErrorMessage string `json:"ErrorMessage,omitempty"`
	Output       string `json:"Output,omitempty"`
}

type jobOutput struct {
	Medias []outputMedia `json:"Medias"`
}

type outputMedia struct {
	OutputURL string `json:"OutputUrl"`
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.baseURL = info.ChannelBaseUrl
	if strings.TrimSpace(a.baseURL) == "" {
		a.baseURL = constant.ChannelBaseURLs[constant.ChannelTypeYike]
	}
	a.accessKeyID, a.accessKeySecret, _ = parseCredentials(info.ApiKey)
	if a.signer == nil {
		a.signer = defaultV3Signer()
	}
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *taskdto.TaskError {
	if info.Action == constant.TaskActionRemix || strings.HasSuffix(c.Request.URL.Path, "/remix") {
		return service.TaskErrorWrapper(
			fmt.Errorf("Yike does not support video remix"),
			"unsupported_yike_remix",
			http.StatusBadRequest,
		)
	}
	if _, _, err := parseCredentials(info.ApiKey); err != nil {
		return service.TaskErrorWrapper(err, "invalid_yike_credentials", http.StatusBadRequest)
	}
	if err := rejectMultipartFiles(c); err != nil {
		return service.TaskErrorWrapper(err, "unsupported_yike_file_upload", http.StatusBadRequest)
	}
	if taskErr := relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionTextGenerate); taskErr != nil {
		return taskErr
	}
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return service.TaskErrorWrapper(err, "get_task_request_failed", http.StatusBadRequest)
	}
	jobType, _, err := convertRequestForValidation(req, info.OriginModelName, "", true)
	if err != nil {
		return service.TaskErrorWrapper(err, "invalid_yike_request", http.StatusBadRequest)
	}
	switch jobType {
	case "image_to_video":
		info.Action = constant.TaskActionGenerate
	case "first_last_frame":
		info.Action = constant.TaskActionFirstTailGenerate
	case "reference_to_video":
		info.Action = constant.TaskActionReferenceGenerate
	default:
		info.Action = constant.TaskActionTextGenerate
	}
	return nil
}

func (a *TaskAdaptor) ValidateMappedModel(c *gin.Context, info *relaycommon.RelayInfo) *taskdto.TaskError {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return service.TaskErrorWrapper(err, "get_task_request_failed", http.StatusBadRequest)
	}
	if _, _, err := convertRequest(req, info.UpstreamModelName, ""); err != nil {
		return service.TaskErrorWrapper(err, "invalid_yike_mapped_request", http.StatusBadRequest)
	}
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, err
	}
	_, query, err := convertRequest(req, info.UpstreamModelName, info.PublicTaskID)
	if err != nil {
		return nil, err
	}
	a.submitQuery = query
	// Yike is an RPC-style API: business parameters are signed in the query and
	// the POST body must remain empty.
	return bytes.NewReader(nil), nil
}

func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	if a.submitQuery == nil {
		return "", fmt.Errorf("Yike submit query is not initialized")
	}
	return buildEndpoint(a.baseURL, a.submitQuery)
}

func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	return a.signer.sign(req, submitAction, apiVersion, a.accessKeyID, a.accessKeySecret)
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (string, []byte, *taskdto.TaskError) {
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", nil, service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
	}
	_ = resp.Body.Close()

	var result submitResponse
	if err := common.Unmarshal(body, &result); err != nil {
		return "", body, service.TaskErrorWrapper(errors.Wrap(err, "unmarshal Yike submit response failed"), "unmarshal_response_body_failed", http.StatusInternalServerError)
	}
	if result.Code != "" {
		return "", body, service.TaskErrorWrapper(fmt.Errorf("%s: %s", result.Code, sanitizeErrorMessage(result.Message)), result.Code, http.StatusBadGateway)
	}
	if strings.TrimSpace(result.JobID) == "" {
		return "", body, service.TaskErrorWrapper(fmt.Errorf("Yike response did not contain JobId"), "missing_job_id", http.StatusBadGateway)
	}

	video := dto.NewOpenAIVideo()
	video.ID = info.PublicTaskID
	video.TaskID = info.PublicTaskID
	video.Model = info.OriginModelName
	video.CreatedAt = time.Now().Unix()
	c.JSON(http.StatusOK, video)
	return result.JobID, body, nil
}

func (a *TaskAdaptor) FetchTask(baseURL, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || strings.TrimSpace(taskID) == "" {
		return nil, fmt.Errorf("invalid task_id")
	}
	// Polling receives the exact AK|SK pair persisted when the task was submitted,
	// rather than the channel's possibly rotated multi-key value.
	accessKeyID, accessKeySecret, err := parseCredentials(key)
	if err != nil {
		return nil, err
	}
	endpoint, err := buildEndpoint(baseURL, url.Values{"JobId": []string{taskID}})
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(http.MethodPost, endpoint, nil)
	if err != nil {
		return nil, err
	}
	signer := a.signer
	if signer == nil {
		signer = defaultV3Signer()
	}
	if err := signer.sign(req, getAction, apiVersion, accessKeyID, accessKeySecret); err != nil {
		return nil, err
	}
	client := a.httpClient
	if client == nil {
		var err error
		client, err = service.GetHttpClientWithProxy(proxy)
		if err != nil {
			return nil, fmt.Errorf("new proxy http client failed: %w", err)
		}
	}
	response, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		_ = response.Body.Close()
		return nil, fmt.Errorf("Yike polling returned HTTP %d", response.StatusCode)
	}
	return response, nil
}

func (a *TaskAdaptor) ParseTaskResult(body []byte) (*relaycommon.TaskInfo, error) {
	var result getResponse
	if err := common.Unmarshal(body, &result); err != nil {
		return nil, errors.Wrap(err, "unmarshal Yike task result failed")
	}
	if result.Code != "" {
		return nil, fmt.Errorf("Yike polling error %s: %s", result.Code, sanitizeErrorMessage(result.Message))
	}
	if result.VideoGenerationJob == nil {
		return nil, fmt.Errorf("Yike response did not contain VideoGenerationJob")
	}

	taskInfo := &relaycommon.TaskInfo{TaskID: result.VideoGenerationJob.JobID}
	switch result.VideoGenerationJob.Status {
	case "Created":
		taskInfo.Status = model.TaskStatusSubmitted
		taskInfo.Progress = taskcommon.ProgressSubmitted
	case "Queuing":
		taskInfo.Status = model.TaskStatusQueued
		taskInfo.Progress = taskcommon.ProgressQueued
	case "Executing":
		taskInfo.Status = model.TaskStatusInProgress
		taskInfo.Progress = taskcommon.ProgressInProgress
	case "Finished":
		output, err := parseJobOutput(result.VideoGenerationJob.Output)
		if err != nil {
			return nil, err
		}
		if len(output.Medias) == 0 || strings.TrimSpace(output.Medias[0].OutputURL) == "" {
			return nil, fmt.Errorf("Yike finished task did not contain OutputUrl")
		}
		taskInfo.Status = model.TaskStatusSuccess
		taskInfo.Progress = taskcommon.ProgressComplete
		taskInfo.Url = output.Medias[0].OutputURL
	case "Failed":
		taskInfo.Status = model.TaskStatusFailure
		taskInfo.Progress = taskcommon.ProgressComplete
		taskInfo.Reason = sanitizeErrorMessage(result.VideoGenerationJob.ErrorMessage)
		if taskInfo.Reason == "" {
			taskInfo.Reason = "Yike video generation failed"
		}
	default:
		return nil, fmt.Errorf("unknown Yike task status: %s", result.VideoGenerationJob.Status)
	}
	return taskInfo, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	video := dto.NewOpenAIVideo()
	video.ID = task.TaskID
	video.Status = task.Status.ToVideoStatus()
	video.Model = task.Properties.OriginModelName
	video.SetProgressStr(task.Progress)
	video.CreatedAt = task.CreatedAt
	video.CompletedAt = task.UpdatedAt
	if task.Status == model.TaskStatusSuccess {
		video.SetMetadata("url", taskcommon.BuildProxyURL(task.TaskID))
	}
	if task.Status == model.TaskStatusFailure {
		video.Error = &dto.OpenAIVideoError{Code: "yike_task_failed", Message: sanitizeErrorMessage(task.FailReason)}
	}
	return common.Marshal(video)
}

func (a *TaskAdaptor) GetModelList() []string {
	return append([]string(nil), modelList...)
}

func (a *TaskAdaptor) GetChannelName() string {
	return "yike"
}

func parseCredentials(key string) (string, string, error) {
	if strings.ContainsAny(key, "\r\n") || strings.Count(key, "|") != 1 {
		return "", "", fmt.Errorf("invalid Yike key format: expected one AccessKeyId|AccessKeySecret pair")
	}
	parts := strings.Split(key, "|")
	if len(parts) != 2 || strings.TrimSpace(parts[0]) == "" || strings.TrimSpace(parts[1]) == "" {
		return "", "", fmt.Errorf("invalid Yike key format: expected AccessKeyId|AccessKeySecret")
	}
	return strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1]), nil
}

// ValidateChannelCredentials validates either one AK|SK pair or a newline-
// separated multi-key set as stored by the channel administration API.
func ValidateChannelCredentials(keys string) error {
	validPairs := 0
	for lineNumber, line := range strings.Split(keys, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if _, _, err := parseCredentials(line); err != nil {
			return fmt.Errorf("invalid Yike credential on line %d: %w", lineNumber+1, err)
		}
		validPairs++
	}
	if validPairs == 0 {
		return fmt.Errorf("at least one Yike AccessKeyId|AccessKeySecret pair is required")
	}
	return nil
}

func ValidateChannelEndpoint(baseURL string) error {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = constant.ChannelBaseURLs[constant.ChannelTypeYike]
	}
	_, err := buildEndpoint(baseURL, nil)
	return err
}

// CheckChannelAccountCredit verifies Yike account-credit access.
func CheckChannelAccountCredit(ctx context.Context, baseURL, key, proxy string) error {
	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return fmt.Errorf("create Yike test client failed: %w", err)
	}
	_, err = FetchAccountCredit(ctx, baseURL, key, client)
	return err
}

// FetchAccountCredit reads and normalizes Yike's three account-credit buckets.
func FetchAccountCredit(ctx context.Context, baseURL, key string, client *http.Client) (AccountCredit, error) {
	accessKeyID, accessKeySecret, err := parseCredentials(key)
	if err != nil {
		return AccountCredit{}, err
	}
	endpoint, err := buildEndpoint(baseURL, nil)
	if err != nil {
		return AccountCredit{}, err
	}
	if ctx == nil {
		ctx = context.Background()
	}
	ctx, cancel := context.WithTimeout(ctx, accountCreditRequestTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, nil)
	if err != nil {
		return AccountCredit{}, fmt.Errorf("create Yike account credit request failed: %w", err)
	}
	if err := defaultV3Signer().sign(req, accountCreditAction, apiVersion, accessKeyID, accessKeySecret); err != nil {
		return AccountCredit{}, fmt.Errorf("sign Yike account credit request failed: %w", err)
	}
	if client == nil {
		client = http.DefaultClient
	}
	response, err := client.Do(req)
	if err != nil {
		return AccountCredit{}, fmt.Errorf("Yike account credit request failed: %w", err)
	}
	defer response.Body.Close()

	body, err := io.ReadAll(io.LimitReader(response.Body, 64*1024))
	if err != nil {
		return AccountCredit{}, fmt.Errorf("read Yike account credit response failed: %w", err)
	}
	var result accountCreditResponse
	if err := common.Unmarshal(body, &result); err != nil {
		if response.StatusCode != http.StatusOK {
			return AccountCredit{}, &AccountCreditError{StatusCode: response.StatusCode}
		}
		return AccountCredit{}, fmt.Errorf("unmarshal Yike account credit response failed: %w", err)
	}
	if result.Code != "" {
		return AccountCredit{}, &AccountCreditError{
			StatusCode: response.StatusCode,
			Code:       result.Code,
			Message:    sanitizeErrorMessage(result.Message),
		}
	}
	if response.StatusCode != http.StatusOK {
		return AccountCredit{}, &AccountCreditError{StatusCode: response.StatusCode}
	}
	return normalizeAccountCredit(result)
}

func normalizeAccountCredit(response accountCreditResponse) (AccountCredit, error) {
	if response.CreditInfo == nil {
		return AccountCredit{}, fmt.Errorf("Yike account credit response did not contain CreditInfo")
	}
	info := response.CreditInfo
	if info.ResourceCreditQuota == nil && info.PackCreditQuota == nil && info.GrantedCreditQuota == nil &&
		info.ResourceCreditQuotaUsage == nil && info.PackCreditQuotaUsage == nil && info.GrantedCreditQuotaUsage == nil {
		return AccountCredit{}, fmt.Errorf("Yike account credit response did not contain credit quotas")
	}
	granted := sumAccountCredits(info.ResourceCreditQuota, info.PackCreditQuota, info.GrantedCreditQuota)
	remaining := sumAccountCredits(info.ResourceCreditQuotaUsage, info.PackCreditQuotaUsage, info.GrantedCreditQuotaUsage)
	if granted.IsNegative() || remaining.IsNegative() || remaining.GreaterThan(granted) {
		return AccountCredit{}, fmt.Errorf("invalid Yike account credit quotas")
	}

	var expiresAt int64
	if response.MembershipInfo != nil && strings.TrimSpace(response.MembershipInfo.EndTime) != "" {
		parsed, err := strconv.ParseInt(strings.TrimSpace(response.MembershipInfo.EndTime), 10, 64)
		if err != nil || parsed < 0 {
			return AccountCredit{}, fmt.Errorf("invalid Yike membership end time")
		}
		expiresAt = parsed
	}
	return AccountCredit{
		Remaining: remaining,
		Used:      granted.Sub(remaining),
		Granted:   granted,
		ExpiresAt: expiresAt,
	}, nil
}

func sumAccountCredits(values ...*decimal.Decimal) decimal.Decimal {
	total := decimal.Zero
	for _, value := range values {
		if value != nil {
			total = total.Add(*value)
		}
	}
	return total
}

func rejectMultipartFiles(c *gin.Context) error {
	contentType := strings.ToLower(strings.TrimSpace(c.GetHeader("Content-Type")))
	if strings.HasPrefix(contentType, "multipart/") || strings.HasPrefix(contentType, "application/octet-stream") {
		return fmt.Errorf("Yike does not support multipart or binary upload; use a public URL or MediaId")
	}
	return nil
}

func convertRequest(req relaycommon.TaskSubmitReq, modelName, clientToken string) (string, url.Values, error) {
	return convertRequestForValidation(req, modelName, clientToken, false)
}

func convertRequestForValidation(req relaycommon.TaskSubmitReq, modelName, clientToken string, allowUnknownModel bool) (string, url.Values, error) {
	modelName = strings.TrimSpace(modelName)
	if !isSupportedModel(modelName) && !allowUnknownModel {
		return "", nil, fmt.Errorf("unsupported Yike model: %s", modelName)
	}
	var metadata requestMetadata
	if err := req.UnmarshalMetadata(&metadata); err != nil {
		return "", nil, err
	}
	if len(bytes.TrimSpace(metadata.JobParameters)) > 0 {
		return "", nil, fmt.Errorf("metadata.job_parameters is not supported by the Yike channel")
	}
	prompt := strings.TrimSpace(req.Prompt)
	if prompt == "" {
		return "", nil, fmt.Errorf("Yike prompt is required")
	}
	medias, err := collectMedias(req, metadata.Medias)
	if err != nil {
		return "", nil, err
	}
	jobType := strings.TrimSpace(metadata.JobType)
	if jobType == "" {
		switch len(medias) {
		case 0:
			jobType = "text_to_video"
		case 1:
			jobType = "image_to_video"
		default:
			return "", nil, fmt.Errorf("multiple media inputs require metadata.job_type")
		}
	}
	if err := validateJobType(jobType, modelName, medias); err != nil {
		return "", nil, err
	}

	resolution, aspectRatio, err := resolveOutputSize(req.Size, metadata.Resolution, metadata.AspectRatio)
	if err != nil {
		return "", nil, err
	}
	duration := req.Duration
	if duration == 0 && strings.TrimSpace(req.Seconds) != "" {
		var parseErr error
		duration, parseErr = strconv.Atoi(strings.TrimSpace(req.Seconds))
		if parseErr != nil {
			return "", nil, fmt.Errorf("invalid Yike seconds: %s", req.Seconds)
		}
	}
	if duration == 0 {
		duration = 5
	}
	if duration < 4 || duration > 15 {
		return "", nil, fmt.Errorf("Yike duration must be between 4 and 15 seconds")
	}
	if metadata.N != nil && *metadata.N != 1 {
		return "", nil, fmt.Errorf("metadata.n must be exactly 1")
	}
	scene := strings.TrimSpace(metadata.Scene)
	if scene == "" {
		scene = "general"
	}
	if scene != "general" {
		return "", nil, fmt.Errorf("unsupported Yike scene: %s", scene)
	}

	inputBytes, err := common.Marshal(upstreamInput{Prompt: prompt, Medias: medias})
	if err != nil {
		return "", nil, err
	}
	query := url.Values{
		"JobType":     []string{jobType},
		"Model":       []string{modelName},
		"Input":       []string{string(inputBytes)},
		"Resolution":  []string{resolution},
		"AspectRatio": []string{aspectRatio},
		"Duration":    []string{strconv.Itoa(duration)},
		"N":           []string{"1"},
		"Scene":       []string{scene},
	}
	if clientToken != "" {
		query.Set("ClientToken", clientToken)
	}
	return jobType, query, nil
}

func collectMedias(req relaycommon.TaskSubmitReq, configured []inputMedia) ([]upstreamMedia, error) {
	if len(configured) > 0 {
		medias := make([]upstreamMedia, 0, len(configured))
		for _, media := range configured {
			converted, err := convertMedia(media)
			if err != nil {
				return nil, err
			}
			medias = append(medias, converted)
		}
		return medias, nil
	}

	inputs := append([]string(nil), req.Images...)
	if len(inputs) == 0 && strings.TrimSpace(req.Image) != "" {
		inputs = append(inputs, req.Image)
	}
	if len(inputs) == 0 && strings.TrimSpace(req.InputReference) != "" {
		inputs = append(inputs, req.InputReference)
	}
	medias := make([]upstreamMedia, 0, len(inputs))
	for _, input := range inputs {
		converted, err := convertMedia(inputMedia{Type: "image", URL: input})
		if err != nil {
			return nil, err
		}
		medias = append(medias, converted)
	}
	return medias, nil
}

func convertMedia(media inputMedia) (upstreamMedia, error) {
	media.Type = strings.ToLower(strings.TrimSpace(media.Type))
	media.URL = strings.TrimSpace(media.URL)
	media.MediaID = strings.TrimSpace(media.MediaID)
	if media.Type == "" {
		media.Type = "image"
	}
	if media.Type != "image" && media.Type != "video" && media.Type != "audio" {
		return upstreamMedia{}, fmt.Errorf("unsupported Yike media type: %s", media.Type)
	}
	if (media.URL == "") == (media.MediaID == "") {
		return upstreamMedia{}, fmt.Errorf("each Yike media requires exactly one of url or media_id")
	}
	if media.URL != "" {
		if !isPublicHTTPURL(media.URL) {
			return upstreamMedia{}, fmt.Errorf("Yike media URL must be a public HTTP(S) URL")
		}
	}
	return upstreamMedia{Type: media.Type, URL: media.URL, MediaID: media.MediaID}, nil
}

func validateJobType(jobType, modelName string, medias []upstreamMedia) error {
	switch jobType {
	case "text_to_video":
		if len(medias) != 0 {
			return fmt.Errorf("text_to_video does not accept media inputs")
		}
	case "image_to_video":
		if len(medias) != 1 || medias[0].Type != "image" {
			return fmt.Errorf("image_to_video requires exactly one image")
		}
	case "first_last_frame":
		if len(medias) != 2 || medias[0].Type != "image" || medias[1].Type != "image" {
			return fmt.Errorf("first_last_frame requires exactly two images")
		}
	case "reference_to_video":
		if len(medias) == 0 {
			return fmt.Errorf("reference_to_video requires at least one media input")
		}
		if strings.HasPrefix(modelName, "happyhorse-") {
			if len(medias) > 9 {
				return fmt.Errorf("HappyHorse reference_to_video supports at most 9 media inputs")
			}
			for _, media := range medias {
				if media.Type == "audio" {
					return fmt.Errorf("HappyHorse reference_to_video does not support audio references")
				}
			}
		}
		if strings.HasPrefix(modelName, "Wonder-") && len(medias) > 15 {
			return fmt.Errorf("Wonder reference_to_video supports at most 15 media inputs")
		}
		if modelName == "wan2.7" {
			return fmt.Errorf("wan2.7 reference_to_video is unavailable until its upstream capability matrix is verified")
		}
	default:
		return fmt.Errorf("unsupported Yike job_type: %s", jobType)
	}
	return nil
}

func resolveOutputSize(size, metadataResolution, metadataAspectRatio string) (string, string, error) {
	resolution := "720P"
	aspectRatio := "16:9"
	size = strings.TrimSpace(size)
	if size != "" {
		upper := strings.ToUpper(size)
		if upper == "720P" || upper == "1080P" {
			resolution = upper
		} else {
			normalized := strings.ToLower(strings.ReplaceAll(strings.ReplaceAll(size, "*", "x"), "×", "x"))
			parts := strings.Split(normalized, "x")
			if len(parts) != 2 {
				return "", "", fmt.Errorf("unsupported Yike size: %s", size)
			}
			width, errWidth := strconv.Atoi(strings.TrimSpace(parts[0]))
			height, errHeight := strconv.Atoi(strings.TrimSpace(parts[1]))
			if errWidth != nil || errHeight != nil {
				return "", "", fmt.Errorf("unsupported Yike size: %s", size)
			}
			mapping := map[[2]int][2]string{
				{1280, 720}:  {"720P", "16:9"},
				{720, 1280}:  {"720P", "9:16"},
				{960, 720}:   {"720P", "4:3"},
				{720, 960}:   {"720P", "3:4"},
				{720, 720}:   {"720P", "1:1"},
				{1920, 1080}: {"1080P", "16:9"},
				{1080, 1920}: {"1080P", "9:16"},
				{1440, 1080}: {"1080P", "4:3"},
				{1080, 1440}: {"1080P", "3:4"},
				{1080, 1080}: {"1080P", "1:1"},
			}
			mapped, ok := mapping[[2]int{width, height}]
			if !ok {
				return "", "", fmt.Errorf("unsupported Yike size: %s", size)
			}
			resolution, aspectRatio = mapped[0], mapped[1]
		}
	}
	if strings.TrimSpace(metadataResolution) != "" {
		resolution = strings.ToUpper(strings.TrimSpace(metadataResolution))
	}
	if strings.TrimSpace(metadataAspectRatio) != "" {
		aspectRatio = strings.TrimSpace(metadataAspectRatio)
	}
	if resolution != "720P" && resolution != "1080P" {
		return "", "", fmt.Errorf("unsupported Yike resolution: %s", resolution)
	}
	validAspectRatios := map[string]bool{"16:9": true, "9:16": true, "4:3": true, "3:4": true, "1:1": true}
	if !validAspectRatios[aspectRatio] {
		return "", "", fmt.Errorf("unsupported Yike aspect_ratio: %s", aspectRatio)
	}
	return resolution, aspectRatio, nil
}

func buildEndpoint(baseURL string, query url.Values) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(baseURL))
	if err != nil {
		return "", fmt.Errorf("invalid Yike base URL: %w", err)
	}
	if !strings.EqualFold(parsed.Scheme, "https") || parsed.Host == "" || parsed.User != nil || parsed.Fragment != "" || parsed.Opaque != "" {
		return "", fmt.Errorf("invalid Yike base URL")
	}
	// The canonical URI is part of the V3 signature. Custom channel URLs may
	// select a host, but must not alter Yike's RPC root path.
	parsed.Scheme = "https"
	parsed.Path = "/"
	parsed.RawPath = ""
	parsed.RawQuery = ""
	parsed.ForceQuery = false
	values := make(url.Values, len(query))
	for key, items := range query {
		for _, item := range items {
			values.Add(key, item)
		}
	}
	parsed.RawQuery = canonicalQuery(values)
	return parsed.String(), nil
}

func isSupportedModel(modelName string) bool {
	for _, candidate := range modelList {
		if modelName == candidate {
			return true
		}
	}
	return false
}

func isPublicHTTPURL(rawURL string) bool {
	parsed, err := url.Parse(rawURL)
	if err != nil || parsed.User != nil || parsed.Host == "" || parsed.Fragment != "" ||
		(parsed.Scheme != "http" && parsed.Scheme != "https") {
		return false
	}
	host := strings.ToLower(strings.TrimSuffix(parsed.Hostname(), "."))
	if host == "" || host == "localhost" || strings.HasSuffix(host, ".localhost") ||
		strings.HasSuffix(host, ".local") || strings.HasSuffix(host, ".internal") {
		return false
	}
	if ip := net.ParseIP(host); ip != nil {
		return !ip.IsLoopback() && !ip.IsPrivate() && !ip.IsUnspecified() &&
			!ip.IsLinkLocalUnicast() && !ip.IsLinkLocalMulticast()
	}
	return true
}

func sanitizeErrorMessage(message string) string {
	message = strings.TrimSpace(message)
	runes := []rune(message)
	if len(runes) > 512 {
		message = string(runes[:512]) + "..."
	}
	for _, field := range strings.Fields(message) {
		if strings.HasPrefix(field, "http://") || strings.HasPrefix(field, "https://") {
			if parsed, err := url.Parse(field); err == nil && parsed.Host != "" {
				message = strings.ReplaceAll(message, field, parsed.Scheme+"://"+parsed.Host+"/***masked***")
			}
		}
	}
	return sensitiveErrorValuePattern.ReplaceAllString(message, "$1=***masked***")
}

var sensitiveErrorValuePattern = regexp.MustCompile(`(?i)\b(accesskeyid|accesskeysecret|authorization|signature)\s*[:=]\s*[^\s,]+`)

func parseJobOutput(raw string) (jobOutput, error) {
	var output jobOutput
	if strings.TrimSpace(raw) == "" {
		return output, fmt.Errorf("Yike task output is empty")
	}
	if err := common.Unmarshal([]byte(raw), &output); err != nil {
		return output, errors.Wrap(err, "unmarshal Yike task output failed")
	}
	return output, nil
}
