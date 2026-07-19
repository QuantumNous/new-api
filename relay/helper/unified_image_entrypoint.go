package helper

import (
	"errors"
	"io"
	"strings"

	rootcommon "github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/setting/reasoning"
	"github.com/tidwall/gjson"
)

const unifiedImageGenerationEndpoint = "POST /v1/images/generations"

// ValidateUnifiedImageEntryPoint prevents synchronous image generation from
// leaking through text, Responses, or native Gemini relay surfaces. A preflight
// call can reject raw request intent and the public model before billing; call
// it again after ModelMappedHelper to cover the effective upstream model.
func ValidateUnifiedImageEntryPoint(info *relaycommon.RelayInfo, request dto.Request) error {
	if info == nil {
		return errors.New("relay info is required to validate the image generation entry point")
	}
	if isUnifiedImageTaskMode(info.RelayMode) {
		return nil
	}

	if requestHasImageOutputIntent(request) ||
		isImageGenerationModel(info.OriginModelName) ||
		isImageGenerationModel(info.UpstreamModelName) {
		return unifiedImageEntryPointError()
	}
	return nil
}

// ValidateUnifiedImagePayload checks the final provider payload after channel
// parameter overrides have been applied. This closes the gap where an override
// injects an image tool, image modality, image config, or image-only model after
// the typed request guard has already run.
func ValidateUnifiedImagePayload(info *relaycommon.RelayInfo, data []byte) error {
	if info == nil {
		return errors.New("relay info is required to validate the image generation payload")
	}
	if isUnifiedImageTaskMode(info.RelayMode) {
		return nil
	}

	if !gjson.ValidBytes(data) {
		return errors.New("invalid JSON image generation payload")
	}
	if rawPayloadHasImageOutputIntent(data) {
		return unifiedImageEntryPointError()
	}
	return nil
}

// ValidateUnifiedImagePayloadStorage scans exact JSON keys in one bounded-memory
// pass, so duplicate or case-variant security-sensitive keys cannot hide image
// intent. The storage is rewound so the request can still be forwarded.
func ValidateUnifiedImagePayloadStorage(info *relaycommon.RelayInfo, storage rootcommon.BodyStorage) error {
	if info == nil {
		return errors.New("relay info is required to validate the image generation payload")
	}
	if isUnifiedImageTaskMode(info.RelayMode) {
		return nil
	}
	if storage == nil {
		return errors.New("request body storage is required to validate the image generation payload")
	}
	if _, err := storage.Seek(0, io.SeekStart); err != nil {
		return err
	}
	imageIntent, scanErr := scanUnifiedImagePayload(storage)
	_, seekErr := storage.Seek(0, io.SeekStart)
	if scanErr != nil {
		return scanErr
	}
	if seekErr != nil {
		return seekErr
	}
	if imageIntent {
		return unifiedImageEntryPointError()
	}
	return nil
}

// ValidateUnifiedImageParamOverride rejects channel overrides that can write
// image-output intent into a non-image relay. It inspects the override program
// without running provider conversion, because converters may download media
// or upload files. Conditions are intentionally ignored: image-producing
// overrides belong on the unified image endpoint, not on text routes.
func ValidateUnifiedImageParamOverride(info *relaycommon.RelayInfo) error {
	if info == nil {
		return errors.New("relay info is required to validate image parameter overrides")
	}
	if isUnifiedImageTaskMode(info.RelayMode) || info.ChannelMeta == nil || len(info.ParamOverride) == 0 {
		return nil
	}
	if unifiedImagePassThroughEnabled(info) {
		return nil
	}

	legacyOverride := make(map[string]any, len(info.ParamOverride))
	for key, value := range info.ParamOverride {
		if key == "operations" {
			continue
		}
		legacyOverride[key] = value
	}
	if len(legacyOverride) > 0 {
		data, err := rootcommon.Marshal(legacyOverride)
		if err != nil {
			return err
		}
		if rawPayloadHasImageOutputIntent(data) {
			return unifiedImageEntryPointError()
		}
	}

	_, ok := info.ParamOverride["operations"]
	if !ok {
		return nil
	}
	operations, ok := relaycommon.ParseParamOverrideOperations(info.ParamOverride)
	if !ok {
		// Invalid operation syntax is treated as a literal legacy field by the
		// override engine and therefore cannot mutate provider JSON paths.
		return nil
	}
	if paramOverrideOperationsCanGenerateImage(info, legacyOverride, operations) {
		return unifiedImageEntryPointError()
	}
	return nil
}

func paramOverrideOperationsCanGenerateImage(info *relaycommon.RelayInfo, legacyOverride map[string]any, operations []relaycommon.ParamOperation) bool {
	model := strings.TrimSpace(info.UpstreamModelName)
	if model == "" {
		model = strings.TrimSpace(info.OriginModelName)
	}
	if model == "" {
		model = "text-model"
	}
	scenarios := unifiedImageParamOverrideScenarios(model)
	if len(legacyOverride) > 0 {
		for index, scenario := range scenarios {
			output, err := relaycommon.ApplyParamOverride(scenario, legacyOverride, nil)
			if err != nil {
				continue
			}
			scenarios[index] = output
			if projectedPayloadHasImageOutputIntent(output) {
				return true
			}
		}
	}
	for _, operation := range operations {
		if paramOverrideOperationHasDirectImageIntent(operation) {
			return true
		}
		switch operation.Mode {
		case "set_header", "delete_header", "copy_header", "move_header", "pass_headers", "return_error":
			continue
		case "copy", "move":
			if paramOverridePathMayWriteImageIntent(operation.To) {
				return true
			}
			continue
		case "sync_fields":
			for _, target := range []string{operation.From, operation.To} {
				if path, ok := paramOverrideSyncJSONPath(target); ok && paramOverridePathMayWriteImageIntent(path) {
					return true
				}
			}
			continue
		}

		override := map[string]any{
			"operations": []any{map[string]any{
				"path":        operation.Path,
				"mode":        operation.Mode,
				"value":       operation.Value,
				"keep_origin": operation.KeepOrigin,
				"from":        operation.From,
				"to":          operation.To,
			}},
		}
		for index, scenario := range scenarios {
			output, err := relaycommon.ApplyParamOverride(scenario, override, nil)
			if err != nil {
				continue
			}
			scenarios[index] = output
			if projectedPayloadHasImageOutputIntent(output) {
				return true
			}
		}
	}
	return false
}

func paramOverridePathMayWriteImageIntent(path string) bool {
	if paramOverridePathHasComplexSelector(path) {
		return true
	}
	return paramOverrideImagePathKind(path) != "" || paramOverridePathCanWriteImageIntent(path)
}

func paramOverrideOperationHasDirectImageIntent(operation relaycommon.ParamOperation) bool {
	if paramOverridePathHasComplexSelector(operation.Path) && paramOverrideComplexSelectorCanWriteImageIntent(operation.Mode) {
		return true
	}
	kind := paramOverrideImagePathKind(operation.Path)
	if kind == "" {
		return false
	}
	if paramOverrideOperationCanComposeClientImageIntent(kind, operation.Mode) {
		return true
	}
	switch operation.Mode {
	case "delete", "prune_objects":
		return false
	case "set":
		return paramOverrideValueCanGenerateImage(kind, operation.Value)
	case "prepend", "append":
		return paramOverrideValueCanGenerateImage(kind, operation.Value)
	case "replace", "regex_replace":
		return paramOverrideStringCanGenerateImage(kind, operation.To)
	case "trim_prefix", "trim_suffix", "ensure_prefix", "ensure_suffix":
		return kind == "image_config" || paramOverrideStringCanGenerateImage(kind, rootcommon.Interface2String(operation.Value))
	case "trim_space", "to_lower", "to_upper":
		return kind == "image_config"
	default:
		return false
	}
}

func paramOverrideComplexSelectorCanWriteImageIntent(mode string) bool {
	switch mode {
	case "set", "prepend", "append", "replace", "regex_replace",
		"trim_prefix", "trim_suffix", "ensure_prefix", "ensure_suffix":
		return true
	default:
		return false
	}
}

func paramOverrideOperationCanComposeClientImageIntent(kind, mode string) bool {
	if kind != "modalities" && kind != "tool_type" && kind != "tools" {
		return false
	}
	return paramOverrideOperationIsStringComposition(mode)
}

func paramOverrideOperationIsStringComposition(mode string) bool {
	switch mode {
	case "prepend", "append", "replace", "regex_replace",
		"trim_prefix", "trim_suffix", "ensure_prefix", "ensure_suffix":
		return true
	default:
		return false
	}
}

func paramOverrideValueCanGenerateImage(kind string, value any) bool {
	if value == nil {
		return false
	}
	switch kind {
	case "image_config":
		return true
	case "model":
		return isImageGenerationModel(rootcommon.Interface2String(value))
	case "modalities":
		return payloadValueContainsImageModality(value)
	case "tools":
		return payloadToolsContainImageGeneration(value)
	case "tool_type":
		return strings.EqualFold(strings.TrimSpace(rootcommon.Interface2String(value)), "image_generation")
	case "container", "wildcard":
		data, err := rootcommon.Marshal(value)
		return err == nil && rawPayloadHasImageOutputIntent(data)
	default:
		return false
	}
}

func paramOverrideStringCanGenerateImage(kind, value string) bool {
	value = strings.TrimSpace(value)
	if value == "" {
		return false
	}
	switch kind {
	case "image_config":
		return true
	case "model":
		return isImageGenerationModel(value) || strings.Contains(strings.ToLower(value), "image")
	case "modalities":
		return strings.Contains(strings.ToLower(value), "image")
	case "tool_type", "tools":
		return strings.Contains(strings.ToLower(value), "image_generation")
	case "container", "wildcard":
		return strings.Contains(strings.ToLower(value), "image")
	default:
		return false
	}
}

func paramOverrideImagePathKind(path string) string {
	segments := paramOverrideSJSONPathSegments(path)
	if len(segments) == 0 {
		return ""
	}
	hasWildcard := false
	fields := make([]string, 0, len(segments))
	for _, segment := range segments {
		if segment == "*" {
			hasWildcard = true
			continue
		}
		if segment == "" || segment == "-1" {
			continue
		}
		isIndex := true
		for _, char := range segment {
			if char < '0' || char > '9' {
				isIndex = false
				break
			}
		}
		if !isIndex {
			fields = append(fields, strings.ToLower(segment))
		}
	}
	if len(fields) == 0 {
		if hasWildcard {
			return "wildcard"
		}
		return ""
	}
	last := fields[len(fields)-1]
	for _, field := range fields {
		if field == "imageconfig" || field == "image_config" {
			return "image_config"
		}
	}
	if last == "model" {
		return "model"
	}
	for _, field := range fields {
		if field == "modalities" || field == "responsemodalities" || field == "response_modalities" {
			return "modalities"
		}
	}
	for _, field := range fields {
		if field != "tools" {
			continue
		}
		if last == "tools" {
			return "tools"
		}
		if last == "type" {
			return "tool_type"
		}
	}
	if last == "generationconfig" || last == "generation_config" || last == "extra_body" || last == "extrabody" || last == "google" {
		return "container"
	}
	return ""
}

func paramOverridePathHasComplexSelector(path string) bool {
	escaped := false
	for _, char := range path {
		if escaped {
			escaped = false
			continue
		}
		if char == '\\' {
			escaped = true
			continue
		}
		switch char {
		case '|', '#', '@', '*', '?':
			return true
		}
	}
	return false
}

func paramOverrideSJSONPathSegments(path string) []string {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil
	}
	segments := make([]string, 0, strings.Count(path, ".")+1)
	var segment strings.Builder
	escaped := false
	for _, char := range path {
		if escaped {
			segment.WriteRune(char)
			escaped = false
			continue
		}
		if char == '\\' {
			escaped = true
			continue
		}
		if char == '.' {
			value := strings.TrimSpace(segment.String())
			value = strings.TrimPrefix(value, ":")
			segments = append(segments, value)
			segment.Reset()
			continue
		}
		segment.WriteRune(char)
	}
	if escaped {
		segment.WriteRune('\\')
	}
	value := strings.TrimSpace(segment.String())
	value = strings.TrimPrefix(value, ":")
	segments = append(segments, value)
	return segments
}

func paramOverridePathCanWriteImageIntent(path string) bool {
	if strings.TrimSpace(path) == "" {
		return false
	}
	candidates := []any{
		"gpt-image-2",
		"IMAGE",
		"image_generation",
		[]any{"IMAGE"},
		map[string]any{"type": "image_generation"},
		[]any{map[string]any{"type": "image_generation"}},
		map[string]any{
			"model":              "gpt-image-2",
			"responseModalities": []any{"IMAGE"},
			"imageConfig":        map[string]any{"aspectRatio": "1:1"},
			"tools":              []any{map[string]any{"type": "image_generation"}},
		},
	}
	for _, candidate := range candidates {
		override := map[string]any{
			"operations": []any{map[string]any{
				"path":  path,
				"mode":  "set",
				"value": candidate,
			}},
		}
		for _, scenario := range unifiedImageParamOverrideScenarios("text-model") {
			output, err := relaycommon.ApplyParamOverride(scenario, override, nil)
			if err == nil && projectedPayloadHasImageOutputIntent(output) {
				return true
			}
		}
	}
	return false
}

func unifiedImageParamOverrideScenarios(model string) [][]byte {
	prefixes := [][]string{
		nil,
		{"generationConfig"},
		{"generation_config"},
		{"extra_body"},
		{"extraBody"},
		{"google"},
		{"extra_body", "google"},
		{"extraBody", "google"},
	}
	leaves := []struct {
		key   string
		value any
	}{
		{key: "model", value: model},
		{key: "modalities", value: []any{"text", "audio"}},
		{key: "responseModalities", value: []any{"TEXT", "AUDIO"}},
		{key: "response_modalities", value: []any{"TEXT", "AUDIO"}},
		{key: "tools", value: []any{
			map[string]any{"type": "function"},
			map[string]any{"type": "function"},
		}},
		{key: "imageConfig", value: nil},
		{key: "image_config", value: nil},
	}

	scenarios := make([][]byte, 0, len(prefixes)*len(leaves))
	for _, prefix := range prefixes {
		for _, leaf := range leaves {
			root := make(map[string]any)
			current := root
			for _, segment := range prefix {
				next := make(map[string]any)
				current[segment] = next
				current = next
			}
			current[leaf.key] = leaf.value
			data, err := rootcommon.Marshal(root)
			if err == nil {
				scenarios = append(scenarios, data)
			}
		}
	}
	return scenarios
}

func projectedPayloadHasImageOutputIntent(data []byte) bool {
	var value any
	if err := rootcommon.Unmarshal(data, &value); err != nil {
		return false
	}
	return projectedValueHasImageOutputIntent(value)
}

func projectedValueHasImageOutputIntent(value any) bool {
	payload, ok := value.(map[string]any)
	if !ok {
		return false
	}
	if model, ok := payload["model"].(string); ok && isImageGenerationModel(model) {
		return true
	}
	for _, key := range []string{"modalities", "responseModalities", "response_modalities"} {
		if payloadValueContainsImageModality(payload[key]) {
			return true
		}
	}
	if payloadToolsContainImageGeneration(payload["tools"]) {
		return true
	}
	for _, key := range []string{"imageConfig", "image_config"} {
		if configured, exists := payload[key]; exists && configured != nil {
			return true
		}
	}
	for _, key := range []string{"generationConfig", "generation_config", "extra_body", "extraBody", "google"} {
		if projectedValueHasImageOutputIntent(payload[key]) {
			return true
		}
	}
	return false
}

func paramOverrideSyncJSONPath(target string) (string, bool) {
	target = strings.TrimSpace(target)
	if target == "" {
		return "", false
	}
	separator := strings.Index(target, ":")
	if separator < 0 {
		return target, true
	}
	kind := strings.ToLower(strings.TrimSpace(target[:separator]))
	if kind != "json" && kind != "body" {
		return "", false
	}
	return strings.TrimSpace(target[separator+1:]), true
}

func unifiedImagePassThroughEnabled(info *relaycommon.RelayInfo) bool {
	return info != nil && info.ChannelMeta != nil &&
		(model_setting.GetGlobalSettings().PassThroughRequestEnabled || info.ChannelSetting.PassThroughBodyEnabled)
}

func isUnifiedImageTaskMode(relayMode int) bool {
	return relayMode == relayconstant.RelayModeImagesGenerations
}

func unifiedImageEntryPointError() error {
	return errors.New("image generation is only available through " + unifiedImageGenerationEndpoint)
}

func requestHasImageOutputIntent(request dto.Request) bool {
	switch req := request.(type) {
	case *dto.ImageRequest:
		return req != nil
	case *dto.GeneralOpenAIRequest:
		if req == nil {
			return false
		}
		for _, tool := range req.Tools {
			if strings.EqualFold(strings.TrimSpace(tool.Type), "image_generation") {
				return true
			}
		}
		if len(req.Modalities) == 0 {
			return rawPayloadHasImageOutputIntent(req.ExtraBody)
		}
		var modalities []string
		if err := rootcommon.Unmarshal(req.Modalities, &modalities); err != nil {
			return rawPayloadHasImageOutputIntent(req.ExtraBody)
		}
		return containsImageModality(modalities) || rawPayloadHasImageOutputIntent(req.ExtraBody)
	case *dto.OpenAIResponsesRequest:
		if req == nil {
			return false
		}
		for _, tool := range req.GetToolsMap() {
			if strings.EqualFold(strings.TrimSpace(rootcommon.Interface2String(tool["type"])), "image_generation") {
				return true
			}
		}
	case *dto.GeminiChatRequest:
		if req == nil {
			return false
		}
		return req.GenerationConfig.HasImageOutputIntent()
	}
	return false
}

func containsImageModality(modalities []string) bool {
	for _, modality := range modalities {
		if strings.EqualFold(strings.TrimSpace(modality), "image") {
			return true
		}
	}
	return false
}

func rawPayloadHasImageOutputIntent(raw []byte) bool {
	if len(raw) == 0 {
		return false
	}
	return exactPayloadHasImageOutputIntent(gjson.ParseBytes(raw))
}

func exactPayloadHasImageOutputIntent(payload gjson.Result) bool {
	if !payload.IsObject() {
		return false
	}
	seen := make(map[string]struct{})
	imageIntent := false
	payload.ForEach(func(key, value gjson.Result) bool {
		name := key.String()
		canonical, sensitive := canonicalImageIntentKey(name)
		if !sensitive {
			return true
		}
		if name != canonical {
			imageIntent = true
			return false
		}
		if _, exists := seen[canonical]; exists {
			imageIntent = true
			return false
		}
		seen[canonical] = struct{}{}

		switch canonical {
		case "model":
			imageIntent = value.Type == gjson.String && isImageGenerationModel(value.String())
		case "modalities", "responseModalities", "response_modalities":
			imageIntent = exactPayloadValueContainsImageModality(value)
		case "tools":
			imageIntent = exactPayloadToolsContainImageGeneration(value)
		case "imageConfig", "image_config":
			imageIntent = value.Type != gjson.Null
		case "generationConfig", "generation_config", "extra_body", "extraBody", "google":
			imageIntent = exactPayloadHasImageOutputIntent(value)
		}
		return !imageIntent
	})
	return imageIntent
}

func canonicalImageIntentKey(key string) (string, bool) {
	for _, canonical := range []string{
		"model",
		"modalities",
		"responseModalities",
		"response_modalities",
		"tools",
		"imageConfig",
		"image_config",
		"generationConfig",
		"generation_config",
		"extra_body",
		"extraBody",
		"google",
	} {
		if strings.EqualFold(key, canonical) {
			return canonical, true
		}
	}
	return "", false
}

func exactPayloadValueContainsImageModality(value gjson.Result) bool {
	if value.Type == gjson.String {
		return strings.EqualFold(strings.TrimSpace(value.String()), "image")
	}
	if !value.IsArray() {
		return false
	}
	containsImage := false
	value.ForEach(func(_, item gjson.Result) bool {
		containsImage = item.Type == gjson.String && strings.EqualFold(strings.TrimSpace(item.String()), "image")
		return !containsImage
	})
	return containsImage
}

func exactPayloadToolsContainImageGeneration(value gjson.Result) bool {
	if value.IsArray() {
		containsImage := false
		value.ForEach(func(_, item gjson.Result) bool {
			containsImage = exactPayloadToolsContainImageGeneration(item)
			return !containsImage
		})
		return containsImage
	}
	if !value.IsObject() {
		return false
	}
	seenType := false
	containsImage := false
	value.ForEach(func(key, item gjson.Result) bool {
		if !strings.EqualFold(key.String(), "type") {
			return true
		}
		if key.String() != "type" || seenType {
			containsImage = true
			return false
		}
		seenType = true
		containsImage = item.Type == gjson.String && strings.EqualFold(strings.TrimSpace(item.String()), "image_generation")
		return !containsImage
	})
	return containsImage
}

func payloadValueContainsImageModality(value any) bool {
	switch typed := value.(type) {
	case string:
		return strings.EqualFold(strings.TrimSpace(typed), "image")
	case []any:
		for _, item := range typed {
			if strings.EqualFold(strings.TrimSpace(rootcommon.Interface2String(item)), "image") {
				return true
			}
		}
	case []string:
		return containsImageModality(typed)
	}
	return false
}

func payloadToolsContainImageGeneration(value any) bool {
	switch typed := value.(type) {
	case []any:
		for _, item := range typed {
			if payloadToolsContainImageGeneration(item) {
				return true
			}
		}
	case map[string]any:
		return strings.EqualFold(strings.TrimSpace(rootcommon.Interface2String(typed["type"])), "image_generation")
	}
	return false
}

func isImageGenerationModel(model string) bool {
	model = strings.TrimPrefix(strings.ToLower(strings.TrimSpace(model)), "models/")
	if model == "" {
		return false
	}
	candidates := []string{model}
	if strings.Contains(model, "-thinking-") {
		candidates = append(candidates, strings.SplitN(model, "-thinking-", 2)[0])
	} else if strings.HasSuffix(model, "-thinking") {
		candidates = append(candidates, strings.TrimSuffix(model, "-thinking"))
	} else if strings.HasSuffix(model, "-nothinking") {
		candidates = append(candidates, strings.TrimSuffix(model, "-nothinking"))
	}
	if baseModel, level, ok := reasoning.TrimEffortSuffix(model); ok && level != "" {
		candidates = append(candidates, baseModel)
	}
	for _, candidate := range candidates {
		if rootcommon.IsImageGenerationModel(candidate) ||
			model_setting.IsGeminiModelSupportImagine(candidate) ||
			model_setting.IsSyncImageModel(candidate) ||
			strings.HasPrefix(candidate, "gpt-image-") ||
			strings.HasPrefix(candidate, "chatgpt-image") ||
			strings.HasPrefix(candidate, "dall-e") ||
			strings.HasPrefix(candidate, "imagen-") ||
			strings.Contains(candidate, "nano-banana") ||
			strings.HasSuffix(candidate, "-image-to-image") ||
			strings.HasSuffix(candidate, "-text-to-image") {
			return true
		}
	}
	return false
}
