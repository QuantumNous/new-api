package relayconvert

import (
	"errors"
	"fmt"
	"reflect"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

type ResponseConverterFunc func(c *gin.Context, info *relaycommon.RelayInfo, response any) (any, *dto.Usage, error)

type ResponseStreamConverterFunc func(c *gin.Context, info *relaycommon.RelayInfo, response any) (any, *dto.Usage, error)

type ResponseStreamStateFactory func(options ResponseStreamOptions) any

type ResponseStreamChunkConverterFunc func(c *gin.Context, info *relaycommon.RelayInfo, response any, state any) ([]any, *dto.Usage, error)

type ResponseStreamFinalizerFunc func(c *gin.Context, info *relaycommon.RelayInfo, state any) ([]any, *dto.Usage, error)

type ResponseConverterQuality string

const (
	ResponseConverterQualityGood        ResponseConverterQuality = "good"
	ResponseConverterQualityFair        ResponseConverterQuality = "fair"
	ResponseConverterQualityDiscouraged ResponseConverterQuality = "discouraged"
)

type ResponseStep struct {
	Converter string
	From      types.RelayFormat
	To        types.RelayFormat
}

type ResponseResult struct {
	Value     any
	Usage     *dto.Usage
	From      types.RelayFormat
	To        types.RelayFormat
	Converter string
	Quality   ResponseConverterQuality
	Steps     []ResponseStep
	Stream    bool
}

type ResponseConverterSpec struct {
	ID                 string
	From               types.RelayFormat
	To                 types.RelayFormat
	Quality            ResponseConverterQuality
	Convert            ResponseConverterFunc
	ConvertStream      ResponseStreamConverterFunc
	NewStreamState     ResponseStreamStateFactory
	ConvertStreamChunk ResponseStreamChunkConverterFunc
	FinalizeStream     ResponseStreamFinalizerFunc
	StepConverters     []string
}

type responseConverterRoute struct {
	from types.RelayFormat
	to   types.RelayFormat
}

type ResponseStreamOptions struct {
	ID           string
	Model        string
	Created      int64
	IncludeUsage bool
}

type ResponseStreamState struct {
	From      types.RelayFormat
	To        types.RelayFormat
	Converter string
	Quality   ResponseConverterQuality
	Steps     []ResponseStep

	specs      []ResponseConverterSpec
	stepStates []any
	usage      *dto.Usage
}

const (
	ResponseConverterOAIChatToOAIResponses   = "oai_chat_to_oai_responses_resp"
	ResponseConverterOAIResponsesToOAIChat   = "oai_responses_to_oai_chat_resp"
	ResponseConverterOAIChatToClaudeMessages = "oai_chat_to_claude_messages_resp"
	ResponseConverterOAIChatToGeminiChat     = "oai_chat_to_gemini_chat_resp"
	ResponseConverterClaudeMessagesToOAIChat = "claude_messages_to_oai_chat_resp"
	ResponseConverterGeminiChatToOAIChat     = "gemini_chat_to_oai_chat_resp"

	responseConverterClaudeToGemini    = "claude_messages_to_gemini_chat_resp"
	responseConverterClaudeToResponses = "claude_messages_to_oai_responses_resp"
	responseConverterGeminiToClaude    = "gemini_chat_to_claude_messages_resp"
	responseConverterGeminiToResponses = "gemini_chat_to_oai_responses_resp"
	responseConverterResponsesToClaude = "oai_responses_to_claude_messages_resp"
	responseConverterResponsesToGemini = "oai_responses_to_gemini_chat_resp"
)

var (
	responseConverterMu      sync.RWMutex
	responseConverters       = make(map[string]ResponseConverterSpec)
	responseConverterAliases = make(map[string]string)
	responseConverterRoutes  = make(map[responseConverterRoute]string)
)

func registerBuiltinResponseConverter(spec ResponseConverterSpec) {
	spec.ID = strings.TrimSpace(spec.ID)
	if spec.ID == "" {
		panic("response converter ID is required")
	}
	if spec.From == "" || spec.To == "" {
		panic(fmt.Sprintf("response converter %q must declare from and to formats", spec.ID))
	}
	if spec.Quality == "" {
		panic(fmt.Sprintf("response converter %q must declare quality", spec.ID))
	}
	if spec.Convert == nil &&
		spec.ConvertStream == nil &&
		spec.ConvertStreamChunk == nil &&
		len(spec.StepConverters) == 0 {
		panic(fmt.Sprintf("response converter %q must declare convert, stream convert, or step converters", spec.ID))
	}
	if len(spec.StepConverters) > 0 &&
		(spec.Convert != nil || spec.ConvertStream != nil || spec.NewStreamState != nil || spec.ConvertStreamChunk != nil || spec.FinalizeStream != nil) {
		panic(fmt.Sprintf("response converter %q cannot declare direct implementations and step converters together", spec.ID))
	}
	if _, exists := responseConverters[spec.ID]; exists {
		panic(fmt.Sprintf("response converter %q is already registered", spec.ID))
	}
	route := responseConverterRoute{from: spec.From, to: spec.To}
	if existingID, exists := responseConverterRoutes[route]; exists {
		panic(fmt.Sprintf("response converter route from %s to %s is already registered by %q", spec.From, spec.To, existingID))
	}

	if len(spec.StepConverters) > 0 {
		stepConverters := make([]string, 0, len(spec.StepConverters))
		current := spec.From
		for _, converterID := range spec.StepConverters {
			step, ok := responseConverters[converterID]
			if !ok {
				panic(fmt.Sprintf("response converter %q references unknown step converter %q", spec.ID, converterID))
			}
			if len(step.StepConverters) > 0 {
				panic(fmt.Sprintf("response converter %q step %q must be a direct converter", spec.ID, converterID))
			}
			if step.From != current {
				panic(fmt.Sprintf("response converter %q step %q expects %s after %s", spec.ID, converterID, step.From, current))
			}
			stepConverters = append(stepConverters, converterID)
			current = step.To
		}
		if current != spec.To {
			panic(fmt.Sprintf("response converter %q ends at %s, expected %s", spec.ID, current, spec.To))
		}
		spec.StepConverters = stepConverters
	}

	responseConverters[spec.ID] = spec
	responseConverterRoutes[route] = spec.ID
}

func registerResponseConverterAlias(alias string, converter string) {
	alias = strings.TrimSpace(alias)
	converter = strings.TrimSpace(converter)
	if alias == "" {
		panic("response converter alias is required")
	}
	if converter == "" {
		panic(fmt.Sprintf("response converter alias %q target is required", alias))
	}
	if alias == converter {
		return
	}
	if _, exists := responseConverters[alias]; exists {
		panic(fmt.Sprintf("response converter alias %q conflicts with registered converter", alias))
	}
	if _, exists := responseConverters[converter]; !exists {
		panic(fmt.Sprintf("response converter alias %q references unknown converter %q", alias, converter))
	}
	if existing, exists := responseConverterAliases[alias]; exists && existing != converter {
		panic(fmt.Sprintf("response converter alias %q is already registered for %q", alias, existing))
	}
	responseConverterAliases[alias] = converter
}

func LookupResponseConverter(converter string) (ResponseConverterSpec, bool) {
	responseConverterMu.RLock()
	defer responseConverterMu.RUnlock()

	converterID := resolveResponseConverterID(converter)
	spec, ok := responseConverters[converterID]
	if !ok {
		return ResponseConverterSpec{}, false
	}
	return cloneResponseConverterSpec(spec), true
}

func ConvertResponse(c *gin.Context, info *relaycommon.RelayInfo, target types.RelayFormat, response any) (*ResponseResult, error) {
	from, err := inferResponseRelayFormat(response)
	if err != nil {
		return nil, err
	}
	if target == "" {
		return nil, errors.New("target relay format is required")
	}
	if from == target {
		return &ResponseResult{
			Value:  response,
			Usage:  canonicalUsageFromResponse(response),
			From:   from,
			To:     target,
			Stream: false,
		}, nil
	}

	spec, ok := lookupResponseRoute(from, target)
	if !ok {
		return nil, fmt.Errorf("response converter from %s to %s is not registered", from, target)
	}
	return executeResponseSpec(c, info, from, target, response, spec)
}

func ConvertResponseByID(c *gin.Context, info *relaycommon.RelayInfo, converter string, response any) (*ResponseResult, error) {
	from, err := inferResponseRelayFormat(response)
	if err != nil {
		return nil, err
	}

	spec, ok := LookupResponseConverter(converter)
	if !ok {
		return nil, fmt.Errorf("response converter %q is not registered", strings.TrimSpace(converter))
	}
	if spec.From != "" && spec.From != from {
		return nil, fmt.Errorf("response converter %q expects %s response, got %s", spec.ID, spec.From, from)
	}
	return executeResponseSpec(c, info, from, spec.To, response, spec)
}

func ConvertStreamResponse(c *gin.Context, info *relaycommon.RelayInfo, target types.RelayFormat, response any) (*ResponseResult, error) {
	from, err := inferResponseRelayFormat(response)
	if err != nil {
		return nil, err
	}
	if target == "" {
		return nil, errors.New("target relay format is required")
	}
	if from == target {
		return &ResponseResult{
			Value:  response,
			Usage:  canonicalUsageFromResponse(response),
			From:   from,
			To:     target,
			Stream: true,
		}, nil
	}

	spec, ok := lookupResponseRoute(from, target)
	if !ok {
		return nil, fmt.Errorf("response converter from %s to %s is not registered", from, target)
	}
	return executeStatelessStreamResponseSpec(c, info, from, target, response, spec)
}

func NewResponseStreamState(from types.RelayFormat, target types.RelayFormat, options ResponseStreamOptions) (*ResponseStreamState, error) {
	if from == "" {
		return nil, errors.New("source relay format is required")
	}
	if target == "" {
		return nil, errors.New("target relay format is required")
	}
	if from == target {
		return &ResponseStreamState{
			From: from,
			To:   target,
		}, nil
	}

	spec, ok := lookupResponseRoute(from, target)
	if !ok {
		return nil, fmt.Errorf("response converter from %s to %s is not registered", from, target)
	}
	return newResponseStreamStateFromSpec(from, target, options, spec)
}

func NewResponseStreamStateByID(converter string, options ResponseStreamOptions) (*ResponseStreamState, error) {
	spec, ok := LookupResponseConverter(converter)
	if !ok {
		return nil, fmt.Errorf("response converter %q is not registered", strings.TrimSpace(converter))
	}
	return newResponseStreamStateFromSpec(spec.From, spec.To, options, spec)
}

func ConvertStreamResponseChunk(c *gin.Context, info *relaycommon.RelayInfo, state *ResponseStreamState, response any) ([]ResponseResult, error) {
	if state == nil {
		return nil, errors.New("response stream state is required")
	}
	from, err := inferResponseRelayFormat(response)
	if err != nil {
		return nil, err
	}
	if from != state.From {
		return nil, fmt.Errorf("response stream converter %q expects %s response, got %s", state.Converter, state.From, from)
	}
	if state.From == state.To {
		usage := canonicalUsageFromResponse(response)
		state.rememberUsage(usage)
		return responseStreamResults(state, streamValuesFromAny(response), usage), nil
	}

	values, usage, err := executeResponseStreamSteps(c, info, state, []any{response}, 0)
	if err != nil {
		return nil, err
	}
	state.rememberUsage(usage)
	return responseStreamResults(state, values, usage), nil
}

func FinalizeStreamResponse(c *gin.Context, info *relaycommon.RelayInfo, state *ResponseStreamState) ([]ResponseResult, error) {
	if state == nil {
		return nil, errors.New("response stream state is required")
	}
	if state.From == state.To {
		return nil, nil
	}

	values := make([]any, 0)
	var usage *dto.Usage
	for i, spec := range state.specs {
		finalValues, stepUsage, err := finalizeResponseStreamStep(c, info, spec, state.stepStates[i])
		if err != nil {
			return nil, err
		}
		if stepUsage != nil {
			usage = stepUsage
			state.rememberUsage(stepUsage)
		}
		if len(finalValues) == 0 {
			continue
		}
		current, currentUsage, err := executeResponseStreamSteps(c, info, state, finalValues, i+1)
		if err != nil {
			return nil, err
		}
		if currentUsage != nil {
			usage = currentUsage
			state.rememberUsage(currentUsage)
		}
		values = append(values, current...)
	}
	return responseStreamResults(state, values, usage), nil
}

func (s *ResponseStreamState) Usage() *dto.Usage {
	if s == nil {
		return nil
	}
	if s.usage != nil {
		return s.usage
	}
	for _, state := range s.stepStates {
		switch typed := state.(type) {
		case *ChatToResponsesStreamState:
			if typed.Usage != nil {
				return typed.Usage
			}
		case *ResponsesToChatStreamState:
			if typed.Usage != nil {
				return typed.Usage
			}
		}
	}
	return nil
}

func (s *ResponseStreamState) SetUsage(usage *dto.Usage) {
	if s == nil || usage == nil {
		return
	}
	s.usage = usage
	for _, state := range s.stepStates {
		switch typed := state.(type) {
		case *ChatToResponsesStreamState:
			typed.Usage = UsageFromChatUsage(usage)
		case *ResponsesToChatStreamState:
			typed.Usage = usage
		}
	}
}

func (s *ResponseStreamState) UsageText() string {
	if s == nil {
		return ""
	}
	for _, state := range s.stepStates {
		switch typed := state.(type) {
		case interface{ UsageText() string }:
			if text := typed.UsageText(); text != "" {
				return text
			}
		}
	}
	return ""
}

func executeResponseSpec(c *gin.Context, info *relaycommon.RelayInfo, from types.RelayFormat, target types.RelayFormat, response any, spec ResponseConverterSpec) (*ResponseResult, error) {
	steps, err := expandResponseConverterSteps(spec)
	if err != nil {
		return nil, err
	}
	return executeResponseSteps(c, info, from, target, response, spec.ID, spec.Quality, steps)
}

func executeResponseSteps(c *gin.Context, info *relaycommon.RelayInfo, from types.RelayFormat, target types.RelayFormat, response any, converter string, quality ResponseConverterQuality, specs []ResponseConverterSpec) (*ResponseResult, error) {
	current := response
	var usage *dto.Usage
	steps := make([]ResponseStep, 0, len(specs))
	for _, spec := range specs {
		var step ResponseStep
		var err error
		current, usage, step, err = executeResponseStep(c, info, spec, current)
		if err != nil {
			return nil, err
		}
		steps = append(steps, step)
	}

	converters := make([]string, 0, len(steps))
	for _, step := range steps {
		converters = append(converters, step.Converter)
	}
	if converter == "" {
		converter = strings.Join(converters, ",")
	}
	return &ResponseResult{
		Value:     current,
		Usage:     usage,
		From:      from,
		To:        target,
		Converter: converter,
		Quality:   quality,
		Steps:     steps,
		Stream:    false,
	}, nil
}

func executeResponseStep(c *gin.Context, info *relaycommon.RelayInfo, spec ResponseConverterSpec, response any) (any, *dto.Usage, ResponseStep, error) {
	if spec.Convert == nil {
		return nil, nil, ResponseStep{}, fmt.Errorf("response converter %q has no non-stream implementation", spec.ID)
	}

	value, usage, err := spec.Convert(c, info, response)
	if err != nil {
		return nil, nil, ResponseStep{}, err
	}
	return value, usage, ResponseStep{
		Converter: spec.ID,
		From:      spec.From,
		To:        spec.To,
	}, nil
}

func executeStatelessStreamResponseSpec(c *gin.Context, info *relaycommon.RelayInfo, from types.RelayFormat, target types.RelayFormat, response any, spec ResponseConverterSpec) (*ResponseResult, error) {
	steps, err := expandResponseConverterSteps(spec)
	if err != nil {
		return nil, err
	}
	current := response
	var usage *dto.Usage
	resultSteps := make([]ResponseStep, 0, len(steps))
	for _, step := range steps {
		if step.ConvertStreamChunk != nil || step.NewStreamState != nil || step.FinalizeStream != nil {
			return nil, fmt.Errorf("response converter %q requires response stream state", step.ID)
		}
		if step.ConvertStream == nil {
			return nil, fmt.Errorf("response converter %q has no stream implementation", step.ID)
		}
		var err error
		current, usage, err = step.ConvertStream(c, info, current)
		if err != nil {
			return nil, err
		}
		resultSteps = append(resultSteps, ResponseStep{
			Converter: step.ID,
			From:      step.From,
			To:        step.To,
		})
	}
	return &ResponseResult{
		Value:     current,
		Usage:     usage,
		From:      from,
		To:        target,
		Converter: spec.ID,
		Quality:   spec.Quality,
		Steps:     resultSteps,
		Stream:    true,
	}, nil
}

func newResponseStreamStateFromSpec(from types.RelayFormat, target types.RelayFormat, options ResponseStreamOptions, spec ResponseConverterSpec) (*ResponseStreamState, error) {
	steps, err := expandResponseConverterSteps(spec)
	if err != nil {
		return nil, err
	}
	stepStates := make([]any, len(steps))
	resultSteps := make([]ResponseStep, 0, len(steps))
	for i, step := range steps {
		if step.NewStreamState != nil {
			stepStates[i] = step.NewStreamState(options)
		}
		resultSteps = append(resultSteps, ResponseStep{
			Converter: step.ID,
			From:      step.From,
			To:        step.To,
		})
	}
	return &ResponseStreamState{
		From:       from,
		To:         target,
		Converter:  spec.ID,
		Quality:    spec.Quality,
		Steps:      resultSteps,
		specs:      steps,
		stepStates: stepStates,
	}, nil
}

func executeResponseStreamSteps(c *gin.Context, info *relaycommon.RelayInfo, state *ResponseStreamState, values []any, start int) ([]any, *dto.Usage, error) {
	current := values
	var usage *dto.Usage
	for i := start; i < len(state.specs); i++ {
		spec := state.specs[i]
		next := make([]any, 0)
		for _, value := range current {
			prepareResponseStreamInfo(info, spec)
			stepValues, stepUsage, err := executeResponseStreamStep(c, info, spec, state.stepStates[i], value)
			if err != nil {
				return nil, nil, err
			}
			if stepUsage != nil {
				usage = stepUsage
				state.rememberUsage(stepUsage)
			}
			next = append(next, stepValues...)
		}
		current = next
		if len(current) == 0 {
			return nil, usage, nil
		}
	}
	return current, usage, nil
}

func prepareResponseStreamInfo(info *relaycommon.RelayInfo, spec ResponseConverterSpec) {
	if info == nil {
		return
	}
	if spec.From != types.RelayFormatOpenAI {
		return
	}
	if spec.To != types.RelayFormatClaude && spec.To != types.RelayFormatGemini {
		return
	}
	info.SendResponseCount++
}

func executeResponseStreamStep(c *gin.Context, info *relaycommon.RelayInfo, spec ResponseConverterSpec, state any, response any) ([]any, *dto.Usage, error) {
	if spec.ConvertStreamChunk != nil {
		return spec.ConvertStreamChunk(c, info, response, state)
	}
	if spec.ConvertStream == nil {
		return nil, nil, fmt.Errorf("response converter %q has no stream implementation", spec.ID)
	}
	value, usage, err := spec.ConvertStream(c, info, response)
	if err != nil {
		return nil, nil, err
	}
	return streamValuesFromAny(value), usage, nil
}

func finalizeResponseStreamStep(c *gin.Context, info *relaycommon.RelayInfo, spec ResponseConverterSpec, state any) ([]any, *dto.Usage, error) {
	if spec.FinalizeStream == nil {
		return nil, nil, nil
	}
	return spec.FinalizeStream(c, info, state)
}

func (s *ResponseStreamState) rememberUsage(usage *dto.Usage) {
	if s != nil && usage != nil {
		s.usage = usage
	}
}

func responseStreamResults(state *ResponseStreamState, values []any, usage *dto.Usage) []ResponseResult {
	if state == nil || len(values) == 0 {
		return nil
	}
	results := make([]ResponseResult, 0, len(values))
	for _, value := range values {
		results = append(results, ResponseResult{
			Value:     value,
			Usage:     usage,
			From:      state.From,
			To:        state.To,
			Converter: state.Converter,
			Quality:   state.Quality,
			Steps:     append([]ResponseStep{}, state.Steps...),
			Stream:    true,
		})
	}
	return results
}

func streamValuesFromAny(value any) []any {
	if value == nil {
		return nil
	}
	rv := reflect.ValueOf(value)
	if rv.Kind() == reflect.Pointer && rv.IsNil() {
		return nil
	}
	if rv.Kind() != reflect.Slice && rv.Kind() != reflect.Array {
		return []any{value}
	}
	if rv.Type().Elem().Kind() == reflect.Uint8 {
		return []any{value}
	}
	values := make([]any, 0, rv.Len())
	for i := 0; i < rv.Len(); i++ {
		item := rv.Index(i)
		if item.Kind() == reflect.Pointer && item.IsNil() {
			continue
		}
		values = append(values, item.Interface())
	}
	return values
}

func expandResponseConverterSteps(spec ResponseConverterSpec) ([]ResponseConverterSpec, error) {
	if len(spec.StepConverters) == 0 {
		if spec.Convert == nil && spec.ConvertStream == nil && spec.ConvertStreamChunk == nil {
			return nil, fmt.Errorf("response converter %q has no registered implementation", spec.ID)
		}
		return []ResponseConverterSpec{spec}, nil
	}

	steps := make([]ResponseConverterSpec, 0, len(spec.StepConverters))
	current := spec.From
	for _, converterID := range spec.StepConverters {
		step, ok := LookupResponseConverter(converterID)
		if !ok {
			return nil, fmt.Errorf("response converter %q references missing step converter %q", spec.ID, converterID)
		}
		if len(step.StepConverters) > 0 {
			return nil, fmt.Errorf("response converter %q step %q is not a direct converter", spec.ID, converterID)
		}
		if step.From != current {
			return nil, fmt.Errorf("response converter %q step %q expects %s response, got %s", spec.ID, converterID, step.From, current)
		}
		steps = append(steps, step)
		current = step.To
	}
	if current != spec.To {
		return nil, fmt.Errorf("response converter %q ends at %s, expected %s", spec.ID, current, spec.To)
	}
	return steps, nil
}

func lookupResponseRoute(from types.RelayFormat, to types.RelayFormat) (ResponseConverterSpec, bool) {
	responseConverterMu.RLock()
	defer responseConverterMu.RUnlock()

	converterID, ok := responseConverterRoutes[responseConverterRoute{from: from, to: to}]
	if !ok {
		return ResponseConverterSpec{}, false
	}
	spec, ok := responseConverters[converterID]
	return cloneResponseConverterSpec(spec), ok
}

func resolveResponseConverterID(converter string) string {
	converter = strings.TrimSpace(converter)
	if canonical, ok := responseConverterAliases[converter]; ok {
		return canonical
	}
	return converter
}

func cloneResponseConverterSpec(spec ResponseConverterSpec) ResponseConverterSpec {
	if len(spec.StepConverters) > 0 {
		spec.StepConverters = append([]string{}, spec.StepConverters...)
	}
	return spec
}

func inferResponseRelayFormat(response any) (types.RelayFormat, error) {
	if isNilResponse(response) {
		return "", errors.New("response is nil")
	}
	switch response.(type) {
	case *dto.OpenAITextResponse, dto.OpenAITextResponse, *dto.ChatCompletionsStreamResponse, dto.ChatCompletionsStreamResponse:
		return types.RelayFormatOpenAI, nil
	case *dto.OpenAIResponsesResponse, dto.OpenAIResponsesResponse, *dto.ResponsesStreamResponse, dto.ResponsesStreamResponse:
		return types.RelayFormatOpenAIResponses, nil
	case *dto.ClaudeResponse, dto.ClaudeResponse:
		return types.RelayFormatClaude, nil
	case *dto.GeminiChatResponse, dto.GeminiChatResponse:
		return types.RelayFormatGemini, nil
	default:
		return "", fmt.Errorf("unsupported response type %T", response)
	}
}

func isNilResponse(response any) bool {
	if response == nil {
		return true
	}
	value := reflect.ValueOf(response)
	switch value.Kind() {
	case reflect.Chan, reflect.Func, reflect.Interface, reflect.Map, reflect.Pointer, reflect.Slice:
		return value.IsNil()
	default:
		return false
	}
}

func canonicalUsageFromResponse(response any) *dto.Usage {
	switch resp := response.(type) {
	case *dto.OpenAITextResponse:
		return UsageFromChatUsage(&resp.Usage)
	case dto.OpenAITextResponse:
		return UsageFromChatUsage(&resp.Usage)
	case *dto.ChatCompletionsStreamResponse:
		if resp.Usage == nil {
			return nil
		}
		return UsageFromChatUsage(resp.Usage)
	case dto.ChatCompletionsStreamResponse:
		if resp.Usage == nil {
			return nil
		}
		return UsageFromChatUsage(resp.Usage)
	case *dto.OpenAIResponsesResponse:
		return UsageFromResponsesUsage(resp.Usage)
	case dto.OpenAIResponsesResponse:
		return UsageFromResponsesUsage(resp.Usage)
	case *dto.ResponsesStreamResponse:
		if resp.Response == nil {
			return nil
		}
		return UsageFromResponsesUsage(resp.Response.Usage)
	case dto.ResponsesStreamResponse:
		if resp.Response == nil {
			return nil
		}
		return UsageFromResponsesUsage(resp.Response.Usage)
	case *dto.ClaudeResponse:
		return usageFromClaudeResponse(resp)
	case dto.ClaudeResponse:
		return usageFromClaudeResponse(&resp)
	case *dto.GeminiChatResponse:
		return UsageFromGeminiMetadata(resp.GetUsageMetadata(), 0)
	case dto.GeminiChatResponse:
		return UsageFromGeminiMetadata(resp.GetUsageMetadata(), 0)
	default:
		return nil
	}
}

func usageFromClaudeResponse(resp *dto.ClaudeResponse) *dto.Usage {
	if resp == nil {
		return nil
	}
	if resp.Usage != nil {
		return UsageFromClaudeAPIUsage(resp.Usage)
	}
	if resp.Message != nil && resp.Message.Usage != nil {
		return UsageFromClaudeAPIUsage(resp.Message.Usage)
	}
	return nil
}

func convertOAIChatResponseToOAIResponses(_ *gin.Context, _ *relaycommon.RelayInfo, response any) (any, *dto.Usage, error) {
	chatResponse, err := asOAIChatResponse(response)
	if err != nil {
		return nil, nil, err
	}
	id := strings.TrimSpace(chatResponse.Id)
	if id == "" {
		id = fmt.Sprintf("resp_%s", common.GetUUID())
	}
	return ChatCompletionsResponseToResponsesResponse(chatResponse, id)
}

func convertOAIResponsesResponseToOAIChat(_ *gin.Context, _ *relaycommon.RelayInfo, response any) (any, *dto.Usage, error) {
	responsesResponse, err := asOAIResponsesResponse(response)
	if err != nil {
		return nil, nil, err
	}
	id := strings.TrimSpace(responsesResponse.ID)
	if id == "" {
		id = fmt.Sprintf("chatcmpl-%s", common.GetUUID())
	}
	return ResponsesResponseToChatCompletionsResponse(responsesResponse, id)
}

func newOAIChatToOAIResponsesStreamState(options ResponseStreamOptions) any {
	id := strings.TrimSpace(options.ID)
	if id == "" {
		id = fmt.Sprintf("resp_%s", common.GetUUID())
	}
	state := NewChatToResponsesStreamState(id, strings.TrimSpace(options.Model))
	if options.Created != 0 {
		state.Created = options.Created
	}
	return state
}

func convertOAIChatStreamResponseToOAIResponses(_ *gin.Context, _ *relaycommon.RelayInfo, response any, state any) ([]any, *dto.Usage, error) {
	chatResponse, err := asOAIChatStreamResponse(response)
	if err != nil {
		return nil, nil, err
	}
	streamState, ok := state.(*ChatToResponsesStreamState)
	if !ok || streamState == nil {
		return nil, nil, errors.New("OAI chat to OAI responses stream state is required")
	}
	events, err := ChatCompletionsStreamChunkToResponsesEvents(chatResponse, streamState)
	if err != nil {
		return nil, nil, err
	}
	return streamValuesFromAny(events), streamState.Usage, nil
}

func finalizeOAIChatStreamResponseToOAIResponses(_ *gin.Context, _ *relaycommon.RelayInfo, state any) ([]any, *dto.Usage, error) {
	streamState, ok := state.(*ChatToResponsesStreamState)
	if !ok || streamState == nil {
		return nil, nil, errors.New("OAI chat to OAI responses stream state is required")
	}
	events := FinalizeChatCompletionsStreamToResponses(streamState)
	return streamValuesFromAny(events), streamState.Usage, nil
}

func newOAIResponsesToOAIChatStreamState(options ResponseStreamOptions) any {
	state := NewResponsesToChatStreamState(strings.TrimSpace(options.Model), options.IncludeUsage)
	state.ID = strings.TrimSpace(options.ID)
	if options.Created != 0 {
		state.Created = options.Created
	}
	return state
}

func convertOAIResponsesStreamResponseToOAIChat(_ *gin.Context, _ *relaycommon.RelayInfo, response any, state any) ([]any, *dto.Usage, error) {
	responsesResponse, err := asOAIResponsesStreamResponse(response)
	if err != nil {
		return nil, nil, err
	}
	streamState, ok := state.(*ResponsesToChatStreamState)
	if !ok || streamState == nil {
		return nil, nil, errors.New("OAI responses to OAI chat stream state is required")
	}
	chunks, err := ResponsesStreamEventToChatChunks(responsesResponse, streamState)
	if err != nil {
		return nil, nil, err
	}
	return streamValuesFromAny(chunks), streamState.Usage, nil
}

func finalizeOAIResponsesStreamResponseToOAIChat(_ *gin.Context, _ *relaycommon.RelayInfo, state any) ([]any, *dto.Usage, error) {
	streamState, ok := state.(*ResponsesToChatStreamState)
	if !ok || streamState == nil {
		return nil, nil, errors.New("OAI responses to OAI chat stream state is required")
	}
	chunks := FinalizeResponsesToChatStream(streamState)
	return streamValuesFromAny(chunks), streamState.Usage, nil
}

func convertOAIChatResponseToClaudeMessages(_ *gin.Context, info *relaycommon.RelayInfo, response any) (any, *dto.Usage, error) {
	chatResponse, err := asOAIChatResponse(response)
	if err != nil {
		return nil, nil, err
	}
	return ResponseOpenAI2Claude(chatResponse, info), UsageFromChatUsage(&chatResponse.Usage), nil
}

func convertOAIChatStreamResponseToClaudeMessages(_ *gin.Context, info *relaycommon.RelayInfo, response any) (any, *dto.Usage, error) {
	chatResponse, err := asOAIChatStreamResponse(response)
	if err != nil {
		return nil, nil, err
	}
	return StreamResponseOpenAI2Claude(chatResponse, info), canonicalUsageFromResponse(chatResponse), nil
}

func convertOAIChatResponseToGeminiChat(_ *gin.Context, info *relaycommon.RelayInfo, response any) (any, *dto.Usage, error) {
	chatResponse, err := asOAIChatResponse(response)
	if err != nil {
		return nil, nil, err
	}
	return ResponseOpenAI2Gemini(chatResponse, info), UsageFromChatUsage(&chatResponse.Usage), nil
}

func convertOAIChatStreamResponseToGeminiChat(_ *gin.Context, info *relaycommon.RelayInfo, response any) (any, *dto.Usage, error) {
	chatResponse, err := asOAIChatStreamResponse(response)
	if err != nil {
		return nil, nil, err
	}
	return StreamResponseOpenAI2Gemini(chatResponse, info), canonicalUsageFromResponse(chatResponse), nil
}

func convertClaudeMessagesResponseToOAIChat(_ *gin.Context, _ *relaycommon.RelayInfo, response any) (any, *dto.Usage, error) {
	claudeResponse, err := asClaudeResponse(response)
	if err != nil {
		return nil, nil, err
	}
	usage := usageFromClaudeResponse(claudeResponse)
	openAIResponse := ResponseClaude2OpenAI(claudeResponse)
	if usage != nil {
		openAIResponse.Usage = *usage
	}
	return openAIResponse, usage, nil
}

func convertClaudeMessagesStreamResponseToOAIChat(_ *gin.Context, _ *relaycommon.RelayInfo, response any) (any, *dto.Usage, error) {
	claudeResponse, err := asClaudeResponse(response)
	if err != nil {
		return nil, nil, err
	}
	openAIResponse := StreamResponseClaude2OpenAI(claudeResponse)
	usage := usageFromClaudeResponse(claudeResponse)
	if openAIResponse != nil && usage != nil {
		openAIResponse.Usage = usage
	}
	return openAIResponse, usage, nil
}

func convertGeminiChatResponseToOAIChat(_ *gin.Context, info *relaycommon.RelayInfo, response any) (any, *dto.Usage, error) {
	geminiResponse, err := asGeminiChatResponse(response)
	if err != nil {
		return nil, nil, err
	}
	usage := UsageFromGeminiMetadata(geminiResponse.GetUsageMetadata(), fallbackPromptTokens(info))
	openAIResponse := ResponseGeminiChat2OpenAI(fmt.Sprintf("chatcmpl-%s", common.GetUUID()), common.GetTimestamp(), geminiResponse)
	if info != nil && info.ChannelMeta != nil {
		openAIResponse.Model = info.UpstreamModelName
	}
	if usage != nil {
		openAIResponse.Usage = *usage
	}
	return openAIResponse, usage, nil
}

func convertGeminiChatStreamResponseToOAIChat(_ *gin.Context, info *relaycommon.RelayInfo, response any) (any, *dto.Usage, error) {
	geminiResponse, err := asGeminiChatResponse(response)
	if err != nil {
		return nil, nil, err
	}
	openAIResponse, _ := StreamResponseGeminiChat2OpenAI(geminiResponse)
	usage := UsageFromGeminiMetadata(geminiResponse.GetUsageMetadata(), fallbackPromptTokens(info))
	if openAIResponse != nil {
		openAIResponse.Id = fmt.Sprintf("chatcmpl-%s", common.GetUUID())
		openAIResponse.Created = common.GetTimestamp()
		if info != nil && info.ChannelMeta != nil {
			openAIResponse.Model = info.UpstreamModelName
		}
		openAIResponse.Usage = usage
	}
	return openAIResponse, usage, nil
}

func fallbackPromptTokens(info *relaycommon.RelayInfo) int {
	if info == nil {
		return 0
	}
	return info.GetEstimatePromptTokens()
}

func asOAIChatResponse(response any) (*dto.OpenAITextResponse, error) {
	switch resp := response.(type) {
	case *dto.OpenAITextResponse:
		return resp, nil
	case dto.OpenAITextResponse:
		return &resp, nil
	default:
		return nil, fmt.Errorf("expected OAI chat response, got %T", response)
	}
}

func asOAIChatStreamResponse(response any) (*dto.ChatCompletionsStreamResponse, error) {
	switch resp := response.(type) {
	case *dto.ChatCompletionsStreamResponse:
		return resp, nil
	case dto.ChatCompletionsStreamResponse:
		return &resp, nil
	default:
		return nil, fmt.Errorf("expected OAI chat stream response, got %T", response)
	}
}

func asOAIResponsesResponse(response any) (*dto.OpenAIResponsesResponse, error) {
	switch resp := response.(type) {
	case *dto.OpenAIResponsesResponse:
		return resp, nil
	case dto.OpenAIResponsesResponse:
		return &resp, nil
	default:
		return nil, fmt.Errorf("expected OAI responses response, got %T", response)
	}
}

func asOAIResponsesStreamResponse(response any) (*dto.ResponsesStreamResponse, error) {
	switch resp := response.(type) {
	case *dto.ResponsesStreamResponse:
		return resp, nil
	case dto.ResponsesStreamResponse:
		return &resp, nil
	default:
		return nil, fmt.Errorf("expected OAI responses stream response, got %T", response)
	}
}

func asClaudeResponse(response any) (*dto.ClaudeResponse, error) {
	switch resp := response.(type) {
	case *dto.ClaudeResponse:
		return resp, nil
	case dto.ClaudeResponse:
		return &resp, nil
	default:
		return nil, fmt.Errorf("expected Claude messages response, got %T", response)
	}
}

func asGeminiChatResponse(response any) (*dto.GeminiChatResponse, error) {
	switch resp := response.(type) {
	case *dto.GeminiChatResponse:
		return resp, nil
	case dto.GeminiChatResponse:
		return &resp, nil
	default:
		return nil, fmt.Errorf("expected Gemini chat response, got %T", response)
	}
}
