package jsplugin

import (
	"context"
	"encoding"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"math/big"
	"reflect"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"
	"unsafe"

	"github.com/Calcium-Ion/moejs"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
)

const (
	DefaultCallTimeout = 5 * time.Second
	DefaultConcurrency = 8
)

var ErrCallAdmissionTimeout = errors.New("plugin call admission timed out")

const hookErrorMessageLimit = 512

// HookError reports a JavaScript exception thrown by a plugin hook. Message
// is the sanitized JS error message with engine prefixes stripped; it is safe
// to surface to API callers.
type HookError struct {
	Hook    string
	Message string
	wrapped error
}

func (e *HookError) Error() string {
	if e == nil || e.wrapped == nil {
		return "plugin hook failed"
	}
	return e.wrapped.Error()
}

func (e *HookError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.wrapped
}

// ResultError reports a hook result that CallInto could not store: one the
// host codec cannot encode (a NaN, an infinity, a cycle) or one the target's
// type rejects. Its message is the codec's.
type ResultError struct {
	err error
}

func (e *ResultError) Error() string {
	return e.err.Error()
}

func (e *ResultError) Unwrap() error {
	return e.err
}

func newHookError(hook, rawMessage string, wrapped error) *HookError {
	var b strings.Builder
	b.Grow(len(rawMessage))
	count := 0
	for _, r := range rawMessage {
		if count >= hookErrorMessageLimit {
			break
		}
		if r < 0x20 || (r >= 0x80 && r <= 0x9F) {
			r = ' '
		}
		b.WriteRune(r)
		count++
	}
	message := b.String()
	if message == "" {
		message = "plugin hook failed"
	}
	return &HookError{Hook: hook, Message: message, wrapped: wrapped}
}

var forbiddenSyntax = regexp.MustCompile(`(?m)(^|[^A-Za-z0-9_$])(async|await|import)([^A-Za-z0-9_$]|$)`)

type Options struct {
	Key         string
	Version     string
	Timeout     time.Duration
	Concurrency int
	Now         func() time.Time
	Log         func(string)
}

type Engine struct {
	key       string
	version   string
	timeout   time.Duration
	now       func() time.Time
	log       func(string)
	module    *moejs.Module
	pool      chan *runtimeInstance
	semaphore chan struct{}
	hooksMu   sync.RWMutex
	hooks     map[hookKey]moejs.Hook
	// exports holds the exports that were not undefined once the module
	// loaded; it is written only by Compile.
	exports map[string]struct{}
}

// hookKey names a cached hook handle. Contract hooks are an export and at
// most two members (protocols.<name>.<hook>); longer paths only come from
// fixture requests and are resolved on every call.
type hookKey struct {
	export  string
	members [2]string
	depth   int
}

// Fixture requests name arbitrary members, so the handle cache is bounded.
const maxCachedHooks = 256

type runtimeInstance struct {
	runtime    *moejs.Runtime
	logContext *runtimeLogContext
}

type runtimeLogContext struct {
	context context.Context
}

// Compile performs upload-time syntax checks and compiles an ESM plugin once.
// All engine-specific module and runtime handling is intentionally kept here.
func Compile(source string, options Options) (*Engine, error) {
	if match := forbiddenSyntax.FindString(sourceWithoutCommentsAndStrings(source)); match != "" {
		return nil, fmt.Errorf("unsupported plugin syntax %q: plugins must be synchronous and cannot import modules", strings.TrimSpace(match))
	}

	// The compiler never reads files, so a sourceMappingURL comment in
	// untrusted source stays inert.
	module, err := moejs.Compile(options.Key+".js", source)
	if err != nil {
		return nil, fmt.Errorf("compile plugin: %w", err)
	}
	// export ... from has no import keyword; the host links no modules.
	if requests := module.Requests(); len(requests) > 0 {
		return nil, fmt.Errorf("unsupported plugin syntax: re-export from %q: plugins must be synchronous and cannot import modules", requests[0])
	}

	timeout := options.Timeout
	if timeout <= 0 {
		timeout = DefaultCallTimeout
	}
	concurrency := options.Concurrency
	if concurrency <= 0 {
		concurrency = DefaultConcurrency
	}
	now := options.Now
	if now == nil {
		now = time.Now
	}

	engine := &Engine{
		key:       options.Key,
		version:   options.Version,
		timeout:   timeout,
		now:       now,
		log:       options.Log,
		module:    module,
		semaphore: make(chan struct{}, concurrency),
		pool:      make(chan *runtimeInstance, concurrency),
		hooks:     make(map[hookKey]moejs.Hook),
		exports:   make(map[string]struct{}),
	}
	instance, err := engine.newRuntime(context.Background())
	if err != nil {
		return nil, err
	}
	for _, name := range module.Exports() {
		if value, found := instance.runtime.Export(name); found && !value.IsUndefined() {
			engine.exports[name] = struct{}{}
		}
	}
	instance.logContext.context = nil
	engine.putRuntime(instance)
	return engine, nil
}

// Export returns one module export without exposing engine values outside the
// engine boundary. It is used for declarative exports such as meta.
func (e *Engine) Export(ctx context.Context, exportName string) (any, error) {
	select {
	case e.semaphore <- struct{}{}:
		defer func() { <-e.semaphore }()
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	instance, err := e.getRuntime(ctx)
	if err != nil {
		return nil, err
	}
	reusable := true
	defer func() {
		instance.runtime.ClearInterrupt()
		instance.logContext.context = nil
		if reusable {
			e.putRuntime(instance)
		}
	}()
	timedOut := errors.New("plugin export timed out")
	stopInterrupt := watchRuntimeContext(instance.runtime, ctx, e.timeout, timedOut)
	defer stopInterrupt()
	value, found := instance.runtime.Export(exportName)
	if !found || value.IsUndefined() {
		return nil, fmt.Errorf("plugin export %q not found", exportName)
	}
	result, err := instance.runtime.ToGo(value)
	if err == nil {
		return result, nil
	}
	reusable = false
	var interrupted *moejs.InterruptedError
	if errors.As(err, &interrupted) {
		return nil, fmt.Errorf("plugin %s@%s export %s interrupted: %w", e.key, e.version, exportName, interruptCause(interrupted))
	}
	var exception *moejs.Exception
	errors.As(err, &exception)
	return nil, fmt.Errorf("plugin %s@%s export %s failed: %w%s", e.key, e.version, exportName, err, thrownAt(instance.runtime, exception))
}

// HasExport reports whether a module export was defined when the plugin
// loaded: an export that was undefined then counts as absent, and a later
// assignment is not seen. Optional contract hooks should be detected with
// this method instead of relying on engine errors. It runs no JavaScript, so
// it neither waits for nor takes a call slot.
func (e *Engine) HasExport(exportName string) bool {
	_, found := e.exports[exportName]
	return found
}

// HasCallablePath reports whether an exported value, or a nested member below
// it, exists and is callable.
func (e *Engine) HasCallablePath(ctx context.Context, exportName string, members ...string) (bool, error) {
	select {
	case e.semaphore <- struct{}{}:
		defer func() { <-e.semaphore }()
	case <-ctx.Done():
		return false, ctx.Err()
	}
	hook, err := e.hook(exportName, members)
	if err != nil {
		return false, nil
	}
	instance, err := e.getRuntime(ctx)
	if err != nil {
		return false, err
	}
	reusable := true
	defer func() {
		instance.runtime.ClearInterrupt()
		instance.logContext.context = nil
		if reusable {
			e.putRuntime(instance)
		}
	}()
	timedOut := errors.New("plugin inspection timed out")
	stopInterrupt := watchRuntimeContext(instance.runtime, ctx, e.timeout, timedOut)
	defer stopInterrupt()
	found, err := instance.runtime.Has(hook)
	if err == nil {
		return found, nil
	}
	reusable = false
	var interrupted *moejs.InterruptedError
	if errors.As(err, &interrupted) {
		return false, fmt.Errorf("plugin %s@%s hook %s inspection interrupted: %w", e.key, e.version, hook.Name(), interruptCause(interrupted))
	}
	var exception *moejs.Exception
	errors.As(err, &exception)
	return false, fmt.Errorf("plugin %s@%s hook %s inspection failed: %w%s", e.key, e.version, hook.Name(), err, thrownAt(instance.runtime, exception))
}

// RawJSON is a hook argument given as JSON text: the hook receives JSON.parse
// of it, members in order, whether it is an argument or inside one, with no Go
// values built in between; text nested too deep for JSON.parse is decoded with
// the host codec instead. The engine parses the bytes in place, without the
// copy ParseJSON makes, and strings of the call's result may share them, so
// the caller must never change them once passed.
type RawJSON []byte

// Call invokes one named module export and returns its JSON-compatible value.
func (e *Engine) Call(ctx context.Context, exportName string, args ...any) (result any, err error) {
	result, _, err = e.call(ctx, callOptions{}, exportName, nil, args...)
	return result, err
}

// CallInto invokes one named module export and stores its result in target as
// the host codec decodes the encoding of the value Call returns, without that
// round trip for plain results. A result the codec cannot encode or target's
// type rejects is a *ResultError, and target may then hold part of it.
func (e *Engine) CallInto(ctx context.Context, target any, exportName string, args ...any) error {
	_, _, err := e.call(ctx, callOptions{target: target}, exportName, nil, args...)
	return err
}

// CallJSONInto is CallInto with the semantics of JSON.stringify's text of the
// result instead of the host codec's encoding: objects keep their member
// order, which a json.RawMessage in target receives as text, members whose
// value is undefined are left out and toJSON runs.
func (e *Engine) CallJSONInto(ctx context.Context, target any, exportName string, args ...any) error {
	_, _, err := e.call(ctx, callOptions{target: target, stringify: true}, exportName, nil, args...)
	return err
}

// CallMember invokes a function stored on an exported object, such as a
// renderer in the renderers export.
func (e *Engine) CallMember(ctx context.Context, exportName, memberName string, args ...any) (result any, err error) {
	result, _, err = e.call(ctx, callOptions{}, exportName, []string{memberName}, args...)
	return result, err
}

// CallPath invokes a function nested below an exported object. It is used for
// protocol hooks such as protocols.openai_responses.renderEvents.
func (e *Engine) CallPath(ctx context.Context, exportName string, members []string, args ...any) (result any, err error) {
	result, _, err = e.call(ctx, callOptions{}, exportName, members, args...)
	return result, err
}

// CallPathInto is CallInto for a function nested below an exported object.
func (e *Engine) CallPathInto(ctx context.Context, target any, exportName string, members []string, args ...any) error {
	_, _, err := e.call(ctx, callOptions{target: target}, exportName, members, args...)
	return err
}

// CallPathWithAdmissionTimeout gives long-lived observers a separate bound for
// waiting on JavaScript capacity. Once admitted, the hook receives the
// engine's full execution timeout instead of inheriting time already spent in
// the semaphore queue.
func (e *Engine) CallPathWithAdmissionTimeout(
	ctx context.Context,
	admissionTimeout time.Duration,
	exportName string,
	members []string,
	args ...any,
) (result any, err error) {
	result, _, err = e.call(ctx, callOptions{admissionTimeout: admissionTimeout}, exportName, members, args...)
	return result, err
}

// CallPathWithMemberJSON is CallPathWithAdmissionTimeout that also returns the
// result's member as the text JSON.stringify writes for it, which keeps the
// member order of its objects. The text is nil when member is empty or the
// result has no such member.
func (e *Engine) CallPathWithMemberJSON(
	ctx context.Context,
	admissionTimeout time.Duration,
	member string,
	exportName string,
	members []string,
	args ...any,
) (result any, text json.RawMessage, err error) {
	return e.call(ctx, callOptions{admissionTimeout: admissionTimeout, jsonMember: member}, exportName, members, args...)
}

// callOptions is what a hook call does besides calling: the bound on waiting
// for a JavaScript slot, the Go value the result is stored in instead of
// being returned (from its JSON.stringify text when stringify is set), and a
// member of the result also returned as JSON text.
type callOptions struct {
	admissionTimeout time.Duration
	target           any
	stringify        bool
	jsonMember       string
}

func (e *Engine) call(ctx context.Context, opts callOptions, exportName string, members []string, args ...any) (any, json.RawMessage, error) {
	if err := e.acquireCallSlot(ctx, opts.admissionTimeout); err != nil {
		return nil, nil, err
	}
	defer func() { <-e.semaphore }()

	hook, err := e.hook(exportName, members)
	if err != nil {
		if len(members) == 0 {
			return nil, nil, fmt.Errorf("plugin export %q not found", exportName)
		}
		return nil, nil, fmt.Errorf("plugin hook %q not found", exportName)
	}
	instance, err := e.getRuntime(ctx)
	if err != nil {
		return nil, nil, err
	}
	reusable := true
	defer func() {
		instance.runtime.ClearInterrupt()
		instance.logContext.context = nil
		if reusable {
			// An idle pooled runtime must not keep this call's request
			// data alive.
			instance.runtime.ReleaseCallData()
			e.putRuntime(instance)
		}
	}()

	callArgs := make([]moejs.Value, 0, 4)
	for index, arg := range args {
		var converted moejs.Value
		if raw, ok := arg.(RawJSON); !ok {
			value, _ := pluginValue(instance.runtime, arg, 0)
			converted, err = instance.runtime.FromGo(value)
		} else if converted, err = instance.runtime.ParseJSONString(unsafe.String(unsafe.SliceData(raw), len(raw))); err != nil {
			// JSON.parse stops at a lower nesting depth than the host codec.
			var decoded any
			if err = common.Unmarshal(raw, &decoded); err == nil {
				converted, err = instance.runtime.FromGo(decoded)
			}
		}
		if err != nil {
			return nil, nil, fmt.Errorf("plugin %s@%s hook %s argument %d: %w", e.key, e.version, hook.Name(), index+1, err)
		}
		callArgs = append(callArgs, converted)
	}

	timedOut := errors.New("plugin call timed out")
	stopInterrupt := watchRuntimeContext(instance.runtime, ctx, e.timeout, timedOut)
	defer stopInterrupt()

	value, err := instance.runtime.Call(hook, callArgs...)
	var interrupted *moejs.InterruptedError
	var exception *moejs.Exception
	if err == nil {
		var result any
		var memberText json.RawMessage
		switch {
		case opts.target != nil && opts.stringify:
			err = instance.runtime.Unmarshal(value, opts.target)
		case opts.target != nil:
			err = instance.runtime.ToGoInto(value, opts.target)
		default:
			result, err = instance.runtime.ToGo(value)
		}
		if err == nil && opts.jsonMember != "" {
			// After the result's Go value: AppendJSON may run a toJSON or
			// a getter, which ToGo never does.
			var member moejs.Value
			if member, err = instance.runtime.Get(value, opts.jsonMember); err == nil && !member.IsUndefined() {
				memberText, err = instance.runtime.AppendJSON(nil, member)
			}
		}
		if err == nil {
			return result, memberText, nil
		}
		if errors.As(err, &interrupted) {
			reusable = false
			return nil, nil, fmt.Errorf("plugin %s@%s hook %s interrupted: %w", e.key, e.version, hook.Name(), interruptCause(interrupted))
		}
		// Past ToGo's errors, ToGoInto fails as json.Marshal and
		// json.Unmarshal do, which is the host codec (common/json.go), and
		// Unmarshal and AppendJSON as JSON.stringify does (a BigInt, a cycle).
		var internal *moejs.InternalError
		if (opts.target != nil || opts.jsonMember != "") && !errors.As(err, &exception) && !errors.As(err, &internal) {
			return nil, nil, &ResultError{err: err}
		}
	}
	switch {
	case errors.Is(err, moejs.ErrHookNotFound):
		if len(members) == 0 {
			return nil, nil, fmt.Errorf("plugin export %q not found", exportName)
		}
		// Name the path up to the first missing member, as far as data
		// properties show it; getters on the path are not run again.
		hookName := exportName
		current, found := instance.runtime.Export(exportName)
		for _, member := range members {
			if !found || current.IsNullish() {
				break
			}
			hookName += "." + member
			if !current.IsObject() {
				break
			}
			current, found = current.AsObject().GetOwnDataValue(instance.runtime.Realm().KeyFromGoString(member))
		}
		return nil, nil, fmt.Errorf("plugin hook %q not found", hookName)
	case errors.Is(err, moejs.ErrNotCallable):
		return nil, nil, fmt.Errorf("plugin hook %q is not a function", hook.Name())
	case errors.As(err, &interrupted):
		reusable = false
		return nil, nil, fmt.Errorf("plugin %s@%s hook %s failed: %w", e.key, e.version, hook.Name(), interruptCause(interrupted))
	case errors.As(err, &exception):
		wrapped := fmt.Errorf("plugin %s@%s hook %s failed: %w%s", e.key, e.version, hook.Name(), err, thrownAt(instance.runtime, exception))
		return nil, nil, newHookError(hook.Name(), exception.Message(), wrapped)
	}
	reusable = false
	return nil, nil, fmt.Errorf("plugin %s@%s hook %s failed: %w", e.key, e.version, hook.Name(), err)
}

// hook resolves a hook path against the module's export table. Only
// declared exports resolve; the handle is cached, while the bindings it
// names are read live on every call.
func (e *Engine) hook(exportName string, members []string) (moejs.Hook, error) {
	key := hookKey{export: exportName, depth: len(members)}
	cacheable := len(members) <= len(key.members)
	if cacheable {
		copy(key.members[:], members)
		e.hooksMu.RLock()
		hook, found := e.hooks[key]
		e.hooksMu.RUnlock()
		if found {
			return hook, nil
		}
	}
	hook, err := e.module.Hook(exportName, members...)
	if err != nil || !cacheable {
		return hook, err
	}
	e.hooksMu.Lock()
	if len(e.hooks) < maxCachedHooks {
		e.hooks[key] = hook
	}
	e.hooksMu.Unlock()
	return hook, nil
}

func (e *Engine) acquireCallSlot(ctx context.Context, admissionTimeout time.Duration) error {
	if admissionTimeout <= 0 {
		select {
		case e.semaphore <- struct{}{}:
			return nil
		case <-ctx.Done():
			return ctx.Err()
		}
	}

	timer := time.NewTimer(admissionTimeout)
	defer timer.Stop()
	select {
	case e.semaphore <- struct{}{}:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		if err := ctx.Err(); err != nil {
			return err
		}
		return fmt.Errorf("%w: plugin %s@%s", ErrCallAdmissionTimeout, e.key, e.version)
	}
}

// interruptCause is what stopped a runtime: the context cause
// watchRuntimeContext interrupted it with, so errors.Is sees a caller's
// cancellation through the host error.
func interruptCause(interrupted *moejs.InterruptedError) error {
	if cause, ok := interrupted.Value.(error); ok {
		return cause
	}
	return interrupted
}

// thrownAt is the frame an Error was thrown from, as " at fn (file:line:col)",
// for host logs; it is empty for thrown values that are not Errors and for
// errors that are not exceptions (exception is nil).
func thrownAt(runtime *moejs.Runtime, exception *moejs.Exception) string {
	_, frames, found := strings.Cut(runtime.StackTrace(exception), "\n    at ")
	if !found {
		return ""
	}
	frame, _, _ := strings.Cut(frames, "\n")
	return " at " + frame
}

// maxPluginValueDepth bounds the argument walk; deeper values, which no
// host-built argument reaches, are passed on as they are.
const maxPluginValueDepth = 512

// pluginValueContainers are the container types moejs converts; named types
// with one of these underlying types are only retyped.
var pluginValueContainers = []reflect.Type{
	reflect.TypeFor[map[string]any](),
	reflect.TypeFor[map[string]string](),
	reflect.TypeFor[map[string][]string](),
	reflect.TypeFor[[]any](),
	reflect.TypeFor[[]string](),
	reflect.TypeFor[[]map[string]any](),
}

// pluginValue returns a hook argument in the shapes moejs converts: nil,
// booleans, numbers, strings, JSON-shaped maps and slices and engine values.
// A RawJSON inside the argument becomes rt's parse of it (RawJSON); other Go
// values (structs, pointers, maps and slices of other element types) take
// their JSON form through the configured codec, and named scalars and
// containers become their underlying type. changed is false when v has
// supported shapes throughout, the usual case, so an argument is passed on
// without a copy.
func pluginValue(rt *moejs.Runtime, v any, depth int) (converted any, changed bool) {
	if depth > maxPluginValueDepth {
		return v, false
	}
	switch typed := v.(type) {
	case nil, bool, string, int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64,
		float32, float64, json.Number, *big.Int, []byte, []string, map[string]string, map[string][]string,
		moejs.Value, moejs.NativeFunc:
		return v, false
	case RawJSON:
		if parsed, err := rt.ParseJSONString(unsafe.String(unsafe.SliceData(typed), len(typed))); err == nil {
			return parsed, true
		}
		// JSON.parse stops at a lower nesting depth than the host codec.
		var decoded any
		if err := common.Unmarshal(typed, &decoded); err != nil {
			return v, false
		}
		return decoded, true
	case map[string]any:
		var copied map[string]any
		for key, item := range typed {
			if item, changed = pluginValue(rt, item, depth+1); changed {
				if copied == nil {
					copied = maps.Clone(typed)
				}
				copied[key] = item
			}
		}
		if copied == nil {
			return v, false
		}
		return copied, true
	case []any:
		var copied []any
		for index, item := range typed {
			if item, changed = pluginValue(rt, item, depth+1); changed {
				if copied == nil {
					copied = slices.Clone(typed)
				}
				copied[index] = item
			}
		}
		if copied == nil {
			return v, false
		}
		return copied, true
	case []map[string]any:
		var copied []map[string]any
		for index, item := range typed {
			if next, changed := pluginValue(rt, item, depth+1); changed {
				if copied == nil {
					copied = slices.Clone(typed)
				}
				copied[index] = next.(map[string]any)
			}
		}
		if copied == nil {
			return v, false
		}
		return copied, true
	}
	_, marshaler := v.(json.Marshaler)
	_, textMarshaler := v.(encoding.TextMarshaler)
	if !marshaler && !textMarshaler {
		value := reflect.ValueOf(v)
		switch value.Kind() {
		case reflect.Bool:
			return value.Bool(), true
		case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
			return value.Int(), true
		case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
			return value.Uint(), true
		case reflect.Float32, reflect.Float64:
			return value.Float(), true
		case reflect.String:
			return value.String(), true
		case reflect.Map, reflect.Slice:
			for _, container := range pluginValueContainers {
				if value.Type().ConvertibleTo(container) {
					converted, _ = pluginValue(rt, value.Convert(container).Interface(), depth)
					return converted, true
				}
			}
		}
	}
	data, err := common.Marshal(v)
	if err != nil {
		return v, false
	}
	var decoded any
	if err = common.Unmarshal(data, &decoded); err != nil {
		return v, false
	}
	return decoded, true
}

// Idle runtimes are bounded by the execution limit and survive GC. Start with
// one instance and grow only when concurrent work actually needs more.
func (e *Engine) putRuntime(instance *runtimeInstance) {
	select {
	case e.pool <- instance:
	default:
	}
}

func (e *Engine) getRuntime(ctx context.Context) (*runtimeInstance, error) {
	select {
	case instance := <-e.pool:
		instance.logContext.context = ctx
		return instance, nil
	default:
		return e.newRuntime(ctx)
	}
}

// A timeout callback must finish before its runtime can be reused. Merely
// stopping a timer does not wait for an already-started Interrupt call.
func watchRuntimeContext(runtime *moejs.Runtime, ctx context.Context, timeout time.Duration, timeoutError error) func() {
	callContext, cancel := context.WithTimeoutCause(ctx, timeout, timeoutError)
	interrupted := make(chan struct{})
	stop := context.AfterFunc(callContext, func() {
		runtime.Interrupt(context.Cause(callContext))
		close(interrupted)
	})
	return func() {
		if !stop() {
			<-interrupted
		}
		cancel()
	}
}

func (e *Engine) newRuntime(ctx context.Context) (*runtimeInstance, error) {
	// Code compiled from strings would bypass the upload-time syntax checks,
	// so eval and the Function constructors throw an EvalError.
	runtime := moejs.NewRuntime(moejs.Options{DisableDynamicCode: true})
	logContext := &runtimeLogContext{context: ctx}
	logOutput := e.log
	if logOutput == nil {
		logOutput = func(message string) {
			logger.LogDebug(logContext.context, "task_plugin subsystem=runtime event=console message=%q", message)
		}
	}
	if err := injectGlobals(runtime, func() string {
		return fmt.Sprintf("[plugin:%s@%s]", e.key, e.version)
	}, e.now, logOutput); err != nil {
		return nil, fmt.Errorf("inject plugin utils: %w", err)
	}
	timedOut := errors.New("plugin initialization timed out")
	stopInterrupt := watchRuntimeContext(runtime, ctx, e.timeout, timedOut)
	err := runtime.Load(e.module)
	stopInterrupt()
	runtime.ClearInterrupt()
	var interrupted *moejs.InterruptedError
	if errors.As(err, &interrupted) {
		return nil, fmt.Errorf("initialize plugin %s@%s: %w", e.key, e.version, interruptCause(interrupted))
	}
	if err != nil {
		return nil, fmt.Errorf("evaluate plugin: %w", err)
	}
	return &runtimeInstance{runtime: runtime, logContext: logContext}, nil
}

func sourceWithoutCommentsAndStrings(source string) string {
	var output strings.Builder
	output.Grow(len(source))
	quote := byte(0)
	escaped := false
	lineComment := false
	blockComment := false
	for i := 0; i < len(source); i++ {
		current := source[i]
		next := byte(0)
		if i+1 < len(source) {
			next = source[i+1]
		}
		if lineComment {
			if current == '\n' {
				lineComment = false
				output.WriteByte('\n')
			} else {
				output.WriteByte(' ')
			}
			continue
		}
		if blockComment {
			if current == '*' && next == '/' {
				blockComment = false
				output.WriteString("  ")
				i++
			} else {
				output.WriteByte(' ')
			}
			continue
		}
		if quote != 0 {
			output.WriteByte(' ')
			if escaped {
				escaped = false
			} else if current == '\\' {
				escaped = true
			} else if current == quote {
				quote = 0
			}
			continue
		}
		if current == '/' && next == '/' {
			lineComment = true
			output.WriteString("  ")
			i++
			continue
		}
		if current == '/' && next == '*' {
			blockComment = true
			output.WriteString("  ")
			i++
			continue
		}
		if current == '\'' || current == '"' || current == '`' {
			quote = current
			output.WriteByte(' ')
			continue
		}
		output.WriteByte(current)
	}
	return output.String()
}
