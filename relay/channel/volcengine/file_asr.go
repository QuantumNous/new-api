package volcengine

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/common/objectstorage"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/performance_setting"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	fileASRSubmitEndpoint     = "https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit"
	fileASRQueryEndpoint      = "https://openspeech.bytedance.com/api/v3/auc/bigmodel/query"
	fileASRBigModelResourceID = "volc.bigasr.auc"
	fileASRDefaultTimeout     = 10 * time.Minute
	fileASRMaxAudioBytes      = 128 << 20
)

var (
	fileASRHTTPClient = http.DefaultClient
	fileASRSubmitURL  = fileASRSubmitEndpoint
	fileASRQueryURL   = fileASRQueryEndpoint
)

type fileASRRequest struct {
	User    fileASRUser    `json:"user"`
	Audio   fileASRAudio   `json:"audio"`
	Request fileASROptions `json:"request"`
}
type fileASRUser struct {
	UID string `json:"uid"`
}
type fileASRAudio struct {
	URL string `json:"url"`
}
type fileASROptions struct {
	ModelName          string `json:"model_name"`
	EnableITN          bool   `json:"enable_itn,omitempty"`
	EnablePunc         bool   `json:"enable_punc,omitempty"`
	EnableDDC          bool   `json:"enable_ddc,omitempty"`
	ShowUtterances     bool   `json:"show_utterances,omitempty"`
	EnableSpeakerInfo  bool   `json:"enable_speaker_info,omitempty"`
	EnableChannelSplit bool   `json:"enable_channel_split,omitempty"`
}

type fileASRResult struct {
	Text       string `json:"text"`
	Utterances []struct {
		Text      string `json:"text"`
		StartTime int64  `json:"start_time"`
		EndTime   int64  `json:"end_time"`
		Words     []struct {
			Text      string `json:"text"`
			StartTime int64  `json:"start_time"`
			EndTime   int64  `json:"end_time"`
		} `json:"words,omitempty"`
	} `json:"utterances,omitempty"`
}

func fileASRResourceID(model string) string {
	model = strings.ToLower(strings.TrimSpace(model))
	// File ASR uses the BigASR resource. The public doubao SeedASR model
	// name normally resolves to the streaming resource, but its file-mode
	// endpoint requires volc.bigasr.auc instead.
	if strings.Contains(model, "bigasr") || strings.Contains(model, "doubao-seed-asr-2") {
		return fileASRBigModelResourceID
	}
	return asrDefaultResourceID
}

func fileASRHeaders(apiKey, resourceID, requestID string) http.Header {
	h := http.Header{}
	h.Set("Content-Type", "application/json")
	h.Set("X-Api-Resource-Id", resourceID)
	h.Set("X-Api-Request-Id", requestID)
	h.Set("X-Api-Connect-Id", requestID)
	if strings.HasPrefix(strings.TrimSpace(apiKey), "ark-") {
		h.Set("X-Api-Key", strings.TrimSpace(apiKey))
	} else {
		parts := strings.SplitN(apiKey, "|", 2)
		if len(parts) == 2 {
			h.Set("X-Api-App-Key", parts[0])
			h.Set("X-Api-Access-Key", parts[1])
		}
	}
	return h
}

func submitFileASR(ctx context.Context, client *http.Client, apiKey, resourceID, audioURL string, options fileASROptions) (string, error) {
	requestID := uuid.New().String()
	body, err := common.Marshal(fileASRRequest{User: fileASRUser{UID: requestID}, Audio: fileASRAudio{URL: audioURL}, Request: options})
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fileASRSubmitURL, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header = fileASRHeaders(apiKey, resourceID, requestID)
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	responseBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("file ASR submit failed: status=%d body=%s", resp.StatusCode, string(responseBody))
	}
	if status := resp.Header.Get("X-Api-Status-Code"); status != "" && status != "20000000" {
		return "", fmt.Errorf("file ASR submit failed: code=%s message=%s", status, resp.Header.Get("X-Api-Message"))
	}
	return requestID, nil
}

func queryFileASR(ctx context.Context, client *http.Client, apiKey, resourceID, requestID string) (*fileASRResult, bool, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fileASRQueryURL, bytes.NewReader([]byte("{}")))
	if err != nil {
		return nil, false, err
	}
	req.Header = fileASRHeaders(apiKey, resourceID, requestID)
	resp, err := client.Do(req)
	if err != nil {
		return nil, false, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, false, fmt.Errorf("file ASR query failed: status=%d", resp.StatusCode)
	}
	if len(bytes.TrimSpace(body)) == 0 || string(bytes.TrimSpace(body)) == "{}" {
		return nil, false, nil
	}
	var result fileASRResult
	if err := common.Unmarshal(body, &result); err != nil {
		return nil, false, err
	}
	return &result, true, nil
}

func pollFileASR(ctx context.Context, client *http.Client, apiKey, resourceID, requestID string) (*fileASRResult, error) {
	pollCtx, cancel := context.WithTimeout(ctx, fileASRDefaultTimeout)
	defer cancel()
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	for {
		result, done, err := queryFileASR(pollCtx, client, apiKey, resourceID, requestID)
		if err != nil {
			return nil, err
		}
		if done {
			return result, nil
		}
		select {
		case <-pollCtx.Done():
			return nil, pollCtx.Err()
		case <-ticker.C:
		}
	}
}

func writeFileASRResponse(c *gin.Context, result *fileASRResult, responseFormat string) (*dto.Usage, *types.NewAPIError) {
	if responseFormat == "verbose_json" || responseFormat == "json" {
		body, err := common.Marshal(result)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
		}
		c.Data(http.StatusOK, "application/json", body)
	} else {
		body, err := common.Marshal(map[string]string{"text": result.Text})
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
		}
		c.Data(http.StatusOK, "application/json", body)
	}
	return &dto.Usage{PromptTokens: 0, CompletionTokens: 0, TotalTokens: 0}, nil
}

func transcribeFileWithTOS(ctx context.Context, c *gin.Context, infoModel, apiKey string, audio *asrContextData) (*fileASRResult, error) {
	if len(audio.audioData) == 0 {
		return nil, fmt.Errorf("audio file is empty")
	}
	if len(audio.audioData) > fileASRMaxAudioBytes {
		return nil, fmt.Errorf("audio file exceeds %d byte limit", fileASRMaxAudioBytes)
	}
	config := performance_setting.GetTOSConfig()
	storage, err := objectstorage.NewTOS(config)
	if err != nil {
		return nil, err
	}
	key := objectstorage.BuildKey(config.KeyPrefix, ".audio")
	if err := storage.Put(ctx, key, bytes.NewReader(audio.audioData), int64(len(audio.audioData)), "application/octet-stream"); err != nil {
		return nil, err
	}
	defer func() {
		if deleteErr := storage.Delete(context.Background(), key); deleteErr != nil {
			common.SysLog(fmt.Sprintf("TOS temporary ASR object cleanup failed: %v", deleteErr))
		}
	}()
	url, err := storage.PresignGet(key)
	if err != nil {
		return nil, err
	}
	requestID, err := submitFileASR(ctx, fileASRHTTPClient, apiKey, fileASRResourceID(infoModel), url, fileASROptions{ModelName: "bigmodel", EnableITN: true, EnablePunc: true, ShowUtterances: true})
	if err != nil {
		return nil, err
	}
	return pollFileASR(ctx, fileASRHTTPClient, apiKey, fileASRResourceID(infoModel), requestID)
}

var _ = json.Valid
