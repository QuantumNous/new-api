package middleware

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

const modelStatusProbeStatusThreshold = 3
const modelStatusProbeWindow = 10 * time.Minute

type endpointInfo struct {
	Type   constant.EndpointType `json:"type"`
	Path   string                `json:"path"`
	Method string                `json:"method"`
}

type endpointMismatchProbeState struct {
	Count    int
	LastSeen time.Time
}

var (
	modelStatusProbeMu                sync.Mutex
	modelStatusProbeStates            = map[string]*endpointMismatchProbeState{}
	modelStatusProbeShouldSampleError = func(count int) bool {
		if count < modelStatusProbeStatusThreshold {
			return true
		}
		return common.GetRandomInt(10) == 0
	}
)

func resetModelStatusProbeStateForTest() {
	modelStatusProbeMu.Lock()
	defer modelStatusProbeMu.Unlock()
	modelStatusProbeStates = map[string]*endpointMismatchProbeState{}
}

func handleEndpointMismatchProbe(c *gin.Context, modelName string) bool {
	if !isImageModelOnChatEndpoint(c, modelName) {
		return false
	}

	state := incrementEndpointMismatchProbe(c, modelName)
	if shouldReturnEndpointMismatchError(state.Count) {
		writeEndpointMismatchError(c, modelName)
		return true
	}

	writeModelStatusProbeResponse(c, modelName)
	return true
}

func isImageModelOnChatEndpoint(c *gin.Context, modelName string) bool {
	if c == nil || c.Request == nil || c.Request.URL == nil {
		return false
	}
	if c.Request.URL.Path != "/v1/chat/completions" {
		return false
	}
	return common.IsImageGenerationModel(modelName)
}

func incrementEndpointMismatchProbe(c *gin.Context, modelName string) endpointMismatchProbeState {
	key := endpointMismatchProbeKey(c, modelName)
	modelStatusProbeMu.Lock()
	defer modelStatusProbeMu.Unlock()

	state := modelStatusProbeStates[key]
	if state == nil {
		state = &endpointMismatchProbeState{}
		modelStatusProbeStates[key] = state
	}
	now := time.Now()
	if !state.LastSeen.IsZero() && now.Sub(state.LastSeen) > modelStatusProbeWindow {
		state.Count = 0
	}
	state.Count++
	state.LastSeen = now
	return *state
}

func endpointMismatchProbeKey(c *gin.Context, modelName string) string {
	return fmt.Sprintf("%d|%d|", c.GetInt("id"), c.GetInt("token_id")) +
		common.GetContextKeyString(c, constant.ContextKeyUsingGroup) + "|" +
		common.GetContextKeyString(c, constant.ContextKeyTokenGroup) + "|" +
		c.Request.URL.Path + "|" +
		modelName
}

func shouldReturnEndpointMismatchError(count int) bool {
	return modelStatusProbeShouldSampleError(count)
}

func writeEndpointMismatchError(c *gin.Context, modelName string) {
	c.JSON(http.StatusBadRequest, gin.H{
		"error": gin.H{
			"message": "Model " + modelName + " does not support /v1/chat/completions. Please use /v1/images/generations or /v1/images/edits.",
			"type":    "invalid_request_error",
			"code":    "model_endpoint_mismatch",
		},
	})
	c.Abort()
}

func writeModelStatusProbeResponse(c *gin.Context, modelName string) {
	model.GetPricing()
	endpointTypes := model.GetModelSupportEndpointTypes(modelName)
	endpoints := make([]endpointInfo, 0, len(endpointTypes))
	for _, endpointType := range endpointTypes {
		if info, ok := common.GetDefaultEndpointInfo(endpointType); ok {
			endpoints = append(endpoints, endpointInfo{
				Type:   endpointType,
				Path:   info.Path,
				Method: info.Method,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"model":                    modelName,
		"available":                len(endpointTypes) > 0,
		"supported_endpoint_types": endpointTypes,
		"endpoints":                endpoints,
		"request_classification":   "repeated_endpoint_mismatch_probe",
	})
	c.Abort()
}
