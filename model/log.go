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

type Log struct {
	Id               int    `json:"id" gorm:"index:idx_created_at_id,priority:1;index:idx_user_id_id,priority:2"`
	UserId           int    `json:"user_id" gorm:"index;index:idx_user_id_id,priority:1"`
	CreatedAt        int64  `json:"created_at" gorm:"bigint;index:idx_created_at_id,priority:2;index:idx_created_at_type"`
	Type             int    `json:"type" gorm:"index:idx_created_at_type"`
	Content          string `json:"content"`
	Username         string `json:"username" gorm:"index;index:index_username_model_name,priority:2;default:''"`
	TokenName        string `json:"token_name" gorm:"index;default:''"`
	ModelName        string `json:"model_name" gorm:"index;index:index_username_model_name,priority:1;default:''"`
	Quota            int    `json:"quota" gorm:"default:0"`
	PromptTokens     int    `json:"prompt_tokens" gorm:"default:0"`
	CompletionTokens int    `json:"completion_tokens" gorm:"default:0"`
	UseTime          int    `json:"use_time" gorm:"default:0"`
	IsStream         bool   `json:"is_stream"`
	ChannelId        int    `json:"channel" gorm:"index"`
	ChannelName      string `json:"channel_name" gorm:"->"`
	UserEmail        string `json:"user_email,omitempty" gorm:"->"`
	TokenId          int    `json:"token_id" gorm:"default:0;index"`
	Group            string `json:"group" gorm:"index"`
	Ip               string `json:"ip" gorm:"index;default:''"`
	RequestId        string `json:"request_id,omitempty" gorm:"type:varchar(64);index:idx_logs_request_id;default:''"`
	Other            string `json:"other"`

	AccountingChannelCostAmountUSD  float64 `json:"-" gorm:"column:accounting_channel_cost_amount_usd;type:decimal(20,10);default:0;index"`
	AccountingUserPriceAmountUSD    float64 `json:"-" gorm:"column:accounting_user_price_amount_usd;type:decimal(20,10);default:0;index"`
	AccountingResellerCostAmountUSD float64 `json:"-" gorm:"column:accounting_reseller_cost_amount_usd;type:decimal(20,10);default:0;index"`
	AccountingUserFinalAmountUSD    float64 `json:"-" gorm:"column:accounting_user_final_amount_usd;type:decimal(20,10);default:0;index"`
	AccountingResellerUserId        int     `json:"-" gorm:"column:accounting_reseller_user_id;default:0;index"`
	AccountingResellerRuleId        int     `json:"-" gorm:"column:accounting_reseller_rule_id;default:0;index"`
	AccountingResellerDiscountRatio float64 `json:"-" gorm:"column:accounting_reseller_discount_ratio;type:decimal(12,8);default:0"`
	AccountingGroupRatio            float64 `json:"-" gorm:"column:accounting_group_ratio;type:decimal(12,8);default:0"`
	AccountingStatus                string  `json:"-" gorm:"column:accounting_status;type:varchar(32);default:'';index"`
	AccountingSnapshot              string  `json:"-" gorm:"column:accounting_snapshot;type:text"`
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
	err = LOG_DB.Model(&Log{}).Omit("AccountingSnapshot").Where("token_id = ?", tokenId).Order("id desc").Limit(common.MaxRecentItems).Find(&logs).Error
	formatUserLogs(logs, 0)
	return logs, err
}

// FindChannelIDForImageTask looks up which channel submitted an async image task (task_id in log content).
func FindChannelIDForImageTask(userID int, taskID string) (int, bool) {
	if userID <= 0 || strings.TrimSpace(taskID) == "" {
		return 0, false
	}
	var row Log
	err := LOG_DB.Model(&Log{}).
		Where("user_id = ? AND model_name LIKE ? AND content LIKE ?", userID, "gpt-image%", "%"+taskID+"%").
		Order("id DESC").
		First(&row).Error
	if err != nil || row.ChannelId <= 0 {
		return 0, false
	}
	return row.ChannelId, true
}

func findConsumeLogRowForTask(userID int, taskID string) (*Log, error) {
	if userID <= 0 || strings.TrimSpace(taskID) == "" {
		return nil, gorm.ErrRecordNotFound
	}
	var row Log
	err := LOG_DB.Model(&Log{}).
		Where("user_id = ? AND type = ? AND other LIKE ?", userID, LogTypeConsume, "%"+taskID+"%").
		Order("id DESC").
		First(&row).Error
	if err == nil {
		return &row, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	// Legacy rows: video tasks logged before task_id was stored in other.
	task, exist, taskErr := GetByTaskId(userID, taskID)
	if taskErr != nil || !exist {
		return nil, gorm.ErrRecordNotFound
	}
	modelName := task.Properties.OriginModelName
	if modelName == "" {
		return nil, gorm.ErrRecordNotFound
	}
	windowStart := task.SubmitTime - 3
	windowEnd := task.SubmitTime + 3
	if windowStart < 0 {
		windowStart = 0
	}
	err = LOG_DB.Model(&Log{}).
		Where("user_id = ? AND type = ? AND model_name = ? AND channel_id = ? AND created_at >= ? AND created_at <= ? AND other LIKE ?",
			userID, LogTypeConsume, modelName, task.ChannelId, windowStart, windowEnd, "%\"is_task\":true%").
		Order("id DESC").
		First(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

// FindConsumeLogRowForTask locates the consume log row associated with a public task_id.
func FindConsumeLogRowForTask(userID int, taskID string) (*Log, error) {
	return findConsumeLogRowForTask(userID, taskID)
}

// ErrorLogContext captures upstream task metadata from the latest error log for a request.
type ErrorLogContext struct {
	TaskID    string
	ChannelId int
	ErrorCode string
}

// FindErrorLogContextForRequestId reads task_id / channel from the latest error log for request_id.
func FindErrorLogContextForRequestId(userID int, requestId string) (ErrorLogContext, bool) {
	requestId = strings.TrimSpace(requestId)
	if userID <= 0 || requestId == "" {
		return ErrorLogContext{}, false
	}
	var row Log
	err := LOG_DB.Model(&Log{}).
		Where("user_id = ? AND type = ? AND request_id = ?", userID, LogTypeError, requestId).
		Order("id DESC").
		First(&row).Error
	if err != nil {
		return ErrorLogContext{}, false
	}
	otherMap, _ := common.StrToMap(row.Other)
	ctx := ErrorLogContext{ChannelId: row.ChannelId}
	if otherMap != nil {
		if taskID, ok := otherMap["task_id"].(string); ok {
			ctx.TaskID = strings.TrimSpace(taskID)
		}
		if code, ok := otherMap["error_code"].(string); ok {
			ctx.ErrorCode = strings.TrimSpace(code)
		}
	}
	if ctx.TaskID == "" && ctx.ChannelId <= 0 {
		return ErrorLogContext{}, false
	}
	return ctx, true
}

// HasConsumeLogForRequestId reports whether a consume log already exists for the request.
func HasConsumeLogForRequestId(userID int, requestId string) (bool, error) {
	requestId = strings.TrimSpace(requestId)
	if userID <= 0 || requestId == "" {
		return false, nil
	}
	var count int64
	err := LOG_DB.Model(&Log{}).
		Where("user_id = ? AND type = ? AND request_id = ?", userID, LogTypeConsume, requestId).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// HasRefundLogForTask reports whether a refund log already exists for the task_id.
func HasRefundLogForTask(userID int, taskID string) (bool, error) {
	taskID = strings.TrimSpace(taskID)
	if userID <= 0 || taskID == "" {
		return false, nil
	}
	var count int64
	err := LOG_DB.Model(&Log{}).
		Where("user_id = ? AND type = ? AND other LIKE ?", userID, LogTypeRefund, "%"+taskID+"%").
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// UpdateLogResultByTaskID backfills the "耗时" (use_time) on the consumption log row for an
// async task once the real result is known, and merges extraOther into its `other` JSON
// (e.g. fallback_triggered for gpt-image race-fallback). Async submits bill/log at submit
// time with use_time=0; this rewrites the same row once polling confirms the task finished.
func UpdateLogResultByTaskID(userID int, taskID string, useTimeSeconds int, extraOther map[string]interface{}) error {
	if userID <= 0 || strings.TrimSpace(taskID) == "" {
		return nil
	}
	if useTimeSeconds <= 0 && len(extraOther) == 0 {
		return nil
	}
	row, err := findConsumeLogRowForTask(userID, taskID)
	if err != nil {
		return err
	}
	otherMap, _ := common.StrToMap(row.Other)
	if otherMap == nil {
		otherMap = map[string]interface{}{}
	}
	if _, ok := otherMap["task_id"]; !ok || otherMap["task_id"] == "" {
		otherMap["task_id"] = taskID
	}
	for k, v := range extraOther {
		otherMap[k] = v
	}
	updates := map[string]interface{}{
		"other": common.MapToJsonStr(otherMap),
	}
	if useTimeSeconds > 0 {
		updates["use_time"] = useTimeSeconds
	}
	return LOG_DB.Model(&Log{}).Where("id = ?", row.Id).Updates(updates).Error
}

// FindRecentImageChannelID returns the channel from the user's latest gpt-image consume within withinSec.
func FindRecentImageChannelID(userID int, withinSec int64) (int, bool) {
	if userID <= 0 || withinSec <= 0 {
		return 0, false
	}
	since := common.GetTimestamp() - withinSec
	var row Log
	err := LOG_DB.Model(&Log{}).
		Where("user_id = ? AND model_name LIKE ? AND type = ? AND channel_id > 0 AND created_at >= ?",
			userID, "gpt-image%", LogTypeConsume, since).
		Order("id DESC").
		First(&row).Error
	if err != nil || row.ChannelId <= 0 {
		return 0, false
	}
	return row.ChannelId, true
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

func resolveLogUsername(c *gin.Context, userId int) string {
	if username := c.GetString("username"); username != "" {
		return username
	}
	if userId <= 0 {
		return ""
	}
	username, err := GetUsernameById(userId, false)
	if err != nil {
		return ""
	}
	return username
}

func RecordErrorLog(c *gin.Context, userId int, channelId int, modelName string, tokenName string, content string, tokenId int, useTimeSeconds int,
	isStream bool, group string, other map[string]interface{}) {
	logger.LogInfo(c, fmt.Sprintf("record error log: userId=%d, channelId=%d, modelName=%s, tokenName=%s, content=%s", userId, channelId, modelName, tokenName, content))
	username := resolveLogUsername(c, userId)
	requestId := c.GetString(common.RequestIdKey)
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
		RequestId: requestId,
		Other:     otherStr,
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
	Accounting       AccountingLogFields    `json:"-"`
}

type AccountingLogFields struct {
	ChannelCostAmountUSD  float64
	UserPriceAmountUSD    float64
	ResellerCostAmountUSD float64
	UserFinalAmountUSD    float64
	ResellerUserId        int
	ResellerRuleId        int
	ResellerDiscountRatio float64
	GroupRatio            float64
	Status                string
	Snapshot              string
}

func RecordConsumeLog(c *gin.Context, userId int, params RecordConsumeLogParams) {
	if !common.LogConsumeEnabled {
		return
	}
	logger.LogInfo(c, fmt.Sprintf("record consume log: userId=%d, params=%s", userId, common.GetJsonString(params)))
	username := resolveLogUsername(c, userId)
	requestId := c.GetString(common.RequestIdKey)
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
		RequestId: requestId,
		Other:     otherStr,

		AccountingChannelCostAmountUSD:  params.Accounting.ChannelCostAmountUSD,
		AccountingUserPriceAmountUSD:    params.Accounting.UserPriceAmountUSD,
		AccountingResellerCostAmountUSD: params.Accounting.ResellerCostAmountUSD,
		AccountingUserFinalAmountUSD:    params.Accounting.UserFinalAmountUSD,
		AccountingResellerUserId:        params.Accounting.ResellerUserId,
		AccountingResellerRuleId:        params.Accounting.ResellerRuleId,
		AccountingResellerDiscountRatio: params.Accounting.ResellerDiscountRatio,
		AccountingGroupRatio:            params.Accounting.GroupRatio,
		AccountingStatus:                params.Accounting.Status,
		AccountingSnapshot:              params.Accounting.Snapshot,
	}
	err := LOG_DB.Create(log).Error
	if err != nil {
		logger.LogError(c, "failed to record log: "+err.Error())
	}
	if common.DataExportEnabled {
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
	RequestId string
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
		RequestId: params.RequestId,
		Other:     common.MapToJsonStr(params.Other),
	}
	err := LOG_DB.Create(log).Error
	if err != nil {
		common.SysLog("failed to record task billing log: " + err.Error())
	}
}

const billingHoldConfirmLogAsConsumeOptionKey = "BillingHoldConfirmLogAsConsumeV1"

// migrateBillingHoldConfirmManageLogsToConsume reclassifies historical confirm_charge rows as consume logs.
func migrateBillingHoldConfirmManageLogsToConsume() {
	if usedQuotaRepairOptionDone(billingHoldConfirmLogAsConsumeOptionKey) {
		return
	}
	res := LOG_DB.Model(&Log{}).
		Where("type = ?", LogTypeManage).
		Where("other LIKE ?", "%billing_hold_reconcile%").
		Where("other LIKE ?", "%confirm_charge%").
		Update("type", LogTypeConsume)
	if res.Error != nil {
		common.SysLog("failed to migrate billing hold confirm logs to consume: " + res.Error.Error())
		return
	}
	if !markUsedQuotaRepairOptionDone(billingHoldConfirmLogAsConsumeOptionKey) {
		return
	}
	if res.RowsAffected > 0 {
		common.SysLog(fmt.Sprintf("billing hold confirm logs migrated to consume: %d row(s)", res.RowsAffected))
	}
}

func GetAllLogs(logType int, startTimestamp int64, endTimestamp int64, modelName string, username string, tokenName string, startIdx int, num int, channel int, group string, requestId string, filterUserId int) (logs []*Log, total int64, err error) {
	var tx *gorm.DB
	if logType == LogTypeUnknown {
		tx = LOG_DB
	} else {
		tx = LOG_DB.Where("logs.type = ?", logType)
	}

	if modelName != "" {
		tx = tx.Where("logs.model_name like ?", modelName)
	}
	if username != "" {
		tx = tx.Where("logs.username = ?", username)
	}
	if filterUserId != 0 {
		tx = tx.Where("logs.user_id = ?", filterUserId)
	}
	if tokenName != "" {
		tx = tx.Where("logs.token_name = ?", tokenName)
	}
	if requestId != "" {
		tx = tx.Where("logs.request_id = ?", requestId)
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
	err = tx.Omit("AccountingSnapshot").Order("logs.id desc").Limit(num).Offset(startIdx).Find(&logs).Error
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

	// Backfill missing usernames (e.g. gpt-image-2 async reconcile logs) and bulk-lookup emails.
	missingUserIds := types.NewSet[int]()
	for _, log := range logs {
		if log.Username == "" && log.UserId > 0 {
			missingUserIds.Add(log.UserId)
		}
	}
	if missingUserIds.Len() > 0 {
		var userRows []struct {
			Id       int    `gorm:"column:id"`
			Username string `gorm:"column:username"`
			Email    string `gorm:"column:email"`
		}
		if err2 := DB.Table("users").Select("id, username, email").Where("id IN ?", missingUserIds.Items()).Find(&userRows).Error; err2 == nil {
			userMap := make(map[int]struct {
				Username string
				Email    string
			}, len(userRows))
			for _, row := range userRows {
				userMap[row.Id] = struct {
					Username string
					Email    string
				}{Username: row.Username, Email: row.Email}
			}
			for i := range logs {
				if logs[i].Username != "" || logs[i].UserId <= 0 {
					continue
				}
				if user, ok := userMap[logs[i].UserId]; ok {
					logs[i].Username = user.Username
					logs[i].UserEmail = user.Email
				}
			}
		}
	}

	usernames := types.NewSet[string]()
	for _, log := range logs {
		if log.Username != "" {
			usernames.Add(log.Username)
		}
	}
	if usernames.Len() > 0 {
		var userEmailRows []struct {
			Username string `gorm:"column:username"`
			Email    string `gorm:"column:email"`
		}
		if err2 := DB.Table("users").Select("username, email").Where("username IN ?", usernames.Items()).Find(&userEmailRows).Error; err2 == nil {
			emailMap := make(map[string]string, len(userEmailRows))
			for _, row := range userEmailRows {
				emailMap[row.Username] = row.Email
			}
			for i := range logs {
				if logs[i].UserEmail == "" {
					logs[i].UserEmail = emailMap[logs[i].Username]
				}
			}
		}
	}

	return logs, total, err
}

const logSearchCountLimit = 10000

func GetUserLogs(userId int, logType int, startTimestamp int64, endTimestamp int64, modelName string, tokenName string, startIdx int, num int, group string, requestId string) (logs []*Log, total int64, err error) {
	var tx *gorm.DB
	if logType == LogTypeUnknown {
		tx = LOG_DB.Where("logs.user_id = ?", userId)
	} else {
		tx = LOG_DB.Where("logs.user_id = ? and logs.type = ?", userId, logType)
	}

	if modelName != "" {
		modelNamePattern, err := sanitizeLikePattern(modelName)
		if err != nil {
			return nil, 0, err
		}
		tx = tx.Where("logs.model_name LIKE ? ESCAPE '!'", modelNamePattern)
	}
	if tokenName != "" {
		tx = tx.Where("logs.token_name = ?", tokenName)
	}
	if requestId != "" {
		tx = tx.Where("logs.request_id = ?", requestId)
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
	err = tx.Omit("AccountingSnapshot").Order("logs.id desc").Limit(num).Offset(startIdx).Find(&logs).Error
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

func SumUsedQuota(logType int, startTimestamp int64, endTimestamp int64, modelName string, username string, tokenName string, channel int, group string, filterUserId int) (stat Stat, err error) {
	tx := LOG_DB.Table("logs").Select("sum(quota) quota")

	// 为rpm和tpm创建单独的查询
	rpmTpmQuery := LOG_DB.Table("logs").Select("count(*) rpm, sum(prompt_tokens) + sum(completion_tokens) tpm")

	if username != "" {
		tx = tx.Where("username = ?", username)
		rpmTpmQuery = rpmTpmQuery.Where("username = ?", username)
	}
	if filterUserId != 0 {
		tx = tx.Where("user_id = ?", filterUserId)
		rpmTpmQuery = rpmTpmQuery.Where("user_id = ?", filterUserId)
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
	if modelName != "" {
		modelNamePattern, err := sanitizeLikePattern(modelName)
		if err != nil {
			return stat, err
		}
		tx = tx.Where("model_name LIKE ? ESCAPE '!'", modelNamePattern)
		rpmTpmQuery = rpmTpmQuery.Where("model_name LIKE ? ESCAPE '!'", modelNamePattern)
	}
	if channel != 0 {
		tx = tx.Where("channel_id = ?", channel)
		rpmTpmQuery = rpmTpmQuery.Where("channel_id = ?", channel)
	}
	if group != "" {
		tx = tx.Where(logGroupCol+" = ?", group)
		rpmTpmQuery = rpmTpmQuery.Where(logGroupCol+" = ?", group)
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
