package relay

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

var sensitivePayloadTextKeys = map[string]struct{}{
	"caption":                {},
	"description":            {},
	"gpt_description_prompt": {},
	"input":                  {},
	"lyrics":                 {},
	"message":                {},
	"negative_prompt":        {},
	"prompt":                 {},
	"tags":                   {},
	"text":                   {},
	"title":                  {},
}

func checkPromptSensitiveForTask(c *gin.Context, info *relaycommon.RelayInfo, checkedScopes map[string]struct{}) *dto.TaskError {
	text := extractSensitiveTextFromTaskContext(c)
	if text == "" {
		return nil
	}
	result := service.CheckSensitiveTextByScope(c, info, text, checkedScopes)
	if !result.Contains {
		return nil
	}
	logSensitiveScopeHit(c, result)
	return service.TaskErrorWrapperLocal(
		errors.New("sensitive words detected"),
		string(types.ErrorCodeSensitiveWordsDetected),
		http.StatusBadRequest,
	)
}

func checkPromptSensitiveForMidjourney(c *gin.Context, info *relaycommon.RelayInfo, request *dto.MidjourneyRequest) *dto.MidjourneyResponse {
	text := extractSensitiveTextFromMidjourneyRequest(info, request)
	if text == "" {
		return nil
	}

	scopeInfo := info
	if scopeInfo == nil {
		scopeInfo = &relaycommon.RelayInfo{}
	}
	if strings.TrimSpace(request.Action) != "" {
		cloned := *scopeInfo
		cloned.OriginModelName = service.CovertMjpActionToModelName(request.Action)
		scopeInfo = &cloned
	}

	result := service.CheckSensitiveTextByScope(c, scopeInfo, text, nil)
	if !result.Contains {
		return nil
	}
	logSensitiveScopeHit(c, result)
	return service.MidjourneyErrorWrapper(constant.MjRequestError, string(types.ErrorCodeSensitiveWordsDetected))
}

func logSensitiveScopeHit(c *gin.Context, result service.SensitiveTextCheckResult) {
	logger.LogWarn(c, fmt.Sprintf(
		"user sensitive words detected: words=%s, rules=%s, rule_names=%s, groups=%s, models=%s, legacy=%t",
		joinLimitedStrings(result.Words, 20),
		joinLimitedStrings(result.Match.RuleIDs, 20),
		joinLimitedStrings(result.Match.RuleNames, 20),
		joinLimitedStrings(result.Scope.EffectiveGroups, 20),
		joinLimitedStrings(result.Scope.ModelCandidates, 20),
		result.Match.Legacy,
	))
}

func extractSensitiveTextFromTaskContext(c *gin.Context) string {
	if c == nil {
		return ""
	}
	if requestValue, ok := c.Get("task_request"); ok {
		if text := collectSensitiveTextFromPayload(requestValue); text != "" {
			return text
		}
	}

	var payload any
	if err := common.UnmarshalBodyReusable(c, &payload); err == nil {
		return collectSensitiveTextFromPayload(payload)
	}
	return ""
}

func extractSensitiveTextFromMidjourneyRequest(info *relaycommon.RelayInfo, request *dto.MidjourneyRequest) string {
	if request == nil || info == nil {
		return ""
	}
	switch info.RelayMode {
	case relayconstant.RelayModeMidjourneyImagine, relayconstant.RelayModeMidjourneyEdits:
		return strings.TrimSpace(request.Prompt)
	default:
		return ""
	}
}

func collectSensitiveTextFromPayload(payload any) string {
	normalized := normalizeSensitivePayload(payload)
	if normalized == nil {
		return ""
	}

	fragments := make([]string, 0, 8)
	seen := make(map[string]struct{}, 8)
	collectSensitiveTextFragments(normalized, &fragments, seen)
	return strings.Join(fragments, "\n")
}

func normalizeSensitivePayload(payload any) any {
	switch payload.(type) {
	case nil, map[string]any, []any:
		return payload
	}

	payloadJSON, err := common.Marshal(payload)
	if err != nil || len(payloadJSON) == 0 {
		return nil
	}

	var normalized any
	if err := common.Unmarshal(payloadJSON, &normalized); err != nil {
		return nil
	}
	return normalized
}

func collectSensitiveTextFragments(value any, fragments *[]string, seen map[string]struct{}) {
	switch typed := value.(type) {
	case map[string]any:
		for key, item := range typed {
			normalizedKey := strings.ToLower(strings.TrimSpace(key))
			if _, ok := sensitivePayloadTextKeys[normalizedKey]; ok {
				collectSensitiveTextValue(item, fragments, seen)
				continue
			}
			collectSensitiveTextFragments(item, fragments, seen)
		}
	case []any:
		for _, item := range typed {
			collectSensitiveTextFragments(item, fragments, seen)
		}
	}
}

func collectSensitiveTextValue(value any, fragments *[]string, seen map[string]struct{}) {
	switch typed := value.(type) {
	case string:
		addSensitiveTextFragment(typed, fragments, seen)
	case []any, map[string]any:
		collectSensitiveTextFragments(typed, fragments, seen)
	}
}

func addSensitiveTextFragment(value string, fragments *[]string, seen map[string]struct{}) {
	value = strings.TrimSpace(value)
	if value == "" {
		return
	}
	key := strings.ToLower(value)
	if _, ok := seen[key]; ok {
		return
	}
	seen[key] = struct{}{}
	*fragments = append(*fragments, value)
}

func joinLimitedStrings(values []string, limit int) string {
	if len(values) == 0 {
		return ""
	}
	if limit <= 0 || len(values) <= limit {
		return strings.Join(values, ", ")
	}
	return fmt.Sprintf("%s, ...(+%d)", strings.Join(values[:limit], ", "), len(values)-limit)
}
