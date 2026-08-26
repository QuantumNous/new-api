package relayconvert

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/ir"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/QuantumNous/new-api/relaykit/types"
)

type ResponseConverterFunc func(c context.Context, info convmeta.Meta, response any) (any, *dto.Usage, error)

type ResponseStreamConverterFunc func(c context.Context, info convmeta.Meta, response any) (any, *dto.Usage, error)

type ResponseStreamStateFactory func(options ResponseStreamOptions) any

type ResponseStreamChunkConverterFunc func(c context.Context, info convmeta.Meta, response any, state any) ([]any, *dto.Usage, error)

type ResponseStreamFinalizerFunc func(c context.Context, info convmeta.Meta, state any) ([]any, *dto.Usage, error)

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
	Report    ir.Report
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
	irState    *ir.StreamState
}

var (
	responseConverterMu     sync.RWMutex
	responseConverters      = make(map[string]ResponseConverterSpec)
	responseConverterRoutes = make(map[responseConverterRoute]string)
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

func LookupResponseConverter(converter string) (ResponseConverterSpec, bool) {
	responseConverterMu.RLock()
	defer responseConverterMu.RUnlock()

	spec, ok := responseConverters[strings.TrimSpace(converter)]
	if !ok {
		return ResponseConverterSpec{}, false
	}
	return cloneResponseConverterSpec(spec), true
}

func ConvertResponse(c context.Context, info convmeta.Meta, target types.RelayFormat, response any) (*ResponseResult, error) {
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

	if isTextRelayFormat(from) && isTextRelayFormat(target) && isNonStreamTextResponse(response) {
		return convertResponseIR(info, from, target, response)
	}

	spec, ok := lookupResponseRoute(from, target)
	if !ok {
		return nil, fmt.Errorf("response converter from %s to %s is not registered", from, target)
	}
	return executeResponseSpec(c, info, from, target, response, spec)
}

func ConvertStreamResponse(c context.Context, info convmeta.Meta, target types.RelayFormat, response any) (*ResponseResult, error) {
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

	if isTextRelayFormat(from) && isTextRelayFormat(target) {
		return convertStreamResponseIR(info, from, target, response)
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

	if isTextRelayFormat(from) && isTextRelayFormat(target) {
		return newIRResponseStreamState(from, target, options), nil
	}

	spec, ok := lookupResponseRoute(from, target)
	if !ok {
		return nil, fmt.Errorf("response converter from %s to %s is not registered", from, target)
	}
	return newResponseStreamStateFromSpec(from, target, options, spec)
}

func ConvertStreamResponseChunk(c context.Context, info convmeta.Meta, state *ResponseStreamState, response any) ([]ResponseResult, error) {
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

	if state.irState != nil {
		return convertStreamChunkIR(info, state, response, false)
	}

	values, usage, err := executeResponseStreamSteps(c, info, state, []any{response}, 0)
	if err != nil {
		return nil, err
	}
	state.rememberUsage(usage)
	return responseStreamResults(state, values, usage), nil
}

func FinalizeStreamResponse(c context.Context, info convmeta.Meta, state *ResponseStreamState) ([]ResponseResult, error) {
	if state == nil {
		return nil, errors.New("response stream state is required")
	}
	if state.From == state.To {
		return nil, nil
	}

	if state.irState != nil {
		return finalizeStreamIR(info, state)
	}

	if state.To == types.RelayFormatClaude && info != nil {
		claudeInfo := info.EnsureClaudeConvertInfo()
		if claudeInfo.Usage == nil {
			claudeInfo.Usage = state.Usage()
		}
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
	if s.irState != nil {
		canonical := UsageFromChatUsage(usage)
		s.irState.SetUsage(ir.Usage{
			Input:   canonical.PromptTokens,
			Output:  canonical.CompletionTokens,
			Thought: canonical.CompletionTokenDetails.ReasoningTokens,
		})
	}
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

func executeResponseSpec(c context.Context, info convmeta.Meta, from types.RelayFormat, target types.RelayFormat, response any, spec ResponseConverterSpec) (*ResponseResult, error) {
	steps, err := expandResponseConverterSteps(spec)
	if err != nil {
		return nil, err
	}
	return executeResponseSteps(c, info, from, target, response, spec.ID, spec.Quality, steps)
}

func executeResponseSteps(c context.Context, info convmeta.Meta, from types.RelayFormat, target types.RelayFormat, response any, converter string, quality ResponseConverterQuality, specs []ResponseConverterSpec) (*ResponseResult, error) {
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

func executeResponseStep(c context.Context, info convmeta.Meta, spec ResponseConverterSpec, response any) (any, *dto.Usage, ResponseStep, error) {
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

func executeStatelessStreamResponseSpec(c context.Context, info convmeta.Meta, from types.RelayFormat, target types.RelayFormat, response any, spec ResponseConverterSpec) (*ResponseResult, error) {
	steps, err := expandResponseConverterSteps(spec)
	if err != nil {
		return nil, err
	}
	current := response
	var usage *dto.Usage
	resultSteps := make([]ResponseStep, 0, len(steps))
	for _, step := range steps {
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

func executeResponseStreamSteps(c context.Context, info convmeta.Meta, state *ResponseStreamState, values []any, start int) ([]any, *dto.Usage, error) {
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

func prepareResponseStreamInfo(info convmeta.Meta, spec ResponseConverterSpec) {
	if info == nil {
		return
	}
	if spec.From != types.RelayFormatOpenAI {
		return
	}
	if spec.To != types.RelayFormatClaude && spec.To != types.RelayFormatGemini {
		return
	}
	info.IncrSendResponseCount()
}

func executeResponseStreamStep(c context.Context, info convmeta.Meta, spec ResponseConverterSpec, state any, response any) ([]any, *dto.Usage, error) {
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

func finalizeResponseStreamStep(c context.Context, info convmeta.Meta, spec ResponseConverterSpec, state any) ([]any, *dto.Usage, error) {
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
