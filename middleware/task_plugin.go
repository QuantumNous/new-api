package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	pluginruntime "github.com/QuantumNous/new-api/pkg/jsplugin"
	taskjsplugin "github.com/QuantumNous/new-api/relay/channel/task/jsplugin"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

const contextKeyTaskPluginEndpointModel = "task_plugin_endpoint_model_request"

const contextKeyTaskPluginEndpointSelection = "task_plugin_endpoint_channel_selection"

type taskPluginEndpointSelection struct {
	Generation *pluginruntime.RoutingGeneration
	Channel    *model.Channel
	Model      string
}

var errTaskPluginUnsupportedMediaType = errors.New("unsupported task plugin media type")

const taskPluginInvalidRouteResult = "plugin returned an invalid route result"

// Text fields have no limit of their own: like a JSON body, they are bounded
// by the request body limit, so a JSON request sent as a multipart field may
// be as large as the same request sent as the body.
const (
	maxTaskPluginFormFields     = 256
	maxTaskPluginMultipartParts = 256
	maxTaskPluginFiles          = 32
	maxTaskPluginFieldNameBytes = 256
	maxTaskPluginFilenameBytes  = 255
)

// NativeRouteCredential accepts, on the native routes of the built-in plugins
// listed here, the vendor's official API-key form as the gateway token and
// rewrites it into the Bearer form TokenAuth reads: Vidu's
// "Authorization: Token <key>", and the Gemini API's "x-goog-api-key: <key>"
// or "?key=<key>". A header the client already sent as Authorization wins.
// "?key=" is taken out of the URL in every case, so decoders, the stored
// request path and later handlers never see it. Every other plugin's routes
// accept the Bearer form only. pluginKeys are the plugins serving the route.
func NativeRouteCredential(pluginKeys ...string) gin.HandlerFunc {
	viduToken := slices.Contains(pluginKeys, "vidu")
	googleKey := slices.Contains(pluginKeys, "google")
	return func(c *gin.Context) {
		header := c.Request.Header
		if viduToken {
			if scheme, token, found := strings.Cut(header.Get("Authorization"), " "); found && strings.EqualFold(scheme, "Token") {
				header.Set("Authorization", "Bearer "+strings.TrimSpace(token))
			}
		}
		if googleKey {
			queryKey, removed := "", false
			kept := make([]string, 0)
			for part := range strings.SplitSeq(c.Request.URL.RawQuery, "&") {
				rawName, rawValue, _ := strings.Cut(part, "=")
				if name, err := url.QueryUnescape(rawName); err != nil || name != "key" {
					kept = append(kept, part)
					continue
				}
				removed = true
				if value, err := url.QueryUnescape(rawValue); err == nil && queryKey == "" {
					queryKey = value
				}
			}
			if removed {
				c.Request.URL.RawQuery = strings.Join(kept, "&")
				c.Request.RequestURI = c.Request.URL.RequestURI()
			}
			headerKey := header.Get("X-Goog-Api-Key")
			header.Del("X-Goog-Api-Key")
			if header.Get("Authorization") == "" {
				if headerKey != "" {
					header.Set("Authorization", "Bearer "+headerKey)
				} else if queryKey != "" {
					header.Set("Authorization", "Bearer "+queryKey)
				}
			}
		}
		c.Next()
	}
}

// PrepareTaskPluginRoute resolves and executes the pinned declarative route.
// Query requests terminate here so channel distribution and billing are never
// entered; submit requests continue through the remaining route handlers.
func PrepareTaskPluginRoute() gin.HandlerFunc {
	return func(c *gin.Context) {
		pinnedValue, exists := c.Get(pluginruntime.ContextKeyPinnedRoute)
		pinned, ok := pinnedValue.(pluginruntime.PinnedRoute)
		if !exists || !ok || pinned.Plugin == nil {
			abortTaskPluginRouteErrorDetail(c, http.StatusInternalServerError, "")
			return
		}
		c.Set(pluginruntime.ContextKeyPinnedPlugin, pluginruntime.PinnedPlugin{
			Generation: pinned.Generation,
			Plugin:     pinned.Plugin,
		})
		generation := uint64(0)
		if pinned.Generation != nil {
			generation = pinned.Generation.Number
		}
		candidates := pinned.Candidates
		if len(candidates) == 0 {
			candidates = []pluginruntime.RouteBinding{{Plugin: pinned.Plugin, Route: pinned.Route}}
		}
		logger.LogDebug(
			c,
			"task_plugin subsystem=route event=prepare_start generation=%d plugin=%q method=%q declared_type=%q candidates=%d",
			generation,
			pinned.Plugin.Meta.Key,
			pinned.Route.Method,
			pinned.Route.Type,
			len(candidates),
		)

		requestContext, err := buildTaskPluginRouteRequest(c)
		requestContext.Params = pluginruntime.RouteParams(c.Params, pinned.Route)
		c.Set(pluginruntime.ContextKeyRouteRequest, requestContext)
		if err != nil {
			logger.LogWarn(
				c,
				common.LogText("task_plugin subsystem=route event=prepare_rejected generation=%d plugin=%q stage=request_decode reason=invalid_request err=%q",
					generation,
					pinned.Plugin.Meta.Key,
					err.Error()),
			)
			status := invalidRequestStatus(err)
			if errors.Is(err, errTaskPluginUnsupportedMediaType) {
				status = http.StatusUnsupportedMediaType
			}
			abortTaskPluginRouteErrorDetail(c, status, err.Error())
			return
		}
		bodyObject, _ := requestContext.Body.(map[string]any)
		bodyKind, _ := bodyObject["kind"].(string)
		// Submit routes hand JSON and multipart bodies to the decoder, which
		// rejects the kinds its vendor format does not use. A route scoped to
		// models reads the model from a JSON body, so it takes JSON only.
		// Query routes take no body.
		eligible := make([]pluginruntime.RouteBinding, 0, len(candidates))
		for _, candidate := range candidates {
			submitBody := bodyKind == string(pluginruntime.BodyJSON) || bodyKind == string(pluginruntime.BodyMultipart) && len(candidate.Route.Models) == 0
			if candidate.Route.Type == pluginruntime.RouteTypeQuery && bodyKind == string(pluginruntime.BodyNone) || candidate.Route.Type != pluginruntime.RouteTypeQuery && submitBody {
				eligible = append(eligible, candidate)
			}
		}
		if len(eligible) == 0 {
			logger.LogWarn(
				c,
				common.LogText("task_plugin subsystem=route event=prepare_rejected generation=%d plugin=%q stage=request_decode reason=body_kind_mismatch body_kind=%q",
					generation,
					pinned.Plugin.Meta.Key,
					bodyKind),
			)
			detail := "this route requires a JSON or multipart body"
			if len(pinned.Route.Models) > 0 {
				detail = "this route requires a JSON body"
			}
			if pinned.Route.Type == pluginruntime.RouteTypeQuery {
				detail = "unsupported request body for this operation"
			}
			abortTaskPluginRouteErrorDetail(c, http.StatusUnsupportedMediaType, detail)
			return
		}
		if eligible[0].Route.Type == pluginruntime.RouteTypeQuery {
			renderTaskPluginRouteQuery(c, pinned, requestContext, eligible)
			return
		}

		// Every candidate decodes the request; the first that accepts it in
		// key order names the model, and the candidates that accept the same
		// model stay eligible for distribution, which picks the executing
		// plugin by channel.
		claimedModel := ""
		if bodyValue, isObject := bodyObject["value"].(map[string]any); isObject {
			claimedModel, _ = bodyValue["model"].(string)
		}
		hookStarted := time.Now()
		var (
			accepted         []pluginruntime.RouteBinding
			resolved         map[string]any
			resolvedIntent   taskPluginRouteIntent
			resolvedContext  pluginruntime.RouteRequestContext
			resolvedBodyText json.RawMessage
			queryMissed      bool
			failures         []string
		)
		rejectedPlugins := make(map[string][]string)
		for _, candidate := range eligible {
			candidateContext := requestContext
			candidateContext.Params = pluginruntime.RouteParams(c.Params, candidate.Route)
			var (
				result   map[string]any
				bodyText json.RawMessage
				intent   taskPluginRouteIntent
				reason   string
				detail   string
			)
			// The list names declared models; a case variant or a channel
			// alias of a listed model is allowed with it.
			allowed := len(candidate.Route.Models) == 0
			if !allowed {
				_, _, allowed = model.ResolveTaskPluginModel(pinned.Generation, claimedModel, candidate.Route.Models)
			}
			if !allowed {
				reason, detail = "model_not_allowed", fmt.Sprintf("model %q is not allowed on this route", claimedModel)
			} else {
				value, text, callErr := candidate.Plugin.Engine.CallPathWithMemberJSON(
					c.Request.Context(), 0, candidate.Plugin.Meta.JSONTextMember("requestBody"),
					"native", []string{candidate.Route.Decode}, candidateContext.JSValueFor(candidate.Plugin.Meta),
				)
				if callErr != nil {
					reason, detail = "hook_failed", taskPluginHookDetail(callErr)
				} else {
					result, _ = value.(map[string]any)
					bodyText = text
					intent, reason, detail = checkTaskPluginRouteIntent(pinned.Generation, candidate, value)
				}
			}
			if reason == "" && intent.kind == string(pluginruntime.RouteTypeQuery) {
				if len(eligible) == 1 {
					logger.LogDebug(
						c,
						"task_plugin subsystem=route event=resolved generation=%d plugin=%q kind=query renderer=%q task_count=%d distribute=false elapsed_ms=%d",
						generation,
						candidate.Plugin.Meta.Key,
						candidate.Route.Render,
						len(intent.taskIDs),
						time.Since(hookStarted).Milliseconds(),
					)
					renderTaskPluginQuery(c, pinned, candidateContext, intent.taskIDs, candidate.Route.Render, true)
					return
				}
				owned, lookupErr := taskPluginOwnsTasks(c, candidate.Plugin.Meta, intent.taskIDs)
				if lookupErr != nil {
					abortTaskPluginRouteError(c, http.StatusInternalServerError)
					return
				}
				if owned {
					pinned.Plugin, pinned.Route = candidate.Plugin, candidate.Route
					c.Set(pluginruntime.ContextKeyPinnedRoute, pinned)
					c.Set(pluginruntime.ContextKeyPinnedPlugin, pluginruntime.PinnedPlugin{Generation: pinned.Generation, Plugin: candidate.Plugin})
					c.Set(pluginruntime.ContextKeyRouteRequest, candidateContext)
					renderTaskPluginQuery(c, pinned, candidateContext, intent.taskIDs, candidate.Route.Render, true)
					return
				}
				queryMissed = true
				continue
			}
			if reason == "" && resolved != nil && intent.model != resolvedIntent.model {
				logger.LogDebug(c, "task_plugin subsystem=route event=candidate_skipped generation=%d plugin=%q reason=other_model model=%q", generation, candidate.Plugin.Meta.Key, intent.model)
				continue
			}
			if reason != "" {
				if detail == "" {
					detail = "Invalid request"
				}
				logger.LogWarn(
					c,
					common.LogText("task_plugin subsystem=route event=prepare_rejected generation=%d plugin=%q stage=resolve_request reason=%s err=%q elapsed_ms=%d",
						generation,
						candidate.Plugin.Meta.Key,
						reason,
						detail,
						time.Since(hookStarted).Milliseconds()),
				)
				if _, seen := rejectedPlugins[detail]; !seen {
					failures = append(failures, detail)
				}
				rejectedPlugins[detail] = append(rejectedPlugins[detail], candidate.Plugin.Meta.Key)
				continue
			}
			accepted = append(accepted, candidate)
			if resolved == nil {
				resolved, resolvedIntent, resolvedContext, resolvedBodyText = result, intent, candidateContext, bodyText
			}
		}
		if len(accepted) == 0 {
			if queryMissed {
				abortTaskPluginRouteError(c, http.StatusNotFound)
				return
			}
			if len(eligible) > 1 {
				for index, detail := range failures {
					failures[index] = strings.Join(rejectedPlugins[detail], ", ") + ": " + detail
				}
			}
			abortTaskPluginRouteErrorDetail(c, http.StatusBadRequest, strings.Join(failures, "; "))
			return
		}

		owner := accepted[0]
		pinned.Plugin, pinned.Route, pinned.Candidates = owner.Plugin, owner.Route, accepted
		c.Set(pluginruntime.ContextKeyPinnedRoute, pinned)
		c.Set(pluginruntime.ContextKeyPinnedPlugin, pluginruntime.PinnedPlugin{Generation: pinned.Generation, Plugin: owner.Plugin})
		_, bodyReplaced := resolved["requestBody"]
		if bodyReplaced {
			resolvedContext.RequestBody = resolved["requestBody"]
		}
		c.Set(pluginruntime.ContextKeyRouteRequest, resolvedContext)
		c.Set("task_request", resolvedContext.RequestBody)
		if resolvedBodyText != nil {
			c.Set(pluginruntime.ContextKeyRequestBodyText, resolvedBodyText)
		}
		c.Set("resolved_task_model", resolvedIntent.model)
		c.Set("expected_task_plugin_key", owner.Plugin.Meta.Key)
		c.Set("task_plugin_key", owner.Plugin.Meta.Key)
		c.Set("platform", owner.Plugin.Meta.Key)
		service.AppendTaskPluginIdentityFilter(c, owner.Plugin.Meta.Key)
		if resolvedIntent.action != "" {
			c.Set("task_action", resolvedIntent.action)
		}
		c.Set("relay_mode", relayconstant.RelayModeVideoSubmit)
		if intentErr := applyOriginTaskIntent(c, resolved, owner.Plugin.Meta); intentErr != nil {
			logger.LogWarn(
				c,
				common.LogText("task_plugin subsystem=route event=prepare_rejected generation=%d plugin=%q stage=origin_task reason=%s",
					generation,
					owner.Plugin.Meta.Key,
					intentErr.Code),
			)
			abortTaskPluginRouteErrorDetail(c, intentErr.StatusCode, intentErr.Message)
			return
		}
		logger.LogDebug(
			c,
			"task_plugin subsystem=route event=resolved generation=%d plugin=%q kind=submit model=%q action_present=%t request_body_replaced=%t candidates=%d distribute=true elapsed_ms=%d",
			generation,
			owner.Plugin.Meta.Key,
			resolvedIntent.model,
			resolvedIntent.action != "",
			bodyReplaced,
			len(accepted),
			time.Since(hookStarted).Milliseconds(),
		)
		c.Next()
	}
}

// taskPluginRouteIntent is what a native route's decoder resolved: a submit
// (model and action) or, on a dynamic route, a query (task ids).
type taskPluginRouteIntent struct {
	kind    string
	model   string
	action  string
	taskIDs []string
}

// checkTaskPluginRouteIntent validates a native decoder's result against the
// candidate route. A rejection names a log reason and the client's detail.
func checkTaskPluginRouteIntent(generation *pluginruntime.RoutingGeneration, candidate pluginruntime.RouteBinding, value any) (intent taskPluginRouteIntent, reason, detail string) {
	resolved, ok := value.(map[string]any)
	if !ok {
		return intent, "result_not_object", taskPluginInvalidRouteResult
	}
	kind, ok := resolved["kind"].(string)
	if !ok {
		return intent, "missing_kind", taskPluginInvalidRouteResult
	}
	if _, forbidden := resolved["renderer"]; forbidden {
		return intent, "forbidden_renderer", taskPluginInvalidRouteResult
	}
	intent.kind = kind
	switch kind {
	case string(pluginruntime.RouteTypeSubmit):
		modelName, valid := resolved["model"].(string)
		if !valid || strings.TrimSpace(modelName) == "" {
			return intent, "invalid_model", "decoded request is missing a model"
		}
		// The task is named as on the host protocols: a case variant by the
		// declared spelling, a channel alias by the alias.
		served, declared, owned := model.ResolveTaskPluginModel(generation, modelName, candidate.Plugin.Meta.Models)
		if !owned {
			return intent, "model_not_owned", fmt.Sprintf("model %q is not served by this plugin", modelName)
		}
		if len(candidate.Route.Models) > 0 && !slices.Contains(candidate.Route.Models, declared) {
			return intent, "resolved_model_not_allowed", fmt.Sprintf("model %q is not allowed on this route", modelName)
		}
		intent.model = served
		intent.action = candidate.Route.Action
		if resolvedAction, present := resolved["action"]; present {
			actionValue, actionOK := resolvedAction.(string)
			if !actionOK {
				return intent, "invalid_action", taskPluginInvalidRouteResult
			}
			if strings.TrimSpace(actionValue) != "" {
				intent.action = actionValue
			}
		}
	case string(pluginruntime.RouteTypeQuery):
		if candidate.Route.Type != pluginruntime.RouteTypeDynamic {
			return intent, "query_from_non_dynamic_route", taskPluginInvalidRouteResult
		}
		taskIDs, valid := resolvedTaskPluginIDs(resolved["taskIds"])
		if !valid {
			return intent, "invalid_query_result", taskPluginInvalidRouteResult
		}
		intent.taskIDs = taskIDs
	default:
		return intent, "unsupported_kind", taskPluginInvalidRouteResult
	}
	return intent, "", ""
}

// renderTaskPluginRouteQuery answers a native query route. A candidate reads
// the task id from its path parameter or, when its taskIdParam is not in the
// path, from the query string. On a path several plugins declare, the task's
// own plugin answers: the first candidate in key order that owns it. A task
// none of them owns is not found, like a missing one.
func renderTaskPluginRouteQuery(c *gin.Context, pinned pluginruntime.PinnedRoute, requestContext pluginruntime.RouteRequestContext, candidates []pluginruntime.RouteBinding) {
	taskIDs := make([]string, len(candidates))
	for index, candidate := range candidates {
		if !candidate.Route.TaskIDInQuery() {
			taskIDs[index] = pluginruntime.RouteParams(c.Params, candidate.Route)[candidate.Route.TaskIDParam]
		} else if values := requestContext.Query[candidate.Route.TaskIDParam]; len(values) > 0 {
			taskIDs[index] = strings.TrimSpace(values[0])
		}
	}
	if !slices.ContainsFunc(taskIDs, func(taskID string) bool { return taskID != "" }) {
		abortTaskPluginRouteErrorDetail(c, http.StatusBadRequest, candidates[0].Route.TaskIDParam+" is required")
		return
	}
	ownerIndex := 0
	if len(candidates) > 1 {
		ownerIndex = -1
		platforms := make([]constant.TaskPlatform, 0, len(candidates))
		for index, candidate := range candidates {
			if taskIDs[index] != "" {
				platforms = append(platforms, taskPluginLegacyPlatforms(candidate.Plugin.Meta)...)
			}
		}
		tasks, err := model.GetByTaskIdsForPlatforms(common.GetContextKeyInt(c, constant.ContextKeyUserId), platforms, slices.Compact(slices.Sorted(slices.Values(taskIDs))))
		if err != nil {
			abortTaskPluginRouteError(c, http.StatusInternalServerError)
			return
		}
		for index, candidate := range candidates {
			if slices.ContainsFunc(tasks, func(task *model.Task) bool {
				return task.TaskID == taskIDs[index] && task.ResultRetrievable() && slices.Contains(taskPluginLegacyPlatforms(candidate.Plugin.Meta), task.Platform)
			}) {
				ownerIndex = index
				break
			}
		}
		if ownerIndex < 0 {
			abortTaskPluginRouteError(c, http.StatusNotFound)
			return
		}
	}
	owner := candidates[ownerIndex]
	if taskIDs[ownerIndex] == "" {
		abortTaskPluginRouteErrorDetail(c, http.StatusBadRequest, owner.Route.TaskIDParam+" is required")
		return
	}
	requestContext.Params = pluginruntime.RouteParams(c.Params, owner.Route)
	pinned.Plugin, pinned.Route = owner.Plugin, owner.Route
	c.Set(pluginruntime.ContextKeyPinnedRoute, pinned)
	c.Set(pluginruntime.ContextKeyPinnedPlugin, pluginruntime.PinnedPlugin{Generation: pinned.Generation, Plugin: owner.Plugin})
	c.Set(pluginruntime.ContextKeyRouteRequest, requestContext)
	generation := uint64(0)
	if pinned.Generation != nil {
		generation = pinned.Generation.Number
	}
	logger.LogDebug(
		c,
		"task_plugin subsystem=route event=resolved generation=%d plugin=%q kind=query renderer=%q task_count=1 candidates=%d distribute=false",
		generation,
		owner.Plugin.Meta.Key,
		owner.Route.Render,
		len(candidates),
	)
	renderTaskPluginQuery(c, pinned, requestContext, []string{taskIDs[ownerIndex]}, owner.Route.Render, false)
}

// taskPluginOwnsTasks reports whether every task id names a retrievable task
// of the caller on one of the plugin's platforms.
func taskPluginOwnsTasks(c *gin.Context, meta pluginruntime.Meta, taskIDs []string) (bool, error) {
	tasks, err := model.GetByTaskIdsForPlatforms(common.GetContextKeyInt(c, constant.ContextKeyUserId), taskPluginLegacyPlatforms(meta), taskIDs)
	if err != nil {
		return false, err
	}
	for _, taskID := range taskIDs {
		if !slices.ContainsFunc(tasks, func(task *model.Task) bool { return task.TaskID == taskID && task.ResultRetrievable() }) {
			return false, nil
		}
	}
	return true, nil
}

// RouteTaskPluginEndpoint selects between ordinary relay and plugin channels
// before a plugin can validate or rewrite the client's request. Plugin calls
// still prepare their candidates and origin-task pins before final distribution.
func RouteTaskPluginEndpoint() gin.HandlerFunc {
	pinEndpoint := PinTaskPluginEndpoint()
	return func(c *gin.Context) {
		generation := pluginruntime.DefaultRegistry.Generation()
		request, err := getModelFromRequest(c)
		if err != nil || generation == nil {
			pinEndpoint(c)
			return
		}
		endpoint, found := lookupTaskPluginEndpoint(generation, c.Request.Method, c.Request.URL.Path, request.Model)
		if !found {
			c.Set(contextKeyTaskPluginEndpointModel, *request)
			c.Next()
			return
		}

		filter := dto.ChannelFilter{Kind: dto.FilterTaskPluginEndpoint}
		for _, candidate := range endpoint.Candidates {
			filter.TaskPluginKeys = append(filter.TaskPluginKeys, candidate.Plugin.Meta.Key)
			filter.TaskPluginChannelTypes = append(filter.TaskPluginChannelTypes, candidate.Plugin.Meta.ChannelTypes...)
		}
		constraints := service.GetChannelConstraints(c)
		filterIndex := len(constraints.Filters)
		constraints.AddFilter(filter)
		constraints.AddFilter(dto.ChannelFilter{Kind: dto.FilterRequestPath, RequestPath: c.Request.URL.Path})
		group := common.GetContextKeyString(c, constant.ContextKeyUsingGroup)
		channel, _, selectErr := service.SelectChannelForRequest(c, request.Model, &service.RetryParam{
			Ctx: c, ModelName: request.Model, TokenGroup: group,
			RequestPath: c.Request.URL.Path, Retry: common.GetPointer(0),
		})
		c.Set(contextKeyTaskPluginEndpointSelection, taskPluginEndpointSelection{
			Generation: generation, Channel: channel, Model: request.Model,
		})
		if selectErr != nil {
			// Keep the existing plugin diagnostics and canonical-model lookup
			// when selection cannot resolve the client's original spelling.
			pinEndpoint(c)
			return
		}
		filter.Kind = dto.FilterTaskPluginIdentity
		filter.TaskPluginKey = endpoint.Plugin.Meta.Key
		if pluginChannel, _ := model.ChannelSatisfiesFilters(channel, request.Model, []dto.ChannelFilter{filter}); !pluginChannel {
			constraints.Filters[filterIndex].TaskPluginRelayOnly = true
			c.Set(pluginruntime.ContextKeyRelayEndpoint, endpoint)
			c.Set(contextKeyTaskPluginEndpointModel, *request)
			c.Next()
			return
		}
		pinEndpoint(c)
	}
}

func lookupTaskPluginEndpoint(generation *pluginruntime.RoutingGeneration, method, path, modelName string) (pluginruntime.PinnedEndpoint, bool) {
	lookupModel, pinModel, mappedModel := modelName, modelName, ""
	if declared, ok := generation.CanonicalModel(modelName); ok {
		lookupModel, pinModel = declared, declared
	} else if target, ok := model.ResolveTaskModelAlias(generation, modelName); ok {
		if target.Declared == "" {
			return pluginruntime.PinnedEndpoint{}, false
		}
		lookupModel, pinModel, mappedModel = target.Declared, target.Alias, target.Declared
	}
	candidates := generation.LookupEndpointCandidates(method, path, lookupModel)
	if len(candidates) == 0 {
		return pluginruntime.PinnedEndpoint{}, false
	}
	binding := candidates[0]
	return pluginruntime.PinnedEndpoint{
		Generation: generation, Plugin: binding.Plugin, Protocol: binding.Protocol,
		Operation: binding.Operation, Model: pinModel, MappedModel: mappedModel, Candidates: candidates,
	}, true
}

// PinTaskPluginEndpoint decides shared-endpoint ownership without executing
// plugin code. Invalid or unidentifiable ordinary requests deliberately fall
// through so the existing endpoint remains responsible for its validation.
func PinTaskPluginEndpoint() gin.HandlerFunc {
	return func(c *gin.Context) {
		generation := pluginruntime.DefaultRegistry.Generation()
		if value, exists := c.Get(contextKeyTaskPluginEndpointSelection); exists {
			if selected, ok := value.(taskPluginEndpointSelection); ok {
				generation = selected.Generation
			}
		}
		if generation == nil {
			c.Next()
			return
		}

		modelRequest, err := getModelFromRequest(c)
		if err != nil {
			if _, _, protocolPath := pluginruntime.LookupHostProtocolOperation(c.Request.Method, c.Request.URL.Path); protocolPath {
				abortWithOpenAiMessage(c, invalidRequestStatus(err), i18n.T(c, i18n.MsgDistributorInvalidRequest, map[string]any{"Error": err.Error()}))
				return
			}
			c.Next()
			return
		}
		claimedModel := modelRequest.Model
		if strings.TrimSpace(claimedModel) == "" {
			c.Set(contextKeyTaskPluginEndpointModel, *modelRequest)
			c.Next()
			return
		}
		pinnedEndpoint, found := lookupTaskPluginEndpoint(generation, c.Request.Method, c.Request.URL.Path, claimedModel)
		if !found {
			c.Set(contextKeyTaskPluginEndpointModel, *modelRequest)
			c.Next()
			return
		}
		if claimedModel != pinnedEndpoint.Model {
			if rewriteErr := rewriteTaskPluginJSONModel(c, pinnedEndpoint.Model); rewriteErr != nil {
				abortWithOpenAiMessage(c, http.StatusBadRequest, "Invalid task protocol request")
				return
			}
		}
		modelRequest.Model = pinnedEndpoint.Model
		c.Set(contextKeyTaskPluginEndpointModel, *modelRequest)
		candidates := pinnedEndpoint.Candidates
		binding := candidates[0]
		if definition, known := pluginruntime.HostProtocol(binding.Protocol); known && len(definition.DefinedModes()) > 0 {
			stream, background := jsonBodyBoolFlags(c)
			required := make([]string, 0, 2)
			if stream {
				required = append(required, "stream")
			}
			if background {
				required = append(required, "background")
			}
			if !stream && !background {
				required = append(required, "sync")
			}
			unfiltered := candidates
			filtered := make([]pluginruntime.ProtocolBinding, 0, len(candidates))
			for _, candidate := range candidates {
				if candidate.Plugin == nil {
					continue
				}
				supported := true
				for _, mode := range required {
					if !candidate.Plugin.Meta.ProtocolSupports(candidate.Protocol, mode) {
						supported = false
						break
					}
				}
				if supported {
					filtered = append(filtered, candidate)
				}
			}
			if len(filtered) == 0 {
				abortWithOpenAiMessage(c, http.StatusBadRequest, unsupportedProtocolFormMessage(unfiltered, binding.Protocol, stream, background))
				return
			}
			candidates = filtered
			binding = candidates[0]
		}

		pin := pluginruntime.PinnedPlugin{Generation: generation, Plugin: binding.Plugin}
		pinnedEndpoint.Plugin = binding.Plugin
		pinnedEndpoint.Protocol = binding.Protocol
		pinnedEndpoint.Operation = binding.Operation
		pinnedEndpoint.Candidates = candidates
		c.Set(pluginruntime.ContextKeyPinnedPlugin, pin)
		c.Set(pluginruntime.ContextKeyPinnedEndpoint, pinnedEndpoint)
		logger.LogDebug(
			c,
			"task_plugin subsystem=endpoint event=claimed generation=%d plugin=%q version=%q method=%q protocol=%q model=%q",
			generation.Number,
			binding.Plugin.Meta.Key,
			binding.Plugin.Meta.Version,
			binding.Operation.Methods[0],
			binding.Protocol,
			pinnedEndpoint.Model,
		)
		c.Next()
	}
}

func jsonBodyBoolFlags(c *gin.Context) (stream, background bool) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return false, false
	}
	requestBody, err := storage.Bytes()
	if err != nil {
		return false, false
	}
	values := gjson.GetManyBytes(requestBody, "stream", "background")
	return values[0].Type == gjson.True, values[1].Type == gjson.True
}

func unsupportedProtocolFormMessage(candidates []pluginruntime.ProtocolBinding, protocol string, stream, background bool) string {
	supports := func(mode string) bool {
		for _, candidate := range candidates {
			if candidate.Plugin != nil && candidate.Plugin.Meta.ProtocolSupports(protocol, mode) {
				return true
			}
		}
		return false
	}
	if stream && !supports("stream") {
		if supports("background") {
			return `Streaming is not supported for this model. Set "stream": false, or use "background": true and retrieve the response later.`
		}
		return `Streaming is not supported for this model. Set "stream": false.`
	}
	if background && !supports("background") {
		return `Background mode is not supported for this model. Remove "background": true.`
	}
	forms := make([]string, 0, 2)
	if supports("stream") {
		forms = append(forms, `"stream": true`)
	}
	if supports("background") {
		forms = append(forms, `"background": true`)
	}
	message := "Synchronous non-streaming requests are not supported for this model."
	if len(forms) == 0 {
		return message
	}
	return message + " Set " + strings.Join(forms, " or ") + "."
}

// TaskPluginEndpointOnly applies middleware only after a shared endpoint has
// been claimed. This preserves the original middleware chain for unclaimed
// video requests while enforcing the plugin route protections on claimed ones.
func TaskPluginEndpointOnly(handler gin.HandlerFunc) gin.HandlerFunc {
	return func(c *gin.Context) {
		if _, exists := c.Get(pluginruntime.ContextKeyPinnedEndpoint); !exists {
			c.Next()
			return
		}
		handler(c)
	}
}

// PrepareTaskPluginEndpoint normalizes a claimed shared request through the
// candidates pinned before distribution, retaining only plugins that accept it.
func PrepareTaskPluginEndpoint() gin.HandlerFunc {
	return func(c *gin.Context) {
		pinnedValue, exists := c.Get(pluginruntime.ContextKeyPinnedEndpoint)
		pinned, ok := pinnedValue.(pluginruntime.PinnedEndpoint)
		if !exists {
			c.Next()
			return
		}
		if !ok || pinned.Generation == nil || pinned.Plugin == nil {
			abortWithOpenAiMessage(c, http.StatusInternalServerError, "Task protocol request failed")
			return
		}
		logger.LogDebug(
			c,
			"task_plugin subsystem=endpoint event=prepare_start generation=%d plugin=%q protocol=%q claimed_model=%q",
			pinned.Generation.Number,
			pinned.Plugin.Meta.Key,
			pinned.Protocol,
			pinned.Model,
		)
		if !pluginruntime.SupportsHostProtocol(pinned.Protocol) {
			logger.LogWarn(
				c,
				common.LogText("task_plugin subsystem=endpoint event=prepare_rejected generation=%d plugin=%q stage=protocol_check reason=unsupported_protocol",
					pinned.Generation.Number,
					pinned.Plugin.Meta.Key),
			)
			abortWithOpenAiMessage(c, http.StatusNotImplemented, "Task protocol bridge is not available")
			return
		}
		requestContext, err := buildTaskPluginRouteRequest(c)
		if err != nil {
			logger.LogWarn(
				c,
				common.LogText("task_plugin subsystem=endpoint event=prepare_rejected generation=%d plugin=%q stage=request_decode reason=invalid_request",
					pinned.Generation.Number,
					pinned.Plugin.Meta.Key),
			)
			status := http.StatusBadRequest
			if errors.Is(err, errTaskPluginUnsupportedMediaType) {
				status = http.StatusUnsupportedMediaType
			}
			abortWithOpenAiMessage(c, status, err.Error())
			return
		}
		if body, ok := requestContext.Body.(map[string]any); ok {
			if fields, ok := body["fields"].(map[string][]string); ok {
				if values := fields["model"]; len(values) > 0 && values[0] != pinned.Model {
					fields["model"][0] = pinned.Model
				}
			}
		}
		bodyObject, _ := requestContext.Body.(map[string]any)
		bodyKind, _ := bodyObject["kind"].(string)
		allowedBody := false
		for _, allowed := range pinned.Operation.BodyKinds {
			if bodyKind == string(allowed) {
				allowedBody = true
				break
			}
		}
		if !allowedBody {
			logger.LogWarn(
				c,
				common.LogText("task_plugin subsystem=endpoint event=prepare_rejected generation=%d plugin=%q stage=request_decode reason=body_kind_mismatch body_kind=%q",
					pinned.Generation.Number,
					pinned.Plugin.Meta.Key,
					bodyKind),
			)
			detail := "unsupported request body for this operation"
			if len(pinned.Operation.BodyKinds) == 1 && pinned.Operation.BodyKinds[0] == pluginruntime.BodyJSON {
				detail = "this route requires a JSON body"
			}
			abortWithOpenAiMessage(c, http.StatusUnsupportedMediaType, detail)
			return
		}
		stream := false
		if body, bodyOK := requestContext.Body.(map[string]any); bodyOK && body["kind"] == string(pluginruntime.BodyJSON) {
			requestBody, _ := body["value"].(map[string]any)
			if streamValue, present := requestBody["stream"]; present {
				stream, ok = streamValue.(bool)
				if !ok {
					logger.LogWarn(
						c,
						common.LogText("task_plugin subsystem=endpoint event=prepare_rejected generation=%d plugin=%q stage=request_decode reason=invalid_stream_flag",
							pinned.Generation.Number,
							pinned.Plugin.Meta.Key),
					)
					abortWithOpenAiMessage(c, http.StatusBadRequest, "stream must be a boolean")
					return
				}
			}
		}
		protocolContext := pluginruntime.ProtocolRequestContext{
			RouteRequestContext: requestContext,
			Protocol:            pinned.Protocol,
			Operation:           pinned.Operation.Name,
			Model:               pinned.Model,
			UpstreamModel:       pinned.MappedModel,
			Stream:              stream,
		}
		hookStarted := time.Now()
		candidates := pinned.Candidates
		if len(candidates) == 0 {
			candidates = []pluginruntime.ProtocolBinding{{Plugin: pinned.Plugin, Protocol: pinned.Protocol, Operation: pinned.Operation, Model: pinned.Model}}
		}
		accepted := make([]pluginruntime.ProtocolBinding, 0, len(candidates))
		var resolved map[string]any
		var resolvedBodyText json.RawMessage
		var failures []string
		rejectedPlugins := make(map[string][]string)
		for _, candidate := range candidates {
			candidateContext := protocolContext
			candidateContext.Protocol = candidate.Protocol
			candidateContext.Operation = candidate.Operation.Name
			// Parsing belongs to durable submission; disconnecting only stops
			// the later Responses observation.
			resolvedValue, requestBodyText, callErr := candidate.Plugin.Engine.CallPathWithMemberJSON(
				context.WithoutCancel(c.Request.Context()), pluginruntime.DefaultCallTimeout,
				candidate.Plugin.Meta.JSONTextMember("requestBody"),
				"protocols", []string{candidate.Protocol, "decodeRequest"}, candidateContext.JSValueFor(candidate.Plugin.Meta),
			)
			result, resultOK := resolvedValue.(map[string]any)
			detail := ""
			reason := ""
			if callErr != nil {
				reason = "hook_failed"
				detail = taskPluginHookDetail(callErr)
				if detail == "" {
					detail = "Invalid task protocol request"
				}
			} else if !resultOK {
				reason = "result_not_object"
				detail = taskPluginInvalidRouteResult
			} else if kind, _ := result["kind"].(string); kind != string(pluginruntime.RouteTypeSubmit) {
				reason = "unsupported_kind"
				detail = taskPluginInvalidRouteResult
			} else if model, _ := result["model"].(string); strings.TrimSpace(model) == "" {
				reason = "invalid_model"
				detail = "decoded request is missing a model"
			} else if model != pinned.Model || (pinned.MappedModel == "" && !slices.Contains(candidate.Plugin.Meta.Models, model)) {
				reason = "resolved_model_not_owned"
				detail = fmt.Sprintf("model %q is not served by this plugin", model)
			}
			if detail != "" {
				logger.LogWarn(c, common.LogText("task_plugin subsystem=endpoint event=prepare_rejected generation=%d plugin=%q stage=parse_request reason=%s err=%q elapsed_ms=%d",
					pinned.Generation.Number, candidate.Plugin.Meta.Key, reason, detail, time.Since(hookStarted).Milliseconds()))
				if _, seen := rejectedPlugins[detail]; !seen {
					failures = append(failures, detail)
				}
				rejectedPlugins[detail] = append(rejectedPlugins[detail], candidate.Plugin.Meta.Key)
				continue
			}
			accepted = append(accepted, candidate)
			if resolved == nil {
				resolved = result
				resolvedBodyText = requestBodyText
				protocolContext = candidateContext
			}
		}
		if len(accepted) == 0 {
			if len(candidates) > 1 {
				for index, detail := range failures {
					failures[index] = strings.Join(rejectedPlugins[detail], ", ") + ": " + detail
				}
			}
			abortWithOpenAiMessage(c, http.StatusBadRequest, strings.Join(failures, "; "))
			return
		}
		pinned.Candidates = accepted
		pinned.Plugin = accepted[0].Plugin
		pinned.Protocol = accepted[0].Protocol
		pinned.Operation = accepted[0].Operation
		c.Set(pluginruntime.ContextKeyPinnedEndpoint, pinned)
		c.Set(pluginruntime.ContextKeyPinnedPlugin, pluginruntime.PinnedPlugin{Generation: pinned.Generation, Plugin: pinned.Plugin})
		c.Set(pluginruntime.ContextKeyProtocolRequest, protocolContext)
		resolvedModel := pinned.Model

		action := ""
		if resolvedAction, present := resolved["action"]; present {
			action, ok = resolvedAction.(string)
			if !ok {
				logger.LogWarn(
					c,
					common.LogText("task_plugin subsystem=endpoint event=prepare_rejected generation=%d plugin=%q stage=parse_request reason=invalid_action",
						pinned.Generation.Number,
						pinned.Plugin.Meta.Key),
				)
				abortWithOpenAiMessage(c, http.StatusBadRequest, taskPluginInvalidRouteResult)
				return
			}
		}
		_, bodyReplaced := resolved["requestBody"]
		if normalizedBody, present := resolved["requestBody"]; present {
			requestContext.RequestBody = normalizedBody
		}
		c.Set(pluginruntime.ContextKeyRouteRequest, requestContext)
		c.Set("task_request", requestContext.RequestBody)
		if resolvedBodyText != nil {
			c.Set(pluginruntime.ContextKeyRequestBodyText, resolvedBodyText)
		}
		c.Set("resolved_task_model", resolvedModel)
		c.Set("expected_task_plugin_key", pinned.Plugin.Meta.Key)
		c.Set("task_plugin_key", pinned.Plugin.Meta.Key)
		c.Set("platform", pinned.Plugin.Meta.Key)
		service.AppendTaskPluginIdentityFilter(c, pinned.Plugin.Meta.Key)
		c.Set("relay_mode", relayconstant.RelayModeVideoSubmit)
		if strings.TrimSpace(action) != "" {
			c.Set("task_action", action)
		}
		if intentErr := applyOriginTaskIntent(c, resolved, pinned.Plugin.Meta); intentErr != nil {
			logger.LogWarn(
				c,
				common.LogText("task_plugin subsystem=endpoint event=prepare_rejected generation=%d plugin=%q stage=origin_task reason=%s",
					pinned.Generation.Number,
					pinned.Plugin.Meta.Key,
					intentErr.Code),
			)
			abortWithOpenAiMessage(c, intentErr.StatusCode, intentErr.Message, types.ErrorCode(intentErr.Code))
			return
		}
		logger.LogDebug(
			c,
			"task_plugin subsystem=endpoint event=prepared generation=%d plugin=%q protocol=%q claimed_model=%q resolved_model=%q action_present=%t stream=%t request_body_replaced=%t elapsed_ms=%d",
			pinned.Generation.Number,
			pinned.Plugin.Meta.Key,
			pinned.Protocol,
			pinned.Model,
			resolvedModel,
			action != "",
			stream,
			bodyReplaced,
			time.Since(hookStarted).Milliseconds(),
		)
		c.Next()
	}
}

func buildTaskPluginRouteRequest(c *gin.Context) (pluginruntime.RouteRequestContext, error) {
	requestContext := pluginruntime.RouteRequestContext{
		Path:    c.Request.URL.Path,
		Method:  c.Request.Method,
		Params:  make(map[string]string, len(c.Params)),
		Query:   make(map[string][]string),
		Headers: taskjsplugin.ClientRequestHeaders(c.Request.Header),
		Body:    map[string]any{"kind": string(pluginruntime.BodyNone)},
	}
	for _, param := range c.Params {
		requestContext.Params[param.Key] = param.Value
	}
	for key, values := range c.Request.URL.Query() {
		requestContext.Query[key] = append([]string(nil), values...)
	}

	contentTypes := c.Request.Header.Values("Content-Type")
	contentType := strings.TrimSpace(c.GetHeader("Content-Type"))
	if len(contentTypes) > 1 {
		canonical := ""
		for _, value := range contentTypes {
			mediaType, params, parseErr := mime.ParseMediaType(value)
			if parseErr != nil {
				return requestContext, parseErr
			}
			current := mime.FormatMediaType(strings.ToLower(mediaType), params)
			if canonical != "" && current != canonical {
				return requestContext, fmt.Errorf("conflicting Content-Type headers")
			}
			canonical = current
		}
		contentType = canonical
	}
	if contentType == "" || c.Request.ContentLength == 0 {
		return requestContext, nil
	}
	mediaType, mediaParams, err := mime.ParseMediaType(contentType)
	if err != nil {
		return requestContext, err
	}
	switch {
	case mediaType == "application/json" || strings.HasSuffix(mediaType, "+json"):
		storage, storageErr := common.GetBodyStorage(c)
		if storageErr != nil {
			return requestContext, storageErr
		}
		raw, bytesErr := storage.Bytes()
		if bytesErr != nil {
			return requestContext, bytesErr
		}
		if !utf8.Valid(raw) {
			return requestContext, fmt.Errorf("JSON body must be valid UTF-8")
		}
		var value any
		if err = common.Unmarshal(raw, &value); err != nil {
			return requestContext, err
		}
		requestContext.Body = map[string]any{"kind": string(pluginruntime.BodyJSON), "value": value}
		// Body storage never changes its bytes in place (a rewrite stores a
		// new copy), so the text needs no copy of its own.
		requestContext.BodyText = raw
	case mediaType == "application/x-www-form-urlencoded":
		storage, storageErr := common.GetBodyStorage(c)
		if storageErr != nil {
			return requestContext, storageErr
		}
		raw, bytesErr := storage.Bytes()
		if bytesErr != nil {
			return requestContext, bytesErr
		}
		if !utf8.Valid(raw) {
			return requestContext, fmt.Errorf("form body must be valid UTF-8")
		}
		values, parseErr := url.ParseQuery(string(raw))
		if parseErr != nil {
			return requestContext, parseErr
		}
		if err = validateTaskPluginFields(values); err != nil {
			return requestContext, err
		}
		fields := make(map[string][]string, len(values))
		for field, values := range values {
			fields[field] = append([]string(nil), values...)
		}
		requestContext.Body = map[string]any{"kind": string(pluginruntime.BodyForm), "fields": fields}
	case mediaType == "multipart/form-data":
		boundary := mediaParams["boundary"]
		if boundary == "" {
			return requestContext, fmt.Errorf("multipart boundary is required")
		}
		storage, storageErr := common.GetBodyStorage(c)
		if storageErr != nil {
			return requestContext, storageErr
		}
		raw, bytesErr := storage.Bytes()
		if bytesErr != nil {
			return requestContext, bytesErr
		}
		reader := multipart.NewReader(bytes.NewReader(raw), boundary)
		partCount := 0
		fileCount := 0
		fieldCount := 0
		fileLimitMB := constant.MaxFileDownloadMB
		if fileLimitMB <= 0 {
			fileLimitMB = 64
		}
		for {
			part, nextErr := reader.NextPart()
			if nextErr == io.EOF {
				break
			}
			if nextErr != nil {
				return requestContext, nextErr
			}
			partCount++
			if partCount > maxTaskPluginMultipartParts {
				part.Close()
				return requestContext, fmt.Errorf("multipart body exceeds %d parts", maxTaskPluginMultipartParts)
			}
			name := part.FormName()
			if !utf8.ValidString(name) || len(name) == 0 || len(name) > maxTaskPluginFieldNameBytes {
				part.Close()
				return requestContext, fmt.Errorf("invalid multipart field name")
			}
			partMediaType, _, partMediaErr := mime.ParseMediaType(part.Header.Get("Content-Type"))
			if partMediaErr != nil && part.Header.Get("Content-Type") != "" {
				part.Close()
				return requestContext, fmt.Errorf("invalid multipart part Content-Type")
			}
			if strings.HasPrefix(strings.ToLower(partMediaType), "multipart/") {
				part.Close()
				return requestContext, fmt.Errorf("nested multipart is not supported")
			}
			filename := part.FileName()
			if filename == "" {
				fieldCount++
				if fieldCount > maxTaskPluginFormFields {
					part.Close()
					return requestContext, fmt.Errorf("request body exceeds %d fields", maxTaskPluginFormFields)
				}
				value, readErr := io.ReadAll(part)
				part.Close()
				if readErr != nil {
					return requestContext, readErr
				}
				if !utf8.Valid(value) {
					return requestContext, fmt.Errorf("request field %q must be valid UTF-8", name)
				}
				continue
			}
			fileCount++
			if fileCount > maxTaskPluginFiles {
				part.Close()
				return requestContext, fmt.Errorf("multipart body exceeds %d files", maxTaskPluginFiles)
			}
			if !utf8.ValidString(filename) || len(filename) > maxTaskPluginFilenameBytes {
				part.Close()
				return requestContext, fmt.Errorf("invalid multipart filename")
			}
			written, copyErr := io.Copy(io.Discard, io.LimitReader(part, (int64(fileLimitMB)<<20)+1))
			part.Close()
			if copyErr != nil {
				return requestContext, copyErr
			}
			if written > int64(fileLimitMB)<<20 {
				return requestContext, fmt.Errorf("multipart file exceeds %d MB", fileLimitMB)
			}
		}
		form, parseErr := common.ParseMultipartFormReusable(c)
		if parseErr != nil {
			return requestContext, parseErr
		}
		defer form.RemoveAll()
		if err = validateTaskPluginFields(form.Value); err != nil {
			return requestContext, err
		}
		partCount = 0
		fileCount = 0
		for _, values := range form.Value {
			partCount += len(values)
		}
		for _, headers := range form.File {
			partCount += len(headers)
			fileCount += len(headers)
		}
		if partCount > maxTaskPluginMultipartParts {
			return requestContext, fmt.Errorf("multipart body exceeds %d parts", maxTaskPluginMultipartParts)
		}
		if fileCount > maxTaskPluginFiles {
			return requestContext, fmt.Errorf("multipart body exceeds %d files", maxTaskPluginFiles)
		}
		textFields := make(map[string][]string, len(form.Value))
		for field, values := range form.Value {
			textFields[field] = append([]string(nil), values...)
		}
		files := make([]map[string]any, 0)
		for field, headers := range form.File {
			if !utf8.ValidString(field) || len(field) > maxTaskPluginFieldNameBytes {
				return requestContext, fmt.Errorf("invalid multipart file field name")
			}
			for index, header := range headers {
				if !utf8.ValidString(header.Filename) || len(header.Filename) > maxTaskPluginFilenameBytes {
					return requestContext, fmt.Errorf("invalid multipart filename")
				}
				partMediaType, _, mediaErr := mime.ParseMediaType(header.Header.Get("Content-Type"))
				if mediaErr != nil && header.Header.Get("Content-Type") != "" {
					return requestContext, fmt.Errorf("invalid multipart part Content-Type")
				}
				if strings.HasPrefix(strings.ToLower(partMediaType), "multipart/") {
					return requestContext, fmt.Errorf("nested multipart is not supported")
				}
				if header.Size < 0 || header.Size > int64(fileLimitMB)<<20 {
					return requestContext, fmt.Errorf("multipart file exceeds %d MB", fileLimitMB)
				}
				ref := pluginruntime.FileReference(field, index)
				files = append(files, map[string]any{"ref": ref, "field": field, "filename": header.Filename, "mimeType": header.Header.Get("Content-Type"), "size": header.Size})
			}
		}
		requestContext.Files = files
		requestContext.Body = map[string]any{"kind": string(pluginruntime.BodyMultipart), "fields": textFields, "files": files}
	default:
		return requestContext, fmt.Errorf("%w %q", errTaskPluginUnsupportedMediaType, mediaType)
	}
	return requestContext, nil
}

func validateTaskPluginFields(fields url.Values) error {
	fieldCount := 0
	for name, values := range fields {
		if !utf8.ValidString(name) || len(name) == 0 || len(name) > maxTaskPluginFieldNameBytes {
			return fmt.Errorf("invalid request field name")
		}
		for _, value := range values {
			fieldCount++
			if fieldCount > maxTaskPluginFormFields {
				return fmt.Errorf("request body exceeds %d fields", maxTaskPluginFormFields)
			}
			if !utf8.ValidString(value) {
				return fmt.Errorf("request field %q must be valid UTF-8", name)
			}
		}
	}
	return nil
}

const (
	maxOriginTaskIDs   = 16
	maxOriginTaskIDLen = 128
)

type originTaskIntentError struct {
	Code       string
	Message    string
	StatusCode int
}

// taskPluginLegacyPlatforms lists the Task.Platform values a plugin owns: its
// key (plugin-era tasks) plus every numeric legacy channel type its driver
// can drive (pre-plugin tasks, e.g. sora tasks submitted on OpenAI-type
// channels stored Platform "1").
func taskPluginLegacyPlatforms(meta pluginruntime.Meta) []constant.TaskPlatform {
	platforms := []constant.TaskPlatform{constant.TaskPlatform(meta.Key)}
	// The sunoapi plugin (adapter for the Suno-API proxy project) was renamed
	// from "suno"; historical rows carry that named Platform value, which
	// predates the numeric channel-type convention below.
	if meta.Key == "sunoapi" {
		platforms = append(platforms, constant.TaskPlatformSuno)
	}
	for _, channelType := range meta.ChannelTypes {
		if channelType <= 0 || channelType == constant.ChannelTypeTaskPlugin {
			continue
		}
		platform := constant.TaskPlatform(strconv.Itoa(channelType))
		if slices.Contains(platforms, platform) {
			continue
		}
		platforms = append(platforms, platform)
	}
	return platforms
}

func applyOriginTaskIntent(c *gin.Context, intent map[string]any, meta pluginruntime.Meta) *originTaskIntentError {
	raw, present := intent["originTaskIds"]
	if !present {
		return nil
	}
	var values []any
	switch typed := raw.(type) {
	case []any:
		values = typed
	case []string:
		values = make([]any, len(typed))
		for i, id := range typed {
			values[i] = id
		}
	default:
		return &originTaskIntentError{Code: "invalid_origin_task_ids", Message: "origin task ids are invalid", StatusCode: http.StatusBadRequest}
	}
	if len(values) > maxOriginTaskIDs {
		return &originTaskIntentError{Code: "invalid_origin_task_ids", Message: "origin task ids are invalid", StatusCode: http.StatusBadRequest}
	}
	ids := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		id, ok := value.(string)
		if !ok {
			return &originTaskIntentError{Code: "invalid_origin_task_ids", Message: "origin task ids are invalid", StatusCode: http.StatusBadRequest}
		}
		id = strings.TrimSpace(id)
		if id == "" || utf8.RuneCountInString(id) > maxOriginTaskIDLen {
			return &originTaskIntentError{Code: "invalid_origin_task_ids", Message: "origin task ids are invalid", StatusCode: http.StatusBadRequest}
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		return nil
	}

	userID := common.GetContextKeyInt(c, constant.ContextKeyUserId)
	platforms := taskPluginLegacyPlatforms(meta)
	allowedPlatform := make(map[constant.TaskPlatform]struct{}, len(platforms))
	for _, platform := range platforms {
		allowedPlatform[platform] = struct{}{}
	}

	tasks := make([]*model.Task, 0, len(ids))
	channelID := 0
	for _, id := range ids {
		task, exist, err := model.GetByTaskId(userID, id)
		if err != nil {
			return &originTaskIntentError{Code: "origin_task_not_found", Message: "origin task not found or not owned by you", StatusCode: http.StatusInternalServerError}
		}
		if !exist || task == nil {
			return &originTaskIntentError{Code: "origin_task_not_found", Message: "origin task not found or not owned by you", StatusCode: http.StatusBadRequest}
		}
		if _, allowed := allowedPlatform[task.Platform]; !allowed {
			return &originTaskIntentError{Code: "origin_task_platform_mismatch", Message: "origin task does not belong to this plugin", StatusCode: http.StatusBadRequest}
		}
		if channelID == 0 {
			channelID = task.ChannelId
		} else if task.ChannelId != channelID {
			return &originTaskIntentError{Code: "origin_task_channel_conflict", Message: "origin tasks must belong to the same channel", StatusCode: http.StatusBadRequest}
		}
		tasks = append(tasks, task)
	}

	channel, err := model.CacheGetChannel(channelID)
	if err != nil || channel == nil || channel.Status != common.ChannelStatusEnabled {
		return &originTaskIntentError{Code: "origin_task_channel_disabled", Message: "origin task channel is disabled", StatusCode: http.StatusBadRequest}
	}
	service.GetChannelConstraints(c).AddPin(dto.ChannelPin{
		ChannelId: channel.Id,
		Source:    dto.PinSourceOriginTask,
		Rank:      dto.PinRankOriginTask,
		RetryMode: dto.PinRetrySameChannel,
	})
	common.SetContextKey(c, constant.ContextKeyOriginTasks, tasks)
	return nil
}

func resolvedTaskPluginIDs(value any) ([]string, bool) {
	values, ok := value.([]any)
	if !ok || len(values) > 100 {
		return nil, false
	}
	taskIDs := make([]string, len(values))
	for index, value := range values {
		taskID, stringOK := value.(string)
		if !stringOK || strings.TrimSpace(taskID) == "" {
			return nil, false
		}
		taskIDs[index] = taskID
	}
	return taskIDs, true
}

func renderTaskPluginQuery(
	c *gin.Context,
	pinned pluginruntime.PinnedRoute,
	requestContext pluginruntime.RouteRequestContext,
	taskIDs []string,
	renderer string,
	multiple bool,
) {
	generation := uint64(0)
	if pinned.Generation != nil {
		generation = pinned.Generation.Number
	}
	logger.LogDebug(
		c,
		"task_plugin subsystem=query event=lookup_start generation=%d plugin=%q renderer=%q requested=%d multiple=%t",
		generation,
		pinned.Plugin.Meta.Key,
		renderer,
		len(taskIDs),
		multiple,
	)
	userID := common.GetContextKeyInt(c, constant.ContextKeyUserId)
	platforms := taskPluginLegacyPlatforms(pinned.Plugin.Meta)
	tasks, err := model.GetByTaskIdsForPlatforms(userID, platforms, taskIDs)
	if err != nil {
		logger.LogDebug(
			c,
			"task_plugin subsystem=query event=lookup_failed generation=%d plugin=%q reason=database_error requested=%d",
			generation,
			pinned.Plugin.Meta.Key,
			len(taskIDs),
		)
		abortTaskPluginRouteError(c, http.StatusInternalServerError)
		return
	}
	logger.LogDebug(
		c,
		"task_plugin subsystem=query event=lookup_complete generation=%d plugin=%q requested=%d found=%d",
		generation,
		pinned.Plugin.Meta.Key,
		len(taskIDs),
		len(tasks),
	)
	tasksByID := make(map[string]*model.Task, len(tasks))
	for _, task := range tasks {
		tasksByID[task.TaskID] = task
	}
	views := make([]dto.TaskView, 0, len(taskIDs))
	for _, taskID := range taskIDs {
		task := tasksByID[taskID]
		if task == nil || !task.ResultRetrievable() {
			logger.LogDebug(
				c,
				"task_plugin subsystem=query event=lookup_failed generation=%d plugin=%q reason=task_not_found requested=%d found=%d",
				generation,
				pinned.Plugin.Meta.Key,
				len(taskIDs),
				len(tasks),
			)
			abortTaskPluginRouteError(c, http.StatusNotFound)
			return
		}
		view, viewErr := service.BuildTaskPluginView(task)
		if viewErr != nil {
			abortTaskPluginRouteError(c, http.StatusInternalServerError)
			return
		}
		views = append(views, view)
	}

	var rendererInput any = views
	if !multiple {
		rendererInput = views[0]
	}
	encoded, err := common.Marshal(rendererInput)
	if err != nil {
		abortTaskPluginRouteError(c, http.StatusInternalServerError)
		return
	}
	// The presenter of one finished task gets its artifacts as the gateway
	// addresses host protocol renderers get.
	presenterContext := requestContext.JSValue()
	artifacts := map[string]any{}
	if !multiple {
		projected, projectErr := taskjsplugin.RendererArtifacts(pinned.Plugin, tasksByID[taskIDs[0]], service.BuildTaskArtifactContentURL)
		if projectErr != nil {
			logger.LogWarn(c, common.LogText("task_plugin subsystem=query event=artifacts_unavailable generation=%d plugin=%q err=%q", generation, pinned.Plugin.Meta.Key, projectErr.Error()))
		} else {
			artifacts = projected
		}
	}
	presenterContext["artifacts"] = artifacts
	renderStarted := time.Now()
	result, err := pinned.Plugin.Engine.CallPath(c.Request.Context(), "native", []string{renderer}, presenterContext, pluginruntime.RawJSON(encoded))
	if err != nil {
		logger.LogDebug(
			c,
			"task_plugin subsystem=query event=render_failed generation=%d plugin=%q renderer=%q reason=hook_failed elapsed_ms=%d",
			generation,
			pinned.Plugin.Meta.Key,
			renderer,
			time.Since(renderStarted).Milliseconds(),
		)
		// A presenter with nothing to deliver for the task, such as a file
		// it has no artifact for, answers like a missing task.
		status := http.StatusInternalServerError
		if taskPluginHookDetail(err) == "artifact_not_found" {
			status = http.StatusNotFound
		}
		abortTaskPluginRouteError(c, status)
		return
	}
	logger.LogDebug(
		c,
		"task_plugin subsystem=query event=render_complete generation=%d plugin=%q renderer=%q task_count=%d elapsed_ms=%d",
		generation,
		pinned.Plugin.Meta.Key,
		renderer,
		len(views),
		time.Since(renderStarted).Milliseconds(),
	)
	c.Abort()
	if replyErr := WriteNativeReply(c, http.StatusOK, result); replyErr != nil {
		logger.LogWarn(c, common.LogText("task_plugin subsystem=query event=render_failed generation=%d plugin=%q renderer=%q err=%q", generation, pinned.Plugin.Meta.Key, renderer, replyErr.Error()))
		abortTaskPluginRouteError(c, http.StatusInternalServerError)
	}
}

// nativeReplyHeaders are the headers a reply wrapper may set: a redirect
// target and a retry hint.
var nativeReplyHeaders = []string{"Location", "Retry-After"}

// WriteNativeReply writes what a native presenter returned. A value is the
// JSON body of a reply with the given status (200 for submit and query
// presenters, the host's status for the error presenter), unless it is an
// object with a __status member: such a reply wrapper, {__status, __headers?,
// __body?}, answers with the vendor's own status, as xAI answers a pending
// video with 202. The status is an integer from 200 to 599, __headers may set
// only Location and Retry-After, and a wrapper without __body sends no body.
// An invalid wrapper is an error and writes nothing.
func WriteNativeReply(c *gin.Context, status int, value any) error {
	wrapper, ok := value.(map[string]any)
	if !ok {
		c.JSON(status, value)
		return nil
	}
	rawStatus, isWrapper := wrapper["__status"]
	if !isWrapper {
		c.JSON(status, value)
		return nil
	}
	status = 0
	switch typed := rawStatus.(type) {
	case int64:
		status = int(typed)
	case int:
		status = typed
	case float64:
		if typed == float64(int(typed)) {
			status = int(typed)
		}
	}
	if status < 200 || status > 599 {
		return fmt.Errorf("reply wrapper __status must be an integer from 200 to 599")
	}
	headers := map[string]string{}
	for key, member := range wrapper {
		switch key {
		case "__status", "__body":
		case "__headers":
			values, ok := member.(map[string]any)
			if !ok {
				return fmt.Errorf("reply wrapper __headers must be an object")
			}
			for name, headerValue := range values {
				canonical := http.CanonicalHeaderKey(name)
				text, isString := headerValue.(string)
				if !slices.Contains(nativeReplyHeaders, canonical) || !isString {
					return fmt.Errorf("reply wrapper may set only string Location and Retry-After headers")
				}
				headers[canonical] = text
			}
		default:
			return fmt.Errorf("reply wrapper has unknown member %q", key)
		}
	}
	for name, headerValue := range headers {
		c.Header(name, headerValue)
	}
	if body, hasBody := wrapper["__body"]; hasBody {
		c.JSON(status, body)
		return nil
	}
	c.Status(status)
	c.Writer.WriteHeaderNow()
	return nil
}

// RespondTaskPluginError gives a pinned plugin a sanitized error DTO and writes
// its native error body with the host's status, unless the body is a reply
// wrapper that answers with the vendor's own status.
func RespondTaskPluginError(c *gin.Context, taskErr *dto.TaskError) bool {
	if taskErr == nil {
		return false
	}
	pinnedValue, exists := c.Get(pluginruntime.ContextKeyPinnedRoute)
	pinned, ok := pinnedValue.(pluginruntime.PinnedRoute)
	if !exists || !ok || pinned.Plugin == nil {
		return false
	}
	sanitized := sanitizedTaskPluginError(taskErr.StatusCode, taskErr.Message)
	requestID := c.GetString(common.RequestIdKey)
	hasRenderer, err := pinned.Plugin.Engine.HasCallablePath(c.Request.Context(), "native", "error")
	requestValue, exists := c.Get(pluginruntime.ContextKeyRouteRequest)
	requestContext, ok := requestValue.(pluginruntime.RouteRequestContext)
	if err == nil && hasRenderer && exists && ok {
		body, callErr := pinned.Plugin.Engine.CallMember(c.Request.Context(), "native", "error", requestContext.JSValue(), map[string]any{
			"code":       sanitized.Code,
			"message":    sanitized.Message,
			"httpStatus": sanitized.HTTPStatus,
			"retryable":  sanitized.Retryable,
			"requestId":  requestID,
		})
		if callErr == nil {
			callErr = WriteNativeReply(c, sanitized.HTTPStatus, body)
		}
		if callErr == nil {
			logger.LogDebug(
				c,
				"task_plugin subsystem=route event=error_rendered plugin=%q renderer=plugin status=%d code=%q",
				pinned.Plugin.Meta.Key,
				sanitized.HTTPStatus,
				sanitized.Code,
			)
			return true
		}
		logger.LogWarn(
			c,
			common.LogText("task_plugin subsystem=route event=error_renderer_failed plugin=%q reason=hook_failed status=%d err=%q",
				pinned.Plugin.Meta.Key,
				sanitized.HTTPStatus,
				callErr.Error()),
		)
	}
	logger.LogWarn(
		c,
		common.LogText("task_plugin subsystem=route event=error_rendered plugin=%q renderer=host_fallback status=%d code=%q",
			pinned.Plugin.Meta.Key,
			sanitized.HTTPStatus,
			sanitized.Code),
	)
	message := sanitized.Message
	if requestID != "" {
		message = common.MessageWithRequestId(sanitized.Message, requestID)
	}
	c.JSON(sanitized.HTTPStatus, &dto.TaskError{
		Code:       sanitized.Code,
		Message:    message,
		StatusCode: sanitized.HTTPStatus,
	})
	return true
}

func abortTaskPluginRouteError(c *gin.Context, status int) {
	abortTaskPluginRouteErrorDetail(c, status, "")
}

func abortTaskPluginRouteErrorDetail(c *gin.Context, status int, detail string) {
	taskErr := sanitizedTaskPluginError(status, detail)
	c.Abort()
	if RespondTaskPluginError(c, &dto.TaskError{Code: taskErr.Code, Message: detail, StatusCode: taskErr.HTTPStatus}) {
		return
	}
	message := taskErr.Message
	if requestID := c.GetString(common.RequestIdKey); requestID != "" {
		message = common.MessageWithRequestId(taskErr.Message, requestID)
	}
	c.JSON(taskErr.HTTPStatus, &dto.TaskError{
		Code:       taskErr.Code,
		Message:    message,
		StatusCode: taskErr.HTTPStatus,
	})
}

func sanitizedTaskPluginError(status int, detail string) dto.TaskPluginError {
	var taskErr dto.TaskPluginError
	switch status {
	case http.StatusBadRequest:
		taskErr = dto.TaskPluginError{Code: "invalid_request", Message: "Invalid request", HTTPStatus: status}
	case http.StatusUnauthorized:
		taskErr = dto.TaskPluginError{Code: "authentication_error", Message: "Authentication failed", HTTPStatus: status}
	case http.StatusForbidden:
		taskErr = dto.TaskPluginError{Code: "permission_denied", Message: "Access denied", HTTPStatus: status}
	case http.StatusNotFound:
		taskErr = dto.TaskPluginError{Code: "task_not_found", Message: "Task not found", HTTPStatus: status}
	case http.StatusConflict:
		taskErr = dto.TaskPluginError{Code: "request_conflict", Message: "Request conflict", HTTPStatus: status}
	case http.StatusTooManyRequests:
		taskErr = dto.TaskPluginError{Code: "rate_limit_exceeded", Message: "Too many requests", HTTPStatus: status, Retryable: true}
	default:
		if status < 400 || status > 599 {
			status = http.StatusInternalServerError
		}
		if status < 500 {
			taskErr = dto.TaskPluginError{Code: "invalid_request", Message: "Invalid request", HTTPStatus: status}
		} else {
			taskErr = dto.TaskPluginError{Code: "server_error", Message: "Task request failed", HTTPStatus: status, Retryable: status >= 500}
		}
	}
	if detail != "" && taskErr.HTTPStatus < 500 {
		taskErr.Message = detail
	}
	return taskErr
}

func taskPluginHookDetail(err error) string {
	var hookErr *pluginruntime.HookError
	if errors.As(err, &hookErr) {
		return hookErr.Message
	}
	return ""
}

func logTaskPluginChannelDecision(c *gin.Context, channel *model.Channel, modelName, event, reason string) {
	expectedPlugin := c.GetString("expected_task_plugin_key")
	if expectedPlugin == "" {
		return
	}
	generation := uint64(0)
	if pinnedValue, exists := c.Get(pluginruntime.ContextKeyPinnedPlugin); exists {
		if pinned, ok := pinnedValue.(pluginruntime.PinnedPlugin); ok && pinned.Generation != nil {
			generation = pinned.Generation.Number
		}
	}
	if channel == nil {
		logger.LogDebug(
			c,
			"task_plugin subsystem=distribution event=%s generation=%d plugin=%q model=%q reason=%q",
			event,
			generation,
			expectedPlugin,
			modelName,
			reason,
		)
		return
	}
	identityMode := "legacy_channel_type"
	switch channel.Type {
	case constant.ChannelTypeTaskPlugin:
		identityMode = "type59_setting"
	case constant.ChannelTypeNewAPI:
		identityMode = "type60_setting"
	}
	logger.LogDebug(
		c,
		"task_plugin subsystem=distribution event=%s generation=%d plugin=%q model=%q channel_id=%d channel_type=%d identity_mode=%q reason=%q",
		event,
		generation,
		expectedPlugin,
		modelName,
		channel.Id,
		channel.Type,
		identityMode,
		reason,
	)
}

func PrepareTaskPluginSubmit() gin.HandlerFunc {
	return func(c *gin.Context) {
		pluginKey := strings.TrimSpace(c.Param("key"))
		generation := pluginruntime.DefaultRegistry.Generation()
		plugin, ok := generation.Get(pluginKey)
		if !ok {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "task plugin not found", "type": "invalid_request_error"}})
			return
		}
		c.Set(pluginruntime.ContextKeyPinnedPlugin, pluginruntime.PinnedPlugin{
			Generation: generation,
			Plugin:     plugin,
		})
		logger.LogDebug(
			c,
			"task_plugin subsystem=route event=legacy_entry_pinned generation=%d plugin=%q version=%q",
			generation.Number,
			plugin.Meta.Key,
			plugin.Meta.Version,
		)
		var requestBody map[string]any
		if err := common.UnmarshalBodyReusable(c, &requestBody); err != nil {
			c.AbortWithStatusJSON(invalidRequestStatus(err), gin.H{"error": gin.H{"message": err.Error(), "type": "invalid_request_error"}})
			return
		}
		modelName, _ := requestBody["model"].(string)
		if strings.TrimSpace(modelName) == "" {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "model is required", "type": "invalid_request_error"}})
			return
		}
		exactOwned := slices.Contains(plugin.Meta.Models, modelName)
		exactAlias := false
		if target, resolved := model.ResolveTaskModelAlias(generation, modelName); resolved && target.Alias == modelName && target.PluginKey == plugin.Meta.Key {
			exactAlias = true
		}
		if !exactOwned && !exactAlias {
			folded := ""
			if declared, ok := generation.CanonicalModel(modelName); ok && slices.Contains(plugin.Meta.Models, declared) && declared != modelName {
				folded = declared
			} else if target, resolved := model.ResolveTaskModelAlias(generation, modelName); resolved && target.PluginKey == plugin.Meta.Key && target.Alias != "" && target.Alias != modelName {
				folded = target.Alias
			}
			if folded != "" {
				if rewriteErr := rewriteTaskPluginJSONModel(c, folded); rewriteErr != nil {
					c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": rewriteErr.Error(), "type": "invalid_request_error"}})
					return
				}
				requestBody["model"] = folded
				modelName = folded
			}
		}
		c.Set("task_request", requestBody)
		if plugin.Meta.PreservesJSONOrder() {
			// The body as stored after any model rewrite: the text hooks get.
			storage, err := common.GetBodyStorage(c)
			var raw []byte
			if err == nil {
				raw, err = storage.Bytes()
			}
			if err != nil {
				c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error(), "type": "invalid_request_error"}})
				return
			}
			c.Set(pluginruntime.ContextKeyRequestBodyText, json.RawMessage(raw))
		}
		c.Set("resolved_task_model", modelName)
		c.Set("expected_task_plugin_key", pluginKey)
		service.AppendTaskPluginIdentityFilter(c, pluginKey)
		c.Set("relay_mode", relayconstant.RelayModeVideoSubmit)
		logger.LogDebug(
			c,
			"task_plugin subsystem=route event=resolved generation=%d plugin=%q kind=submit model=%q distribute=true entry=legacy",
			generation.Number,
			plugin.Meta.Key,
			modelName,
		)
		c.Next()
	}
}
