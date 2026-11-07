package middleware

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"io"
	"mime"
	"mime/multipart"
	"net"
	"net/http"
	"net/url"
	"path"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	pluginruntime "github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"golang.org/x/net/http/httpguts"
)

// EstimateTarget restores a target request after the outer credential has been checked.
// resolveTarget matches against the real relay route registrations.
func EstimateTarget(resolveTarget func(method, targetPath string, generation *pluginruntime.RoutingGeneration) (types.RelayFormat, bool)) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		var envelope struct {
			Method     string          `json:"method"`
			Path       string          `json:"path"`
			Headers    http.Header     `json:"headers"`
			Body       json.RawMessage `json:"body"`
			BodyBase64 *string         `json:"body_base64"`
			MediaInfo  json.RawMessage `json:"media_info"`
		}
		if err := common.UnmarshalBodyReusable(c, &envelope); err != nil {
			status := http.StatusBadRequest
			if common.IsRequestBodyTooLargeError(err) {
				status = http.StatusRequestEntityTooLarge
			}
			abortWithOpenAiMessage(c, status, i18n.T(c, i18n.MsgEstimateInvalidRequest))
			return
		}
		target, err := url.ParseRequestURI(envelope.Path)
		if err != nil {
			abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgEstimateInvalidRequest))
			return
		}
		cleanPath := path.Clean(target.Path)
		nonCanonicalPath := cleanPath != target.Path && cleanPath+"/" != target.Path
		if target.IsAbs() || target.Host != "" || strings.HasPrefix(envelope.Path, "//") || strings.Contains(envelope.Path, "#") || nonCanonicalPath || strings.ContainsAny(target.Path, "\\\x00") {
			abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgEstimateInvalidRequest))
			return
		}
		query, err := url.ParseQuery(target.RawQuery)
		if err != nil || (len(envelope.Body) > 0 && envelope.BodyBase64 != nil) {
			abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgEstimateInvalidRequest))
			return
		}
		envelope.Method = strings.ToUpper(strings.TrimSpace(envelope.Method))
		if !httpguts.ValidHeaderFieldName(envelope.Method) {
			abortWithOpenAiMessage(c, http.StatusUnprocessableEntity, i18n.T(c, i18n.MsgEstimateUnsupported))
			return
		}
		generation := pluginruntime.DefaultRegistry.Generation()
		relayFormat, supported := resolveTarget(envelope.Method, target.Path, generation)
		if !supported {
			abortWithOpenAiMessage(c, http.StatusUnprocessableEntity, i18n.T(c, i18n.MsgEstimateUnsupported))
			return
		}
		c.Set(requestEstimateGenerationKey, generation)
		taskPluginKey := ""
		if relayFormat == types.RelayFormatTask {
			parts := strings.Split(strings.Trim(target.Path, "/"), "/")
			if len(parts) == 3 && parts[0] == "v1" && parts[1] == "tasks" && strings.TrimSpace(parts[2]) != "" {
				taskPluginKey = parts[2]
			} else if len(parts) == 4 && parts[0] == "v1" && parts[1] == "videos" && parts[3] == "remix" {
				c.Params = append(c.Params, gin.Param{Key: "video_id", Value: parts[2]})
			} else {
				route, params, nativeRoute := generation.LookupDeclaredRequestRouteParams(envelope.Method, target.Path)
				_, _, protocolOperation := pluginruntime.LookupHostProtocolOperation(envelope.Method, target.Path)
				if nativeRoute {
					c.Set(pluginruntime.ContextKeyPinnedRoute, pluginruntime.PinnedRoute{Generation: generation, Plugin: route.Plugin, Route: route.Route})
					c.Set(requestEstimateNativeParamsKey, params)
					c.Set(requestEstimatePluginTargetKey, true)
				} else if protocolOperation {
					c.Set(requestEstimatePluginTargetKey, true)
				} else {
					abortWithOpenAiMessage(c, http.StatusUnprocessableEntity, i18n.T(c, i18n.MsgEstimateUnsupported))
					return
				}
			}
		}
		body := []byte(envelope.Body)
		if envelope.BodyBase64 != nil {
			body, err = base64.StdEncoding.Strict().DecodeString(*envelope.BodyBase64)
			if err != nil {
				abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgEstimateInvalidRequest), types.ErrorCodeInvalidRequest)
				return
			}
		}
		if len(body) == 0 {
			abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgEstimateInvalidRequest))
			return
		}
		headers := make(http.Header)
		for name, values := range envelope.Headers {
			if !httpguts.ValidHeaderFieldName(name) {
				abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgEstimateInvalidRequest))
				return
			}
			for _, value := range values {
				if !httpguts.ValidHeaderFieldValue(value) {
					abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgEstimateInvalidRequest))
					return
				}
			}
			switch strings.ToLower(name) {
			case "authorization", "proxy-authorization", "x-api-key", "x-goog-api-key", "mj-api-secret", "cookie", "host", "forwarded", "x-real-ip", "x-client-ip", "true-client-ip", "cf-connecting-ip", "connection", "upgrade", "content-length", "transfer-encoding", "content-encoding":
				continue
			}
			if strings.HasPrefix(strings.ToLower(name), "x-forwarded-") || strings.HasPrefix(strings.ToLower(name), "sec-websocket-") {
				continue
			}
			for _, value := range values {
				headers.Add(name, value)
			}
		}
		if headers.Get("Content-Type") == "" {
			headers.Set("Content-Type", "application/json")
		}
		mediaType, _, err := mime.ParseMediaType(headers.Get("Content-Type"))
		if err != nil {
			abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgEstimateInvalidRequest))
			return
		}
		if mediaType != "application/json" && mediaType != "multipart/form-data" {
			abortWithOpenAiMessage(c, http.StatusUnprocessableEntity, i18n.T(c, i18n.MsgEstimateUnsupported))
			return
		}
		maxBodyMB := constant.MaxRequestBodyMB
		if maxBodyMB <= 0 {
			maxBodyMB = 128
		}
		if int64(len(body)) > int64(maxBodyMB)<<20 {
			abortWithOpenAiMessage(c, http.StatusRequestEntityTooLarge, i18n.T(c, i18n.MsgEstimateInvalidRequest))
			return
		}
		var multipartForm *multipart.Form
		if mediaType == "multipart/form-data" {
			_, params, _ := mime.ParseMediaType(headers.Get("Content-Type"))
			boundary := params["boundary"]
			if boundary == "" {
				abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgEstimateInvalidRequest))
				return
			}
			maxFileMB := constant.MaxFileDownloadMB
			if maxFileMB <= 0 {
				maxFileMB = 64
			}
			form, formErr := multipart.NewReader(bytes.NewReader(body), boundary).ReadForm(32 << 20)
			if formErr != nil {
				abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgEstimateInvalidRequest), types.ErrorCodeInvalidRequest)
				return
			}
			multipartForm = form
			tooLarge := false
			for _, files := range form.File {
				for _, file := range files {
					if file.Size > int64(maxFileMB)<<20 {
						tooLarge = true
					}
				}
			}
			_ = form.RemoveAll()
			if tooLarge {
				abortWithOpenAiMessage(c, http.StatusRequestEntityTooLarge, i18n.T(c, i18n.MsgEstimateInvalidRequest))
				return
			}
		} else if envelope.BodyBase64 != nil || (len(envelope.MediaInfo) > 0 && string(envelope.MediaInfo) != "null") {
			var jsonBody any
			if common.Unmarshal(body, &jsonBody) != nil {
				abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgEstimateInvalidRequest))
				return
			}
		}
		mediaInfo, mediaErr := common.ParseRequestEstimateMediaInfo(envelope.MediaInfo, body)
		if mediaErr != nil {
			abortWithOpenAiMessage(c, http.StatusBadRequest, mediaErr.Error(), types.ErrorCodeInvalidRequest)
			return
		}
		for _, fact := range mediaInfo {
			if fact.Field != "" && (multipartForm == nil || fact.Index >= len(multipartForm.File[fact.Field])) {
				abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgEstimateInvalidRequest), types.ErrorCodeInvalidRequest)
				return
			}
		}
		query.Del("key")
		// Keep the original query bytes unless an identity parameter must be removed.
		if _, present := target.Query()["key"]; present {
			target.RawQuery = query.Encode()
		}
		outer := c.Request
		clientIP := c.ClientIP()
		inner := outer.Clone(outer.Context())
		inner.Method, inner.URL, inner.Header = envelope.Method, target, headers
		inner.Host = ""
		inner.RequestURI = target.RequestURI()
		inner.RemoteAddr = net.JoinHostPort(clientIP, "0")
		inner.Body = io.NopCloser(bytes.NewReader(body))
		inner.ContentLength = int64(len(body))
		common.CleanupBodyStorage(c)
		c.Request = inner
		defer func() { common.CleanupBodyStorage(c); c.Request = outer }()
		c.Set("estimate_relay_format", relayFormat)
		c.Set("request_estimate", true)
		if taskPluginKey != "" {
			plugin, exists := generation.Get(taskPluginKey)
			if !exists {
				abortWithOpenAiMessage(c, http.StatusUnprocessableEntity, i18n.T(c, i18n.MsgEstimateUnsupported))
				return
			}
			if status, message := prepareTaskPluginSubmitRequest(c, taskPluginKey, generation, plugin); status != 0 {
				abortWithOpenAiMessage(c, status, message, types.ErrorCodeInvalidRequest)
				return
			}
			c.Set("task_plugin_key", taskPluginKey)
			c.Set("platform", taskPluginKey)
		}
		if relayFormat != types.RelayFormatTask {
			if _, _, protocolOperation := pluginruntime.LookupHostProtocolOperation(envelope.Method, target.Path); protocolOperation {
				c.Set(requestEstimatePluginTargetKey, true)
			}
		}
		if len(mediaInfo) > 0 {
			c.Set(common.RequestEstimateMediaInfoContextKey, mediaInfo)
		}
		c.Next()
	}
}
