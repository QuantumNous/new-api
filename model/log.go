package model

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"

	"github.com/bytedance/gopkg/util/gopool"
	"gorm.io/gorm"
)

func applyExplicitLogTextFilter(tx *gorm.DB, column string, value string) (*gorm.DB, error) {
	if value == "" {
		return tx, nil
	}
	if strings.Contains(value, "%") {
		pattern, err := sanitizeLikePattern(value)
		if err != nil {
			return nil, err
		}
		return tx.Where(column+" LIKE ? ESCAPE '!'", pattern), nil
	}
	return tx.Where(column+" = ?", value), nil
}

type LogSearchFilters struct {
	LogType           int
	StartTimestamp    int64
	EndTimestamp      int64
	ModelName         string
	Username          string
	TokenName         string
	Channel           int
	Group             string
	RequestId         string
	UpstreamRequestId string
	Content           string
	Endpoint          string
	StatusCode        *int
	SessionId         string
	UserAgent         string
	IsStream          *bool
	ReasoningEffort   string
	BillingSource     string
}

func escapeLikeLiteral(value string) string {
	value = strings.ReplaceAll(value, "!", "!!")
	value = strings.ReplaceAll(value, "%", "!%")
	value = strings.ReplaceAll(value, "_", "!_")
	return value
}

func containsLikePattern(value string) (string, error) {
	if strings.Contains(value, "%") {
		return sanitizeLikePattern(value)
	}
	return "%" + escapeLikeLiteral(value) + "%", nil
}

func applyLogOtherStringContainsFilter(tx *gorm.DB, key string, value string) (*gorm.DB, error) {
	if value == "" {
		return tx, nil
	}
	pattern, err := containsLikePattern(value)
	if err != nil {
		return nil, err
	}
	prefix := "%" + escapeLikeLiteral(fmt.Sprintf(`"%s":"`, key))
	return tx.Where("logs.other LIKE ? ESCAPE '!'", prefix+pattern), nil
}

func logOtherStringExactPattern(key string, value string) (string, error) {
	encoded, err := common.Marshal(value)
	if err != nil {
		return "", err
	}
	needle := fmt.Sprintf(`"%s":%s`, key, string(encoded))
	return "%" + escapeLikeLiteral(needle) + "%", nil
}

func applyLogOtherStringExactFilter(tx *gorm.DB, key string, value string) (*gorm.DB, error) {
	if value == "" {
		return tx, nil
	}
	pattern, err := logOtherStringExactPattern(key, value)
	if err != nil {
		return nil, err
	}
	return tx.Where("logs.other LIKE ? ESCAPE '!'", pattern), nil
}

func logOtherStatusCodePatterns(statusCode int) []string {
	status := fmt.Sprintf("%d", statusCode)
	patterns := make([]string, 0, 4)
	for _, suffix := range []string{",", "}"} {
		patterns = append(patterns, "%"+escapeLikeLiteral(fmt.Sprintf(`"status_code":%s%s`, status, suffix))+"%")
		patterns = append(patterns, "%"+escapeLikeLiteral(fmt.Sprintf(`"status_code":"%s"%s`, status, suffix))+"%")
	}
	return patterns
}

func applyLogStatusCodeFilter(tx *gorm.DB, statusCode *int) *gorm.DB {
	if statusCode == nil {
		return tx
	}

	clauses := make([]string, 0, 5)
	args := make([]interface{}, 0, 5)
	if *statusCode == 200 {
		clauses = append(clauses, "logs.type = ?")
		args = append(args, LogTypeConsume)
	}
	for _, pattern := range logOtherStatusCodePatterns(*statusCode) {
		clauses = append(clauses, "logs.other LIKE ? ESCAPE '!'")
		args = append(args, pattern)
	}
	return tx.Where("("+strings.Join(clauses, " OR ")+")", args...)
}

func applyBillingSourceFilter(tx *gorm.DB, billingSource string) (*gorm.DB, error) {
	switch billingSource {
	case "":
		return tx, nil
	case "subscription":
		return applyLogOtherStringExactFilter(tx, "billing_source", billingSource)
	case "wallet":
		subscriptionPattern, err := logOtherStringExactPattern("billing_source", "subscription")
		if err != nil {
			return nil, err
		}
		return tx.Where("logs.other NOT LIKE ? ESCAPE '!'", subscriptionPattern), nil
	default:
		return applyLogOtherStringExactFilter(tx, "billing_source", billingSource)
	}
}

func applyLogSearchFilters(tx *gorm.DB, filters LogSearchFilters, includeLogType bool) (*gorm.DB, error) {
	var err error
	if includeLogType && filters.LogType != LogTypeUnknown {
		tx = tx.Where("logs.type = ?", filters.LogType)
	}
	if tx, err = applyExplicitLogTextFilter(tx, "logs.model_name", filters.ModelName); err != nil {
		return nil, err
	}
	if tx, err = applyExplicitLogTextFilter(tx, "logs.username", filters.Username); err != nil {
		return nil, err
	}
	if filters.TokenName != "" {
		tx = tx.Where("logs.token_name = ?", filters.TokenName)
	}
	if filters.RequestId != "" {
		tx = tx.Where("logs.request_id = ?", filters.RequestId)
	}
	if filters.UpstreamRequestId != "" {
		tx = tx.Where("logs.upstream_request_id = ?", filters.UpstreamRequestId)
	}
	if filters.StartTimestamp != 0 {
		tx = tx.Where("logs.created_at >= ?", filters.StartTimestamp)
	}
	if filters.EndTimestamp != 0 {
		tx = tx.Where("logs.created_at <= ?", filters.EndTimestamp)
	}
	if filters.Channel != 0 {
		tx = tx.Where("logs.channel_id = ?", filters.Channel)
	}
	if filters.Group != "" {
		tx = tx.Where("logs."+logGroupCol+" = ?", filters.Group)
	}
	if filters.Content != "" {
		if tx, err = applyExplicitLogTextFilter(tx, "logs.content", filters.Content); err != nil {
			return nil, err
		}
	}
	if tx, err = applyLogOtherStringContainsFilter(tx, "request_path", filters.Endpoint); err != nil {
		return nil, err
	}
	tx = applyLogStatusCodeFilter(tx, filters.StatusCode)
	if tx, err = applyLogOtherStringContainsFilter(tx, "session_id", filters.SessionId); err != nil {
		return nil, err
	}
	if tx, err = applyLogOtherStringContainsFilter(tx, "user_agent", filters.UserAgent); err != nil {
		return nil, err
	}
	if filters.IsStream != nil {
		tx = tx.Where("logs.is_stream = ?", *filters.IsStream)
	}
	if tx, err = applyLogOtherStringExactFilter(tx, "reasoning_effort", filters.ReasoningEffort); err != nil {
		return nil, err
	}
	if tx, err = applyBillingSourceFilter(tx, filters.BillingSource); err != nil {
		return nil, err
	}
	return tx, nil
}

type Log struct {
	Id                int    `json:"id" gorm:"index:idx_created_at_id,priority:2;index:idx_user_id_id,priority:2"`
	UserId            int    `json:"user_id" gorm:"index;index:idx_user_id_id,priority:1"`
	CreatedAt         int64  `json:"created_at" gorm:"bigint;index:idx_created_at_id,priority:1;index:idx_created_at_type"`
	Type              int    `json:"type" gorm:"index:idx_created_at_type"`
	Content           string `json:"content"`
	Username          string `json:"username" gorm:"index;index:index_username_model_name,priority:2;default:''"`
	TokenName         string `json:"token_name" gorm:"index;default:''"`
	ModelName         string `json:"model_name" gorm:"index;index:index_username_model_name,priority:1;default:''"`
	Quota             int    `json:"quota" gorm:"default:0"`
	PromptTokens      int    `json:"prompt_tokens" gorm:"default:0"`
	CompletionTokens  int    `json:"completion_tokens" gorm:"default:0"`
	UseTime           int    `json:"use_time" gorm:"default:0"`
	IsStream          bool   `json:"is_stream"`
	ChannelId         int    `json:"channel" gorm:"index"`
	ChannelName       string `json:"channel_name" gorm:"->"`
	TokenId           int    `json:"token_id" gorm:"default:0;index"`
	Group             string `json:"group" gorm:"index"`
	Ip                string `json:"ip" gorm:"index;default:''"`
	RequestId         string `json:"request_id,omitempty" gorm:"type:varchar(64);index:idx_logs_request_id;default:''"`
	UpstreamRequestId string `json:"upstream_request_id,omitempty" gorm:"type:varchar(128);index:idx_logs_upstream_request_id;default:''"`
	Other             string `json:"other"`
}

// don't use iota, avoid change log type value
const (
	LogTypeUnknown = 0
	LogTypeTopup   = 1
	LogTypeConsume = 2
	LogTypeManage  = 3
	LogTypeSystem  = 4
	LogTypeError   = 5
	LogTypeRefund  = 6
)

func formatUserLogs(logs []*Log, startIdx int) {
	for i := range logs {
		logs[i].ChannelName = ""
		var otherMap map[string]interface{}
		otherMap, _ = common.StrToMap(logs[i].Other)
		if otherMap != nil {
			// Remove admin-only debug fields.
			delete(otherMap, "admin_info")
			// delete(otherMap, "reject_reason")
			delete(otherMap, "stream_status")
		}
		logs[i].Other = common.MapToJsonStr(otherMap)
		logs[i].Id = startIdx + i + 1
	}
}

func GetLogByTokenId(tokenId int) (logs []*Log, err error) {
	err = LOG_DB.Model(&Log{}).Where("token_id = ?", tokenId).Order("id desc").Limit(common.MaxRecentItems).Find(&logs).Error
	formatUserLogs(logs, 0)
	return logs, err
}

func RecordLog(userId int, logType int, content string) {
	if logType == LogTypeConsume && !common.LogConsumeEnabled {
		return
	}
	username, _ := GetUsernameById(userId, false)
	log := &Log{
		UserId:    userId,
		Username:  username,
		CreatedAt: common.GetTimestamp(),
		Type:      logType,
		Content:   content,
	}
	err := LOG_DB.Create(log).Error
	if err != nil {
		common.SysLog("failed to record log: " + err.Error())
	}
}

// RecordLogWithAdminInfo 记录操作日志，并将管理员相关信息存入 Other.admin_info，
func RecordLogWithAdminInfo(userId int, logType int, content string, adminInfo map[string]interface{}) {
	if logType == LogTypeConsume && !common.LogConsumeEnabled {
		return
	}
	username, _ := GetUsernameById(userId, false)
	log := &Log{
		UserId:    userId,
		Username:  username,
		CreatedAt: common.GetTimestamp(),
		Type:      logType,
		Content:   content,
	}
	if len(adminInfo) > 0 {
		other := map[string]interface{}{
			"admin_info": adminInfo,
		}
		log.Other = common.MapToJsonStr(other)
	}
	if err := LOG_DB.Create(log).Error; err != nil {
		common.SysLog("failed to record log: " + err.Error())
	}
}

func RecordTopupLog(userId int, content string, callerIp string, paymentMethod string, callbackPaymentMethod string) {
	username, _ := GetUsernameById(userId, false)
	adminInfo := map[string]interface{}{
		"server_ip":               common.GetIp(),
		"node_name":               common.NodeName,
		"caller_ip":               callerIp,
		"payment_method":          paymentMethod,
		"callback_payment_method": callbackPaymentMethod,
		"version":                 common.Version,
	}
	other := map[string]interface{}{
		"admin_info": adminInfo,
	}
	log := &Log{
		UserId:    userId,
		Username:  username,
		CreatedAt: common.GetTimestamp(),
		Type:      LogTypeTopup,
		Content:   content,
		Ip:        callerIp,
		Other:     common.MapToJsonStr(other),
	}
	err := LOG_DB.Create(log).Error
	if err != nil {
		common.SysLog("failed to record topup log: " + err.Error())
	}
}

const (
	maxLogUserAgentLength = 512
	maxLogSessionLength   = 256
)

func cleanLogText(value string, maxLength int) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	value = strings.Map(func(r rune) rune {
		if r == '\n' || r == '\r' || r == '\t' {
			return ' '
		}
		if r < 0x20 {
			return -1
		}
		return r
	}, value)
	value = strings.Join(strings.Fields(value), " ")
	if maxLength > 0 {
		runes := []rune(value)
		if len(runes) > maxLength {
			return string(runes[:maxLength])
		}
	}
	return value
}

func appendErrorLogClientInfo(c *gin.Context, other map[string]interface{}) {
	if c == nil || c.Request == nil || other == nil {
		return
	}
	if userAgent := cleanLogText(c.Request.UserAgent(), maxLogUserAgentLength); userAgent != "" {
		other["user_agent"] = userAgent
	}
	for _, header := range []string{
		"Session_id",
		"Session-Id",
		"X-Session-Id",
		"X-Codex-Session-Id",
		"Conversation_id",
		"Conversation-Id",
		"X-Conversation-Id",
		"OpenAI-Conversation-Id",
	} {
		if session := cleanLogText(c.GetHeader(header), maxLogSessionLength); session != "" {
			other["session_id"] = session
			other["session_source"] = "header"
			return
		}
	}
}

func RecordErrorLog(c *gin.Context, userId int, channelId int, modelName string, tokenName string, content string, tokenId int, useTimeSeconds int,
	isStream bool, group string, other map[string]interface{}) {
	logger.LogInfo(c, fmt.Sprintf("record error log: userId=%d, channelId=%d, modelName=%s, tokenName=%s, content=%s", userId, channelId, modelName, tokenName, common.LocalLogPreview(content)))
	username := c.GetString("username")
	requestId := c.GetString(common.RequestIdKey)
	upstreamRequestId := c.GetString(common.UpstreamRequestIdKey)
	if other == nil {
		other = make(map[string]interface{})
	}
	appendErrorLogClientInfo(c, other)
	otherStr := common.MapToJsonStr(other)
	// 判断是否需要记录 IP
	needRecordIp := false
	if settingMap, err := GetUserSetting(userId, false); err == nil {
		if settingMap.RecordIpLog {
			needRecordIp = true
		}
	}
	log := &Log{
		UserId:           userId,
		Username:         username,
		CreatedAt:        common.GetTimestamp(),
		Type:             LogTypeError,
		Content:          content,
		PromptTokens:     0,
		CompletionTokens: 0,
		TokenName:        tokenName,
		ModelName:        modelName,
		Quota:            0,
		ChannelId:        channelId,
		TokenId:          tokenId,
		UseTime:          useTimeSeconds,
		IsStream:         isStream,
		Group:            group,
		Ip: func() string {
			if needRecordIp {
				return c.ClientIP()
			}
			return ""
		}(),
		RequestId:         requestId,
		UpstreamRequestId: upstreamRequestId,
		Other:             otherStr,
	}
	err := LOG_DB.Create(log).Error
	if err != nil {
		logger.LogError(c, "failed to record log: "+err.Error())
	}
}

type RecordConsumeLogParams struct {
	ChannelId        int                    `json:"channel_id"`
	PromptTokens     int                    `json:"prompt_tokens"`
	CompletionTokens int                    `json:"completion_tokens"`
	ModelName        string                 `json:"model_name"`
	TokenName        string                 `json:"token_name"`
	Quota            int                    `json:"quota"`
	Content          string                 `json:"content"`
	TokenId          int                    `json:"token_id"`
	UseTimeSeconds   int                    `json:"use_time_seconds"`
	IsStream         bool                   `json:"is_stream"`
	Group            string                 `json:"group"`
	Other            map[string]interface{} `json:"other"`
	SkipQuotaData    bool                   `json:"skip_quota_data"`
}

func RecordConsumeLog(c *gin.Context, userId int, params RecordConsumeLogParams) {
	if !common.LogConsumeEnabled {
		return
	}
	logger.LogInfo(c, fmt.Sprintf("record consume log: userId=%d, params=%s", userId, common.GetJsonString(params)))
	username := c.GetString("username")
	requestId := c.GetString(common.RequestIdKey)
	upstreamRequestId := c.GetString(common.UpstreamRequestIdKey)
	otherStr := common.MapToJsonStr(params.Other)
	// 判断是否需要记录 IP
	needRecordIp := false
	if settingMap, err := GetUserSetting(userId, false); err == nil {
		if settingMap.RecordIpLog {
			needRecordIp = true
		}
	}
	log := &Log{
		UserId:           userId,
		Username:         username,
		CreatedAt:        common.GetTimestamp(),
		Type:             LogTypeConsume,
		Content:          params.Content,
		PromptTokens:     params.PromptTokens,
		CompletionTokens: params.CompletionTokens,
		TokenName:        params.TokenName,
		ModelName:        params.ModelName,
		Quota:            params.Quota,
		ChannelId:        params.ChannelId,
		TokenId:          params.TokenId,
		UseTime:          params.UseTimeSeconds,
		IsStream:         params.IsStream,
		Group:            params.Group,
		Ip: func() string {
			if needRecordIp {
				return c.ClientIP()
			}
			return ""
		}(),
		RequestId:         requestId,
		UpstreamRequestId: upstreamRequestId,
		Other:             otherStr,
	}
	err := LOG_DB.Create(log).Error
	if err != nil {
		logger.LogError(c, "failed to record log: "+err.Error())
	}
	if common.DataExportEnabled && !params.SkipQuotaData {
		gopool.Go(func() {
			LogQuotaData(userId, username, params.ModelName, params.Quota, common.GetTimestamp(), params.PromptTokens+params.CompletionTokens)
		})
	}
}

type RecordTaskBillingLogParams struct {
	UserId    int
	LogType   int
	Content   string
	ChannelId int
	ModelName string
	Quota     int
	TokenId   int
	Group     string
	Other     map[string]interface{}
}

func RecordTaskBillingLog(params RecordTaskBillingLogParams) {
	if params.LogType == LogTypeConsume && !common.LogConsumeEnabled {
		return
	}
	username, _ := GetUsernameById(params.UserId, false)
	tokenName := ""
	if params.TokenId > 0 {
		if token, err := GetTokenById(params.TokenId); err == nil {
			tokenName = token.Name
		}
	}
	log := &Log{
		UserId:    params.UserId,
		Username:  username,
		CreatedAt: common.GetTimestamp(),
		Type:      params.LogType,
		Content:   params.Content,
		TokenName: tokenName,
		ModelName: params.ModelName,
		Quota:     params.Quota,
		ChannelId: params.ChannelId,
		TokenId:   params.TokenId,
		Group:     params.Group,
		Other:     common.MapToJsonStr(params.Other),
	}
	err := LOG_DB.Create(log).Error
	if err != nil {
		common.SysLog("failed to record task billing log: " + err.Error())
	}
}

func GetAllLogs(filters LogSearchFilters, startIdx int, num int) (logs []*Log, total int64, err error) {
	var tx *gorm.DB
	tx = LOG_DB
	if tx, err = applyLogSearchFilters(tx, filters, true); err != nil {
		return nil, 0, err
	}
	err = tx.Model(&Log{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}
	err = tx.Order("logs.created_at desc, logs.id desc").Limit(num).Offset(startIdx).Find(&logs).Error
	if err != nil {
		return nil, 0, err
	}

	channelIds := types.NewSet[int]()
	for _, log := range logs {
		if log.ChannelId != 0 {
			channelIds.Add(log.ChannelId)
		}
	}

	if channelIds.Len() > 0 {
		var channels []struct {
			Id   int    `gorm:"column:id"`
			Name string `gorm:"column:name"`
		}
		if common.MemoryCacheEnabled {
			// Cache get channel
			for _, channelId := range channelIds.Items() {
				if cacheChannel, err := CacheGetChannel(channelId); err == nil {
					channels = append(channels, struct {
						Id   int    `gorm:"column:id"`
						Name string `gorm:"column:name"`
					}{
						Id:   channelId,
						Name: cacheChannel.Name,
					})
				}
			}
		} else {
			// Bulk query channels from DB
			if err = DB.Table("channels").Select("id, name").Where("id IN ?", channelIds.Items()).Find(&channels).Error; err != nil {
				return logs, total, err
			}
		}
		channelMap := make(map[int]string, len(channels))
		for _, channel := range channels {
			channelMap[channel.Id] = channel.Name
		}
		for i := range logs {
			logs[i].ChannelName = channelMap[logs[i].ChannelId]
		}
	}

	return logs, total, err
}

const logSearchCountLimit = 10000

func GetUserLogs(userId int, filters LogSearchFilters, startIdx int, num int) (logs []*Log, total int64, err error) {
	var tx *gorm.DB
	tx = LOG_DB.Where("logs.user_id = ?", userId)
	filters.Username = ""
	filters.Channel = 0
	if tx, err = applyLogSearchFilters(tx, filters, true); err != nil {
		return nil, 0, err
	}
	err = tx.Model(&Log{}).Limit(logSearchCountLimit).Count(&total).Error
	if err != nil {
		common.SysError("failed to count user logs: " + err.Error())
		return nil, 0, errors.New("查询日志失败")
	}
	err = tx.Order("logs.id desc").Limit(num).Offset(startIdx).Find(&logs).Error
	if err != nil {
		common.SysError("failed to search user logs: " + err.Error())
		return nil, 0, errors.New("查询日志失败")
	}

	formatUserLogs(logs, startIdx)
	return logs, total, err
}

type Stat struct {
	Quota int `json:"quota"`
	Rpm   int `json:"rpm"`
	Tpm   int `json:"tpm"`
}

func SumUsedQuota(filters LogSearchFilters) (stat Stat, err error) {
	tx := LOG_DB.Table("logs").Select("sum(quota) quota")

	// 为rpm和tpm创建单独的查询
	rpmTpmQuery := LOG_DB.Table("logs").Select("count(*) rpm, sum(prompt_tokens) + sum(completion_tokens) tpm")

	if tx, err = applyLogSearchFilters(tx, filters, false); err != nil {
		return stat, err
	}
	if rpmTpmQuery, err = applyLogSearchFilters(rpmTpmQuery, filters, false); err != nil {
		return stat, err
	}

	tx = tx.Where("type = ?", LogTypeConsume)
	rpmTpmQuery = rpmTpmQuery.Where("type = ?", LogTypeConsume)

	// 只统计最近60秒的rpm和tpm
	rpmTpmQuery = rpmTpmQuery.Where("created_at >= ?", time.Now().Add(-60*time.Second).Unix())

	// 执行查询
	if err := tx.Scan(&stat).Error; err != nil {
		common.SysError("failed to query log stat: " + err.Error())
		return stat, errors.New("查询统计数据失败")
	}
	if err := rpmTpmQuery.Scan(&stat).Error; err != nil {
		common.SysError("failed to query rpm/tpm stat: " + err.Error())
		return stat, errors.New("查询统计数据失败")
	}

	return stat, nil
}

func SumUsedToken(logType int, startTimestamp int64, endTimestamp int64, modelName string, username string, tokenName string) (token int) {
	tx := LOG_DB.Table("logs").Select("ifnull(sum(prompt_tokens),0) + ifnull(sum(completion_tokens),0)")
	if username != "" {
		tx = tx.Where("username = ?", username)
	}
	if tokenName != "" {
		tx = tx.Where("token_name = ?", tokenName)
	}
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	if modelName != "" {
		tx = tx.Where("model_name = ?", modelName)
	}
	tx.Where("type = ?", LogTypeConsume).Scan(&token)
	return token
}

func DeleteOldLog(ctx context.Context, targetTimestamp int64, limit int) (int64, error) {
	var total int64 = 0

	for {
		if nil != ctx.Err() {
			return total, ctx.Err()
		}

		result := LOG_DB.Where("created_at < ?", targetTimestamp).Limit(limit).Delete(&Log{})
		if nil != result.Error {
			return total, result.Error
		}

		total += result.RowsAffected

		if result.RowsAffected < int64(limit) {
			break
		}
	}

	return total, nil
}
