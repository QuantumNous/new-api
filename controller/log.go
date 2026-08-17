package controller

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type userLogDTO struct {
	Id               int             `json:"id"`
	CreatedAt        int64           `json:"created_at"`
	Type             int             `json:"type"`
	Content          string          `json:"content"`
	TokenName        string          `json:"token_name"`
	ModelName        string          `json:"model_name"`
	ChannelName      string          `json:"channel_name"`
	Quota            int             `json:"quota"`
	PromptTokens     int             `json:"prompt_tokens"`
	CompletionTokens int             `json:"completion_tokens"`
	UseTime          int             `json:"use_time"`
	IsStream         bool            `json:"is_stream"`
	Other            json.RawMessage `json:"other,omitempty"`
}

type operationLogActorDTO struct {
	Id         int    `json:"id"`
	Username   string `json:"username"`
	Role       *int   `json:"role,omitempty"`
	AuthMethod string `json:"auth_method,omitempty"`
}

type operationLogRequestDTO struct {
	Method  string `json:"method,omitempty"`
	Route   string `json:"route,omitempty"`
	Path    string `json:"path,omitempty"`
	Status  *int   `json:"status,omitempty"`
	Success *bool  `json:"success,omitempty"`
}

type operationLogDTO struct {
	Id        int                     `json:"id"`
	CreatedAt int64                   `json:"created_at"`
	Kind      string                  `json:"kind"`
	Action    string                  `json:"action,omitempty"`
	Params    map[string]interface{}  `json:"params,omitempty"`
	Content   string                  `json:"content"`
	Actor     operationLogActorDTO    `json:"actor"`
	Ip        string                  `json:"ip,omitempty"`
	UserAgent string                  `json:"user_agent,omitempty"`
	Request   *operationLogRequestDTO `json:"request,omitempty"`
}

func operationLogMap(value interface{}) map[string]interface{} {
	result, _ := value.(map[string]interface{})
	return result
}

func operationLogString(value interface{}) string {
	result, _ := value.(string)
	return result
}

func operationLogInt(value interface{}) *int {
	var result int
	switch typed := value.(type) {
	case int:
		result = typed
	case int64:
		result = int(typed)
	case float64:
		result = int(typed)
	case json.Number:
		parsed, err := strconv.Atoi(typed.String())
		if err != nil {
			return nil
		}
		result = parsed
	case string:
		parsed, err := strconv.Atoi(typed)
		if err != nil {
			return nil
		}
		result = parsed
	default:
		return nil
	}
	return &result
}

func operationLogBool(value interface{}) *bool {
	result, ok := value.(bool)
	if !ok {
		return nil
	}
	return &result
}

func operationLogKind(logType int) string {
	switch logType {
	case model.LogTypeManage:
		return "manage"
	case model.LogTypeSystem:
		return "system"
	case model.LogTypeLogin:
		return "login"
	default:
		return "unknown"
	}
}

func operationLogSensitiveKey(key string) bool {
	normalized := strings.ToLower(strings.ReplaceAll(key, "-", "_"))
	if strings.Contains(normalized, "password") || strings.Contains(normalized, "secret") {
		return true
	}
	if normalized == "token" || strings.HasSuffix(normalized, "_token") {
		return true
	}
	switch normalized {
	case "api_key", "apikey", "authorization", "cookie", "set_cookie":
		return true
	default:
		return false
	}
}

func sanitizeOperationLogValue(value interface{}) interface{} {
	switch typed := value.(type) {
	case map[string]interface{}:
		result := make(map[string]interface{}, len(typed))
		for key, nested := range typed {
			if !operationLogSensitiveKey(key) {
				result[key] = sanitizeOperationLogValue(nested)
			}
		}
		return result
	case []interface{}:
		result := make([]interface{}, len(typed))
		for index, nested := range typed {
			result[index] = sanitizeOperationLogValue(nested)
		}
		return result
	default:
		return value
	}
}

func sanitizeOperationLogParams(value interface{}) map[string]interface{} {
	params := operationLogMap(value)
	if params == nil {
		return nil
	}
	return sanitizeOperationLogValue(params).(map[string]interface{})
}

func buildOperationLogDTO(log *model.Log) operationLogDTO {
	other, _ := common.StrToMap(log.Other)
	op := operationLogMap(other["op"])
	adminInfo := operationLogMap(other["admin_info"])
	auditInfo := operationLogMap(other["audit_info"])

	actorId := log.UserId
	if value := operationLogInt(adminInfo["admin_id"]); value != nil {
		actorId = *value
	}
	actorUsername := log.Username
	if value := operationLogString(adminInfo["admin_username"]); value != "" {
		actorUsername = value
	}
	authMethod := operationLogString(adminInfo["auth_method"])
	if authMethod == "" {
		authMethod = operationLogString(auditInfo["auth_method"])
	}
	if authMethod == "" && log.Type == model.LogTypeLogin {
		authMethod = operationLogString(other["login_method"])
	}
	actorRole := operationLogInt(adminInfo["admin_role"])
	if actorRole == nil {
		actorRole = operationLogInt(auditInfo["actor_role"])
	}
	if actorRole == nil && log.Type == model.LogTypeLogin {
		actorRole = operationLogInt(other["user_role"])
	}
	userAgent := operationLogString(other["user_agent"])
	if userAgent == "" {
		userAgent = operationLogString(auditInfo["user_agent"])
	}

	var request *operationLogRequestDTO
	if len(auditInfo) > 0 {
		request = &operationLogRequestDTO{
			Method:  operationLogString(auditInfo["method"]),
			Route:   operationLogString(auditInfo["route"]),
			Path:    operationLogString(auditInfo["path"]),
			Status:  operationLogInt(auditInfo["status"]),
			Success: operationLogBool(auditInfo["success"]),
		}
	}

	return operationLogDTO{
		Id:        log.Id,
		CreatedAt: log.CreatedAt,
		Kind:      operationLogKind(log.Type),
		Action:    operationLogString(op["action"]),
		Params:    sanitizeOperationLogParams(op["params"]),
		Content:   log.Content,
		Actor: operationLogActorDTO{
			Id:         actorId,
			Username:   actorUsername,
			Role:       actorRole,
			AuthMethod: authMethod,
		},
		Ip:        log.Ip,
		UserAgent: userAgent,
		Request:   request,
	}
}

func buildUserLogDTOs(logs []*model.Log) []userLogDTO {
	result := make([]userLogDTO, 0, len(logs))
	for _, log := range logs {
		if log == nil {
			continue
		}
		other := json.RawMessage(nil)
		if json.Valid([]byte(log.Other)) && log.Other != "{}" {
			other = json.RawMessage(log.Other)
		}
		result = append(result, userLogDTO{
			Id:               log.Id,
			CreatedAt:        log.CreatedAt,
			Type:             log.Type,
			Content:          log.Content,
			TokenName:        log.TokenName,
			ModelName:        log.ModelName,
			ChannelName:      log.ChannelName,
			Quota:            log.Quota,
			PromptTokens:     log.PromptTokens,
			CompletionTokens: log.CompletionTokens,
			UseTime:          log.UseTime,
			IsStream:         log.IsStream,
			Other:            other,
		})
	}
	return result
}

func GetAllLogs(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	username := c.Query("username")
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	channel, _ := strconv.Atoi(c.Query("channel"))
	group := c.Query("group")
	requestId := c.Query("request_id")
	upstreamRequestId := c.Query("upstream_request_id")
	logs, total, err := model.GetAllLogs(logType, startTimestamp, endTimestamp, modelName, username, tokenName, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), channel, group, requestId, upstreamRequestId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	common.ApiSuccess(c, pageInfo)
	return
}

func GetUserLogs(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	userId := c.GetInt("id")
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	group := c.Query("group")
	requestId := c.Query("request_id")
	upstreamRequestId := c.Query("upstream_request_id")
	keyword := strings.TrimSpace(c.Query("keyword"))
	if len(keyword) > 128 {
		common.ApiErrorMsg(c, "keyword is too long")
		return
	}
	logs, total, err := model.GetUserLogs(userId, logType, startTimestamp, endTimestamp, modelName, tokenName, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), group, requestId, upstreamRequestId, keyword)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(buildUserLogDTOs(logs))
	common.ApiSuccess(c, pageInfo)
	return
}

func GetOperationLogs(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	kind := strings.TrimSpace(c.DefaultQuery("kind", "all"))
	logTypes := []int{model.LogTypeManage, model.LogTypeSystem, model.LogTypeLogin}
	switch kind {
	case "", "all":
	case "manage":
		logTypes = []int{model.LogTypeManage}
	case "system":
		logTypes = []int{model.LogTypeSystem}
	case "login":
		logTypes = []int{model.LogTypeLogin}
	default:
		common.ApiErrorMsg(c, "invalid operation log kind")
		return
	}

	keyword := strings.TrimSpace(c.Query("keyword"))
	if len(keyword) > 128 {
		common.ApiErrorMsg(c, "keyword is too long")
		return
	}
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	if startTimestamp > 0 && endTimestamp > 0 && startTimestamp > endTimestamp {
		common.ApiErrorMsg(c, "invalid date range")
		return
	}

	logs, total, err := model.GetOperationLogs(
		logTypes,
		keyword,
		startTimestamp,
		endTimestamp,
		pageInfo.GetStartIdx(),
		pageInfo.GetPageSize(),
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	items := make([]operationLogDTO, 0, len(logs))
	for _, log := range logs {
		if log != nil {
			items = append(items, buildOperationLogDTO(log))
		}
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

// Deprecated: SearchAllLogs 已废弃，前端未使用该接口。
func SearchAllLogs(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": false,
		"message": "该接口已废弃",
	})
}

// Deprecated: SearchUserLogs 已废弃，前端未使用该接口。
func SearchUserLogs(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": false,
		"message": "该接口已废弃",
	})
}

func GetLogByKey(c *gin.Context) {
	tokenId := c.GetInt("token_id")
	if tokenId == 0 {
		c.JSON(200, gin.H{
			"success": false,
			"message": "无效的令牌",
		})
		return
	}
	logs, err := model.GetLogByTokenId(tokenId)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(200, gin.H{
		"success": true,
		"message": "",
		"data":    logs,
	})
}

func GetLogsStat(c *gin.Context) {
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	username := c.Query("username")
	modelName := c.Query("model_name")
	channel, _ := strconv.Atoi(c.Query("channel"))
	group := c.Query("group")
	stat, err := model.SumUsedQuota(logType, startTimestamp, endTimestamp, modelName, username, tokenName, channel, group)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	//tokenNum := model.SumUsedToken(logType, startTimestamp, endTimestamp, modelName, username, "")
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"quota": stat.Quota,
			"rpm":   stat.Rpm,
			"tpm":   stat.Tpm,
		},
	})
	return
}

func GetLogsSelfStat(c *gin.Context) {
	userId := c.GetInt("id")
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	channel, _ := strconv.Atoi(c.Query("channel"))
	group := c.Query("group")
	quotaNum, err := model.SumUsedQuotaForUser(userId, logType, startTimestamp, endTimestamp, modelName, tokenName, channel, group)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	overview, err := model.GetSelfLogStat(userId, time.Now())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	//tokenNum := model.SumUsedToken(logType, startTimestamp, endTimestamp, modelName, username, tokenName)
	c.JSON(200, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"quota":          quotaNum.Quota,
			"rpm":            quotaNum.Rpm,
			"tpm":            quotaNum.Tpm,
			"total_requests": overview.TotalRequests,
			"total_quota":    overview.TotalQuota,
			"today_requests": overview.TodayRequests,
			"today_quota":    overview.TodayQuota,
			//"token": tokenNum,
		},
	})
	return
}
