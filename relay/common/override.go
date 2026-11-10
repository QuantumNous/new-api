package common

import (
	"errors"
	"fmt"
	"maps"
	"net/http"
	"regexp"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"

	"github.com/MoeForge/moego/ojson"
	"github.com/QuantumNous/new-api/common"
	kitreasoning "github.com/QuantumNous/new-api/relaykit/relayconvert/reasoning"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/samber/lo"
)

var negativeIndexRegexp = regexp.MustCompile(`\.(-\d+)`)

// Param override rules are re-parsed for every request, so compiled patterns are
// shared by pattern text instead of being stored on the parsed operations.
var paramOverrideRegexCache sync.Map // map[string]*regexp.Regexp

func getParamOverrideRegex(pattern string) (*regexp.Regexp, error) {
	if cached, ok := paramOverrideRegexCache.Load(pattern); ok {
		return cached.(*regexp.Regexp), nil
	}
	compiled, err := regexp.Compile(pattern)
	if err != nil {
		return nil, err
	}
	actual, _ := paramOverrideRegexCache.LoadOrStore(pattern, compiled)
	return actual.(*regexp.Regexp), nil
}

const (
	paramOverrideContextRequestHeaders = "request_headers"
	paramOverrideContextHeaderOverride = "header_override"
	paramOverrideContextAuditRecorder  = "__param_override_audit_recorder"
)

var errSourceHeaderNotFound = errors.New("source header does not exist")

var paramOverrideSensitivePathPrefixes = []string{
	"model",
	"original_model",
	"upstream_model",
	"reasoning",
	"reasoning_effort",
	"output_config",
	"generationConfig.thinkingConfig",
	"generation_config.thinking_config",
	"service_tier",
	"inference_geo",
	"speed",
	"messages",
	"input",
	"instructions",
	"system",
	"contents",
	"systemInstruction",
	"system_instruction",
}

type paramOverrideAuditRecorder struct {
	lines []string
}

type ConditionOperation struct {
	Path           string `json:"path"`             // JSON路径
	Mode           string `json:"mode"`             // full, prefix, suffix, contains, regex, gt, gte, lt, lte
	Value          any    `json:"value"`            // 匹配的值
	Invert         bool   `json:"invert"`           // 反选功能，true表示取反结果
	PassMissingKey bool   `json:"pass_missing_key"` // 未获取到json key时的行为
}

type ParamOperation struct {
	Path       string               `json:"path"`
	Mode       string               `json:"mode"` // delete, set, move, copy, prepend, append, trim_prefix, trim_suffix, ensure_prefix, ensure_suffix, trim_space, to_lower, to_upper, replace, regex_replace, return_error, prune_objects, set_header, delete_header, copy_header, move_header, pass_headers, sync_fields
	Value      any                  `json:"value"`
	KeepOrigin bool                 `json:"keep_origin"`
	From       string               `json:"from,omitempty"`
	To         string               `json:"to,omitempty"`
	Conditions []ConditionOperation `json:"conditions,omitempty"` // 条件列表
	Logic      string               `json:"logic,omitempty"`      // AND, OR (默认OR)
}

type ParamOverrideReturnError struct {
	Message    string
	StatusCode int
	Code       string
	Type       string
	SkipRetry  bool
}

func (e *ParamOverrideReturnError) Error() string {
	if e == nil {
		return "param override return error"
	}
	if e.Message == "" {
		return "param override return error"
	}
	return e.Message
}

func AsParamOverrideReturnError(err error) (*ParamOverrideReturnError, bool) {
	if err == nil {
		return nil, false
	}
	var target *ParamOverrideReturnError
	if errors.As(err, &target) {
		return target, true
	}
	return nil, false
}

func NewAPIErrorFromParamOverride(err *ParamOverrideReturnError) *types.NewAPIError {
	if err == nil {
		return types.NewError(
			errors.New("param override return error is nil"),
			types.ErrorCodeChannelParamOverrideInvalid,
			types.ErrOptionWithSkipRetry(),
		)
	}

	statusCode := err.StatusCode
	if statusCode < http.StatusContinue || statusCode > http.StatusNetworkAuthenticationRequired {
		statusCode = http.StatusBadRequest
	}

	errorCode := err.Code
	if strings.TrimSpace(errorCode) == "" {
		errorCode = string(types.ErrorCodeInvalidRequest)
	}

	errorType := err.Type
	if strings.TrimSpace(errorType) == "" {
		errorType = "invalid_request_error"
	}

	message := strings.TrimSpace(err.Message)
	if message == "" {
		message = "request blocked by param override"
	}

	opts := make([]types.NewAPIErrorOptions, 0, 1)
	if err.SkipRetry {
		opts = append(opts, types.ErrOptionWithSkipRetry())
	}

	return types.WithOpenAIError(types.OpenAIError{
		Message: message,
		Type:    errorType,
		Code:    errorCode,
	}, statusCode, opts...)
}

func ApplyParamOverride(jsonData []byte, paramOverride map[string]any, conditionContext map[string]any) ([]byte, error) {
	if len(paramOverride) == 0 {
		return jsonData, nil
	}
	auditRecorder := getParamOverrideAuditRecorder(conditionContext)
	// 新旧两种格式的所有修改都在同一个 Doc 上进行，最后只生成一次输出
	doc := ojson.NewDoc(jsonData)

	// 尝试断言为操作格式
	if operations, ok := tryParseOperations(paramOverride); ok {
		legacyOverride := buildLegacyParamOverride(paramOverride)
		if len(legacyOverride) > 0 {
			if err := applyOperationsLegacy(doc, legacyOverride, auditRecorder); err != nil {
				return nil, err
			}
		}

		return applyOperations(doc, operations, conditionContext)
	}

	// 直接使用旧方法
	if err := applyOperationsLegacy(doc, paramOverride, auditRecorder); err != nil {
		return nil, err
	}
	return doc.Bytes(), nil
}

func buildLegacyParamOverride(paramOverride map[string]any) map[string]any {
	if len(paramOverride) == 0 {
		return nil
	}
	legacy := make(map[string]any, len(paramOverride))
	for key, value := range paramOverride {
		if strings.EqualFold(strings.TrimSpace(key), "operations") {
			continue
		}
		legacy[key] = value
	}
	return legacy
}

func ApplyParamOverrideWithRelayInfo(jsonData []byte, info *RelayInfo) ([]byte, error) {
	paramOverride := getParamOverrideMap(info)
	if len(paramOverride) == 0 {
		return jsonData, nil
	}

	overrideCtx := BuildParamOverrideContext(info)
	var recorder *paramOverrideAuditRecorder
	if shouldEnableParamOverrideAudit(paramOverride) {
		recorder = &paramOverrideAuditRecorder{}
		overrideCtx[paramOverrideContextAuditRecorder] = recorder
	}
	result, err := ApplyParamOverride(jsonData, paramOverride, overrideCtx)
	if err != nil {
		return nil, err
	}
	syncReasoningEffortAfterParamOverride(info, jsonData, result)
	syncRuntimeHeaderOverrideFromContext(info, overrideCtx)
	if info != nil {
		if recorder != nil {
			info.ParamOverrideAudit = recorder.lines
		} else {
			info.ParamOverrideAudit = nil
		}
	}
	return result, nil
}

func syncReasoningEffortAfterParamOverride(info *RelayInfo, before, after []byte) {
	if info == nil {
		return
	}
	_, existedBefore := extractReasoningEffortFromJSON(info.GetFinalRequestRelayFormat(), before)
	effort, existsAfter := extractReasoningEffortFromJSON(info.GetFinalRequestRelayFormat(), after)
	if existsAfter {
		info.SetReasoningEffort(effort)
		return
	}
	if existedBefore {
		info.SetReasoningEffort("")
	}
}

func extractReasoningEffortFromJSON(format types.RelayFormat, data []byte) (string, bool) {
	switch format {
	case types.RelayFormatOpenAI:
		if effort, exists := firstStringValue(data, "reasoning_effort"); exists && effort != "" {
			return effort, true
		}
		if enabled := ojson.GetBytes(data, "reasoning.enabled"); enabled.Exists() {
			if enabled.Type != ojson.True && enabled.Type != ojson.False {
				return "", true
			}
			if !enabled.Bool() {
				return string(kitreasoning.EffortNone), true
			}
			if effort, exists := firstStringValue(data, "reasoning.effort"); exists && effort != "" {
				return effort, true
			}
			if budget := ojson.GetBytes(data, "reasoning.max_tokens"); budget.Exists() {
				return reasoningEffortFromBudgetValue(budget)
			}
			return string(kitreasoning.EffortHigh), true
		}
		if effort, exists := firstStringValue(data, "reasoning.effort"); exists && effort != "" {
			return effort, true
		}
		if budget := ojson.GetBytes(data, "reasoning.max_tokens"); budget.Exists() {
			return reasoningEffortFromBudgetValue(budget)
		}
		return "", false
	case types.RelayFormatOpenAIResponses:
		return firstStringValue(data, "reasoning.effort")
	case types.RelayFormatClaude:
		if effort, exists := firstStringValue(data, "output_config.effort"); exists && effort != "" {
			return effort, true
		}
		thinkingType, hasThinkingType := firstStringValue(data, "thinking.type")
		if thinkingType == "disabled" {
			return string(kitreasoning.EffortNone), true
		}
		if budget := ojson.GetBytes(data, "thinking.budget_tokens"); budget.Exists() {
			return reasoningEffortFromBudgetValue(budget)
		}
		if thinkingType == "enabled" || thinkingType == "adaptive" {
			return string(kitreasoning.EffortHigh), true
		}
		return "", hasThinkingType
	case types.RelayFormatGemini:
		level, hasLevel := firstStringValue(data,
			"generationConfig.thinkingConfig.thinkingLevel",
			"generation_config.thinking_config.thinking_level",
		)
		if level != "" {
			return level, true
		}
		for _, path := range []string{
			"generationConfig.thinkingConfig.thinkingBudget",
			"generation_config.thinking_config.thinking_budget",
		} {
			if budget := ojson.GetBytes(data, path); budget.Exists() {
				return reasoningEffortFromBudgetValue(budget)
			}
		}
		return "", hasLevel
	default:
		return "", false
	}
}

func firstStringValue(data []byte, paths ...string) (string, bool) {
	for _, path := range paths {
		value := ojson.GetBytes(data, path)
		if !value.Exists() {
			continue
		}
		if value.Type != ojson.String {
			return "", true
		}
		return strings.TrimSpace(value.String()), true
	}
	return "", false
}

func reasoningEffortFromBudgetValue(value ojson.Result) (string, bool) {
	if value.Type != ojson.Number {
		return "", true
	}
	budget := value.Float()
	switch {
	case budget == 0:
		return string(kitreasoning.EffortNone), true
	case budget < 0:
		return string(kitreasoning.EffortHigh), true
	case budget <= 1024:
		return string(kitreasoning.EffortLow), true
	case budget <= 8192:
		return string(kitreasoning.EffortMedium), true
	default:
		return string(kitreasoning.EffortHigh), true
	}
}

func shouldEnableParamOverrideAudit(paramOverride map[string]any) bool {
	if common.DebugEnabled {
		return true
	}
	if len(paramOverride) == 0 {
		return false
	}
	if operations, ok := tryParseOperations(paramOverride); ok {
		for _, operation := range operations {
			if shouldAuditParamPath(strings.TrimSpace(operation.Path)) ||
				shouldAuditParamPath(strings.TrimSpace(operation.From)) ||
				shouldAuditParamPath(strings.TrimSpace(operation.To)) {
				return true
			}
		}
		for key := range buildLegacyParamOverride(paramOverride) {
			if shouldAuditParamPath(strings.TrimSpace(key)) {
				return true
			}
		}
		return false
	}
	for key := range paramOverride {
		if shouldAuditParamPath(strings.TrimSpace(key)) {
			return true
		}
	}
	return false
}

func getParamOverrideAuditRecorder(context map[string]any) *paramOverrideAuditRecorder {
	if context == nil {
		return nil
	}
	recorder, _ := context[paramOverrideContextAuditRecorder].(*paramOverrideAuditRecorder)
	return recorder
}

func (r *paramOverrideAuditRecorder) recordOperation(mode, path, from, to string, value any) {
	if r == nil {
		return
	}
	line := buildParamOverrideAuditLine(mode, path, from, to, value)
	if line == "" {
		return
	}
	if lo.Contains(r.lines, line) {
		return
	}
	r.lines = append(r.lines, line)
}

func shouldAuditParamPath(path string) bool {
	path = strings.TrimSpace(path)
	if path == "" {
		return false
	}
	if common.DebugEnabled {
		return true
	}
	for _, prefix := range paramOverrideSensitivePathPrefixes {
		if path == prefix || strings.HasPrefix(path, prefix+".") {
			return true
		}
	}
	return false
}

func shouldAuditOperation(mode, path, from, to string) bool {
	if common.DebugEnabled {
		return true
	}
	return slices.ContainsFunc([]string{path, from, to}, shouldAuditParamPath)
}

func formatParamOverrideAuditValue(value any) string {
	switch typed := value.(type) {
	case nil:
		return "<empty>"
	case string:
		return typed
	default:
		return common.GetJsonString(typed)
	}
}

func buildParamOverrideAuditLine(mode, path, from, to string, value any) string {
	mode = strings.TrimSpace(mode)
	path = strings.TrimSpace(path)
	from = strings.TrimSpace(from)
	to = strings.TrimSpace(to)

	if !shouldAuditOperation(mode, path, from, to) {
		return ""
	}

	switch mode {
	case "set":
		if path == "" {
			return ""
		}
		return fmt.Sprintf("set %s = %s", path, formatParamOverrideAuditValue(value))
	case "delete":
		if path == "" {
			return ""
		}
		return fmt.Sprintf("delete %s", path)
	case "copy":
		if from == "" || to == "" {
			return ""
		}
		return fmt.Sprintf("copy %s -> %s", from, to)
	case "move":
		if from == "" || to == "" {
			return ""
		}
		return fmt.Sprintf("move %s -> %s", from, to)
	case "prepend":
		if path == "" {
			return ""
		}
		return fmt.Sprintf("prepend %s with %s", path, formatParamOverrideAuditValue(value))
	case "append":
		if path == "" {
			return ""
		}
		return fmt.Sprintf("append %s with %s", path, formatParamOverrideAuditValue(value))
	case "trim_prefix", "trim_suffix", "ensure_prefix", "ensure_suffix":
		if path == "" {
			return ""
		}
		return fmt.Sprintf("%s %s with %s", mode, path, formatParamOverrideAuditValue(value))
	case "trim_space", "to_lower", "to_upper":
		if path == "" {
			return ""
		}
		return fmt.Sprintf("%s %s", mode, path)
	case "replace", "regex_replace":
		if path == "" {
			return ""
		}
		return fmt.Sprintf("%s %s from %s to %s", mode, path, from, to)
	case "set_header":
		if path == "" {
			return ""
		}
		return fmt.Sprintf("set_header %s = %s", path, formatParamOverrideAuditValue(value))
	case "delete_header":
		if path == "" {
			return ""
		}
		return fmt.Sprintf("delete_header %s", path)
	case "copy_header", "move_header":
		if from == "" || to == "" {
			return ""
		}
		return fmt.Sprintf("%s %s -> %s", mode, from, to)
	case "pass_headers":
		return fmt.Sprintf("pass_headers %s", formatParamOverrideAuditValue(value))
	case "sync_fields":
		if from == "" || to == "" {
			return ""
		}
		return fmt.Sprintf("sync_fields %s -> %s", from, to)
	case "return_error":
		return fmt.Sprintf("return_error %s", formatParamOverrideAuditValue(value))
	default:
		if path == "" {
			return mode
		}
		return fmt.Sprintf("%s %s", mode, path)
	}
}

func getParamOverrideMap(info *RelayInfo) map[string]any {
	if info == nil || info.ChannelMeta == nil {
		return nil
	}
	return info.ChannelMeta.ParamOverride
}

func getHeaderOverrideMap(info *RelayInfo) map[string]any {
	if info == nil || info.ChannelMeta == nil {
		return nil
	}
	return info.ChannelMeta.HeadersOverride
}

func sanitizeHeaderOverrideMap(source map[string]any) map[string]any {
	if len(source) == 0 {
		return map[string]any{}
	}
	target := make(map[string]any, len(source))
	for key, value := range source {
		normalizedKey := normalizeHeaderContextKey(key)
		if normalizedKey == "" {
			continue
		}
		normalizedValue := strings.TrimSpace(fmt.Sprintf("%v", value))
		if normalizedValue == "" {
			if isHeaderPassthroughRuleKeyForOverride(normalizedKey) {
				target[normalizedKey] = ""
			}
			continue
		}
		target[normalizedKey] = normalizedValue
	}
	return target
}

func isHeaderPassthroughRuleKeyForOverride(key string) bool {
	key = strings.TrimSpace(strings.ToLower(key))
	if key == "" {
		return false
	}
	if key == "*" {
		return true
	}
	return strings.HasPrefix(key, "re:") || strings.HasPrefix(key, "regex:")
}

func GetEffectiveHeaderOverride(info *RelayInfo) map[string]any {
	if info == nil {
		return map[string]any{}
	}
	if info.UseRuntimeHeadersOverride {
		return sanitizeHeaderOverrideMap(info.RuntimeHeadersOverride)
	}
	return sanitizeHeaderOverrideMap(getHeaderOverrideMap(info))
}

func tryParseOperations(paramOverride map[string]any) ([]ParamOperation, bool) {
	// 检查是否包含 "operations" 字段
	opsValue, exists := paramOverride["operations"]
	if !exists {
		return nil, false
	}

	var opMaps []map[string]any
	switch ops := opsValue.(type) {
	case []any:
		opMaps = make([]map[string]any, 0, len(ops))
		for _, op := range ops {
			opMap, ok := op.(map[string]any)
			if !ok {
				return nil, false
			}
			opMaps = append(opMaps, opMap)
		}
	case []map[string]any:
		opMaps = ops
	default:
		return nil, false
	}

	operations := make([]ParamOperation, 0, len(opMaps))
	for _, opMap := range opMaps {
		operation := ParamOperation{}

		// 断言必要字段
		if path, ok := opMap["path"].(string); ok {
			operation.Path = path
		}
		if mode, ok := opMap["mode"].(string); ok {
			operation.Mode = mode
		} else {
			return nil, false // mode 是必需的
		}

		// 可选字段
		if value, exists := opMap["value"]; exists {
			operation.Value = value
		}
		if keepOrigin, ok := opMap["keep_origin"].(bool); ok {
			operation.KeepOrigin = keepOrigin
		}
		if from, ok := opMap["from"].(string); ok {
			operation.From = from
		}
		if to, ok := opMap["to"].(string); ok {
			operation.To = to
		}
		if logic, ok := opMap["logic"].(string); ok {
			operation.Logic = logic
		} else {
			operation.Logic = "OR" // 默认为OR
		}

		// 解析条件
		if conditions, exists := opMap["conditions"]; exists {
			parsedConditions, err := parseConditionOperations(conditions)
			if err != nil {
				return nil, false
			}
			operation.Conditions = append(operation.Conditions, parsedConditions...)
		}

		operations = append(operations, operation)
	}
	return operations, true
}

func checkConditions(doc *ojson.Doc, contextJSON string, conditions []ConditionOperation, logic string) (bool, error) {
	if len(conditions) == 0 {
		return true, nil // 没有条件，直接通过
	}
	results := make([]bool, len(conditions))
	for i := range conditions {
		result, err := checkSingleCondition(doc, contextJSON, &conditions[i])
		if err != nil {
			return false, err
		}
		results[i] = result
	}

	if strings.ToUpper(logic) == "AND" {
		return lo.EveryBy(results, func(item bool) bool { return item }), nil
	}
	return lo.SomeBy(results, func(item bool) bool { return item }), nil
}

func checkSingleCondition(doc *ojson.Doc, contextJSON string, condition *ConditionOperation) (bool, error) {
	// 处理负数索引
	path := processNegativeIndex(doc, condition.Path)
	value := doc.Get(path)
	if !value.Exists() && contextJSON != "" {
		value = ojson.Get(contextJSON, condition.Path)
	}
	if !value.Exists() {
		if condition.PassMissingKey {
			return true, nil
		}
		return false, nil
	}

	// 利用ojson的类型解析
	targetBytes, err := common.Marshal(condition.Value)
	if err != nil {
		return false, fmt.Errorf("failed to marshal condition value: %v", err)
	}
	targetValue := ojson.ParseBytes(targetBytes)

	result, err := condition.compareGjsonValues(value, targetValue)
	if err != nil {
		return false, fmt.Errorf("comparison failed for path %s: %v", condition.Path, err)
	}

	if condition.Invert {
		result = !result
	}
	return result, nil
}

func processNegativeIndex(doc *ojson.Doc, path string) string {
	matches := negativeIndexRegexp.FindAllStringSubmatch(path, -1)

	if len(matches) == 0 {
		return path
	}

	result := path
	for _, match := range matches {
		negIndex := match[1]
		index, _ := strconv.Atoi(negIndex)

		arrayPath := strings.Split(path, negIndex)[0]
		if strings.HasSuffix(arrayPath, ".") {
			arrayPath = arrayPath[:len(arrayPath)-1]
		}

		array := doc.Get(arrayPath)
		if array.IsArray() {
			length := len(array.Array())
			actualIndex := length + index
			if actualIndex >= 0 && actualIndex < length {
				result = strings.Replace(result, match[0], "."+strconv.Itoa(actualIndex), 1)
			}
		}
	}

	return result
}

// compareGjsonValues 直接比较两个ojson.Result，支持所有比较模式
func (condition *ConditionOperation) compareGjsonValues(jsonValue, targetValue ojson.Result) (bool, error) {
	mode := strings.ToLower(condition.Mode)
	switch mode {
	case "full":
		return compareEqual(jsonValue, targetValue)
	case "prefix":
		return strings.HasPrefix(jsonValue.String(), targetValue.String()), nil
	case "suffix":
		return strings.HasSuffix(jsonValue.String(), targetValue.String()), nil
	case "contains":
		return strings.Contains(jsonValue.String(), targetValue.String()), nil
	case "regex":
		if targetValue.Type != ojson.String {
			return false, fmt.Errorf("regex pattern must be a string")
		}
		re, err := getParamOverrideRegex(targetValue.String())
		if err != nil {
			return false, fmt.Errorf("invalid regex pattern: %w", err)
		}
		return re.MatchString(jsonValue.String()), nil
	case "gt":
		return compareNumeric(jsonValue, targetValue, "gt")
	case "gte":
		return compareNumeric(jsonValue, targetValue, "gte")
	case "lt":
		return compareNumeric(jsonValue, targetValue, "lt")
	case "lte":
		return compareNumeric(jsonValue, targetValue, "lte")
	default:
		return false, fmt.Errorf("unsupported comparison mode: %s", mode)
	}
}

func compareEqual(jsonValue, targetValue ojson.Result) (bool, error) {
	// 对null值特殊处理：两个都是null返回true，一个是null另一个不是返回false
	if jsonValue.Type == ojson.Null || targetValue.Type == ojson.Null {
		return jsonValue.Type == ojson.Null && targetValue.Type == ojson.Null, nil
	}

	// 对布尔值特殊处理
	if (jsonValue.Type == ojson.True || jsonValue.Type == ojson.False) &&
		(targetValue.Type == ojson.True || targetValue.Type == ojson.False) {
		return jsonValue.Bool() == targetValue.Bool(), nil
	}

	// 如果类型不同，报错
	if jsonValue.Type != targetValue.Type {
		return false, fmt.Errorf("compare for different types, got %v and %v", jsonValue.Type, targetValue.Type)
	}

	switch jsonValue.Type {
	case ojson.True, ojson.False:
		return jsonValue.Bool() == targetValue.Bool(), nil
	case ojson.Number:
		return jsonValue.Num == targetValue.Num, nil
	case ojson.String:
		return jsonValue.String() == targetValue.String(), nil
	default:
		return jsonValue.String() == targetValue.String(), nil
	}
}

func compareNumeric(jsonValue, targetValue ojson.Result, operator string) (bool, error) {
	// 只有数字类型才支持数值比较
	if jsonValue.Type != ojson.Number || targetValue.Type != ojson.Number {
		return false, fmt.Errorf("numeric comparison requires both values to be numbers, got %v and %v", jsonValue.Type, targetValue.Type)
	}

	jsonNum := jsonValue.Num
	targetNum := targetValue.Num

	switch operator {
	case "gt":
		return jsonNum > targetNum, nil
	case "gte":
		return jsonNum >= targetNum, nil
	case "lt":
		return jsonNum < targetNum, nil
	case "lte":
		return jsonNum <= targetNum, nil
	default:
		return false, fmt.Errorf("unsupported numeric operator: %s", operator)
	}
}

// applyOperationsLegacy 原参数覆盖方法。
//
// 旧实现把整个 jsonData unmarshal 成 map[string]interface{} 再 marshal 回来，
// 对包含大 base64 字段（如 Gemini inlineData.data）的请求会放大数倍内存
// （interface 装箱、map bucket、再次 marshal）。
// 这里改成在 ojson.Doc 上按顶层 key 逐个写入，
// 不再把 payload 解码到 map[string]interface{}。
//
// 语义保持：每个 paramOverride 顶层 key 视为字面 key（不解析点号路径），
// 与旧的 reqMap[key] = value 一致。包含 `.` `*` `?` `\` 的 key 会被转义，
// 防止被 ojson 当作嵌套路径或通配符。
func applyOperationsLegacy(doc *ojson.Doc, paramOverride map[string]any, auditRecorder *paramOverrideAuditRecorder) error {
	for key, value := range paramOverride {
		escaped := escapeSjsonLiteralKey(key)
		if err := doc.Set(escaped, value); err != nil {
			return err
		}
		auditRecorder.recordOperation("set", key, "", "", value)
	}
	return nil
}

// escapeSjsonLiteralKey 把可能被 ojson 误判为路径或通配符的字符转义，
// 用于把字面 key 安全地传给 ojson.Doc.Set。
func escapeSjsonLiteralKey(key string) string {
	if !strings.ContainsAny(key, ".*?\\") {
		return key
	}
	var sb strings.Builder
	sb.Grow(len(key) + 4)
	for i := 0; i < len(key); i++ {
		c := key[i]
		switch c {
		case '.', '*', '?', '\\':
			sb.WriteByte('\\')
		}
		sb.WriteByte(c)
	}
	return sb.String()
}

// applyOperations 在同一个 ojson.Doc 上依次应用所有 param override 操作，
// 返回最终的请求体。
//
// 旧实现每个操作都调用一次 sjson.SetBytes，每次都要复制整个请求体，
// 对大 base64 payload（如 Gemini inlineData.data）来说操作越多拷贝越多。
// ojson.Doc 只拆开编辑经过的对象和数组，其余部分仍是输入的切片；
// 条件、负数索引、keep_origin 等读取都通过 doc.Get 读当前文档，
// 最后由 doc.Bytes() 一次性生成输出。doc.Get 的结果可能指向输入，
// 不能在本次调用之外保留。
func applyOperations(doc *ojson.Doc, operations []ParamOperation, conditionContext map[string]any) ([]byte, error) {
	context := ensureContextMap(conditionContext)
	auditRecorder := getParamOverrideAuditRecorder(context)
	contextJSON, err := marshalContextJSON(context)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal condition context: %v", err)
	}

	for _, op := range operations {
		// 检查条件是否满足
		ok, err := checkConditions(doc, contextJSON, op.Conditions, op.Logic)
		if err != nil {
			return nil, err
		}
		if !ok {
			continue // 条件不满足，跳过当前操作
		}
		// 处理路径中的负数索引
		opPath := processNegativeIndex(doc, op.Path)
		var opPaths []string
		if isPathBasedOperation(op.Mode) {
			opPaths, err = resolveOperationPaths(doc, opPath)
			if err != nil {
				return nil, err
			}
			if len(opPaths) == 0 {
				continue
			}
		}

		switch op.Mode {
		case "delete":
			for _, path := range opPaths {
				err = deleteValue(doc, path)
				if err != nil {
					break
				}
				auditRecorder.recordOperation("delete", path, "", "", nil)
			}
		case "set":
			for _, path := range opPaths {
				if op.KeepOrigin && doc.Get(path).Exists() {
					continue
				}
				err = doc.Set(path, op.Value)
				if err != nil {
					break
				}
				auditRecorder.recordOperation("set", path, "", "", op.Value)
			}
		case "move":
			opFrom := processNegativeIndex(doc, op.From)
			opTo := processNegativeIndex(doc, op.To)
			err = moveValue(doc, opFrom, opTo)
			if err == nil {
				auditRecorder.recordOperation("move", "", opFrom, opTo, nil)
			}
		case "copy":
			if op.From == "" || op.To == "" {
				return nil, fmt.Errorf("copy from/to is required")
			}
			opFrom := processNegativeIndex(doc, op.From)
			opTo := processNegativeIndex(doc, op.To)
			err = copyValue(doc, opFrom, opTo)
			if err == nil {
				auditRecorder.recordOperation("copy", "", opFrom, opTo, nil)
			}
		case "prepend":
			for _, path := range opPaths {
				err = modifyValue(doc, path, op.Value, op.KeepOrigin, true)
				if err != nil {
					break
				}
				auditRecorder.recordOperation("prepend", path, "", "", op.Value)
			}
		case "append":
			for _, path := range opPaths {
				err = modifyValue(doc, path, op.Value, op.KeepOrigin, false)
				if err != nil {
					break
				}
				auditRecorder.recordOperation("append", path, "", "", op.Value)
			}
		case "trim_prefix":
			for _, path := range opPaths {
				err = trimStringValue(doc, path, op.Value, true)
				if err != nil {
					break
				}
				auditRecorder.recordOperation("trim_prefix", path, "", "", op.Value)
			}
		case "trim_suffix":
			for _, path := range opPaths {
				err = trimStringValue(doc, path, op.Value, false)
				if err != nil {
					break
				}
				auditRecorder.recordOperation("trim_suffix", path, "", "", op.Value)
			}
		case "ensure_prefix":
			for _, path := range opPaths {
				err = ensureStringAffix(doc, path, op.Value, true)
				if err != nil {
					break
				}
				auditRecorder.recordOperation("ensure_prefix", path, "", "", op.Value)
			}
		case "ensure_suffix":
			for _, path := range opPaths {
				err = ensureStringAffix(doc, path, op.Value, false)
				if err != nil {
					break
				}
				auditRecorder.recordOperation("ensure_suffix", path, "", "", op.Value)
			}
		case "trim_space":
			for _, path := range opPaths {
				err = transformStringValue(doc, path, strings.TrimSpace)
				if err != nil {
					break
				}
				auditRecorder.recordOperation("trim_space", path, "", "", nil)
			}
		case "to_lower":
			for _, path := range opPaths {
				err = transformStringValue(doc, path, strings.ToLower)
				if err != nil {
					break
				}
				auditRecorder.recordOperation("to_lower", path, "", "", nil)
			}
		case "to_upper":
			for _, path := range opPaths {
				err = transformStringValue(doc, path, strings.ToUpper)
				if err != nil {
					break
				}
				auditRecorder.recordOperation("to_upper", path, "", "", nil)
			}
		case "replace":
			for _, path := range opPaths {
				err = replaceStringValue(doc, path, op.From, op.To)
				if err != nil {
					break
				}
				auditRecorder.recordOperation("replace", path, op.From, op.To, nil)
			}
		case "regex_replace":
			for _, path := range opPaths {
				err = regexReplaceStringValue(doc, path, op.From, op.To)
				if err != nil {
					break
				}
				auditRecorder.recordOperation("regex_replace", path, op.From, op.To, nil)
			}
		case "return_error":
			auditRecorder.recordOperation("return_error", op.Path, "", "", op.Value)
			returnErr, parseErr := parseParamOverrideReturnError(op.Value)
			if parseErr != nil {
				return nil, parseErr
			}
			return nil, returnErr
		case "prune_objects":
			for _, path := range opPaths {
				err = pruneObjects(doc, path, contextJSON, op.Value)
				if err != nil {
					break
				}
			}
		case "set_header":
			err = setHeaderOverrideInContext(context, op.Path, op.Value, op.KeepOrigin)
			if err == nil {
				auditRecorder.recordOperation("set_header", op.Path, "", "", op.Value)
				contextJSON, err = marshalContextJSON(context)
			}
		case "delete_header":
			err = deleteHeaderOverrideInContext(context, op.Path)
			if err == nil {
				auditRecorder.recordOperation("delete_header", op.Path, "", "", nil)
				contextJSON, err = marshalContextJSON(context)
			}
		case "copy_header":
			sourceHeader := strings.TrimSpace(op.From)
			targetHeader := strings.TrimSpace(op.To)
			if sourceHeader == "" {
				sourceHeader = strings.TrimSpace(op.Path)
			}
			if targetHeader == "" {
				targetHeader = strings.TrimSpace(op.Path)
			}
			err = copyHeaderInContext(context, sourceHeader, targetHeader, op.KeepOrigin)
			if errors.Is(err, errSourceHeaderNotFound) {
				err = nil
			}
			if err == nil {
				auditRecorder.recordOperation("copy_header", "", sourceHeader, targetHeader, nil)
				contextJSON, err = marshalContextJSON(context)
			}
		case "move_header":
			sourceHeader := strings.TrimSpace(op.From)
			targetHeader := strings.TrimSpace(op.To)
			if sourceHeader == "" {
				sourceHeader = strings.TrimSpace(op.Path)
			}
			if targetHeader == "" {
				targetHeader = strings.TrimSpace(op.Path)
			}
			err = moveHeaderInContext(context, sourceHeader, targetHeader, op.KeepOrigin)
			if errors.Is(err, errSourceHeaderNotFound) {
				err = nil
			}
			if err == nil {
				auditRecorder.recordOperation("move_header", "", sourceHeader, targetHeader, nil)
				contextJSON, err = marshalContextJSON(context)
			}
		case "pass_headers":
			headerNames, parseErr := parseHeaderPassThroughNames(op.Value)
			if parseErr != nil {
				return nil, parseErr
			}
			for _, headerName := range headerNames {
				if err = copyHeaderInContext(context, headerName, headerName, op.KeepOrigin); err != nil {
					if errors.Is(err, errSourceHeaderNotFound) {
						err = nil
						continue
					}
					break
				}
			}
			if err == nil {
				auditRecorder.recordOperation("pass_headers", "", "", "", headerNames)
				contextJSON, err = marshalContextJSON(context)
			}
		case "sync_fields":
			err = syncFieldsBetweenTargets(doc, context, op.From, op.To)
			if err == nil {
				auditRecorder.recordOperation("sync_fields", "", op.From, op.To, nil)
				contextJSON, err = marshalContextJSON(context)
			}
		default:
			return nil, fmt.Errorf("unknown operation: %s", op.Mode)
		}
		if err != nil {
			return nil, fmt.Errorf("operation %s failed: %w", op.Mode, err)
		}
	}
	return doc.Bytes(), nil
}

func parseParamOverrideReturnError(value any) (*ParamOverrideReturnError, error) {
	result := &ParamOverrideReturnError{
		StatusCode: http.StatusBadRequest,
		Code:       string(types.ErrorCodeInvalidRequest),
		Type:       "invalid_request_error",
		SkipRetry:  true,
	}

	switch raw := value.(type) {
	case nil:
		return nil, fmt.Errorf("return_error value is required")
	case string:
		result.Message = strings.TrimSpace(raw)
	case map[string]any:
		if message, ok := raw["message"].(string); ok {
			result.Message = strings.TrimSpace(message)
		}
		if result.Message == "" {
			if message, ok := raw["msg"].(string); ok {
				result.Message = strings.TrimSpace(message)
			}
		}

		if code, exists := raw["code"]; exists {
			codeStr := strings.TrimSpace(fmt.Sprintf("%v", code))
			if codeStr != "" {
				result.Code = codeStr
			}
		}
		if errType, ok := raw["type"].(string); ok {
			errType = strings.TrimSpace(errType)
			if errType != "" {
				result.Type = errType
			}
		}
		if skipRetry, ok := raw["skip_retry"].(bool); ok {
			result.SkipRetry = skipRetry
		}

		if statusCodeRaw, exists := raw["status_code"]; exists {
			statusCode, ok := parseOverrideInt(statusCodeRaw)
			if !ok {
				return nil, fmt.Errorf("return_error status_code must be an integer")
			}
			result.StatusCode = statusCode
		} else if statusRaw, exists := raw["status"]; exists {
			statusCode, ok := parseOverrideInt(statusRaw)
			if !ok {
				return nil, fmt.Errorf("return_error status must be an integer")
			}
			result.StatusCode = statusCode
		}
	default:
		return nil, fmt.Errorf("return_error value must be string or object")
	}

	if result.Message == "" {
		return nil, fmt.Errorf("return_error message is required")
	}
	if result.StatusCode < http.StatusContinue || result.StatusCode > http.StatusNetworkAuthenticationRequired {
		return nil, fmt.Errorf("return_error status code out of range: %d", result.StatusCode)
	}

	return result, nil
}

func parseOverrideInt(v any) (int, bool) {
	switch value := v.(type) {
	case int:
		return value, true
	case float64:
		if value != float64(int(value)) {
			return 0, false
		}
		return int(value), true
	default:
		return 0, false
	}
}

func ensureContextMap(conditionContext map[string]any) map[string]any {
	if conditionContext != nil {
		return conditionContext
	}
	return make(map[string]any)
}

func marshalContextJSON(context map[string]any) (string, error) {
	if context == nil || len(context) == 0 {
		return "", nil
	}
	ctxBytes, err := common.Marshal(context)
	if err != nil {
		return "", err
	}
	return string(ctxBytes), nil
}

func setHeaderOverrideInContext(context map[string]any, headerName string, value any, keepOrigin bool) error {
	headerName = normalizeHeaderContextKey(headerName)
	if headerName == "" {
		return fmt.Errorf("header name is required")
	}

	rawHeaders := ensureMapKeyInContext(context, paramOverrideContextHeaderOverride)
	if keepOrigin {
		if existing, ok := rawHeaders[headerName]; ok {
			existingValue := strings.TrimSpace(fmt.Sprintf("%v", existing))
			if existingValue != "" {
				return nil
			}
		}
	}

	headerValue, hasValue, err := resolveHeaderOverrideValue(context, headerName, value)
	if err != nil {
		return err
	}
	if !hasValue {
		delete(rawHeaders, headerName)
		return nil
	}

	rawHeaders[headerName] = headerValue
	return nil
}

func resolveHeaderOverrideValue(context map[string]any, headerName string, value any) (string, bool, error) {
	if value == nil {
		return "", false, fmt.Errorf("header value is required")
	}

	if mapping, ok := value.(map[string]any); ok {
		return resolveHeaderOverrideValueByMapping(context, headerName, mapping)
	}
	if mapping, ok := value.(map[string]string); ok {
		converted := make(map[string]any, len(mapping))
		for key, item := range mapping {
			converted[key] = item
		}
		return resolveHeaderOverrideValueByMapping(context, headerName, converted)
	}

	headerValue := strings.TrimSpace(fmt.Sprintf("%v", value))
	if headerValue == "" {
		return "", false, nil
	}
	return headerValue, true, nil
}

func resolveHeaderOverrideValueByMapping(context map[string]any, headerName string, mapping map[string]any) (string, bool, error) {
	if len(mapping) == 0 {
		return "", false, fmt.Errorf("header value mapping cannot be empty")
	}

	appendTokens, err := parseHeaderAppendTokens(mapping)
	if err != nil {
		return "", false, err
	}
	keepOnlyDeclared := parseHeaderKeepOnlyDeclared(mapping)

	sourceValue, exists := getHeaderValueFromContext(context, headerName)
	sourceTokens := make([]string, 0)
	if exists {
		sourceTokens = splitHeaderListValue(sourceValue)
	}

	wildcardValue, hasWildcard := mapping["*"]
	resultTokens := make([]string, 0, len(sourceTokens)+len(appendTokens))
	for _, token := range sourceTokens {
		replacementRaw, hasReplacement := mapping[token]
		if !hasReplacement && hasWildcard && !keepOnlyDeclared {
			replacementRaw = wildcardValue
			hasReplacement = true
		}
		if !hasReplacement {
			if keepOnlyDeclared {
				continue
			}
			resultTokens = append(resultTokens, token)
			continue
		}
		replacementTokens, err := parseHeaderReplacementTokens(replacementRaw)
		if err != nil {
			return "", false, err
		}
		resultTokens = append(resultTokens, replacementTokens...)
	}

	resultTokens = append(resultTokens, appendTokens...)
	resultTokens = lo.Uniq(resultTokens)
	if len(resultTokens) == 0 {
		return "", false, nil
	}
	return strings.Join(resultTokens, ","), true, nil
}

func parseHeaderAppendTokens(mapping map[string]any) ([]string, error) {
	appendRaw, ok := mapping["$append"]
	if !ok {
		return nil, nil
	}
	return parseHeaderReplacementTokens(appendRaw)
}

func parseHeaderKeepOnlyDeclared(mapping map[string]any) bool {
	keepOnlyDeclaredRaw, ok := mapping["$keep_only_declared"]
	if !ok {
		return false
	}
	keepOnlyDeclared, ok := keepOnlyDeclaredRaw.(bool)
	if !ok {
		return false
	}
	return keepOnlyDeclared
}

func parseHeaderReplacementTokens(value any) ([]string, error) {
	switch raw := value.(type) {
	case nil:
		return nil, nil
	case string:
		return splitHeaderListValue(raw), nil
	case []string:
		tokens := make([]string, 0, len(raw))
		for _, item := range raw {
			tokens = append(tokens, splitHeaderListValue(item)...)
		}
		return lo.Uniq(tokens), nil
	case []any:
		tokens := make([]string, 0, len(raw))
		for _, item := range raw {
			itemTokens, err := parseHeaderReplacementTokens(item)
			if err != nil {
				return nil, err
			}
			tokens = append(tokens, itemTokens...)
		}
		return lo.Uniq(tokens), nil
	case map[string]any, map[string]string:
		return nil, fmt.Errorf("header replacement value must be string, array or null")
	default:
		token := strings.TrimSpace(fmt.Sprintf("%v", raw))
		if token == "" {
			return nil, nil
		}
		return []string{token}, nil
	}
}

func splitHeaderListValue(raw string) []string {
	items := strings.Split(raw, ",")
	return lo.FilterMap(items, func(item string, _ int) (string, bool) {
		token := strings.TrimSpace(item)
		if token == "" {
			return "", false
		}
		return token, true
	})
}

func copyHeaderInContext(context map[string]any, fromHeader, toHeader string, keepOrigin bool) error {
	fromHeader = normalizeHeaderContextKey(fromHeader)
	toHeader = normalizeHeaderContextKey(toHeader)
	if fromHeader == "" || toHeader == "" {
		return fmt.Errorf("copy_header from/to is required")
	}
	value, exists := getHeaderValueFromContext(context, fromHeader)
	if !exists {
		return fmt.Errorf("%w: %s", errSourceHeaderNotFound, fromHeader)
	}
	return setHeaderOverrideInContext(context, toHeader, value, keepOrigin)
}

func moveHeaderInContext(context map[string]any, fromHeader, toHeader string, keepOrigin bool) error {
	fromHeader = normalizeHeaderContextKey(fromHeader)
	toHeader = normalizeHeaderContextKey(toHeader)
	if fromHeader == "" || toHeader == "" {
		return fmt.Errorf("move_header from/to is required")
	}
	if err := copyHeaderInContext(context, fromHeader, toHeader, keepOrigin); err != nil {
		return err
	}
	if strings.EqualFold(fromHeader, toHeader) {
		return nil
	}
	return deleteHeaderOverrideInContext(context, fromHeader)
}

func deleteHeaderOverrideInContext(context map[string]any, headerName string) error {
	headerName = normalizeHeaderContextKey(headerName)
	if headerName == "" {
		return fmt.Errorf("header name is required")
	}
	rawHeaders := ensureMapKeyInContext(context, paramOverrideContextHeaderOverride)
	delete(rawHeaders, headerName)
	return nil
}

func parseHeaderPassThroughNames(value any) ([]string, error) {
	normalizeNames := func(values []string) []string {
		names := lo.FilterMap(values, func(item string, _ int) (string, bool) {
			headerName := normalizeHeaderContextKey(item)
			if headerName == "" {
				return "", false
			}
			return headerName, true
		})
		return lo.Uniq(names)
	}

	switch raw := value.(type) {
	case nil:
		return nil, fmt.Errorf("pass_headers value is required")
	case string:
		trimmed := strings.TrimSpace(raw)
		if trimmed == "" {
			return nil, fmt.Errorf("pass_headers value is required")
		}
		if strings.HasPrefix(trimmed, "[") || strings.HasPrefix(trimmed, "{") {
			var parsed any
			if err := common.UnmarshalJsonStr(trimmed, &parsed); err == nil {
				return parseHeaderPassThroughNames(parsed)
			}
		}
		names := normalizeNames(strings.Split(trimmed, ","))
		if len(names) == 0 {
			return nil, fmt.Errorf("pass_headers value is invalid")
		}
		return names, nil
	case []any:
		names := lo.FilterMap(raw, func(item any, _ int) (string, bool) {
			headerName := normalizeHeaderContextKey(fmt.Sprintf("%v", item))
			if headerName == "" {
				return "", false
			}
			return headerName, true
		})
		names = lo.Uniq(names)
		if len(names) == 0 {
			return nil, fmt.Errorf("pass_headers value is invalid")
		}
		return names, nil
	case []string:
		names := lo.FilterMap(raw, func(item string, _ int) (string, bool) {
			headerName := normalizeHeaderContextKey(item)
			if headerName == "" {
				return "", false
			}
			return headerName, true
		})
		names = lo.Uniq(names)
		if len(names) == 0 {
			return nil, fmt.Errorf("pass_headers value is invalid")
		}
		return names, nil
	case map[string]any:
		candidates := make([]string, 0, 8)
		if headersRaw, ok := raw["headers"]; ok {
			names, err := parseHeaderPassThroughNames(headersRaw)
			if err == nil {
				candidates = append(candidates, names...)
			}
		}
		if namesRaw, ok := raw["names"]; ok {
			names, err := parseHeaderPassThroughNames(namesRaw)
			if err == nil {
				candidates = append(candidates, names...)
			}
		}
		if headerRaw, ok := raw["header"]; ok {
			names, err := parseHeaderPassThroughNames(headerRaw)
			if err == nil {
				candidates = append(candidates, names...)
			}
		}
		names := normalizeNames(candidates)
		if len(names) == 0 {
			return nil, fmt.Errorf("pass_headers value is invalid")
		}
		return names, nil
	default:
		return nil, fmt.Errorf("pass_headers value must be string, array or object")
	}
}

type syncTarget struct {
	kind string
	key  string
}

func parseSyncTarget(spec string) (syncTarget, error) {
	raw := strings.TrimSpace(spec)
	if raw == "" {
		return syncTarget{}, fmt.Errorf("sync_fields target is required")
	}

	before, after, ok := strings.Cut(raw, ":")
	if !ok {
		// Backward compatibility: treat bare value as JSON path.
		return syncTarget{
			kind: "json",
			key:  raw,
		}, nil
	}

	kind := strings.ToLower(strings.TrimSpace(before))
	key := strings.TrimSpace(after)
	if key == "" {
		return syncTarget{}, fmt.Errorf("sync_fields target key is required: %s", raw)
	}

	switch kind {
	case "json", "body":
		return syncTarget{
			kind: "json",
			key:  key,
		}, nil
	case "header":
		return syncTarget{
			kind: "header",
			key:  key,
		}, nil
	default:
		return syncTarget{}, fmt.Errorf("sync_fields target prefix is invalid: %s", raw)
	}
}

func readSyncTargetValue(doc *ojson.Doc, context map[string]any, target syncTarget) (any, bool, error) {
	switch target.kind {
	case "json":
		path := processNegativeIndex(doc, target.key)
		value := doc.Get(path)
		if !value.Exists() || value.Type == ojson.Null {
			return nil, false, nil
		}
		if value.Type == ojson.String && strings.TrimSpace(value.String()) == "" {
			return nil, false, nil
		}
		// A header target keeps the value in the context map, so it must not
		// point into the request body.
		value.Raw, value.Str = strings.Clone(value.Raw), strings.Clone(value.Str)
		return value.Value(), true, nil
	case "header":
		value, ok := getHeaderValueFromContext(context, target.key)
		if !ok || strings.TrimSpace(value) == "" {
			return nil, false, nil
		}
		return value, true, nil
	default:
		return nil, false, fmt.Errorf("unsupported sync_fields target kind: %s", target.kind)
	}
}

func writeSyncTargetValue(doc *ojson.Doc, context map[string]any, target syncTarget, value any) error {
	switch target.kind {
	case "json":
		path := processNegativeIndex(doc, target.key)
		return doc.Set(path, value)
	case "header":
		return setHeaderOverrideInContext(context, target.key, value, false)
	default:
		return fmt.Errorf("unsupported sync_fields target kind: %s", target.kind)
	}
}

func syncFieldsBetweenTargets(doc *ojson.Doc, context map[string]any, fromSpec string, toSpec string) error {
	fromTarget, err := parseSyncTarget(fromSpec)
	if err != nil {
		return err
	}
	toTarget, err := parseSyncTarget(toSpec)
	if err != nil {
		return err
	}

	fromValue, fromExists, err := readSyncTargetValue(doc, context, fromTarget)
	if err != nil {
		return err
	}
	toValue, toExists, err := readSyncTargetValue(doc, context, toTarget)
	if err != nil {
		return err
	}

	// If one side exists and the other side is missing, sync the missing side.
	if fromExists && !toExists {
		return writeSyncTargetValue(doc, context, toTarget, fromValue)
	}
	if toExists && !fromExists {
		return writeSyncTargetValue(doc, context, fromTarget, toValue)
	}
	return nil
}

func ensureMapKeyInContext(context map[string]any, key string) map[string]any {
	if context == nil {
		return map[string]any{}
	}
	if existing, ok := context[key]; ok {
		if mapVal, ok := existing.(map[string]any); ok {
			return mapVal
		}
	}
	result := make(map[string]any)
	context[key] = result
	return result
}

func getHeaderValueFromContext(context map[string]any, headerName string) (string, bool) {
	headerName = normalizeHeaderContextKey(headerName)
	if headerName == "" {
		return "", false
	}
	for _, key := range []string{paramOverrideContextHeaderOverride, paramOverrideContextRequestHeaders} {
		source := ensureMapKeyInContext(context, key)
		raw, ok := source[headerName]
		if !ok {
			continue
		}
		value := strings.TrimSpace(fmt.Sprintf("%v", raw))
		if value != "" {
			return value, true
		}
	}
	return "", false
}

func normalizeHeaderContextKey(key string) string {
	return strings.TrimSpace(strings.ToLower(key))
}

func buildRequestHeadersContext(headers map[string]string) map[string]any {
	if len(headers) == 0 {
		return map[string]any{}
	}
	entries := lo.Entries(headers)
	normalizedEntries := lo.FilterMap(entries, func(item lo.Entry[string, string], _ int) (lo.Entry[string, string], bool) {
		normalized := normalizeHeaderContextKey(item.Key)
		value := strings.TrimSpace(item.Value)
		if normalized == "" || value == "" {
			return lo.Entry[string, string]{}, false
		}
		return lo.Entry[string, string]{Key: normalized, Value: value}, true
	})
	return lo.SliceToMap(normalizedEntries, func(item lo.Entry[string, string]) (string, any) {
		return item.Key, item.Value
	})
}

func syncRuntimeHeaderOverrideFromContext(info *RelayInfo, context map[string]any) {
	if info == nil || context == nil {
		return
	}
	raw, exists := context[paramOverrideContextHeaderOverride]
	if !exists {
		return
	}
	rawMap, ok := raw.(map[string]any)
	if !ok {
		return
	}
	info.RuntimeHeadersOverride = sanitizeHeaderOverrideMap(rawMap)
	info.UseRuntimeHeadersOverride = true
}

// moveValue and copyValue write the source's raw bytes: a decoded value
// would be re-encoded with sorted object keys.
func moveValue(doc *ojson.Doc, fromPath, toPath string) error {
	sourceValue := doc.Get(fromPath)
	if !sourceValue.Exists() {
		return fmt.Errorf("source path does not exist: %s", fromPath)
	}
	if err := doc.SetRaw(toPath, sourceValue.Raw); err != nil {
		return err
	}
	return doc.Delete(fromPath)
}

func copyValue(doc *ojson.Doc, fromPath, toPath string) error {
	sourceValue := doc.Get(fromPath)
	if !sourceValue.Exists() {
		return fmt.Errorf("source path does not exist: %s", fromPath)
	}
	return doc.SetRaw(toPath, sourceValue.Raw)
}

func isPathBasedOperation(mode string) bool {
	switch mode {
	case "delete", "set", "prepend", "append", "trim_prefix", "trim_suffix", "ensure_prefix", "ensure_suffix", "trim_space", "to_lower", "to_upper", "replace", "regex_replace", "prune_objects":
		return true
	default:
		return false
	}
}

func resolveOperationPaths(doc *ojson.Doc, path string) ([]string, error) {
	if !strings.Contains(path, "*") {
		return []string{path}, nil
	}
	return expandWildcardPaths(doc, path)
}

func expandWildcardPaths(doc *ojson.Doc, path string) ([]string, error) {
	var root any
	if err := common.Unmarshal(doc.Bytes(), &root); err != nil {
		return nil, err
	}

	segments := strings.Split(path, ".")
	paths := collectWildcardPaths(root, segments, nil)
	return lo.Uniq(paths), nil
}

func collectWildcardPaths(node any, segments []string, prefix []string) []string {
	if len(segments) == 0 {
		return []string{strings.Join(prefix, ".")}
	}

	segment := strings.TrimSpace(segments[0])
	if segment == "" {
		return nil
	}
	isLast := len(segments) == 1

	if segment == "*" {
		switch typed := node.(type) {
		case map[string]any:
			keys := lo.Keys(typed)
			sort.Strings(keys)
			return lo.FlatMap(keys, func(key string, _ int) []string {
				return collectWildcardPaths(typed[key], segments[1:], append(prefix, key))
			})
		case []any:
			return lo.FlatMap(lo.Range(len(typed)), func(index int, _ int) []string {
				return collectWildcardPaths(typed[index], segments[1:], append(prefix, strconv.Itoa(index)))
			})
		default:
			return nil
		}
	}

	switch typed := node.(type) {
	case map[string]any:
		if isLast {
			return []string{strings.Join(append(prefix, segment), ".")}
		}
		next, exists := typed[segment]
		if !exists {
			return nil
		}
		return collectWildcardPaths(next, segments[1:], append(prefix, segment))
	case []any:
		index, err := strconv.Atoi(segment)
		if err != nil || index < 0 || index >= len(typed) {
			return nil
		}
		if isLast {
			return []string{strings.Join(append(prefix, segment), ".")}
		}
		return collectWildcardPaths(typed[index], segments[1:], append(prefix, segment))
	default:
		return nil
	}
}

func deleteValue(doc *ojson.Doc, path string) error {
	if strings.TrimSpace(path) == "" {
		return nil
	}
	return doc.Delete(path)
}

func modifyValue(doc *ojson.Doc, path string, value any, keepOrigin, isPrepend bool) error {
	current := doc.Get(path)
	switch {
	case current.IsArray():
		return modifyArray(doc, path, value, isPrepend)
	case current.Type == ojson.String:
		return modifyString(doc, path, value, isPrepend)
	case current.Type == ojson.JSON:
		return mergeObjects(doc, path, value, keepOrigin)
	}
	return fmt.Errorf("operation not supported for type: %v", current.Type)
}

func modifyArray(doc *ojson.Doc, path string, value any, isPrepend bool) error {
	current := doc.Get(path)
	var newArray []any
	// 添加新值
	addValue := func() {
		if arr, ok := value.([]any); ok {
			newArray = append(newArray, arr...)
		} else {
			newArray = append(newArray, value)
		}
	}
	// 添加原值（保留原始字节，对象键顺序不变）
	addOriginal := func() {
		current.ForEach(func(_, val ojson.Result) bool {
			newArray = append(newArray, common.RawMessage(val.Raw))
			return true
		})
	}
	if isPrepend {
		addValue()
		addOriginal()
	} else {
		addOriginal()
		addValue()
	}
	return doc.Set(path, newArray)
}

func modifyString(doc *ojson.Doc, path string, value any, isPrepend bool) error {
	current := doc.Get(path)
	valueStr := fmt.Sprintf("%v", value)
	var newStr string
	if isPrepend {
		newStr = valueStr + current.String()
	} else {
		newStr = current.String() + valueStr
	}
	return doc.Set(path, newStr)
}

func trimStringValue(doc *ojson.Doc, path string, value any, isPrefix bool) error {
	current := doc.Get(path)
	if current.Type != ojson.String {
		return fmt.Errorf("operation not supported for type: %v", current.Type)
	}

	if value == nil {
		return fmt.Errorf("trim value is required")
	}
	valueStr := fmt.Sprintf("%v", value)

	var newStr string
	if isPrefix {
		newStr = strings.TrimPrefix(current.String(), valueStr)
	} else {
		newStr = strings.TrimSuffix(current.String(), valueStr)
	}
	return doc.Set(path, newStr)
}

func ensureStringAffix(doc *ojson.Doc, path string, value any, isPrefix bool) error {
	current := doc.Get(path)
	if current.Type != ojson.String {
		return fmt.Errorf("operation not supported for type: %v", current.Type)
	}

	if value == nil {
		return fmt.Errorf("ensure value is required")
	}
	valueStr := fmt.Sprintf("%v", value)
	if valueStr == "" {
		return fmt.Errorf("ensure value is required")
	}

	currentStr := current.String()
	if isPrefix {
		if strings.HasPrefix(currentStr, valueStr) {
			return nil
		}
		return doc.Set(path, valueStr+currentStr)
	}

	if strings.HasSuffix(currentStr, valueStr) {
		return nil
	}
	return doc.Set(path, currentStr+valueStr)
}

func transformStringValue(doc *ojson.Doc, path string, transform func(string) string) error {
	current := doc.Get(path)
	if current.Type != ojson.String {
		return fmt.Errorf("operation not supported for type: %v", current.Type)
	}
	return doc.Set(path, transform(current.String()))
}

func replaceStringValue(doc *ojson.Doc, path, from, to string) error {
	current := doc.Get(path)
	if current.Type != ojson.String {
		return fmt.Errorf("operation not supported for type: %v", current.Type)
	}
	if from == "" {
		return fmt.Errorf("replace from is required")
	}
	return doc.Set(path, strings.ReplaceAll(current.String(), from, to))
}

func regexReplaceStringValue(doc *ojson.Doc, path, pattern, replacement string) error {
	current := doc.Get(path)
	if current.Type != ojson.String {
		return fmt.Errorf("operation not supported for type: %v", current.Type)
	}
	if pattern == "" {
		return fmt.Errorf("regex pattern is required")
	}
	re, err := getParamOverrideRegex(pattern)
	if err != nil {
		return err
	}
	return doc.Set(path, re.ReplaceAllString(current.String(), replacement))
}

type pruneObjectsOptions struct {
	conditions []ConditionOperation
	logic      string
	recursive  bool
}

// pruneObjects 在原 Doc 上删除 path（为空时为整个请求体）下满足条件的对象，
// 其余内容保持原样。
func pruneObjects(doc *ojson.Doc, path, contextJSON string, value any) error {
	options, err := parsePruneObjectsOptions(value)
	if err != nil {
		return err
	}

	target := doc.Get(path)
	if path == "" {
		target = doc.Get("@this")
	}
	if !target.Exists() {
		return nil
	}

	var pruned []prunedObject
	if _, err := collectPrunedObjects(target, path, options, contextJSON, true, &pruned); err != nil {
		return err
	}
	// 从后往前删，前面数组元素的下标不受影响
	for i := len(pruned) - 1; i >= 0; i-- {
		if pruned[i].member {
			err = DeleteJSONMember(doc, pruned[i].path)
		} else {
			err = doc.Delete(pruned[i].path)
		}
		if err != nil {
			return err
		}
	}
	return nil
}

func parsePruneObjectsOptions(value any) (pruneObjectsOptions, error) {
	opts := pruneObjectsOptions{
		logic:     "AND",
		recursive: true,
	}

	switch raw := value.(type) {
	case nil:
		return opts, fmt.Errorf("prune_objects value is required")
	case string:
		v := strings.TrimSpace(raw)
		if v == "" {
			return opts, fmt.Errorf("prune_objects value is required")
		}
		opts.conditions = []ConditionOperation{
			{
				Path:  "type",
				Mode:  "full",
				Value: v,
			},
		}
	case map[string]any:
		if logic, ok := raw["logic"].(string); ok && strings.TrimSpace(logic) != "" {
			opts.logic = logic
		}
		if recursive, ok := raw["recursive"].(bool); ok {
			opts.recursive = recursive
		}

		if condRaw, exists := raw["conditions"]; exists {
			conditions, err := parseConditionOperations(condRaw)
			if err != nil {
				return opts, err
			}
			opts.conditions = append(opts.conditions, conditions...)
		}

		if whereRaw, exists := raw["where"]; exists {
			whereMap, ok := whereRaw.(map[string]any)
			if !ok {
				return opts, fmt.Errorf("prune_objects where must be object")
			}
			for key, val := range whereMap {
				key = strings.TrimSpace(key)
				if key == "" {
					continue
				}
				opts.conditions = append(opts.conditions, ConditionOperation{
					Path:  key,
					Mode:  "full",
					Value: val,
				})
			}
		}

		if matchType, exists := raw["type"]; exists {
			opts.conditions = append(opts.conditions, ConditionOperation{
				Path:  "type",
				Mode:  "full",
				Value: matchType,
			})
		}
	default:
		return opts, fmt.Errorf("prune_objects value must be string or object")
	}

	if len(opts.conditions) == 0 {
		return opts, fmt.Errorf("prune_objects conditions are required")
	}
	return opts, nil
}

func parseConditionOperations(raw any) ([]ConditionOperation, error) {
	switch typed := raw.(type) {
	case map[string]any:
		entries := lo.Entries(typed)
		conditions := lo.FilterMap(entries, func(item lo.Entry[string, any], _ int) (ConditionOperation, bool) {
			path := strings.TrimSpace(item.Key)
			if path == "" {
				return ConditionOperation{}, false
			}
			return ConditionOperation{
				Path:  path,
				Mode:  "full",
				Value: item.Value,
			}, true
		})
		if len(conditions) == 0 {
			return nil, fmt.Errorf("conditions object must contain at least one key")
		}
		return conditions, nil
	case []any:
		items := typed
		result := make([]ConditionOperation, 0, len(items))
		for _, item := range items {
			itemMap, ok := item.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("condition must be object")
			}
			path, _ := itemMap["path"].(string)
			mode, _ := itemMap["mode"].(string)
			if strings.TrimSpace(path) == "" || strings.TrimSpace(mode) == "" {
				return nil, fmt.Errorf("condition path/mode is required")
			}
			condition := ConditionOperation{
				Path: path,
				Mode: mode,
			}
			if value, exists := itemMap["value"]; exists {
				condition.Value = value
			}
			if invert, ok := itemMap["invert"].(bool); ok {
				condition.Invert = invert
			}
			if passMissingKey, ok := itemMap["pass_missing_key"].(bool); ok {
				condition.PassMissingKey = passMissingKey
			}
			result = append(result, condition)
		}
		return result, nil
	default:
		return nil, fmt.Errorf("conditions must be an array or object")
	}
}

// prunedObject 是 prune_objects 要删除的对象：对象成员按键删除所有副本，
// 数组元素按下标删除。
type prunedObject struct {
	path   string
	member bool
}

// collectPrunedObjects 遍历 node：数组逐个检查元素，对象满足条件时（根节点除外）
// 整个删除，recursive 时继续检查对象的成员。要删除的路径按文档顺序追加到
// pruned，返回值表示 node 本身是否要删除。
func collectPrunedObjects(node ojson.Result, path string, options pruneObjectsOptions, contextJSON string, isRoot bool, pruned *[]prunedObject) (bool, error) {
	prefix := ""
	if path != "" {
		prefix = path + "."
	}
	switch {
	case node.IsArray():
		for i, item := range node.Array() {
			itemPath := prefix + strconv.Itoa(i)
			drop, err := collectPrunedObjects(item, itemPath, options, contextJSON, false, pruned)
			if err != nil {
				return false, err
			}
			if drop {
				*pruned = append(*pruned, prunedObject{path: itemPath})
			}
		}
		return false, nil
	case node.IsObject():
		shouldDrop, err := checkConditions(ojson.NewDocString(node.Raw), contextJSON, options.conditions, options.logic)
		if err != nil {
			return false, err
		}
		if shouldDrop && !isRoot {
			return true, nil
		}
		if !options.recursive {
			return false, nil
		}
		node.ForEach(func(key, child ojson.Result) bool {
			childPath := prefix + ojson.Escape(key.Str)
			var drop bool
			drop, err = collectPrunedObjects(child, childPath, options, contextJSON, false, pruned)
			if err != nil {
				return false
			}
			if drop {
				*pruned = append(*pruned, prunedObject{path: childPath, member: true})
			}
			return true
		})
		return false, err
	default:
		return false, nil
	}
}

// mergeObjects 把 value 的成员写入 path 处的对象：已有成员原地替换，新成员按
// 键名顺序追加到末尾，其余成员保持原样。
func mergeObjects(doc *ojson.Doc, path string, value any, keepOrigin bool) error {
	var newMap map[string]any
	switch v := value.(type) {
	case map[string]any:
		newMap = v
	default:
		jsonBytes, _ := common.Marshal(v)
		if err := common.Unmarshal(jsonBytes, &newMap); err != nil {
			return err
		}
	}
	for _, key := range slices.Sorted(maps.Keys(newMap)) {
		if keepOrigin {
			if current := doc.Get(path + "." + ojson.Escape(key)); current.Exists() && current.Type != ojson.Null {
				continue
			}
		}
		if err := SetJSONMember(doc, path, key, newMap[key]); err != nil {
			return err
		}
	}
	return nil
}

// BuildParamOverrideContext 提供 ApplyParamOverride 可用的上下文信息。
// 目前内置以下字段：
//   - upstream_model/model：始终为通道映射后的上游模型名。
//   - original_model：请求最初指定的模型名。
//   - user_id：已认证用户 ID。
//   - user_group：用户所属分组。
//   - token_group：令牌指定的分组；未指定时回退为用户分组。
//   - using_group：当前实际使用的分组，自动跨分组重试时可能变化。
//   - request_path：请求路径
//   - is_channel_test：是否为渠道测试请求（同 is_test）。
func BuildParamOverrideContext(info *RelayInfo) map[string]any {
	if info == nil {
		return nil
	}

	ctx := make(map[string]any)
	ctx["user_id"] = info.UserId
	ctx["user_group"] = info.UserGroup
	ctx["token_group"] = info.TokenGroup
	ctx["using_group"] = info.UsingGroup
	if info.ChannelMeta != nil && info.ChannelMeta.UpstreamModelName != "" {
		ctx["model"] = info.ChannelMeta.UpstreamModelName
		ctx["upstream_model"] = info.ChannelMeta.UpstreamModelName
	}
	if info.OriginModelName != "" {
		ctx["original_model"] = info.OriginModelName
		if _, exists := ctx["model"]; !exists {
			ctx["model"] = info.OriginModelName
		}
	}

	if info.RequestURLPath != "" {
		requestPath := info.RequestURLPath
		if requestPath != "" {
			ctx["request_path"] = requestPath
		}
	}

	ctx[paramOverrideContextRequestHeaders] = buildRequestHeadersContext(info.RequestHeaders)

	headerOverrideSource := GetEffectiveHeaderOverride(info)
	ctx[paramOverrideContextHeaderOverride] = sanitizeHeaderOverrideMap(headerOverrideSource)

	ctx["retry_index"] = info.RetryIndex
	ctx["is_retry"] = info.RetryIndex > 0
	ctx["retry"] = map[string]any{
		"index":    info.RetryIndex,
		"is_retry": info.RetryIndex > 0,
	}

	if info.LastError != nil {
		code := string(info.LastError.GetErrorCode())
		errorType := string(info.LastError.GetErrorType())
		lastError := map[string]any{
			"status_code": info.LastError.StatusCode,
			"message":     info.LastError.Error(),
			"code":        code,
			"error_code":  code,
			"type":        errorType,
			"error_type":  errorType,
			"skip_retry":  types.IsSkipRetryError(info.LastError),
		}
		ctx["last_error"] = lastError
		ctx["last_error_status_code"] = info.LastError.StatusCode
		ctx["last_error_message"] = info.LastError.Error()
		ctx["last_error_code"] = code
		ctx["last_error_type"] = errorType
	}

	ctx["is_channel_test"] = info.IsChannelTest
	return ctx
}
