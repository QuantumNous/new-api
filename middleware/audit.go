package middleware

import (
	"bytes"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// auditResponseWriter wraps gin.ResponseWriter, captures the response status code and copies the response body to
// A buffer of limited size, used to determine whether the business is successful (parsing the success field of the response JSON).
// The buffer has an upper limit to prevent large responses (such as key export) from occupying too much memory; if the upper limit is exceeded, it will no longer be cached.
// At this time, success or failure is determined only based on the HTTP status code.
type auditResponseWriter struct {
	gin.ResponseWriter
	body    *bytes.Buffer
	maxSize int
}

func (w *auditResponseWriter) Write(b []byte) (int, error) {
	if w.body.Len() < w.maxSize {
		remain := w.maxSize - w.body.Len()
		if remain >= len(b) {
			w.body.Write(b)
		} else {
			w.body.Write(b[:remain])
		}
	}
	return w.ResponseWriter.Write(b)
}

func (w *auditResponseWriter) WriteString(s string) (int, error) {
	return w.Write([]byte(s))
}

// auditRouteActions maps "METHOD + route template" to a language-independent operation identifier action.
// These are write operations that have not been manually buried by the handler, and are recorded by the middleware; the front end uses i18n localization for display based on the action.
// Missed write operations fall back to action="generic", and the front end displays "METHOD route".
var auditRouteActions = map[string]string{
	// User management
	"POST /api/user/topup/complete":                    "user.topup_complete",
	"DELETE /api/user/:id/reset_passkey":               "user.reset_passkey",
	"DELETE /api/user/:id/oauth/bindings/:provider_id": "user.oauth_unbind",

	// System settings (root)
	"POST /api/option/payment_compliance":       "option.payment_compliance",
	"POST /api/option/rest_model_ratio":         "option.reset_ratio",
	"DELETE /api/option/channel_affinity_cache": "option.clear_affinity_cache",

	// Custom OAuth (root)
	"POST /api/custom-oauth-provider/":      "custom_oauth.create",
	"PUT /api/custom-oauth-provider/:id":    "custom_oauth.update",
	"DELETE /api/custom-oauth-provider/:id": "custom_oauth.delete",

	// Performance/Cache (root)
	"DELETE /api/performance/disk_cache": "performance.clear_disk_cache",
	"POST /api/performance/gc":           "performance.gc",
	"DELETE /api/performance/logs":       "performance.clear_logs",

	// Redeem code
	"PUT /api/redemption/":           "redemption.update",
	"POST /api/redemption/batch":     "redemption.delete_batch",
	"DELETE /api/redemption/:id":     "redemption.delete",
	"DELETE /api/redemption/invalid": "redemption.delete_invalid",

	// prefilled group
	"POST /api/prefill_group/":      "prefill_group.create",
	"PUT /api/prefill_group/":       "prefill_group.update",
	"DELETE /api/prefill_group/:id": "prefill_group.delete",

	// supplier
	"POST /api/vendors/":      "vendor.create",
	"PUT /api/vendors/":       "vendor.update",
	"DELETE /api/vendors/:id": "vendor.delete",

	// Model metadata
	"POST /api/models/":              "model.create",
	"PUT /api/models/":               "model.update",
	"DELETE /api/models/:id":         "model.delete",
	"POST /api/models/sync_upstream": "model.sync_upstream",

	// deploy
	"POST /api/deployments/":      "deployment.create",
	"PUT /api/deployments/:id":    "deployment.update",
	"DELETE /api/deployments/:id": "deployment.delete",

	// Subscribe (Admin)
	"POST /api/subscription/admin/plans":    "subscription.plan_create",
	"PUT /api/subscription/admin/plans/:id": "subscription.plan_update",
	"POST /api/subscription/admin/bind":     "subscription.bind",

	// Log
	"POST /api/system-task/log-cleanup": "log.cleanup_start",
}

// beginAdminAudit wraps the ResponseWriter before the management/root write operation enters the handler.
// In order to analyze the response afterwards to determine whether the business was successful. Only effective for write methods (POST/PUT/PATCH/DELETE);
// Read-only requests return nil, allowing the caller to skip post-mortem logging.
//
// This function is called by authHelper before authentication, c.Next(): because any management/root interface
// It must go through AdminAuth/RootAuth and integrate the auditing into the authentication link to ensure that "new interfaces automatically leave traces".
// There is no need to install a separate layer of audit middleware on the routing (to avoid missing connections).
func beginAdminAudit(c *gin.Context) *auditResponseWriter {
	method := c.Request.Method
	if method != "POST" && method != "PUT" && method != "PATCH" && method != "DELETE" {
		return nil
	}
	writer := &auditResponseWriter{
		ResponseWriter: c.Writer,
		body:           bytes.NewBuffer(nil),
		maxSize:        64 * 1024,
	}
	c.Writer = writer
	return writer
}

// finishAdminAudit makes a thorough audit record of management/high-risk write operations after c.Next().
// If the handler has been manually embedded (ContextKeyAuditLogged is set), it will be skipped to avoid duplication.
func finishAdminAudit(c *gin.Context, writer *auditResponseWriter) {
	if writer == nil {
		return
	}
	method := c.Request.Method

	// The handler has manually recorded more detailed audit logs, skipping the details.
	if common.GetContextKeyBool(c, constant.ContextKeyAuditLogged) {
		return
	}

	operatorId := c.GetInt("id")
	operatorName := c.GetString("username")
	operatorRole := c.GetInt("role")
	ip := c.ClientIP()
	status := writer.Status()
	success := auditResponseSuccess(status, writer.body.Bytes())

	route := c.FullPath()
	action := auditRouteActions[method+" "+route]
	if action == "" {
		action = "generic"
	}

	routeParams := map[string]string{}
	for _, p := range c.Params {
		routeParams[p.Key] = p.Value
	}

	// op.params are language-independent parameters for front-end i18n rendering; generic carries method/route.
	opParams := map[string]any{}
	if action == "generic" {
		opParams["method"] = method
		opParams["route"] = route
	}

	// content is the English summary text (for non-localized consumers such as export).
	content := method + " " + route

	adminInfo := &model.AuditAdminInfo{
		AdminID:       operatorId,
		AdminUsername: operatorName,
		AdminRole:     operatorRole,
		AuthMethod:    auditAuthMethod(c),
	}
	auditInfo := &model.AuditRequestInfo{
		Method:  method,
		Route:   route,
		Path:    route,
		Status:  status,
		Success: success,
		Params:  routeParams,
	}

	model.RecordOperationAuditLog(operatorId, operatorRole, content, ip, action, opParams, adminInfo, auditInfo, c)
}

func auditAuthMethod(c *gin.Context) string {
	if c.GetBool("use_access_token") {
		return "access_token"
	}
	return "session"
}

// auditResponseSuccess infers whether the operation was successful based on the HTTP status code and response body.
// Prioritize parsing the success field in the response JSON; if it cannot be parsed, it will fall back to status code judgment.
func auditResponseSuccess(status int, body []byte) bool {
	if status >= 400 {
		return false
	}
	trimmed := bytes.TrimSpace(body)
	if len(trimmed) > 0 && trimmed[0] == '{' {
		var resp struct {
			Success *bool `json:"success"`
		}
		if err := common.Unmarshal(trimmed, &resp); err == nil && resp.Success != nil {
			return *resp.Success
		}
	}
	return status < 400
}

const accessTokenAuditContextKey = "access_token_request_audit"

// TokenOperationAudit runs after UserAuth and before endpoint rate limits.
// Handlers add only allowlisted metadata; neither bodies nor raw errors are persisted.
func TokenOperationAudit() gin.HandlerFunc {
	return func(c *gin.Context) {
		var action, content string
		switch c.Request.Method + " " + c.FullPath() {
		case "POST /api/token/":
			action, content = "token.create", "API token creation"
		case "PUT /api/token/":
			action, content = "token.update", "API token configuration update"
			if c.Query("status_only") != "" {
				action, content = "token.status_update", "API token status update"
			}
		case "DELETE /api/token/:id":
			action, content = "token.delete", "API token deletion"
		case "POST /api/token/batch":
			action, content = "token.delete_batch", "API token batch deletion"
		case "POST /api/token/:id/key":
			action, content = "token.key_view", "API token key access"
		case "POST /api/token/batch/keys":
			action, content = "token.key_view_batch", "API token batch key access"
		default:
			c.Next()
			return
		}

		params := model.AuditFields{}
		if id, err := strconv.Atoi(c.Param("id")); err == nil && id > 0 {
			params["id"] = id
		}
		common.SetContextKey(c, constant.ContextKeyTokenAuditParams, params)
		entry := model.AuditLog{
			UserId: c.GetInt("id"), Username: c.GetString("username"), ActorRole: c.GetInt("role"),
			Category: model.AuditCategorySecurity, Action: action, Content: content,
			Other: model.AuditOther{Op: &model.AuditOperation{Action: action, Params: params}},
		}
		writer := &auditResponseWriter{ResponseWriter: c.Writer, body: bytes.NewBuffer(nil), maxSize: 64 * 1024}
		c.Writer = writer
		c.Next()
		entry.Status = writer.Status()
		entry.Success = auditResponseSuccess(entry.Status, writer.body.Bytes())
		if writer.body.Len() == writer.maxSize {
			// JSON may be truncated before its success field. A completed handler
			// supplies the result without retaining an unbounded response body.
			entry.Success = entry.Status < 400 && common.GetContextKeyBool(c, constant.ContextKeyTokenAuditSucceeded)
		}
		model.RecordAuditLog(c, entry)
	}
}

type accessTokenRequestAudit struct {
	entry  model.AuditLog
	writer *auditResponseWriter
}

// AccessTokenAudit also captures public reads and rejections before route-level
// authentication (for example, rate limiting). It does not grant authentication.
func AccessTokenAudit() gin.HandlerFunc {
	return func(c *gin.Context) {
		raw, present := authorizationToken(c.GetHeader("Authorization"))
		if present {
			_, internal, _ := service.ParseDashboardAccessToken(raw)
			if !internal {
				if lookup := lookupAccessToken(c, raw); lookup.user != nil {
					beginAccessTokenAudit(c, lookup.user, lookup.ref)
					defer finishAccessTokenAudit(c)
				}
			}
		}
		c.Next()
	}
}

func beginAccessTokenAudit(c *gin.Context, user *model.UserBase, tokenRef string) {
	if _, exists := c.Get(accessTokenAuditContextKey); exists {
		return
	}
	writer := &auditResponseWriter{ResponseWriter: c.Writer, body: bytes.NewBuffer(nil), maxSize: 64 * 1024}
	c.Writer = writer
	c.Set(accessTokenAuditContextKey, &accessTokenRequestAudit{
		entry:  model.AuditLog{UserId: user.Id, Username: user.Username, ActorRole: user.Role, Category: model.AuditCategoryAccessToken, AuthMethod: "access_token", TokenRef: tokenRef, CreatedAt: common.GetTimestamp(), EventId: common.NewRequestId()},
		writer: writer,
	})
}

// setAccessTokenAuditParam adds non-secret context, such as why a token was
// rejected, to the current request's access audit entry.
func setAccessTokenAuditParam(c *gin.Context, key string, value any) {
	stored, _ := c.Get(accessTokenAuditContextKey)
	audit, ok := stored.(*accessTokenRequestAudit)
	if !ok {
		return
	}
	if audit.entry.Other.Op == nil {
		audit.entry.Other.Op = &model.AuditOperation{Params: model.AuditFields{}}
	}
	audit.entry.Other.Op.Params[key] = value
}

func finishAccessTokenAudit(c *gin.Context) {
	value, exists := c.Get(accessTokenAuditContextKey)
	if !exists {
		return
	}
	audit, ok := value.(*accessTokenRequestAudit)
	if !ok {
		return
	}
	audit.entry.Status = audit.writer.Status()
	audit.entry.Success = auditResponseSuccess(audit.entry.Status, audit.writer.body.Bytes())
	model.RecordAuditLog(c, audit.entry)
}
