package openaivideo

import (
	"net/http"
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

type requestHeaderSetter interface {
	setupRequestHeader(req *http.Request, apiKey string)
}

type jsonBodyProvider interface {
	forceJSONBody() bool
}

type requestNormalizer interface {
	normalizeJSONRequest(bodyMap map[string]interface{}, originModel, upstreamModel string, imageCount int)
	normalizeMultipartRequest(values map[string][]string, originModel, upstreamModel string, imageCount int)
}

func getProvider(channelOther string) provider {
	if prov, ok := getProviderByHint(channelOther); ok {
		return prov
	}
	return &bltcyProvider{}
}

func getProviderByHint(channelOther string) (provider, bool) {
	switch {
	case containsAny(channelOther, "runway"):
		return &runwayProvider{}, true
	case containsAny(channelOther, "lk888", "lk666", "jiushi", "ai聚合站"):
		return &lk888Provider{}, true
	case containsAny(channelOther, "xb-sora2", "xbsora2", "xb-sora", "xbsora", "hongniao"):
		return &xbSoraProvider{}, true
	case containsAny(channelOther, "xgapi", "xingguang"):
		return &xgapiProvider{}, true
	case containsAny(channelOther, "937qq", "qilin"):
		return &qilinProvider{}, true
	case containsAny(channelOther, "apexer"):
		return &apexerapiProvider{}, true
	case containsAny(channelOther, "newapi"):
		return &newapiProvider{}, true
	default:
		return nil, false
	}
}

func getProviderByBaseURL(baseURL string) provider {
	switch {
	case isRunwayBaseURL(baseURL):
		return &runwayProvider{}
	case isLK888BaseURL(baseURL):
		return &lk888Provider{}
	case containsAny(baseURL, "xgapi"):
		return &xgapiProvider{}
	case containsAny(baseURL, "937qq", "qilin"):
		return &qilinProvider{}
	case containsAny(baseURL, "apexer"):
		return &apexerapiProvider{}
	case containsAny(baseURL, "newapi"):
		return &newapiProvider{}
	case isXBSoraBaseURL(baseURL):
		return &xbSoraProvider{}
	default:
		return &bltcyProvider{}
	}
}

func getProviderForRelayInfo(info *relaycommon.RelayInfo) provider {
	if info == nil {
		return &bltcyProvider{}
	}
	baseURL := info.ChannelBaseUrl
	if prov, ok := getProviderByHint(info.ChannelOther); ok {
		return prov
	}
	switch {
	case isRunwayBaseURL(baseURL):
		return &runwayProvider{}
	case isLK888BaseURL(baseURL):
		return &lk888Provider{}
	case containsAny(baseURL, "xgapi"):
		return &xgapiProvider{}
	case containsAny(baseURL, "937qq", "qilin"):
		return &qilinProvider{}
	case containsAny(baseURL, "apexer"):
		return &apexerapiProvider{}
	case containsAny(baseURL, "newapi"):
		return &newapiProvider{}
	case isXBSoraBaseURL(baseURL), isXBSoraModelName(info.OriginModelName), isXBSoraModelName(info.UpstreamModelName):
		return &xbSoraProvider{}
	default:
		return &bltcyProvider{}
	}
}

func getProviderForTaskFetch(baseURL string, body map[string]any) provider {
	if body != nil {
		for _, key := range []string{"provider", "channel_other", "other"} {
			if prov, ok := getProviderByHint(fmtString(body[key])); ok {
				return prov
			}
		}
	}
	switch {
	case isRunwayBaseURL(baseURL):
		return &runwayProvider{}
	case isLK888BaseURL(baseURL):
		return &lk888Provider{}
	case containsAny(baseURL, "xgapi"):
		return &xgapiProvider{}
	case containsAny(baseURL, "937qq", "qilin"):
		return &qilinProvider{}
	case containsAny(baseURL, "apexer"):
		return &apexerapiProvider{}
	case containsAny(baseURL, "newapi"):
		return &newapiProvider{}
	case isXBSoraBaseURL(baseURL):
		return &xbSoraProvider{}
	}
	if body != nil {
		for _, key := range []string{"origin_model_name", "upstream_model_name", "model"} {
			if isXBSoraModelName(fmtString(body[key])) {
				return &xbSoraProvider{}
			}
		}
	}
	return &bltcyProvider{}
}

func isRunwayBaseURL(baseURL string) bool {
	baseURL = strings.ToLower(strings.TrimRight(strings.TrimSpace(baseURL), "/"))
	return strings.Contains(baseURL, "runway") ||
		strings.Contains(baseURL, "127.0.0.1:8787") ||
		strings.Contains(baseURL, "localhost:8787")
}

func isLK888BaseURL(baseURL string) bool {
	baseURL = strings.ToLower(strings.TrimRight(strings.TrimSpace(baseURL), "/"))
	return strings.Contains(baseURL, "api.lk888.ai") ||
		strings.Contains(baseURL, "jiushi.lk666.ai")
}

func isXBSoraBaseURL(baseURL string) bool {
	baseURL = strings.ToLower(strings.TrimRight(strings.TrimSpace(baseURL), "/"))
	return containsAny(baseURL, "xb-sora2", "xbsora2", "xb-sora", "xbsora") ||
		strings.HasSuffix(baseURL, "/api/v1") ||
		strings.HasSuffix(baseURL, "/v1")
}

func fmtString(value any) string {
	if s, ok := value.(string); ok {
		return s
	}
	return ""
}

func isXBSoraModelName(modelName string) bool {
	switch strings.TrimSpace(modelName) {
	case "xb-sora2", "xb-sora-2", "sora-2", "sora-2-pro", "openai-sora-2", "sora-2-pro-text-to-video", "sora-2-image-to-video":
		return true
	default:
		return false
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
	case "processing", "in_progress", "running", "RUNNING", "IN_PROGRESS":
		return model.TaskStatusInProgress
	case "SUCCESS", "SUCCEEDED", "completed", "succeed", "succeeded", "success":
		return model.TaskStatusSuccess
	case "FAILED", "failed", "cancelled", "canceled":
		return model.TaskStatusFailure
	default:
		return ""
	}
}
