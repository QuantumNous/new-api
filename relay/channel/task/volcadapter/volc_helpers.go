package volcadapter

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel/task/doubao"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

// validateVolcNativeTaskRequest parses a Volc-native task submit body minimally.
// It detects the model name and whether content[] has image/video inputs to set action.
func validateVolcNativeTaskRequest(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	var body map[string]json.RawMessage
	if err := common.UnmarshalBodyReusable(c, &body); err != nil {
		return &dto.TaskError{
			Code:       "invalid_request",
			Message:    "invalid request body: " + err.Error(),
			StatusCode: http.StatusBadRequest,
			LocalError: true,
		}
	}

	// Extract model name
	if modelRaw, ok := body["model"]; ok {
		var modelName string
		if err := json.Unmarshal(modelRaw, &modelName); err == nil && modelName != "" {
			info.OriginModelName = modelName
		}
	}
	if info.OriginModelName == "" {
		return &dto.TaskError{
			Code:       "invalid_request",
			Message:    "model is required",
			StatusCode: http.StatusBadRequest,
			LocalError: true,
		}
	}

	// Determine action: if content[] has image_url or video_url items → Generate, else TextGenerate
	action := constant.TaskActionTextGenerate
	if contentRaw, ok := body["content"]; ok {
		if hasImageOrVideoInVolcContent(contentRaw) {
			action = constant.TaskActionGenerate
		}
	}
	// Ensure TaskRelayInfo is initialized before setting Action.
	if info.TaskRelayInfo == nil {
		info.TaskRelayInfo = &relaycommon.TaskRelayInfo{}
	}
	info.Action = action
	return nil
}

// hasImageOrVideoInVolcContent checks whether the Volc content[] JSON array contains
// any item with type "image_url" or "video_url".
func hasImageOrVideoInVolcContent(contentRaw json.RawMessage) bool {
	var items []map[string]json.RawMessage
	if err := json.Unmarshal(contentRaw, &items); err != nil {
		return false
	}
	for _, item := range items {
		typeRaw, ok := item["type"]
		if !ok {
			continue
		}
		var typeStr string
		if err := json.Unmarshal(typeRaw, &typeStr); err != nil {
			continue
		}
		if typeStr == "image_url" || typeStr == "video_url" {
			return true
		}
	}
	return false
}

// hasVideoInVolcContent checks whether the Volc content[] JSON array contains
// any item with type "video_url" (or has a "video_url" key in the item).
func hasVideoInVolcContent(contentRaw json.RawMessage) bool {
	var items []map[string]json.RawMessage
	if err := json.Unmarshal(contentRaw, &items); err != nil {
		return false
	}
	for _, item := range items {
		typeRaw, ok := item["type"]
		if ok {
			var typeStr string
			if err := json.Unmarshal(typeRaw, &typeStr); err == nil && typeStr == "video_url" {
				return true
			}
		}
		if _, hasVideoURL := item["video_url"]; hasVideoURL {
			return true
		}
	}
	return false
}

// estimateBillingVolcNative checks the raw Volc body for video_url content items.
func estimateBillingVolcNative(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil
	}
	rawBytes, err := storage.Bytes()
	if err != nil {
		return nil
	}
	var body map[string]json.RawMessage
	if err = json.Unmarshal(rawBytes, &body); err != nil {
		return nil
	}
	contentRaw, ok := body["content"]
	if !ok {
		return nil
	}
	if hasVideoInVolcContent(contentRaw) {
		if ratio, ok := doubao.GetVideoInputRatio(info.OriginModelName); ok {
			return map[string]float64{"video_input": ratio}
		}
	}
	return nil
}

// patchVolcBodyModel replaces the "model" field in a raw Volc JSON body with
// the mapped upstream model name, preserving all other fields.
func patchVolcBodyModel(rawBody []byte, upstreamModel string) ([]byte, error) {
	var bodyMap map[string]json.RawMessage
	if err := json.Unmarshal(rawBody, &bodyMap); err != nil {
		return rawBody, err
	}
	modelJSON, err := json.Marshal(upstreamModel)
	if err != nil {
		return rawBody, err
	}
	bodyMap["model"] = modelJSON
	return json.Marshal(bodyMap)
}

// readBodyBytes reads raw bytes from gin body storage.
func readBodyBytes(c *gin.Context) ([]byte, error) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, err
	}
	if _, err = storage.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}
	return storage.Bytes()
}
