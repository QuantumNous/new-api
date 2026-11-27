package pluginkit

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"mime/multipart"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/MoeForge/moego/base64"
	"github.com/MoeForge/moego/regexp"
)

// MaxSubmitStateBytes bounds the JSON state of a submission stream and the
// result parseSubmitEventDelta accumulates; MaxSubmitControlStateBytes bounds
// the control state parseSubmitEventDelta passes to its next event.
const (
	MaxSubmitStateBytes        = 1 << 20
	MaxSubmitControlStateBytes = 64 << 10
)

// MaxTaskArtifacts is the most artifacts listArtifacts may return.
const MaxTaskArtifacts = 64

var taskArtifactKeyPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$`)

// ErrSubmitClientResponse is the error of a parseSubmitResponse result that
// carries the removed clientResponse member.
var ErrSubmitClientResponse = errors.New("parseSubmitResponse must not return clientResponse")

// RequestDescriptor is the request a request-building hook returns
// (buildSubmitRequest, buildQueryRequest, buildBatchQueryRequest,
// buildContentRequest).
type RequestDescriptor struct {
	ResponseType   string            `json:"responseType"`
	URL            string            `json:"url"`
	Method         string            `json:"method"`
	Headers        map[string]string `json:"headers"`
	Body           any               `json:"body"`
	Credentialless bool              `json:"credentialless"`
	Action         string            `json:"action"`
	Model          string            `json:"model"`
	RewriteModel   string            `json:"rewriteModel"`
	BodyType       string            `json:"bodyType"`
	Parts          []RequestPart     `json:"parts"`

	// ContentPath and MimeType are read from buildContentRequest only: the
	// artifact's bytes are a base64 string at that path of the JSON reply.
	ContentPath []any  `json:"contentPath"`
	MimeType    string `json:"mimeType"`
	// BodyText is the body as JSON.stringify wrote it, for a plugin that
	// preserves JSON order: the upstream gets the members in that order.
	BodyText json.RawMessage `json:"-"`
}

// orderedRequestDescriptor is RequestDescriptor as a plugin that preserves
// JSON order returns it: decoded from the JSON.stringify text of the result,
// with the body kept as that text.
type orderedRequestDescriptor struct {
	ResponseType   string            `json:"responseType"`
	URL            string            `json:"url"`
	Method         string            `json:"method"`
	Headers        map[string]string `json:"headers"`
	Body           json.RawMessage   `json:"body"`
	Credentialless bool              `json:"credentialless"`
	Action         string            `json:"action"`
	Model          string            `json:"model"`
	RewriteModel   string            `json:"rewriteModel"`
	BodyType       string            `json:"bodyType"`
	Parts          []RequestPart     `json:"parts"`

	ContentPath []any  `json:"contentPath"`
	MimeType    string `json:"mimeType"`
}

// RequestPart is one part of a multipart request descriptor.
type RequestPart struct {
	Name     string `json:"name"`
	Value    any    `json:"value"`
	FileRef  string `json:"fileRef"`
	Filename string `json:"filename"`
}

// CallRequestDescriptor runs a request-building hook. A plugin that preserves
// JSON order has its descriptor decoded from the JSON.stringify text of the
// result, with the body kept as that text (BodyText) for the upstream.
func (p *LoadedPlugin) CallRequestDescriptor(ctx context.Context, hook string, args ...any) (RequestDescriptor, error) {
	if !p.Meta.PreservesJSONOrder() {
		var descriptor RequestDescriptor
		err := p.Engine.CallInto(ctx, &descriptor, hook, args...)
		return descriptor, err
	}
	var ordered orderedRequestDescriptor
	if err := p.Engine.CallJSONInto(ctx, &ordered, hook, args...); err != nil {
		return RequestDescriptor{}, err
	}
	descriptor := RequestDescriptor{
		ResponseType: ordered.ResponseType, URL: ordered.URL, Method: ordered.Method, Headers: ordered.Headers,
		Credentialless: ordered.Credentialless, Action: ordered.Action, Model: ordered.Model,
		RewriteModel: ordered.RewriteModel, BodyType: ordered.BodyType, Parts: ordered.Parts,
		ContentPath: ordered.ContentPath, MimeType: ordered.MimeType,
	}
	switch {
	case len(ordered.Body) == 0 || string(ordered.Body) == "null":
	case ordered.Body[0] == '"':
		// A string body is the plugin's own text, sent as it is.
		var text string
		if err := unmarshalJSON(ordered.Body, &text); err != nil {
			return RequestDescriptor{}, err
		}
		descriptor.Body = text
	default:
		descriptor.Body, descriptor.BodyText = ordered.Body, ordered.Body
	}
	return descriptor, nil
}

// TaskResult is the task state parseTaskResult returns, and the immediate
// result of parseSubmitResponse. The token counts are the plugin's numbers,
// unbounded; the host converts them.
type TaskResult struct {
	Code             int     `json:"code"`
	TaskID           string  `json:"taskId"`
	Status           string  `json:"status"`
	Progress         string  `json:"progress"`
	Reason           string  `json:"reason"`
	URL              string  `json:"url"`
	RemoteURL        string  `json:"remoteUrl"`
	CompletionTokens float64 `json:"completionTokens"`
	TotalTokens      float64 `json:"totalTokens"`
	// State is the JSON of the returned state; nil when the result has
	// none, a null one or one that does not encode.
	State json.RawMessage `json:"-"`
}

// SubmitResponse is the upstream reply parseSubmitResponse reads.
type SubmitResponse struct {
	StatusCode int
	Headers    map[string][]string
	Body       any
}

// SubmitResult is what parseSubmitResponse returns. TaskData is the hook's
// value, which may be a host value.
type SubmitResult struct {
	TaskID    string
	TaskData  any
	Immediate *TaskResult
	// State is the JSON of the returned state; nil when the result has
	// none, a null one or one that does not encode.
	State json.RawMessage
}

// CallParseSubmitResponse runs parseSubmitResponse with the driver context.
// A result of the wrong shape, without a taskId or with clientResponse
// (ErrSubmitClientResponse) is a *ResultError; other errors are the hook's.
func (p *LoadedPlugin) CallParseSubmitResponse(ctx context.Context, driver map[string]any, response SubmitResponse) (SubmitResult, error) {
	value, err := p.Engine.Call(ctx, "parseSubmitResponse", driver, map[string]any{"statusCode": response.StatusCode, "headers": response.Headers, "body": response.Body})
	if err != nil {
		return SubmitResult{}, err
	}
	if object, ok := value.(map[string]any); ok {
		if _, forbidden := object["clientResponse"]; forbidden {
			return SubmitResult{}, &ResultError{err: ErrSubmitClientResponse}
		}
	}
	var parsed struct {
		TaskID    string      `json:"taskId"`
		TaskData  any         `json:"taskData"`
		Immediate *TaskResult `json:"immediate"`
	}
	if err = convertJSON(value, &parsed); err != nil {
		return SubmitResult{}, &ResultError{err: err}
	}
	if strings.TrimSpace(parsed.TaskID) == "" {
		return SubmitResult{}, &ResultError{err: fmt.Errorf("plugin returned an empty taskId")}
	}
	state, _ := returnedState(value)
	return SubmitResult{TaskID: parsed.TaskID, TaskData: parsed.TaskData, Immediate: parsed.Immediate, State: state}, nil
}

// HookHTTPResponse is the {status, headers} argument of the parse hooks for
// an upstream reply: the first value of each header.
func HookHTTPResponse(resp *http.Response) map[string]any {
	headers := map[string]string{}
	status := 0
	if resp != nil {
		status = resp.StatusCode
		for name, values := range resp.Header {
			if len(values) > 0 {
				headers[name] = values[0]
			}
		}
	}
	return map[string]any{"status": status, "headers": headers}
}

// CallParseTaskResult runs parseTaskResult with the task query context, the
// upstream body (parsed JSON, else text) and HookHTTPResponse. A result of
// the wrong shape is a *ResultError; other errors are the hook's.
func (p *LoadedPlugin) CallParseTaskResult(ctx context.Context, query map[string]any, body any, response map[string]any) (TaskResult, error) {
	value, err := p.Engine.Call(ctx, "parseTaskResult", query, body, response)
	if err != nil {
		return TaskResult{}, err
	}
	var parsed TaskResult
	if err = convertJSON(value, &parsed); err != nil {
		return TaskResult{}, &ResultError{err: err}
	}
	parsed.State, _ = returnedState(value)
	return parsed, nil
}

// BatchResultItem is one task of a parseBatchResult result. State is the
// hook's value, which may be a host value.
type BatchResultItem struct {
	TaskID     string `json:"taskId"`
	Action     string `json:"action"`
	Status     string `json:"status"`
	Progress   string `json:"progress"`
	Reason     string `json:"reason"`
	URL        string `json:"url"`
	SubmitTime int64  `json:"submitTime"`
	StartTime  int64  `json:"startTime"`
	FinishTime int64  `json:"finishTime"`
	Data       any    `json:"data"`
	State      any    `json:"state"`
}

// CallParseBatchResult runs parseBatchResult with the batch query context,
// the upstream body and HookHTTPResponse. A result of the wrong shape is a
// *ResultError; other errors are the hook's.
func (p *LoadedPlugin) CallParseBatchResult(ctx context.Context, batch map[string]any, body any, response map[string]any) ([]BatchResultItem, error) {
	var items []BatchResultItem
	if err := p.Engine.CallInto(ctx, &items, "parseBatchResult", batch, body, response); err != nil {
		return nil, err
	}
	return items, nil
}

// errUsageNotObject is the error of a usage hook result that is neither an
// object nor null.
var errUsageNotObject = errors.New("plugin usage hook must return an object")

// CallUsage runs a usage hook (extractUsage, extractUsageOnSubmit,
// extractUsageOnComplete) and returns its facts as the plugin reported them:
// nil for a null or undefined result. The host validates and bounds them. A
// result that is not an object is a *ResultError; other errors are the
// hook's.
func (p *LoadedPlugin) CallUsage(ctx context.Context, hook string, args ...any) (map[string]any, error) {
	value, err := p.Engine.Call(ctx, hook, args...)
	if err != nil {
		return nil, err
	}
	if value == nil {
		return nil, nil
	}
	facts, ok := value.(map[string]any)
	if !ok {
		return nil, &ResultError{err: errUsageNotObject}
	}
	return facts, nil
}

// SubmitEvent is one server-sent event of a submission stream.
type SubmitEvent struct {
	Event string
	ID    string
	Data  string
}

// SubmitEventResult is what parseSubmitEvent or parseSubmitEventDelta
// returns. State is the hook's value, which may be a host value, and
// StateJSON its encoding. Changes is set by parseSubmitEventDelta only.
type SubmitEventResult struct {
	State     any
	StateJSON json.RawMessage
	Done      bool
	Changes   any
}

// CallSubmitEvent runs hook, parseSubmitEvent or parseSubmitEventDelta (see
// UsesSubmitEventDelta), on one event with the previous state, and checks
// the result's shape and state size. Errors are those of the hook or of an
// invalid result.
func (p *LoadedPlugin) CallSubmitEvent(ctx context.Context, hook string, driver map[string]any, event SubmitEvent, previous any) (SubmitEventResult, error) {
	value, err := p.Engine.Call(ctx, hook, driver, map[string]any{"event": event.Event, "id": event.ID, "data": event.Data}, previous)
	if err != nil {
		return SubmitEventResult{}, err
	}
	result, ok := value.(map[string]any)
	if !ok {
		return SubmitEventResult{}, fmt.Errorf("%s must return an object", hook)
	}
	state, hasState := result["state"]
	done, hasDone := result["done"].(bool)
	if !hasState || !hasDone {
		return SubmitEventResult{}, fmt.Errorf("%s must return state and a boolean done", hook)
	}
	encoded, err := marshalJSON(state)
	if err != nil {
		return SubmitEventResult{}, fmt.Errorf("invalid submit stream state: %w", err)
	}
	if len(encoded) > MaxSubmitStateBytes {
		return SubmitEventResult{}, fmt.Errorf("task submit stream state exceeds size limit")
	}
	parsed := SubmitEventResult{State: state, StateJSON: encoded, Done: done}
	if hook == "parseSubmitEventDelta" {
		if len(result) != 3 {
			return SubmitEventResult{}, fmt.Errorf("parseSubmitEventDelta must return only changes, state and done")
		}
		// Control state is separate from the full result and is the only
		// snapshot passed back to JS on the next event.
		if len(encoded) > MaxSubmitControlStateBytes {
			return SubmitEventResult{}, fmt.Errorf("task submit stream control state exceeds size limit")
		}
		parsed.Changes = result["changes"]
	}
	return parsed, nil
}

// Artifact is one artifact listArtifacts names.
type Artifact struct {
	Key      string
	Type     string
	MimeType string
}

// CallListArtifacts runs listArtifacts with the artifact context of a task
// and validates the list. An invalid list is a *ResultError; other errors
// are the hook's.
func (p *LoadedPlugin) CallListArtifacts(ctx context.Context, task map[string]any) ([]Artifact, error) {
	value, err := p.Engine.Call(ctx, "listArtifacts", task)
	if err != nil {
		return nil, err
	}
	artifacts, err := validateArtifacts(value)
	if err != nil {
		return nil, &ResultError{err: err}
	}
	return artifacts, nil
}

func validateArtifacts(value any) ([]Artifact, error) {
	encoded, err := marshalJSON(value)
	if err != nil {
		return nil, fmt.Errorf("plugin returned invalid artifacts")
	}
	if trimmed := strings.TrimSpace(string(encoded)); trimmed == "" || trimmed[0] != '[' {
		return nil, fmt.Errorf("plugin listArtifacts must return an array")
	}
	var items []map[string]any
	if err = unmarshalJSON(encoded, &items); err != nil {
		return nil, fmt.Errorf("plugin listArtifacts must return an array")
	}
	if len(items) > MaxTaskArtifacts {
		return nil, fmt.Errorf("plugin returned too many artifacts")
	}
	artifacts := make([]Artifact, 0, len(items))
	keys := make(map[string]struct{}, len(items))
	for _, item := range items {
		for field := range item {
			if field != "key" && field != "type" && field != "mimeType" {
				return nil, fmt.Errorf("plugin artifact contains unsupported field %q", field)
			}
		}
		key, keyOK := item["key"].(string)
		artifactType, typeOK := item["type"].(string)
		if !keyOK || !taskArtifactKeyPattern.MatchString(key) {
			return nil, fmt.Errorf("plugin artifact has invalid key")
		}
		if _, exists := keys[key]; exists {
			return nil, fmt.Errorf("plugin artifact keys must be unique")
		}
		keys[key] = struct{}{}
		switch artifactType {
		case "video", "audio", "image", "file":
		default:
			if !typeOK {
				return nil, fmt.Errorf("plugin artifact has invalid type")
			}
			return nil, fmt.Errorf("plugin artifact has unsupported type")
		}
		mimeType := ""
		if rawMimeType, exists := item["mimeType"]; exists {
			var mimeTypeOK bool
			mimeType, mimeTypeOK = rawMimeType.(string)
			if !mimeTypeOK || len(mimeType) > 255 || strings.ContainsAny(mimeType, "\r\n") {
				return nil, fmt.Errorf("plugin artifact has invalid mimeType")
			}
		}
		artifacts = append(artifacts, Artifact{Key: key, Type: artifactType, MimeType: mimeType})
	}
	return artifacts, nil
}

// gatewayCredentialHeaders carry the client's gateway credentials. Driver
// hooks receive every other request header.
var gatewayCredentialHeaders = []string{"Authorization", "Proxy-Authorization", "Cookie", "X-Api-Key", "X-Goog-Api-Key", "Mj-Api-Secret"}

// ClientRequestHeaders is the client's request headers as decoders and driver
// hooks receive them: the first value of each under its canonical name,
// without the headers that carry gateway credentials, and with Content-Type
// and Accept always present.
func ClientRequestHeaders(header http.Header) map[string]string {
	headers := make(map[string]string, len(header)+2)
	for name, values := range header {
		name = http.CanonicalHeaderKey(name)
		if len(values) > 0 && !slices.Contains(gatewayCredentialHeaders, name) {
			headers[name] = values[0]
		}
	}
	headers["Content-Type"] = header.Get("Content-Type")
	headers["Accept"] = header.Get("Accept")
	return headers
}

// EncodeFilePlaceholders replaces, in body itself, each file placeholder of
// a JSON request descriptor body with the encoded bytes of the uploaded file
// it names, and returns the result. limit bounds each file and all of them
// together. body must be the host's own copy: its maps and slices change.
func EncodeFilePlaceholders(body any, form *multipart.Form, limit int64) (any, error) {
	var total int64
	return replaceFilePlaceholders(body, form, limit, &total)
}

func replaceFilePlaceholders(value any, form *multipart.Form, limit int64, total *int64) (any, error) {
	switch typed := value.(type) {
	case map[string]any:
		if _, isPlaceholder := typed["__fileRef"]; isPlaceholder {
			return encodeFilePlaceholder(typed, form, limit, total)
		}
		for key, item := range typed {
			replaced, err := replaceFilePlaceholders(item, form, limit, total)
			if err != nil {
				return nil, err
			}
			typed[key] = replaced
		}
		return typed, nil
	case []any:
		for index, item := range typed {
			replaced, err := replaceFilePlaceholders(item, form, limit, total)
			if err != nil {
				return nil, err
			}
			typed[index] = replaced
		}
		return typed, nil
	default:
		return value, nil
	}
}

func encodeFilePlaceholder(placeholder map[string]any, form *multipart.Form, limit int64, total *int64) (string, error) {
	for key := range placeholder {
		switch key {
		case "__fileRef", "encoding", "mimeType", "maxBytes":
		default:
			return "", fmt.Errorf("invalid file placeholder")
		}
	}
	ref, _ := placeholder["__fileRef"].(string)
	if strings.TrimSpace(ref) == "" {
		return "", fmt.Errorf("unknown file reference %q", ref)
	}
	encoding, _ := placeholder["encoding"].(string)
	if encoding != "base64" && encoding != "dataUrl" {
		return "", fmt.Errorf("file placeholder encoding must be \"base64\" or \"dataUrl\"")
	}
	if form == nil {
		return "", fmt.Errorf("unknown file reference %q", ref)
	}
	field, index, validRef := ParseFileReference(ref)
	files := form.File[field]
	if !validRef || index >= len(files) {
		return "", fmt.Errorf("unknown file reference %q", ref)
	}
	header := files[index]
	maxBytes := limit
	if raw, exists := placeholder["maxBytes"]; exists {
		n, ok := usageExampleNumber(raw)
		if !ok || n <= 0 || n != math.Trunc(n) {
			return "", fmt.Errorf("invalid file placeholder")
		}
		if int64(n) < maxBytes {
			maxBytes = int64(n)
		}
	}
	if header.Size > maxBytes {
		return "", fmt.Errorf("file %q exceeds the %d byte limit", ref, maxBytes)
	}
	file, openErr := header.Open()
	if openErr != nil {
		return "", openErr
	}
	data, readErr := io.ReadAll(io.LimitReader(file, maxBytes+1))
	file.Close()
	if readErr != nil {
		return "", readErr
	}
	if int64(len(data)) > maxBytes {
		return "", fmt.Errorf("file %q exceeds the %d byte limit", ref, maxBytes)
	}
	if *total+int64(len(data)) > limit {
		return "", fmt.Errorf("inlined files exceed the %d byte limit", limit)
	}
	*total += int64(len(data))
	if encoding == "base64" {
		return base64.StdEncoding.EncodeToString(data), nil
	}
	mimeType := "application/octet-stream"
	if override, ok := placeholder["mimeType"].(string); ok && strings.TrimSpace(override) != "" {
		mimeType = override
	} else if contentType := header.Header.Get("Content-Type"); contentType != "" {
		mimeType = contentType
	}
	return base64.EncodeDataURL(mimeType, data), nil
}

// returnedState is the JSON of a hook result's state member, which the host
// stores only when the hook returns one: not when it is absent or null.
func returnedState(value any) ([]byte, bool) {
	object, ok := value.(map[string]any)
	if !ok {
		return nil, false
	}
	state, exists := object["state"]
	if !exists || state == nil {
		return nil, false
	}
	data, err := marshalJSON(state)
	if err != nil {
		return nil, false
	}
	return data, true
}

func convertJSON(value any, target any) error {
	data, err := marshalJSON(value)
	if err != nil {
		return err
	}
	return unmarshalJSON(data, target)
}

// ValidArtifactKey reports whether key may name a task artifact.
func ValidArtifactKey(key string) bool {
	return taskArtifactKeyPattern.MatchString(key)
}

// DecodedRequest is what a decoder returns: a native route's decode hook or
// a protocol's decodeRequest.
type DecodedRequest struct {
	// Value is the hook's result and Result the same value when it is an
	// object, else nil.
	Value  any
	Result map[string]any
	// RequestBodyText is the JSON.stringify text of the result's
	// requestBody for a plugin that preserves JSON order, else nil.
	RequestBodyText json.RawMessage
}

// CallRouteDecode runs native[decode] on the request of a native route.
// admissionTimeout is as for Engine.CallPathWithAdmissionTimeout; 0 is the
// default.
func (p *LoadedPlugin) CallRouteDecode(ctx context.Context, admissionTimeout time.Duration, decode string, request RouteRequestContext) (DecodedRequest, error) {
	return p.callDecode(ctx, admissionTimeout, "native", []string{decode}, request.JSValueFor(p.Meta))
}

// CallProtocolDecode runs protocols[protocol].decodeRequest on the request of
// a host protocol.
func (p *LoadedPlugin) CallProtocolDecode(ctx context.Context, admissionTimeout time.Duration, protocol string, request ProtocolRequestContext) (DecodedRequest, error) {
	return p.callDecode(ctx, admissionTimeout, "protocols", []string{protocol, "decodeRequest"}, request.JSValueFor(p.Meta))
}

func (p *LoadedPlugin) callDecode(ctx context.Context, admissionTimeout time.Duration, exportName string, members []string, request map[string]any) (DecodedRequest, error) {
	value, text, err := p.Engine.CallPathWithMemberJSON(ctx, admissionTimeout, p.Meta.JSONTextMember("requestBody"), exportName, members, request)
	result, _ := value.(map[string]any)
	return DecodedRequest{Value: value, Result: result, RequestBodyText: text}, err
}
