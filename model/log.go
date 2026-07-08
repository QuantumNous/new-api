package model

import (
	"context"
	"errors"
	"fmt"
	"strconv"
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

func normalizeLogTextFilterValue(value string) string {
	value = strings.TrimSpace(value)
	if unquoted, err := strconv.Unquote(value); err == nil {
		return strings.TrimSpace(unquoted)
	}
	return value
}

// fuzzyUsernameUserIDLimit 限制模糊匹配时从 user 表物化到内存的 user_id 数量。
// 日志库可能经 LOG_SQL_DSN 独立部署（LOG_DB != DB，见 model/main.go），因此不能
// 用基于主库 DB 的子查询去拼 LOG_DB 的 WHERE（会产生跨库引用）；只能在应用侧把
// user_id 物化成 IN 列表。该上限防止过宽关键词（如 2 字符）命中海量用户导致内存/
// SQL 参数膨胀甚至超过数据库参数上限。
//
// 关键：超过上限时必须返回空列表（全有或全无），而不是返回被截断的前 N 个 id。
// 截断列表会让调用方静默地用残缺的 user_id 集合，漏掉第 N+1 个及之后用户改名前
// 的历史日志，产生“看起来正常但结果不全”的边界漏数。返回空后调用方退化为仅按
// logs.username 快照 LIKE，结果仍正确（只是放弃用 user 表补齐改名前历史日志这一
// 增强）——宁可不补齐，也不返回不完整的集合。
//
// 用 var 而非 const 仅为便于测试覆盖超限降级分支（造上千用户代价过高）。
var fuzzyUsernameUserIDLimit = 1000

func getUserIDsByUsernameFilter(value string, fuzzy bool) ([]int, error) {
	if DB == nil {
		return nil, nil
	}
	var userIDs []int
	tx := DB.Model(&User{}).Select("id")
	if fuzzy {
		pattern, err := sanitizeLikePattern(value)
		if err != nil {
			return nil, err
		}
		// 多查 1 条以判断是否真的超过上限。
		tx = tx.Where("username LIKE ? ESCAPE '!'", pattern).Limit(fuzzyUsernameUserIDLimit + 1)
	} else {
		tx = tx.Where("username = ?", value)
	}
	if err := tx.Find(&userIDs).Error; err != nil {
		return nil, err
	}
	// 命中数超过上限：返回空，让调用方退化为纯 LIKE，避免用截断后的不完整集合。
	if fuzzy && len(userIDs) > fuzzyUsernameUserIDLimit {
		return nil, nil
	}
	return userIDs, nil
}

// applyFuzzyUsernameFilter 对日志用户名做模糊匹配：既匹配 logs 表里的用户名
// 快照（历史改名前写入的记录），又通过 user 表把关键词解析成 user_id 列表，
// 再用 user_id IN 命中该用户改名后的全部日志。rawPattern 形如 "%kw%" 或用户
// 显式给出的含 % 模式。
func applyFuzzyUsernameFilter(tx *gorm.DB, usernameColumn string, userIDColumn string, rawPattern string) (*gorm.DB, error) {
	pattern, err := sanitizeLikePattern(rawPattern)
	if err != nil {
		return nil, err
	}
	userIDs, err := getUserIDsByUsernameFilter(rawPattern, true)
	if err != nil {
		return nil, err
	}
	if len(userIDs) > 0 {
		return tx.Where("("+usernameColumn+" LIKE ? ESCAPE '!' OR "+userIDColumn+" IN ?)", pattern, userIDs), nil
	}
	return tx.Where(usernameColumn+" LIKE ? ESCAPE '!'", pattern), nil
}

func applyLogUsernameFilter(tx *gorm.DB, usernameColumn string, userIDColumn string, value string) (*gorm.DB, error) {
	value = normalizeLogTextFilterValue(value)
	if value == "" {
		return tx, nil
	}
	// 用户显式使用 % 通配符：按其给定的模式模糊匹配。
	if strings.Contains(value, "%") {
		return applyFuzzyUsernameFilter(tx, usernameColumn, userIDColumn, value)
	}
	// 纯数字：按 user_id 精确匹配，用于 /users「使用日志」行内跳转以及按 ID
	// 精确定位单个用户（用户名唯一，但管理员也可能直接输 ID）。
	if userID, err := strconv.Atoi(value); err == nil {
		return tx.Where("("+usernameColumn+" = ? OR "+userIDColumn+" = ?)", value, userID), nil
	}
	// 纯文本关键词：精确匹配 logs.username 快照，并经 user 表把用户名解析成
	// user_id，补齐用户改名前写入的历史日志。精确查询走索引、无前导通配扫描，
	// 不会像 "%kw%" 那样在大日志表上全表扫描（#222）。需要模糊时由用户在输入
	// 框显式输入 % 触发，走上面的 strings.Contains(value, "%") 分支。
	userIDs, err := getUserIDsByUsernameFilter(value, false)
	if err != nil {
		return nil, err
	}
	if len(userIDs) > 0 {
		return tx.Where("("+usernameColumn+" = ? OR "+userIDColumn+" IN ?)", value, userIDs), nil
	}
	return tx.Where(usernameColumn+" = ?", value), nil
}

type Log struct {
	Id                int    `json:"id" gorm:"index:idx_created_at_id,priority:2;index:idx_user_id_id,priority:2;index:idx_logs_channel_type_created_id,priority:4"`
	UserId            int    `json:"user_id" gorm:"index;index:idx_user_id_id,priority:1"`
	CreatedAt         int64  `json:"created_at" gorm:"bigint;index:idx_created_at_id,priority:1;index:idx_created_at_type;index:idx_type_created_at_quota,priority:2;index:idx_logs_channel_type_created_id,priority:3"`
	Type              int    `json:"type" gorm:"index:idx_created_at_type;index:idx_type_created_at_quota,priority:1;index:idx_logs_channel_type_created_id,priority:2"`
	Content           string `json:"content"`
	Username          string `json:"username" gorm:"index;index:index_username_model_name,priority:2;default:''"`
	TokenName         string `json:"token_name" gorm:"index;default:''"`
	ModelName         string `json:"model_name" gorm:"index;index:index_username_model_name,priority:1;default:''"`
	Quota             int    `json:"quota" gorm:"default:0;index:idx_type_created_at_quota,priority:3"`
	PromptTokens      int    `json:"prompt_tokens" gorm:"default:0"`
	CompletionTokens  int    `json:"completion_tokens" gorm:"default:0"`
	UseTime           int    `json:"use_time" gorm:"default:0"`
	IsStream          bool   `json:"is_stream"`
	ChannelId         int    `json:"channel" gorm:"index;index:idx_logs_channel_type_created_id,priority:1"`
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

func RecordErrorLog(c *gin.Context, userId int, channelId int, modelName string, tokenName string, content string, tokenId int, useTimeSeconds int,
	isStream bool, group string, other map[string]interface{}) {
	logger.LogInfo(c, fmt.Sprintf("record error log: userId=%d, channelId=%d, modelName=%s, tokenName=%s, content=%s", userId, channelId, modelName, tokenName, common.LocalLogPreview(content)))
	username := c.GetString("username")
	requestId := c.GetString(common.RequestIdKey)
	upstreamRequestId := c.GetString(common.UpstreamRequestIdKey)
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
	} else {
		maybeRecordLogRequestSample(c, userId, params, log)
	}
	if common.DataExportEnabled {
		gopool.Go(func() {
			ts := common.GetTimestamp()
			totalTokens := params.PromptTokens + params.CompletionTokens
			LogQuotaData(userId, username, params.ModelName, params.Quota, ts, totalTokens)
			// 仅对真实令牌请求记录令牌维度，避免管理员渠道测试 / 内部 violation_fee 等
			// TokenId=0 调用污染令牌看板。
			if params.TokenId > 0 {
				LogQuotaDataToken(userId, username, params.TokenId, params.TokenName, params.ModelName, params.Quota, ts, totalTokens)
			}
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

func GetAllLogs(logType int, startTimestamp int64, endTimestamp int64, modelName string, username string, tokenName string, startIdx int, num int, channel int, group string, requestId string, upstreamRequestId string, excludeUserId int) (logs []*Log, total int64, err error) {
	var tx *gorm.DB
	if logType == LogTypeUnknown {
		tx = LOG_DB
	} else {
		tx = LOG_DB.Where("logs.type = ?", logType)
	}

	if tx, err = applyExplicitLogTextFilter(tx, "logs.model_name", modelName); err != nil {
		return nil, 0, err
	}
	if tx, err = applyLogUsernameFilter(tx, "logs.username", "logs.user_id", username); err != nil {
		return nil, 0, err
	}
	if excludeUserId != 0 {
		tx = tx.Where("logs.user_id != ?", excludeUserId)
	}
	if tokenName != "" {
		tx = tx.Where("logs.token_name = ?", tokenName)
	}
	if requestId != "" {
		tx = tx.Where("logs.request_id = ?", requestId)
	}
	if upstreamRequestId != "" {
		tx = tx.Where("logs.upstream_request_id = ?", upstreamRequestId)
	}
	if startTimestamp != 0 {
		tx = tx.Where("logs.created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("logs.created_at <= ?", endTimestamp)
	}
	if channel != 0 {
		tx = tx.Where("logs.channel_id = ?", channel)
	}
	if group != "" {
		tx = tx.Where("logs."+logGroupCol+" = ?", group)
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

func GetUserLogs(userId int, logType int, startTimestamp int64, endTimestamp int64, modelName string, tokenName string, startIdx int, num int, group string, requestId string, upstreamRequestId string) (logs []*Log, total int64, err error) {
	var tx *gorm.DB
	if logType == LogTypeUnknown {
		tx = LOG_DB.Where("logs.user_id = ?", userId)
	} else {
		tx = LOG_DB.Where("logs.user_id = ? and logs.type = ?", userId, logType)
	}

	if tx, err = applyExplicitLogTextFilter(tx, "logs.model_name", modelName); err != nil {
		return nil, 0, err
	}
	if tokenName != "" {
		tx = tx.Where("logs.token_name = ?", tokenName)
	}
	if requestId != "" {
		tx = tx.Where("logs.request_id = ?", requestId)
	}
	if upstreamRequestId != "" {
		tx = tx.Where("logs.upstream_request_id = ?", upstreamRequestId)
	}
	if startTimestamp != 0 {
		tx = tx.Where("logs.created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("logs.created_at <= ?", endTimestamp)
	}
	if group != "" {
		tx = tx.Where("logs."+logGroupCol+" = ?", group)
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

type CodexChannelUsageStat struct {
	ChannelID int   `json:"channel_id" gorm:"column:channel_id"`
	TokenUsed int64 `json:"token_used" gorm:"column:token_used"`
	Quota     int64 `json:"quota" gorm:"column:quota"`
}

func GetCodexChannelUsageStats(
	channelIds []int,
	startTimestamp int64,
	endTimestamp int64,
) (map[int]CodexChannelUsageStat, error) {
	result := make(map[int]CodexChannelUsageStat)
	if len(channelIds) == 0 {
		return result, nil
	}

	var stats []CodexChannelUsageStat
	tx := LOG_DB.Table("logs").Select(
		"channel_id, COALESCE(SUM(prompt_tokens), 0) + COALESCE(SUM(completion_tokens), 0) AS token_used, COALESCE(SUM(quota), 0) AS quota",
	).Where("type = ?", LogTypeConsume).Where("channel_id IN ?", channelIds)
	if startTimestamp > 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp > 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}

	if err := tx.Group("channel_id").Scan(&stats).Error; err != nil {
		common.SysError("failed to query codex channel usage stats: " + err.Error())
		return result, errors.New("查询 Codex 渠道统计数据失败")
	}
	for _, stat := range stats {
		result[stat.ChannelID] = stat
	}
	return result, nil
}

// SumUsedQuota 聚合用量统计。
//
// selfUserId 用于「查自己」场景的身份约束：非 0 时强制 user_id = selfUserId 精确
// 过滤，且忽略 username 模糊搜索（username 自 fuzzy 化后会把 alice2/malice 等带进
// alice 的统计，绝不能用于身份约束）。管理员搜索路径传 0，按 username 模糊匹配。
func SumUsedQuota(logType int, startTimestamp int64, endTimestamp int64, modelName string, username string, tokenName string, channel int, group string, excludeUserId int, selfUserId int) (stat Stat, err error) {
	tx := LOG_DB.Table("logs").Select("sum(quota) quota")

	// 为rpm和tpm创建单独的查询
	rpmTpmQuery := LOG_DB.Table("logs").Select("count(*) rpm, sum(prompt_tokens) + sum(completion_tokens) tpm")

	if selfUserId != 0 {
		// 身份约束：只统计本人日志，精确按 user_id，不掺入 username 模糊匹配。
		tx = tx.Where("user_id = ?", selfUserId)
		rpmTpmQuery = rpmTpmQuery.Where("user_id = ?", selfUserId)
	} else {
		if tx, err = applyLogUsernameFilter(tx, "username", "user_id", username); err != nil {
			return stat, err
		}
		if rpmTpmQuery, err = applyLogUsernameFilter(rpmTpmQuery, "username", "user_id", username); err != nil {
			return stat, err
		}
	}
	if tokenName != "" {
		tx = tx.Where("token_name = ?", tokenName)
		rpmTpmQuery = rpmTpmQuery.Where("token_name = ?", tokenName)
	}
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	if tx, err = applyExplicitLogTextFilter(tx, "model_name", modelName); err != nil {
		return stat, err
	}
	if rpmTpmQuery, err = applyExplicitLogTextFilter(rpmTpmQuery, "model_name", modelName); err != nil {
		return stat, err
	}
	if channel != 0 {
		tx = tx.Where("channel_id = ?", channel)
		rpmTpmQuery = rpmTpmQuery.Where("channel_id = ?", channel)
	}
	if group != "" {
		tx = tx.Where(logGroupCol+" = ?", group)
		rpmTpmQuery = rpmTpmQuery.Where(logGroupCol+" = ?", group)
	}
	if excludeUserId != 0 {
		tx = tx.Where("user_id != ?", excludeUserId)
		rpmTpmQuery = rpmTpmQuery.Where("user_id != ?", excludeUserId)
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

		var ids []int
		if err := LOG_DB.Model(&Log{}).Where("created_at < ?", targetTimestamp).Order("id").Limit(limit).Pluck("id", &ids).Error; err != nil {
			return total, err
		}
		if len(ids) == 0 {
			break
		}
		result := LOG_DB.Where("id IN ?", ids).Delete(&Log{})
		if result.Error != nil {
			return total, result.Error
		}

		total += result.RowsAffected

		if len(ids) < limit {
			break
		}
	}

	return total, nil
}
