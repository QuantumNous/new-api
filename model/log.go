package model

import (
	"fmt"
	"one-api/common"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"sync"
	"sync/atomic"

	"github.com/bytedance/gopkg/util/gopool"
)

type Log struct {
	Id               int    `json:"id" gorm:"index:idx_created_at_id,priority:1"`
	RequestID        string `json:"request_id" gorm:"request_id"`
	UserId           int    `json:"user_id" gorm:"index"`
	CreatedAt        int64  `json:"created_at" gorm:"bigint;index:idx_created_at_id,priority:2;index:idx_created_at_type"`
	Type             int    `json:"type" gorm:"index:idx_created_at_type"`
	Content          string `json:"content"`
	Username         string `json:"username" gorm:"index;index:index_username_model_name,priority:2;default:''"`
	TokenName        string `json:"token_name" gorm:"index;default:''"`
	ModelName        string `json:"model_name" gorm:"index;index:index_username_model_name,priority:1;default:''"`
	Quota            int    `json:"quota" gorm:"default:0"`
	PromptTokens     int    `json:"prompt_tokens" gorm:"default:0"`
	CompletionTokens int    `json:"completion_tokens" gorm:"default:0"`
	ThinkingTokens   int    `json:"thinking_tokens" gorm:"default:0"`
	UseTime          int    `json:"use_time" gorm:"default:0"`
	IsStream         bool   `json:"is_stream" gorm:"default:false"`
	ChannelId        int    `json:"channel" gorm:"index"`
	ChannelName      string `json:"channel_name" gorm:"->"`
	TokenId          int    `json:"token_id" gorm:"default:0;index"`
	Group            string `json:"group" gorm:"index"`
	Other            string `json:"other"`
}

const (
	LogTypeUnknown = iota
	LogTypeTopup
	LogTypeConsume
	LogTypeManage
	LogTypeSystem
)

func formatUserLogs(logs []*Log) {
	for i := range logs {
		logs[i].ChannelName = ""
		var otherMap map[string]interface{}
		otherMap = common.StrToMap(logs[i].Other)
		if otherMap != nil {
			// delete admin
			delete(otherMap, "admin_info")
		}
		logs[i].Other = common.MapToJsonStr(otherMap)
		logs[i].Id = logs[i].Id % 1024
	}
}

func GetLogByKey(key string) (logs []*Log, err error) {
	if os.Getenv("LOG_SQL_DSN") != "" {
		var tk Token
		if err = DB.Model(&Token{}).Where(keyCol+"=?", strings.TrimPrefix(key, "sk-")).First(&tk).Error; err != nil {
			return nil, err
		}
		err = LOG_DB.Model(&Log{}).Where("token_id=?", tk.Id).Find(&logs).Error
	} else {
		err = LOG_DB.Joins("left join tokens on tokens.id = logs.token_id").Where("tokens.key = ?", strings.TrimPrefix(key, "sk-")).Find(&logs).Error
	}
	formatUserLogs(logs)
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
		CreatedAt: common.GetBeijingTimestamp(),
		Type:      logType,
		Content:   content,
	}
	err := LOG_DB.Create(log).Error
	if err != nil {
		common.SysError("failed to record log: " + err.Error())
	}
}

// 添加新的全局变量
var (
	currentLogTable  atomic.Value
	tableCreateLock  sync.Mutex
	nextDayTimestamp atomic.Int64
)

// 添加新的函数用于获取日志表名
func GetLogTableName(timestamp int64) string {
	// 获取下一天的时间戳
	next := nextDayTimestamp.Load()
	if timestamp >= next {
		tableCreateLock.Lock()
		defer tableCreateLock.Unlock()

		// 双重检查
		if timestamp >= nextDayTimestamp.Load() {
			// 计算新的表名
			t := common.GetBeijingTimeFromTimestamp(timestamp)
			tableName := fmt.Sprintf("logs_%04d_%02d_%02d", t.Year(), t.Month(), t.Day())

			// 创建新表
			newTableSQL := fmt.Sprintf(`CREATE TABLE IF NOT EXISTS %s LIKE logs`, tableName)
			if err := LOG_DB.Exec(newTableSQL).Error; err != nil {
				common.SysError("failed to create new log table: " + err.Error())
				return "logs"
			}

			// 更新下一天的时间戳
			nextDay := time.Date(t.Year(), t.Month(), t.Day()+1, 0, 0, 0, 0, common.BeijingLocation)
			nextDayTimestamp.Store(nextDay.Unix())

			// 存储当前表名
			currentLogTable.Store(tableName)
			return tableName
		}
	}

	if current, ok := currentLogTable.Load().(string); ok && current != "" {
		return current
	}
	return "logs"
}

// 修改 RecordConsumeLog 函数中的相关部分
func RecordConsumeLog(c *gin.Context, userId int, channelId int, promptTokens int, completionTokens int, thinkingTokens int,
	modelName string, tokenName string, quota int, content string, tokenId int, userQuota int, useTimeSeconds int,
	isStream bool, group string, other map[string]interface{}) {
	// 如果是压测流量，不记录计费日志
	if c.GetHeader("X-Test-Traffic") == "true" {
		common.LogInfo(c, "test traffic detected, skipping consume log")
		return
	}

	common.LogInfo(c, fmt.Sprintf("record consume log: userId=%d, 用户调用前余额=%d, channelId=%d, promptTokens=%d, completionTokens=%d, modelName=%s, tokenName=%s, quota=%d, content=%s", userId, userQuota, channelId, promptTokens, completionTokens, modelName, tokenName, quota, content))
	if !common.LogConsumeEnabled {
		return
	}
	username := c.GetString("username")
	otherStr := common.MapToJsonStr(other)
	log := &Log{
		UserId:           common.GetOriginUserId(c, userId),
		RequestID:        c.GetString(common.RequestIdKey),
		Username:         username,
		CreatedAt:        common.GetBeijingTimestamp(),
		Type:             LogTypeConsume,
		Content:          content,
		PromptTokens:     promptTokens,
		CompletionTokens: completionTokens,
		ThinkingTokens:   thinkingTokens,
		TokenName:        tokenName,
		ModelName:        modelName,
		Quota:            quota,
		ChannelId:        common.GetOriginChannelId(c, channelId),
		TokenId:          common.GetOriginTokenId(c, tokenId),
		UseTime:          useTimeSeconds,
		IsStream:         isStream,
		Group:            group,
		Other:            otherStr,
	}
	tableName := GetLogTableName(log.CreatedAt)
	if time.Now().In(common.BeijingLocation).Before(time.Date(2025, 3, 12, 23, 59, 59, 0, common.BeijingLocation)) {
		tableName = "logs"
	}
	err := LOG_DB.Table(tableName).Create(log).Error
	if err != nil {
		common.LogError(c, "failed to record log: "+err.Error())
	}
	if common.DataExportEnabled {
		gopool.Go(func() {
			LogQuotaData(userId, tokenName, username, modelName, quota, common.GetBeijingTimestamp(), promptTokens+completionTokens)
		})
	}
}

func GetAllLogs(logType int, startTimestamp int64, endTimestamp int64, modelName string, username string, tokenName string, startIdx int, num int, channel int, group string) (logs []*Log, total int64, err error) {
	// 获取需要查询的所有表名
	tableNames := getTableNamesByTimeRange(startTimestamp, endTimestamp)
	if len(tableNames) == 0 {
		return nil, 0, nil
	}

	// 用于存储所有查询结果
	allLogs := make([]*Log, 0)
	total = 0

	// 遍历每个表进行查询
	for _, tableName := range tableNames {
		var tempTotal int64
		var tempLogs []*Log
		var tx = LOG_DB.Table(tableName)

		if logType != LogTypeUnknown {
			tx = tx.Where("type = ?", logType)
		}
		if modelName != "" {
			tx = tx.Where("model_name like ?", modelName)
		}
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
		if channel != 0 {
			tx = tx.Where("channel_id = ?", channel)
		}
		if group != "" {
			tx = tx.Where(groupCol+" = ?", group)
		}

		// 获取当前表的总数
		if err = tx.Count(&tempTotal).Error; err != nil {
			return nil, 0, err
		}
		total += tempTotal

		// 获取当前表的数据
		if err = tx.Order("id desc").Find(&tempLogs).Error; err != nil {
			return nil, 0, err
		}
		allLogs = append(allLogs, tempLogs...)
	}

	// 对所有结果按时间倒序排序
	sort.Slice(allLogs, func(i, j int) bool {
		return allLogs[i].CreatedAt > allLogs[j].CreatedAt
	})

	// 处理分页
	end := startIdx + num
	if end > len(allLogs) {
		end = len(allLogs)
	}
	if startIdx < len(allLogs) {
		logs = allLogs[startIdx:end]
	}

	// 处理渠道信息
	channelIds := make([]int, 0)
	channelMap := make(map[int]string)
	for _, log := range logs {
		if log.ChannelId != 0 {
			channelIds = append(channelIds, log.ChannelId)
		}
	}
	if len(channelIds) > 0 {
		var channels []struct {
			Id   int    `gorm:"column:id"`
			Name string `gorm:"column:name"`
		}
		if err = DB.Table("channels").Select("id, name").Where("id IN ?", channelIds).Find(&channels).Error; err != nil {
			return logs, total, err
		}
		for _, channel := range channels {
			channelMap[channel.Id] = channel.Name
		}
		for i := range logs {
			logs[i].ChannelName = channelMap[logs[i].ChannelId]
		}
	}

	return logs, total, nil
}

func GetUserLogs(userId int, logType int, startTimestamp int64, endTimestamp int64, modelName string, tokenName string, startIdx int, num int, group string) (logs []*Log, total int64, err error) {
	// 获取需要查询的所有表名
	tableNames := getTableNamesByTimeRange(startTimestamp, endTimestamp)
	if len(tableNames) == 0 {
		return nil, 0, nil
	}

	// 用于存储所有查询结果
	allLogs := make([]*Log, 0)
	total = 0

	// 遍历每个表进行查询
	for _, tableName := range tableNames {
		var tempTotal int64
		var tempLogs []*Log
		var tx = LOG_DB.Table(tableName)

		if logType == LogTypeUnknown {
			tx = tx.Where("user_id = ?", userId)
		} else {
			tx = tx.Where("user_id = ? and type = ?", userId, logType)
		}

		if modelName != "" {
			tx = tx.Where("model_name like ?", modelName)
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
		if group != "" {
			tx = tx.Where(groupCol+" = ?", group)
		}

		// 获取当前表的总数
		if err = tx.Count(&tempTotal).Error; err != nil {
			return nil, 0, err
		}
		total += tempTotal

		// 获取当前表的数据
		if err = tx.Order("id desc").Find(&tempLogs).Error; err != nil {
			return nil, 0, err
		}
		allLogs = append(allLogs, tempLogs...)
	}

	// 对所有结果按时间倒序排序
	sort.Slice(allLogs, func(i, j int) bool {
		return allLogs[i].CreatedAt > allLogs[j].CreatedAt
	})

	// 处理分页
	end := startIdx + num
	if end > len(allLogs) {
		end = len(allLogs)
	}
	if startIdx < len(allLogs) {
		logs = allLogs[startIdx:end]
	}

	formatUserLogs(logs)
	return logs, total, nil
}

func SearchAllLogs(keyword string) (logs []*Log, err error) {
	// 获取当前时间
	now := time.Now()
	// 获取一个月前的时间戳
	oneMonthAgo := now.AddDate(0, -1, 0)

	// 获取时间范围内的所有表名
	tableNames := getTableNamesByTimeRange(oneMonthAgo.Unix(), now.Unix())

	// 用于存储所有查询结果
	allLogs := make([]*Log, 0)

	// 遍历每个表进行查询
	for _, tableName := range tableNames {
		var tempLogs []*Log
		err = LOG_DB.Table(tableName).
			Where("type = ? or content LIKE ?", keyword, keyword+"%").
			Order("id desc").
			Find(&tempLogs).Error
		if err != nil {
			return nil, err
		}
		allLogs = append(allLogs, tempLogs...)
	}

	// 对所有结果按时间倒序排序
	sort.Slice(allLogs, func(i, j int) bool {
		return allLogs[i].CreatedAt > allLogs[j].CreatedAt
	})

	// 只返回最近的 MaxRecentItems 条记录
	if len(allLogs) > common.MaxRecentItems {
		allLogs = allLogs[:common.MaxRecentItems]
	}

	return allLogs, nil
}

func SearchUserLogs(userId int, keyword string) (logs []*Log, err error) {
	// 获取当前时间
	now := time.Now()
	// 获取一个月前的时间戳
	oneMonthAgo := now.AddDate(0, -1, 0)

	// 获取时间范围内的所有表名
	tableNames := getTableNamesByTimeRange(oneMonthAgo.Unix(), now.Unix())

	// 用于存储所有查询结果
	allLogs := make([]*Log, 0)

	// 遍历每个表进行查询
	for _, tableName := range tableNames {
		var tempLogs []*Log
		err = LOG_DB.Table(tableName).
			Where("user_id = ? and type = ?", userId, keyword).
			Order("id desc").
			Find(&tempLogs).Error
		if err != nil {
			return nil, err
		}
		allLogs = append(allLogs, tempLogs...)
	}

	// 对所有结果按时间倒序排序
	sort.Slice(allLogs, func(i, j int) bool {
		return allLogs[i].CreatedAt > allLogs[j].CreatedAt
	})

	// 只返回最近的 MaxRecentItems 条记录
	if len(allLogs) > common.MaxRecentItems {
		allLogs = allLogs[:common.MaxRecentItems]
	}

	formatUserLogs(allLogs)
	return allLogs, nil
}

type Stat struct {
	Quota int `json:"quota"`
	Rpm   int `json:"rpm"`
	Tpm   int `json:"tpm"`
}

// 添加一个辅助函数用于获取时间范围内的所有表名
func getTableNamesByTimeRange(startTimestamp, endTimestamp int64) []string {
	if startTimestamp == 0 || endTimestamp == 0 {
		return []string{"logs"}
	}

	tables := make([]string, 0)
	start := time.Unix(startTimestamp, 0)
	end := time.Unix(endTimestamp, 0)

	// 如果在同一天，直接返回一个表名
	if start.Year() == end.Year() && start.Month() == end.Month() && start.Day() == end.Day() {
		tableName := fmt.Sprintf("logs_%04d_%02d_%02d", start.Year(), start.Month(), start.Day())
		return []string{tableName}
	}

	// 遍历日期范围内的每一天
	for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
		tableName := fmt.Sprintf("logs_%04d_%02d_%02d", d.Year(), d.Month(), d.Day())
		tables = append(tables, tableName)
	}

	return tables
}

// 修改 SumUsedQuota 函数
func SumUsedQuota(logType int, startTimestamp int64, endTimestamp int64, modelName string, username string, tokenName string, channel int, group string) (stat Stat) {
	// 获取需要查询的所有表名
	tableNames := getTableNamesByTimeRange(startTimestamp, endTimestamp)
	if len(tableNames) == 0 {
		return stat
	}
	// 用于存储聚合结果
	var totalQuota int64
	// var totalRpm int64
	// var totalTpm int64

	// 遍历每个表进行查询
	for _, tableName := range tableNames {
		var tempStat Stat

		// 配额查询
		quotaQuery := LOG_DB.Table(tableName).Select("IFNULL(sum(quota), 0) as quota")
		if username != "" {
			quotaQuery = quotaQuery.Where("username = ?", username)
		}
		if tokenName != "" {
			quotaQuery = quotaQuery.Where("token_name = ?", tokenName)
		}
		if startTimestamp != 0 {
			quotaQuery = quotaQuery.Where("created_at >= ?", startTimestamp)
		}
		if endTimestamp != 0 {
			quotaQuery = quotaQuery.Where("created_at <= ?", endTimestamp)
		}
		if modelName != "" {
			quotaQuery = quotaQuery.Where("model_name like ?", modelName)
		}
		if channel != 0 {
			quotaQuery = quotaQuery.Where("channel_id = ?", channel)
		}
		if group != "" {
			quotaQuery = quotaQuery.Where(groupCol+" = ?", group)
		}
		quotaQuery = quotaQuery.Where("type = ?", LogTypeConsume)
		quotaQuery.Scan(&tempStat)

		totalQuota += int64(tempStat.Quota)
	}

	// RPM和TPM只需要查询最近的表
	rpmTpmQuery := LOG_DB.Table(tableNames[len(tableNames)-1]).
		Select("count(*) rpm, IFNULL(sum(prompt_tokens), 0) + IFNULL(sum(completion_tokens), 0) tpm")

	if username != "" {
		rpmTpmQuery = rpmTpmQuery.Where("username = ?", username)
	}
	if tokenName != "" {
		rpmTpmQuery = rpmTpmQuery.Where("token_name = ?", tokenName)
	}
	if modelName != "" {
		rpmTpmQuery = rpmTpmQuery.Where("model_name like ?", modelName)
	}
	if channel != 0 {
		rpmTpmQuery = rpmTpmQuery.Where("channel_id = ?", channel)
	}
	if group != "" {
		rpmTpmQuery = rpmTpmQuery.Where(groupCol+" = ?", group)
	}

	rpmTpmQuery = rpmTpmQuery.Where("type = ?", LogTypeConsume).
		Where("created_at >= ?", time.Now().Add(-60*time.Second).Unix())

	var tempStat Stat
	rpmTpmQuery.Scan(&tempStat)

	// 合并结果
	stat.Quota = int(totalQuota)
	stat.Rpm = tempStat.Rpm
	stat.Tpm = tempStat.Tpm

	return stat
}

func SumUsedToken(logType int, startTimestamp int64, endTimestamp int64, modelName string, username string, tokenName string) (token int) {
	// 获取需要查询的所有表名
	tableNames := getTableNamesByTimeRange(startTimestamp, endTimestamp)
	if len(tableNames) == 0 {
		return 0
	}

	var totalTokens int64
	// 遍历每个表进行查询
	for _, tableName := range tableNames {
		var tempToken int64
		tx := LOG_DB.Table(tableName).
			Select("IFNULL(sum(prompt_tokens), 0) + IFNULL(sum(completion_tokens), 0)")

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
		tx.Where("type = ?", LogTypeConsume).Scan(&tempToken)

		totalTokens += tempToken
	}

	return int(totalTokens)
}

func DeleteOldLog(targetTimestamp int64) (int64, error) {
	result := LOG_DB.Where("created_at < ?", targetTimestamp).Delete(&Log{})
	return result.RowsAffected, result.Error
}

// SELECT
// logs.channel_id,
// COALESCE(channels.name, logs.channel_name, '未知渠道') AS channel_name,
// logs.model_name,
// SUM(logs.prompt_tokens) AS total_prompt_tokens,
// SUM(logs.completion_tokens) AS total_completion_tokens
// FROM logs
// LEFT JOIN channels ON logs.channel_id = channels.id
// WHERE
// logs.created_at BETWEEN 1741338023 AND 1741341623
// GROUP BY
// logs.channel_id,   -- 渠道ID作为主分组键
// channel_name,      -- 直接使用SELECT中的别名（COALESCE表达式结果）
// logs.model_name    -- 模型名称
// ORDER BY
// logs.channel_id;

func GetAllChannelBilling(logType int, startTimestamp int64, endTimestamp int64, modelName string, username string, tokenName string) (token int) {
	// 获取需要查询的所有表名
	tableNames := getTableNamesByTimeRange(startTimestamp, endTimestamp)
	if len(tableNames) == 0 {
		return 0
	}

	var totalTokens int
	// 遍历每个表进行查询
	for _, tableName := range tableNames {
		var tempToken int
		tx := LOG_DB.Table(tableName).Select("ifnull(sum(prompt_tokens),0) + ifnull(sum(completion_tokens),0)")
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
		tx.Where("type = ?", LogTypeConsume).Scan(&tempToken)
		totalTokens += tempToken
	}
	return totalTokens
}

// 在 init 函数中初始化（添加新的 init 函数）
func init() {
	// 设置初始的下一天时间戳
	now := common.GetBeijingTime()
	nextDay := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, common.BeijingLocation)
	nextDayTimestamp.Store(nextDay.Unix())
	// 设置当前表名
	currentLogTable.Store(fmt.Sprintf("logs_%04d_%02d_%02d", now.Year(), now.Month(), now.Day()))
}

func InitLogTable() error {
	now := common.GetBeijingTime()
	nextDay := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, common.BeijingLocation)
	nextDayTimestamp.Store(nextDay.Unix())

	tableName := fmt.Sprintf("logs_%04d_%02d_%02d", now.Year(), now.Month(), now.Day())
	currentLogTable.Store(tableName)

	newTableSQL := fmt.Sprintf(`CREATE TABLE IF NOT EXISTS %s LIKE logs`, tableName)
	if err := LOG_DB.Exec(newTableSQL).Error; err != nil {
		common.SysError("failed to create new log table: " + err.Error())
		return err
	}
	return nil
}
