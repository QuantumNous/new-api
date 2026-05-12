package openaivideo

import (
	"strings"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

type provider interface {
	submitURL(baseURL string) string
	queryURL(baseURL, taskID string) string
	parseSubmitResponse(body []byte) (upstreamTaskID string, err error)
	parseQueryResponse(body []byte) (*relaycommon.TaskInfo, error)
	buildSubmitResponseBody(info *relaycommon.RelayInfo, upstreamTaskID string) any
	needsMultipart() bool
	mapModelForImages(model string, hasImages bool) string
}

func getProvider(channelOther string) provider {
	switch {
	case containsAny(channelOther, "xgapi", "xingguang"):
		return &xgapiProvider{}
	case containsAny(channelOther, "apexer"):
		return &apexerapiProvider{}
	case containsAny(channelOther, "newapi"):
		return &newapiProvider{}
	default:
		return &bltcyProvider{}
	}
}

func getProviderByBaseURL(baseURL string) provider {
	switch {
	case containsAny(baseURL, "xgapi"):
		return &xgapiProvider{}
	case containsAny(baseURL, "apexer"):
		return &apexerapiProvider{}
	case containsAny(baseURL, "newapi"):
		return &newapiProvider{}
	default:
		return &bltcyProvider{}
	}
}

func containsAny(s string, keywords ...string) bool {
	s = strings.ToLower(s)
	for _, k := range keywords {
		if strings.Contains(s, strings.ToLower(k)) {
			return true
		}
	}
	return false
}

func statusToTaskStatus(status string) string {
	switch status {
	case "NOT_START", "queued", "pending", "submitted":
		return model.TaskStatusQueued
	case "processing", "in_progress", "RUNNING":
		return model.TaskStatusInProgress
	case "SUCCESS", "completed", "succeed", "succeeded", "success":
		return model.TaskStatusSuccess
	case "FAILED", "failed", "cancelled":
		return model.TaskStatusFailure
	default:
		return ""
	}
}


