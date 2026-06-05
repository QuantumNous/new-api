// Package blockrunseedance implements the new-api task adaptor for BlockRun's
// VIP Seedance video API (https://blockrun.ai/api/v1/videos/generations).
//
// Protocol (different from every other seedance channel in this tree):
//   - Auth is x402: no Authorization header. The first request returns HTTP 402
//     with payment requirements; we sign an EIP-712 USDC authorization with the
//     channel's EVM wallet key and resend with a PAYMENT-SIGNATURE header.
//   - Submit POST /v1/videos/generations → 202 {id,status,poll_url}. The paid
//     leg is the submit. poll_url (absolutised) is stored as the upstream task id.
//   - Poll GET <poll_url> → 202 {status} while running, 200 {data[0].url} done.
//
// Whitelabel: the wallet key is the channel Key and must never enter any header
// other than the derived signature; the upstream MP4 URL is served via the
// /v1/videos/{task_id}/content proxy, never returned directly.
package blockrunseedance

import (
	"bytes"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	blockrunchat "github.com/QuantumNous/new-api/relay/channel/blockrun"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

const videoGenerationsPath = "/v1/videos/generations"

type TaskAdaptor struct {
	taskcommon.BaseBilling
	ChannelType int
	apiKey      string // EVM wallet private key (0x hex)
	baseURL     string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = info.ChannelBaseUrl
	a.apiKey = info.ApiKey
}

func (a *TaskAdaptor) GetModelList() []string { return ModelList }
func (a *TaskAdaptor) GetChannelName() string { return ChannelName }

// ValidateRequestAndSetAction parses the shared seedance content[] body and runs
// channel-specific value checks (real_face_asset_id rules).
func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	seedReq, err := taskcommon.BindSeedanceRequest(c, info, constant.TaskActionGenerate)
	if err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	if _, ok := upstreamModel(modelName(info, seedReq)); !ok {
		return service.TaskErrorWrapperLocal(
			fmt.Errorf("unsupported model %q; expected one of %v", modelName(info, seedReq), ModelList),
			"invalid_request", http.StatusBadRequest)
	}
	var ext blockrunExtensions
	_ = common.UnmarshalBodyReusable(c, &struct {
		dto.SeedanceVideoRequest
		*blockrunExtensions
	}{SeedanceVideoRequest: *seedReq, blockrunExtensions: &ext})
	if err := validateSeedanceValues(seedReq, ext, modelName(info, seedReq)); err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	return nil
}

// modelName returns the client-facing pseudo model name (mapped name wins).
func modelName(info *relaycommon.RelayInfo, seed *dto.SeedanceVideoRequest) string {
	if info.UpstreamModelName != "" {
		return info.UpstreamModelName
	}
	return seed.Model
}

func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	return a.baseURL + videoGenerationsPath, nil
}

// BuildRequestHeader sets content-type only. x402: NO Authorization / x-api-key
// (the wallet key must never enter a header except as the derived signature).
func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	var inbound struct {
		dto.SeedanceVideoRequest
		blockrunExtensions
	}
	if err := common.UnmarshalBodyReusable(c, &inbound); err != nil {
		return nil, err
	}
	pseudo := modelName(info, &inbound.SeedanceVideoRequest)
	upstreamID, ok := upstreamModel(pseudo)
	if !ok {
		return nil, fmt.Errorf("unsupported model %q", pseudo)
	}
	body := buildBlockrunSeedanceCreateRequest(&inbound.SeedanceVideoRequest, inbound.blockrunExtensions, upstreamID)
	debugLogDropped(&inbound.SeedanceVideoRequest)

	data, err := common.MarshalNoHTMLEscape(body)
	if err != nil {
		return nil, err
	}
	if common.DebugEnabled {
		common.SysLog(fmt.Sprintf("[blockrun-seedance] POST %s body=%s", a.baseURL+videoGenerationsPath, string(data)))
	}
	return bytes.NewReader(data), nil
}

// DoRequest performs the x402 two-trip submit: first POST (unpaid) expecting 402,
// then sign with the wallet key and resend. The signed retry returns 202.
func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	bodyBytes, err := io.ReadAll(requestBody)
	if err != nil {
		return nil, err
	}
	first, err := channel.DoTaskApiRequest(a, c, info, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	if first.StatusCode != http.StatusPaymentRequired {
		return first, nil
	}
	defer func() { _, _ = io.Copy(io.Discard, first.Body); _ = first.Body.Close() }()

	fullURL := a.baseURL + videoGenerationsPath
	sig, err := blockrunchat.SignX402PaymentWithLimits(first, a.apiKey, fullURL, big.NewInt(maxAmountAtomicUSDCVideo))
	if err != nil {
		return nil, err
	}
	return a.signedRequest(http.MethodPost, fullURL, bodyBytes, sig, info.ChannelSetting.Proxy)
}

// signedRequest issues an x402-signed request (PAYMENT-SIGNATURE + X-PAYMENT).
func (a *TaskAdaptor) signedRequest(method, fullURL string, body []byte, signature, proxy string) (*http.Response, error) {
	var r io.Reader
	if body != nil {
		r = bytes.NewReader(body)
	}
	req, err := http.NewRequest(method, fullURL, r)
	if err != nil {
		return nil, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("PAYMENT-SIGNATURE", signature)
	req.Header.Set("X-PAYMENT", signature)
	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

// submitResponse is the 202 (or rare 200) body shape from POST /v1/videos/generations.
type submitResponse struct {
	ID      string `json:"id"`
	Status  string `json:"status"`
	PollURL string `json:"poll_url"`
}

// DoResponse parses the submit result, stores poll_url as the upstream task id,
// and returns the client-facing OpenAI video envelope (public task id only).
func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}
	_ = resp.Body.Close()

	if resp.StatusCode != http.StatusAccepted && resp.StatusCode != http.StatusOK {
		taskErr = service.TaskErrorWrapper(
			fmt.Errorf("blockrun-seedance submit status=%d body=%s", resp.StatusCode, responseBody),
			"upstream_error", http.StatusBadGateway)
		return
	}

	var sub submitResponse
	if err := common.Unmarshal(responseBody, &sub); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}
	if sub.PollURL == "" {
		// Rare synchronous 200-at-submit: no poll_url; persist the body and let
		// ParseTaskResult treat the presence of data[0].url as success.
		if resp.StatusCode == http.StatusOK {
			taskID = a.baseURL + videoGenerationsPath // sentinel, unused for sync result
			taskData = responseBody
			a.writeClientEnvelope(c, info)
			return
		}
		taskErr = service.TaskErrorWrapper(
			fmt.Errorf("blockrun-seedance 202 without poll_url body=%s", responseBody),
			"invalid_response", http.StatusBadGateway)
		return
	}

	pollURL, perr := a.absoluteURL(sub.PollURL)
	if perr != nil {
		taskErr = service.TaskErrorWrapper(perr, "invalid_response", http.StatusBadGateway)
		return
	}
	a.writeClientEnvelope(c, info)
	// upstream task id = absolute poll_url (FetchTask GETs it directly).
	return pollURL, responseBody, nil
}

// writeClientEnvelope returns the whitelabel OpenAI video object (public id only).
func (a *TaskAdaptor) writeClientEnvelope(c *gin.Context, info *relaycommon.RelayInfo) {
	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName
	c.JSON(http.StatusOK, ov)
}

// absoluteURL resolves a possibly-relative poll_url against the gateway origin.
func (a *TaskAdaptor) absoluteURL(pollURL string) (string, error) {
	if len(pollURL) >= 7 && (pollURL[:7] == "http://" || (len(pollURL) >= 8 && pollURL[:8] == "https://")) {
		return pollURL, nil
	}
	base, err := url.Parse(a.baseURL)
	if err != nil {
		return "", fmt.Errorf("parse base url: %w", err)
	}
	return fmt.Sprintf("%s://%s%s", base.Scheme, base.Host, pollURL), nil
}

// statusResponse is the poll body. While running the gateway returns 202 with a
// status; on completion 200 with data[].url.
type statusResponse struct {
	Status string `json:"status"`
	Data   []struct {
		URL string `json:"url"`
	} `json:"data"`
	Error string `json:"error"`
}

// FetchTask GETs the stored poll_url (passed back as body["task_id"]). The poll
// is x402-aware: a 402 is signed with the wallet key and retried, mirroring the
// gateway's design (settlement happens once, at completion).
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	pollURL, ok := body["task_id"].(string)
	if !ok || pollURL == "" {
		return nil, fmt.Errorf("invalid task_id (poll url)")
	}
	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	req, err := http.NewRequest(http.MethodGet, pollURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusPaymentRequired {
		return resp, nil
	}
	// 402 on poll: sign and retry once.
	defer func() { _, _ = io.Copy(io.Discard, resp.Body); _ = resp.Body.Close() }()
	sig, err := blockrunchat.SignX402PaymentWithLimits(resp, key, pollURL, big.NewInt(maxAmountAtomicUSDCVideo))
	if err != nil {
		return nil, err
	}
	return a.signedRequest(http.MethodGet, pollURL, nil, sig, proxy)
}

// ParseTaskResult maps the poll response to a unified TaskInfo. The success URL
// is the upstream MP4; it is stored in task data and only surfaced through the
// proxy by ConvertToOpenAIVideo (never returned raw).
func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var s statusResponse
	if err := common.Unmarshal(respBody, &s); err != nil {
		return nil, errors.Wrap(err, "unmarshal task status failed")
	}
	info := &relaycommon.TaskInfo{Code: 0}
	switch s.Status {
	case "queued":
		info.Status = model.TaskStatusQueued
		info.Progress = taskcommon.ProgressQueued
	case "in_progress":
		info.Status = model.TaskStatusInProgress
		info.Progress = taskcommon.ProgressInProgress
	case "failed":
		info.Status = model.TaskStatusFailure
		info.Progress = taskcommon.ProgressComplete
		info.Reason = taskcommon.ScrubBrandedText(s.Error)
	default:
		// completed: gateway returns 200 with data[].url and (often) empty status.
		if url := firstVideoURL(s); url != "" {
			info.Status = model.TaskStatusSuccess
			info.Progress = taskcommon.ProgressComplete
			info.Url = url
		} else if s.Error != "" {
			info.Status = model.TaskStatusFailure
			info.Progress = taskcommon.ProgressComplete
			info.Reason = taskcommon.ScrubBrandedText(s.Error)
		} else {
			info.Status = model.TaskStatusInProgress
			info.Progress = taskcommon.ProgressInProgress
		}
	}
	return info, nil
}

func firstVideoURL(s statusResponse) string {
	if len(s.Data) > 0 {
		return s.Data[0].URL
	}
	return ""
}

// ExtractUpstreamVideoURL parses the persisted poll/submit body and returns the
// real upstream MP4 URL. Used by controller.VideoProxy to resolve the download
// link server-side without exposing the upstream host to customers.
func ExtractUpstreamVideoURL(taskData []byte) string {
	if len(taskData) == 0 {
		return ""
	}
	var s statusResponse
	if err := common.Unmarshal(taskData, &s); err != nil {
		return ""
	}
	return firstVideoURL(s)
}

// ConvertToOpenAIVideo builds the customer-facing video object. Success uses the
// whitelabel proxy URL (GetResultURL), never the upstream MP4 host; failure text
// is scrubbed of provider branding.
func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	ov := dto.NewOpenAIVideo()
	ov.ID = originTask.TaskID
	ov.TaskID = originTask.TaskID
	ov.Status = originTask.Status.ToVideoStatus()
	ov.SetProgressStr(originTask.Progress)
	ov.CreatedAt = originTask.CreatedAt
	ov.CompletedAt = originTask.UpdatedAt
	ov.Model = originTask.Properties.OriginModelName

	if originTask.Status == model.TaskStatusSuccess {
		ov.SetMetadata("url", originTask.GetResultURL())
	}
	if originTask.Status == model.TaskStatusFailure {
		ov.Error = &dto.OpenAIVideoError{
			Message: taskcommon.ScrubBrandedText(originTask.FailReason),
		}
	}
	return common.Marshal(ov)
}
