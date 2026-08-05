package model

import (
	"context"
	"errors"
	"fmt"
	"sort"
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
	TokenId          int    `json:"token_id" gorm:"default:0;index"`
	Group            string `json:"group" gorm:"index"`
	Ip               string `json:"ip" gorm:"index;default:''"`
	RequestId        string `json:"request_id,omitempty" gorm:"type:varchar(64);index:idx_logs_request_id;default:''"`
	Other            string `json:"other"`
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
	logger.LogInfo(c, fmt.Sprintf("record error log: userId=%d, channelId=%d, modelName=%s, tokenName=%s, content=%s", userId, channelId, modelName, tokenName, content))
	username := c.GetString("username")
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
}

func RecordConsumeLog(c *gin.Context, userId int, params RecordConsumeLogParams) {
	if !common.LogConsumeEnabled {
		return
	}
	logger.LogInfo(c, fmt.Sprintf("record consume log: userId=%d, params=%s", userId, common.GetJsonString(params)))
	username := c.GetString("username")
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

func GetAllLogs(logType int, startTimestamp int64, endTimestamp int64, modelName string, username string, tokenName string, startIdx int, num int, channel int, group string, requestId string) (logs []*Log, total int64, err error) {
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
	err = tx.Order("logs.id desc").Limit(num).Offset(startIdx).Find(&logs).Error
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

type LogUsageSummaryFilter struct {
	UserId         int
	Username       string
	TokenName      string
	ModelName      string
	StartTimestamp int64
	EndTimestamp   int64
	Channel        int
	Group          string
	RequestId      string
}

type LogUsageSummary struct {
	ModelName        string `json:"model_name"`
	RequestCount     int64  `json:"request_count"`
	PromptTokens     int64  `json:"prompt_tokens"`
	CompletionTokens int64  `json:"completion_tokens"`
	Quota            int64  `json:"quota"`
}

// LogUsageAnalysisFilter controls the multidimensional dashboard query. The
// query deliberately stays on the consumption log projection: it never
// selects prompt content, IP addresses, request bodies, or full token values.
type LogUsageAnalysisFilter struct {
	LogUsageSummaryFilter
	Granularity string
	Dimensions  []string
	// Context is supplied by the HTTP handler so an analysis request cannot
	// hold a database connection indefinitely. Nil keeps direct callers
	// backwards-compatible and uses the database's default context.
	Context context.Context
}

type LogUsageAnalysisRow struct {
	Period           int64  `json:"period" gorm:"column:period_bucket"`
	Username         string `json:"username,omitempty"`
	TokenName        string `json:"token_name,omitempty"`
	ModelName        string `json:"model_name,omitempty"`
	GroupName        string `json:"group,omitempty"`
	Channel          int    `json:"channel_id,omitempty"`
	RequestCount     int64  `json:"request_count"`
	PromptTokens     int64  `json:"prompt_tokens"`
	CompletionTokens int64  `json:"completion_tokens"`
	Quota            int64  `json:"quota"`
}

// maxLogUsageAnalysisRows bounds the projection a single analysis response may
// contain. It is enforced per segment and again on the merged result, so a
// segmented cross-month query can never return more rows than a single-segment
// query was allowed to.
const maxLogUsageAnalysisRows = 5000

// maxLogUsageAnalysisPeriodBuckets is a defence-in-depth bucket cap. The range
// bound already limits an hourly query to 90*24+1 buckets; a larger value means
// the period expression or the range validation is wrong, and the query is
// refused rather than allowed to fan out.
const maxLogUsageAnalysisPeriodBuckets = int(common.DashboardMaxRangeSeconds/3600) + 2

var ErrLogUsageAnalysisTooManyRows = errors.New("匹配的分析分组超过 5000 条，请缩小筛选范围或降低时间粒度")

var ErrLogUsageAnalysisTooManyBuckets = fmt.Errorf("匹配的分析时间桶超过 %d 个，请缩小时间范围或降低时间粒度", maxLogUsageAnalysisPeriodBuckets)

// logUsageAnalysisKey is the merge key for a segmented query. It contains every
// grouped dimension so two segments that both contribute to one CST period
// bucket (a day bucket can straddle a segment boundary) are summed instead of
// being emitted twice.
type logUsageAnalysisKey struct {
	Period    int64
	Username  string
	TokenName string
	ModelName string
	GroupName string
	Channel   int
}

func logUsageAnalysisRowKey(row LogUsageAnalysisRow) logUsageAnalysisKey {
	return logUsageAnalysisKey{
		Period:    row.Period,
		Username:  row.Username,
		TokenName: row.TokenName,
		ModelName: row.ModelName,
		GroupName: row.GroupName,
		Channel:   row.Channel,
	}
}

// logUsageAnalysisPeriodExpression returns an integer-valued epoch bucket for
// the selected SQL dialect.  The result is deliberately kept as a BIGINT (or
// the dialect's equivalent) all the way through the arithmetic so GORM can
// scan period_bucket into the API's int64 field.  In particular, PostgreSQL's
// FLOOR(bigint / bigint) returns double precision, which is not safe for that
// scan and was the source of the original dashboard failure.
func logUsageAnalysisPeriodExpression(dialect string, offsetSeconds, stepSeconds int64) string {
	// SQLite's INTEGER division and CAST are both integer-valued.  Keep an
	// explicit CAST for drivers that expose created_at as a wider numeric type.
	if dialect == "sqlite" {
		return fmt.Sprintf("CAST((created_at + %d) / %d AS INTEGER) * %d - %d", offsetSeconds, stepSeconds, stepSeconds, offsetSeconds)
	}
	// MySQL supports DIV for integer quotient and CAST(... AS SIGNED) for a
	// portable signed 64-bit result.  DIV avoids introducing a DECIMAL/float
	// intermediate that can be returned as a string by some drivers.
	if dialect == "mysql" {
		return fmt.Sprintf("CAST((created_at + %d) DIV %d AS SIGNED) * %d - %d", offsetSeconds, stepSeconds, stepSeconds, offsetSeconds)
	}
	// PostgreSQL integer division on bigint operands is integer-valued; the
	// explicit BIGINT cast documents and enforces the scan contract.
	if dialect == "postgres" {
		return fmt.Sprintf("CAST((created_at + %d) / %d AS BIGINT) * %d - %d", offsetSeconds, stepSeconds, stepSeconds, offsetSeconds)
	}
	// Unknown drivers get the SQLite-compatible integer expression rather than
	// a floating-point function.  This is safe for the integer epoch column and
	// keeps the result compatible with the int64 API contract.
	return fmt.Sprintf("CAST((created_at + %d) / %d AS INTEGER) * %d - %d", offsetSeconds, stepSeconds, stepSeconds, offsetSeconds)
}

// GetLogUsageAnalysis returns a bounded, server-side grouped projection for
// the dashboard. Gross margin is intentionally not calculated here: logs hold
// customer-billed quota but do not contain an auditable upstream cost ledger.
func GetLogUsageAnalysis(filter LogUsageAnalysisFilter) (summary []LogUsageAnalysisRow, err error) {
	granularity := filter.Granularity
	if granularity != "hour" && granularity != "day" {
		return nil, errors.New("分析时间粒度仅支持 hour 或 day")
	}
	step := int64(24 * 60 * 60)
	if granularity == "hour" {
		step = 60 * 60
	}
	const cstOffsetSeconds int64 = 8 * 60 * 60

	// Integer timestamps are used so the API stays timezone-neutral;
	// subtracting the offset after multiplying the bucket index keeps both day
	// and hour boundaries at 00:00/HH:00 Asia/Shanghai rather than UTC.  Each
	// supported dialect has a distinct integer expression; do not use FLOOR,
	// whose PostgreSQL result is double precision and cannot be scanned into
	// int64 reliably.
	dialect := "sqlite"
	if LOG_DB != nil && LOG_DB.Dialector != nil {
		dialect = LOG_DB.Dialector.Name()
	}
	periodExpr := logUsageAnalysisPeriodExpression(dialect, cstOffsetSeconds, step)

	dimensions := make(map[string]bool, len(filter.Dimensions))
	for _, dimension := range filter.Dimensions {
		dimensions[dimension] = true
	}
	selectParts := []string{periodExpr + " AS period_bucket"}
	groupParts := []string{periodExpr}
	addDimension := func(name, expression, zeroExpression string) {
		if dimensions[name] {
			selectParts = append(selectParts, expression+" AS "+name)
			groupParts = append(groupParts, expression)
			return
		}
		selectParts = append(selectParts, zeroExpression+" AS "+name)
	}
	addDimension("username", "username", "''")
	addDimension("token_name", "token_name", "''")
	addDimension("model_name", "model_name", "''")
	if dimensions["group"] {
		selectParts = append(selectParts, logGroupCol+" AS group_name")
		groupParts = append(groupParts, logGroupCol)
	} else {
		selectParts = append(selectParts, "'' AS group_name")
	}
	addDimension("channel", "channel_id", "0")
	selectParts = append(selectParts,
		"count(*) AS request_count",
		"coalesce(sum(prompt_tokens), 0) AS prompt_tokens",
		"coalesce(sum(completion_tokens), 0) AS completion_tokens",
		"coalesce(sum(quota), 0) AS quota",
	)

	db := LOG_DB
	if filter.Context != nil {
		db = db.WithContext(filter.Context)
	}

	// A range longer than the per-statement bound is split into consecutive,
	// non-overlapping segments. Each segment is a normal bounded aggregate; the
	// segments are then merged here so the caller still sees one server-side
	// aggregation over CST buckets. Splitting keeps the worst case of a single
	// SQL statement equal to the historical single-segment query.
	segments := common.SplitDashboardRange(filter.StartTimestamp, filter.EndTimestamp)

	querySegment := func(segment common.DashboardRangeSegment) ([]LogUsageAnalysisRow, error) {
		tx := db.Table("logs").Select(strings.Join(selectParts, ", ")).
			Where("type = ?", LogTypeConsume)
		if filter.UserId != 0 {
			tx = tx.Where("user_id = ?", filter.UserId)
		}
		if filter.Username != "" {
			tx = tx.Where("username = ?", filter.Username)
		}
		if filter.TokenName != "" {
			tx = tx.Where("token_name = ?", filter.TokenName)
		}
		if filter.ModelName != "" {
			modelNamePattern, sanitizeErr := sanitizeLikePattern(filter.ModelName)
			if sanitizeErr != nil {
				return nil, sanitizeErr
			}
			tx = tx.Where("model_name LIKE ? ESCAPE '!'", modelNamePattern)
		}
		if segment.Start != 0 {
			tx = tx.Where("created_at >= ?", segment.Start)
		}
		if segment.End != 0 {
			tx = tx.Where("created_at <= ?", segment.End)
		}
		if filter.Channel != 0 {
			tx = tx.Where("channel_id = ?", filter.Channel)
		}
		if filter.Group != "" {
			tx = tx.Where(logGroupCol+" = ?", filter.Group)
		}
		if filter.RequestId != "" {
			tx = tx.Where("request_id = ?", filter.RequestId)
		}

		var rows []LogUsageAnalysisRow
		query := tx.Group(strings.Join(groupParts, ", ")).
			Order("period_bucket asc, quota desc").
			Limit(maxLogUsageAnalysisRows + 1)
		if scanErr := query.Scan(&rows).Error; scanErr != nil {
			common.SysError("failed to query log usage analysis: " + scanErr.Error())
			if errors.Is(scanErr, context.DeadlineExceeded) || errors.Is(scanErr, context.Canceled) {
				return nil, scanErr
			}
			return nil, errors.New("查询多维消费分析失败")
		}
		// Guard per segment as well as on the merged result. A segment that hit
		// the LIMIT would otherwise be silently truncated and under-report totals.
		if len(rows) > maxLogUsageAnalysisRows {
			return nil, ErrLogUsageAnalysisTooManyRows
		}
		return rows, nil
	}

	if len(segments) == 1 {
		rows, queryErr := querySegment(segments[0])
		if queryErr != nil {
			return nil, queryErr
		}
		if bucketErr := checkLogUsageAnalysisBuckets(rows); bucketErr != nil {
			return nil, bucketErr
		}
		return rows, nil
	}

	merged := make(map[logUsageAnalysisKey]*LogUsageAnalysisRow, maxLogUsageAnalysisRows)
	order := make([]logUsageAnalysisKey, 0, maxLogUsageAnalysisRows)
	for _, segment := range segments {
		rows, queryErr := querySegment(segment)
		if queryErr != nil {
			return nil, queryErr
		}
		for i := range rows {
			key := logUsageAnalysisRowKey(rows[i])
			existing, ok := merged[key]
			if !ok {
				row := rows[i]
				merged[key] = &row
				order = append(order, key)
				if len(order) > maxLogUsageAnalysisRows {
					return nil, ErrLogUsageAnalysisTooManyRows
				}
				continue
			}
			existing.RequestCount += rows[i].RequestCount
			existing.PromptTokens += rows[i].PromptTokens
			existing.CompletionTokens += rows[i].CompletionTokens
			existing.Quota += rows[i].Quota
		}
	}

	summary = make([]LogUsageAnalysisRow, 0, len(order))
	for _, key := range order {
		summary = append(summary, *merged[key])
	}
	// Reproduce the single-segment ordering contract (period ascending, then
	// quota descending) with a deterministic tiebreak so a merged response is
	// stable across runs and databases.
	sort.SliceStable(summary, func(i, j int) bool {
		left, right := summary[i], summary[j]
		if left.Period != right.Period {
			return left.Period < right.Period
		}
		if left.Quota != right.Quota {
			return left.Quota > right.Quota
		}
		if left.ModelName != right.ModelName {
			return left.ModelName < right.ModelName
		}
		if left.Username != right.Username {
			return left.Username < right.Username
		}
		if left.TokenName != right.TokenName {
			return left.TokenName < right.TokenName
		}
		if left.GroupName != right.GroupName {
			return left.GroupName < right.GroupName
		}
		return left.Channel < right.Channel
	})
	if bucketErr := checkLogUsageAnalysisBuckets(summary); bucketErr != nil {
		return nil, bucketErr
	}
	return summary, nil
}

func checkLogUsageAnalysisBuckets(rows []LogUsageAnalysisRow) error {
	if len(rows) <= maxLogUsageAnalysisPeriodBuckets {
		// Distinct buckets can never exceed the row count; skip the allocation.
		return nil
	}
	buckets := make(map[int64]struct{}, maxLogUsageAnalysisPeriodBuckets+1)
	for _, row := range rows {
		buckets[row.Period] = struct{}{}
		if len(buckets) > maxLogUsageAnalysisPeriodBuckets {
			return ErrLogUsageAnalysisTooManyBuckets
		}
	}
	return nil
}

// GetLogUsageSummary returns successful consumption grouped by model. It
// intentionally excludes prompt content, IP addresses, token values and error
// details so the result can be safely used for reconciliation exports.
func GetLogUsageSummary(filter LogUsageSummaryFilter) (summary []LogUsageSummary, err error) {
	tx := LOG_DB.Table("logs").
		Select(
			"model_name, count(*) request_count, "+
				"coalesce(sum(prompt_tokens), 0) prompt_tokens, "+
				"coalesce(sum(completion_tokens), 0) completion_tokens, "+
				"coalesce(sum(quota), 0) quota",
		).
		Where("type = ?", LogTypeConsume)

	if filter.UserId != 0 {
		tx = tx.Where("user_id = ?", filter.UserId)
	}
	if filter.Username != "" {
		tx = tx.Where("username = ?", filter.Username)
	}
	if filter.TokenName != "" {
		tx = tx.Where("token_name = ?", filter.TokenName)
	}
	if filter.ModelName != "" {
		modelNamePattern, sanitizeErr := sanitizeLikePattern(filter.ModelName)
		if sanitizeErr != nil {
			return nil, sanitizeErr
		}
		tx = tx.Where("model_name LIKE ? ESCAPE '!'", modelNamePattern)
	}
	if filter.StartTimestamp != 0 {
		tx = tx.Where("created_at >= ?", filter.StartTimestamp)
	}
	if filter.EndTimestamp != 0 {
		tx = tx.Where("created_at <= ?", filter.EndTimestamp)
	}
	if filter.Channel != 0 {
		tx = tx.Where("channel_id = ?", filter.Channel)
	}
	if filter.Group != "" {
		tx = tx.Where(logGroupCol+" = ?", filter.Group)
	}
	if filter.RequestId != "" {
		tx = tx.Where("request_id = ?", filter.RequestId)
	}

	err = tx.Group("model_name").Order("quota desc").Limit(1001).Scan(&summary).Error
	if err != nil {
		common.SysError("failed to query log usage summary: " + err.Error())
		return nil, errors.New("查询消费汇总失败")
	}
	if len(summary) > 1000 {
		return nil, errors.New("匹配的模型数量超过 1000 个，请缩小筛选范围后重试")
	}
	return summary, nil
}

func SumUsedQuota(logType int, startTimestamp int64, endTimestamp int64, modelName string, username string, tokenName string, channel int, group string) (stat Stat, err error) {
	tx := LOG_DB.Table("logs").Select("sum(quota) quota")

	// 为rpm和tpm创建单独的查询
	rpmTpmQuery := LOG_DB.Table("logs").Select("count(*) rpm, sum(prompt_tokens) + sum(completion_tokens) tpm")

	if username != "" {
		tx = tx.Where("username = ?", username)
		rpmTpmQuery = rpmTpmQuery.Where("username = ?", username)
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
