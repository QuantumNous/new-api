package model

import (
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// QuotaData 柱状图数据
type QuotaData struct {
	Id        int    `json:"id"`
	UserID    int    `json:"user_id" gorm:"index"`
	Username  string `json:"username" gorm:"index:idx_qdt_model_user_name,priority:2;size:64;default:''"`
	ModelName string `json:"model_name" gorm:"index:idx_qdt_model_user_name,priority:1;size:64;default:''"`
	CreatedAt int64  `json:"created_at" gorm:"bigint;index:idx_qdt_created_at,priority:2"`
	UseGroup  string `json:"use_group" gorm:"index;size:64;default:''"`
	TokenID   int    `json:"token_id" gorm:"index;default:0"`
	ChannelID int    `json:"channel_id" gorm:"index;default:0"`
	NodeName  string `json:"node_name" gorm:"index;size:64;default:''"`
	TokenUsed int    `json:"token_used" gorm:"default:0"`
	Count     int    `json:"count" gorm:"default:0"`
	Quota     int    `json:"quota" gorm:"default:0"`
	// 缓存率统计分列：prompt_tokens 为输入 token 总量（含缓存读/写），
	// cache_tokens 为缓存读取命中，cache_creation_tokens 为缓存创建（写入）。
	// cache_hit_count 为缓存读取命中的请求数（每次请求 cache_tokens > 0 记 1），
	// 与 count（总请求数）相除即请求次数口径的缓存命中率。
	PromptTokens        int `json:"prompt_tokens" gorm:"default:0"`
	CacheTokens         int `json:"cache_tokens" gorm:"default:0"`
	CacheCreationTokens int `json:"cache_creation_tokens" gorm:"default:0"`
	CacheHitCount       int `json:"cache_hit_count" gorm:"default:0"`
}

type QuotaDataLogParams struct {
	UserID              int
	Username            string
	ModelName           string
	Quota               int
	CreatedAt           int64
	TokenUsed           int
	UseGroup            string
	TokenID             int
	ChannelID           int
	NodeName            string
	PromptTokens        int
	CacheTokens         int
	CacheCreationTokens int
}

func UpdateQuotaData() {
	for {
		if common.DataExportEnabled {
			common.SysLog("正在更新数据看板数据...")
			SaveQuotaDataCache()
		}
		time.Sleep(time.Duration(common.DataExportInterval) * time.Minute)
	}
}

var CacheQuotaData = make(map[string]*QuotaData)
var CacheQuotaDataLock = sync.Mutex{}

func logQuotaDataCache(quotaData *QuotaData) {
	key := fmt.Sprintf("%d\x00%s\x00%s\x00%d\x00%s\x00%d\x00%d\x00%s",
		quotaData.UserID,
		quotaData.Username,
		quotaData.ModelName,
		quotaData.CreatedAt,
		quotaData.UseGroup,
		quotaData.TokenID,
		quotaData.ChannelID,
		quotaData.NodeName,
	)
	count := quotaData.Count
	quota := quotaData.Quota
	tokenUsed := quotaData.TokenUsed
	promptTokens := quotaData.PromptTokens
	cacheTokens := quotaData.CacheTokens
	cacheCreationTokens := quotaData.CacheCreationTokens
	cacheHitCount := quotaData.CacheHitCount
	cachedQuotaData, ok := CacheQuotaData[key]
	if ok {
		cachedQuotaData.Count += count
		cachedQuotaData.Quota += quota
		cachedQuotaData.TokenUsed += tokenUsed
		cachedQuotaData.PromptTokens += promptTokens
		cachedQuotaData.CacheTokens += cacheTokens
		cachedQuotaData.CacheCreationTokens += cacheCreationTokens
		cachedQuotaData.CacheHitCount += cacheHitCount
		quotaData = cachedQuotaData
	}
	CacheQuotaData[key] = quotaData
}

func LogQuotaData(params QuotaDataLogParams) {
	// 只精确到小时
	createdAt := params.CreatedAt - (params.CreatedAt % 3600)
	// 每次调用即一次请求：缓存读取命中（cache_tokens > 0）计 1 次命中。
	cacheHitCount := 0
	if params.CacheTokens > 0 {
		cacheHitCount = 1
	}
	quotaData := &QuotaData{
		UserID:              params.UserID,
		Username:            params.Username,
		ModelName:           params.ModelName,
		CreatedAt:           createdAt,
		UseGroup:            params.UseGroup,
		TokenID:             params.TokenID,
		ChannelID:           params.ChannelID,
		NodeName:            params.NodeName,
		Count:               1,
		Quota:               params.Quota,
		TokenUsed:           params.TokenUsed,
		PromptTokens:        params.PromptTokens,
		CacheTokens:         params.CacheTokens,
		CacheCreationTokens: params.CacheCreationTokens,
		CacheHitCount:       cacheHitCount,
	}

	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	logQuotaDataCache(quotaData)
}

func SaveQuotaDataCache() {
	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	size := len(CacheQuotaData)
	// 如果缓存中有数据，就保存到数据库中
	// 1. 先查询数据库中是否有数据
	// 2. 如果有数据，就更新数据
	// 3. 如果没有数据，就插入数据
	for _, quotaData := range CacheQuotaData {
		quotaDataDB := &QuotaData{}
		DB.Table("quota_data").
			Where("user_id = ? and username = ? and model_name = ? and created_at = ? and use_group = ? and token_id = ? and channel_id = ? and node_name = ?",
				quotaData.UserID, quotaData.Username, quotaData.ModelName, quotaData.CreatedAt, quotaData.UseGroup, quotaData.TokenID, quotaData.ChannelID, quotaData.NodeName).
			First(quotaDataDB)
		if quotaDataDB.Id > 0 {
			//quotaDataDB.Count += quotaData.Count
			//quotaDataDB.Quota += quotaData.Quota
			//DB.Table("quota_data").Save(quotaDataDB)
			increaseQuotaData(quotaData)
		} else {
			DB.Table("quota_data").Create(quotaData)
		}
	}
	CacheQuotaData = make(map[string]*QuotaData)
	common.SysLog(fmt.Sprintf("保存数据看板数据成功，共保存%d条数据", size))
}

func increaseQuotaData(quotaData *QuotaData) {
	err := DB.Table("quota_data").
		Where("user_id = ? and username = ? and model_name = ? and created_at = ? and use_group = ? and token_id = ? and channel_id = ? and node_name = ?",
			quotaData.UserID, quotaData.Username, quotaData.ModelName, quotaData.CreatedAt, quotaData.UseGroup, quotaData.TokenID, quotaData.ChannelID, quotaData.NodeName).
		Updates(map[string]any{
			"count":                 gorm.Expr("count + ?", quotaData.Count),
			"quota":                 gorm.Expr("quota + ?", quotaData.Quota),
			"token_used":            gorm.Expr("token_used + ?", quotaData.TokenUsed),
			"prompt_tokens":         gorm.Expr("prompt_tokens + ?", quotaData.PromptTokens),
			"cache_tokens":          gorm.Expr("cache_tokens + ?", quotaData.CacheTokens),
			"cache_creation_tokens": gorm.Expr("cache_creation_tokens + ?", quotaData.CacheCreationTokens),
			"cache_hit_count":       gorm.Expr("cache_hit_count + ?", quotaData.CacheHitCount),
		}).Error
	if err != nil {
		common.SysLog(fmt.Sprintf("increaseQuotaData error: %s", err))
	}
}

func GetQuotaDataByUsername(username string, startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	// 从quota_data表中查询数据
	err = DB.Table("quota_data").
		Select("user_id, username, model_name, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(prompt_tokens) as prompt_tokens, sum(cache_tokens) as cache_tokens, sum(cache_creation_tokens) as cache_creation_tokens, sum(cache_hit_count) as cache_hit_count").
		Where("username = ? and created_at >= ? and created_at <= ?", username, startTime, endTime).
		Group("user_id, username, model_name, created_at").
		Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetQuotaDataByUserId(userId int, startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	// 从quota_data表中查询数据
	err = DB.Table("quota_data").
		Select("user_id, username, model_name, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(prompt_tokens) as prompt_tokens, sum(cache_tokens) as cache_tokens, sum(cache_creation_tokens) as cache_creation_tokens, sum(cache_hit_count) as cache_hit_count").
		Where("user_id = ? and created_at >= ? and created_at <= ?", userId, startTime, endTime).
		Group("user_id, username, model_name, created_at").
		Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetQuotaDataGroupByUser(startTime int64, endTime int64, username string) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	query := DB.Table("quota_data").
		Select("username, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(prompt_tokens) as prompt_tokens, sum(cache_tokens) as cache_tokens, sum(cache_creation_tokens) as cache_creation_tokens, sum(cache_hit_count) as cache_hit_count").
		Where("created_at >= ? and created_at <= ?", startTime, endTime)
	if username != "" {
		query = query.Where("username = ?", username)
	}
	err = query.Group("username, created_at").
		Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetAllQuotaDates(startTime int64, endTime int64, username string) (quotaData []*QuotaData, err error) {
	if username != "" {
		return GetQuotaDataByUsername(username, startTime, endTime)
	}
	var quotaDatas []*QuotaData
	// 从quota_data表中查询数据
	// only select model_name, sum(count) as count, sum(quota) as quota, model_name, created_at from quota_data group by model_name, created_at;
	//err = DB.Table("quota_data").Where("created_at >= ? and created_at <= ?", startTime, endTime).Find(&quotaDatas).Error
	err = DB.Table("quota_data").Select("model_name, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(prompt_tokens) as prompt_tokens, sum(cache_tokens) as cache_tokens, sum(cache_creation_tokens) as cache_creation_tokens, sum(cache_hit_count) as cache_hit_count, created_at").Where("created_at >= ? and created_at <= ?", startTime, endTime).Group("model_name, created_at").Find(&quotaDatas).Error
	return quotaDatas, err
}

// GetQuotaDataCacheTimeseriesByModel 返回单个模型在时间窗内按小时桶
// 聚合的用量与缓存列（quota_data 的 created_at 本身就是小时粒度），
// 用于模型广场模型详情的缓存率折线图；同桶多用户/多渠道的行被求和。
func GetQuotaDataCacheTimeseriesByModel(modelName string, startTime int64, endTime int64) ([]*QuotaData, error) {
	rows := make([]*QuotaData, 0)
	err := DB.Table("quota_data").
		Select("sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(prompt_tokens) as prompt_tokens, sum(cache_tokens) as cache_tokens, sum(cache_creation_tokens) as cache_creation_tokens, sum(cache_hit_count) as cache_hit_count, created_at").
		Where("model_name = ? and created_at >= ? and created_at <= ?", modelName, startTime, endTime).
		Group("created_at").
		Order("created_at asc").
		Find(&rows).Error
	return rows, err
}

// ChannelQuotaData 渠道维度的小时聚合，用于看板缓存率按渠道查看
type ChannelQuotaData struct {
	ChannelID           int    `json:"channel_id" gorm:"column:channel_id"`
	ChannelName         string `json:"channel_name" gorm:"-"`
	CreatedAt           int64  `json:"created_at" gorm:"column:created_at"`
	Count               int    `json:"count" gorm:"column:count"`
	Quota               int    `json:"quota" gorm:"column:quota"`
	TokenUsed           int    `json:"token_used" gorm:"column:token_used"`
	PromptTokens        int    `json:"prompt_tokens" gorm:"column:prompt_tokens"`
	CacheTokens         int    `json:"cache_tokens" gorm:"column:cache_tokens"`
	CacheCreationTokens int    `json:"cache_creation_tokens" gorm:"column:cache_creation_tokens"`
	CacheHitCount       int    `json:"cache_hit_count" gorm:"column:cache_hit_count"`
}

func fillChannelQuotaDataNames(rows []*ChannelQuotaData) error {
	channelIDSet := make(map[int]struct{})
	channelIDs := make([]int, 0)
	for _, row := range rows {
		if row.ChannelID == 0 {
			continue
		}
		if _, ok := channelIDSet[row.ChannelID]; ok {
			continue
		}
		channelIDSet[row.ChannelID] = struct{}{}
		channelIDs = append(channelIDs, row.ChannelID)
	}
	if len(channelIDs) == 0 {
		return nil
	}
	channelNameByID, err := lookupChannelNames(channelIDs)
	if err != nil {
		return err
	}
	for _, row := range rows {
		if name := channelNameByID[row.ChannelID]; name != "" {
			row.ChannelName = name
			continue
		}
		if row.ChannelID > 0 {
			row.ChannelName = fmt.Sprintf("channel-%d", row.ChannelID)
		}
	}
	return nil
}

func GetQuotaDataGroupByChannel(startTime int64, endTime int64, username string) ([]*ChannelQuotaData, error) {
	rows := make([]*ChannelQuotaData, 0)
	query := DB.Table("quota_data").
		Select("channel_id, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(prompt_tokens) as prompt_tokens, sum(cache_tokens) as cache_tokens, sum(cache_creation_tokens) as cache_creation_tokens, sum(cache_hit_count) as cache_hit_count").
		Where("created_at >= ? and created_at <= ?", startTime, endTime)
	if username != "" {
		query = query.Where("username = ?", username)
	}
	err := query.Group("channel_id, created_at").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	if err := fillChannelQuotaDataNames(rows); err != nil {
		return nil, err
	}
	return rows, nil
}

// GetQuotaDataGroupByGroup 返回分组维度（use_group）按小时桶聚合的用量与
// 缓存列，用于看板缓存率按分组查看；username 或 userId 非空时只聚合对应
// 范围的数据（管理员按用户名筛选，普通用户仅看自己的分组）。
func GetQuotaDataGroupByGroup(startTime int64, endTime int64, username string, userId int) ([]*QuotaData, error) {
	rows := make([]*QuotaData, 0)
	query := DB.Table("quota_data").
		Select("use_group, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(prompt_tokens) as prompt_tokens, sum(cache_tokens) as cache_tokens, sum(cache_creation_tokens) as cache_creation_tokens, sum(cache_hit_count) as cache_hit_count").
		Where("created_at >= ? and created_at <= ?", startTime, endTime)
	if username != "" {
		query = query.Where("username = ?", username)
	}
	if userId > 0 {
		query = query.Where("user_id = ?", userId)
	}
	err := query.Group("use_group, created_at").
		Find(&rows).Error
	return rows, err
}
