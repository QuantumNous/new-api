package doubao

import (
	"fmt"
	"strings"
)

const (
	VolcVideoAPIStyleAuto     = "auto"
	VolcVideoAPIStyleOfficial = "official"
	VolcVideoAPIStyleOpenAI   = "openai"
)

type volcVideoResolvedStyle int

const (
	volcVideoStyleOfficial volcVideoResolvedStyle = iota
	volcVideoStyleOpenAI
)

func normalizeBaseURL(baseURL string) string {
	return strings.TrimSuffix(strings.TrimSpace(baseURL), "/")
}

func ResolveVolcVideoAPIStyle(baseURL, configuredStyle string) volcVideoResolvedStyle {
	switch strings.ToLower(strings.TrimSpace(configuredStyle)) {
	case VolcVideoAPIStyleOfficial:
		return volcVideoStyleOfficial
	case VolcVideoAPIStyleOpenAI:
		return volcVideoStyleOpenAI
	}

	baseURL = normalizeBaseURL(baseURL)
	lower := strings.ToLower(baseURL)
	if strings.HasPrefix(lower, "https://ark.") ||
		strings.HasPrefix(lower, "http://ark.") ||
		strings.HasPrefix(lower, "https://visual.") ||
		strings.HasPrefix(lower, "http://visual.") {
		return volcVideoStyleOfficial
	}
	if strings.HasSuffix(lower, "/api/v3") {
		return volcVideoStyleOfficial
	}
	return volcVideoStyleOpenAI
}

func BuildVideoSubmitURL(baseURL, configuredStyle string) string {
	baseURL = normalizeBaseURL(baseURL)
	if ResolveVolcVideoAPIStyle(baseURL, configuredStyle) == volcVideoStyleOfficial {
		if strings.HasSuffix(strings.ToLower(baseURL), "/api/v3") {
			return baseURL + "/contents/generations/tasks"
		}
		return baseURL + "/api/v3/contents/generations/tasks"
	}
	return baseURL + "/v1/video/generations"
}

func BuildVideoFetchURL(baseURL, configuredStyle, taskID string) string {
	baseURL = normalizeBaseURL(baseURL)
	if ResolveVolcVideoAPIStyle(baseURL, configuredStyle) == volcVideoStyleOfficial {
		if strings.HasSuffix(strings.ToLower(baseURL), "/api/v3") {
			return fmt.Sprintf("%s/contents/generations/tasks/%s", baseURL, taskID)
		}
		return fmt.Sprintf("%s/api/v3/contents/generations/tasks/%s", baseURL, taskID)
	}
	return fmt.Sprintf("%s/v1/video/generations/%s", baseURL, taskID)
}
