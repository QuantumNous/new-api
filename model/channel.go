package model

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/types"

	"github.com/samber/lo"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Channel struct {
	Id                 int     `json:"id"`
	Type               int     `json:"type" gorm:"default:0"`
	Key                string  `json:"key" gorm:"not null"`
	OpenAIOrganization *string `json:"openai_organization"`
	TestModel          *string `json:"test_model"`
	Status             int     `json:"status" gorm:"default:1"`
	Name               string  `json:"name" gorm:"index"`
	Weight             *uint   `json:"weight" gorm:"default:0"`
	CreatedTime        int64   `json:"created_time" gorm:"bigint"`
	TestTime           int64   `json:"test_time" gorm:"bigint"`
	ResponseTime       int     `json:"response_time"` // in milliseconds
	BaseURL            *string `json:"base_url" gorm:"column:base_url;default:''"`
	Other              string  `json:"other"`
	Balance            float64 `json:"balance"` // in USD
	BalanceUpdatedTime int64   `json:"balance_updated_time" gorm:"bigint"`
	Models             string  `json:"models"`
	Group              string  `json:"group" gorm:"type:varchar(64);default:'default'"`
	UsedQuota          int64   `json:"used_quota" gorm:"bigint;default:0"`
	ModelMapping       *string `json:"model_mapping" gorm:"type:text"`
	//MaxInputTokens     *int    `json:"max_input_tokens" gorm:"default:0"`
	StatusCodeMapping *string `json:"status_code_mapping" gorm:"type:varchar(1024);default:''"`
	Priority          *int64  `json:"priority" gorm:"bigint;default:0"`
	AutoBan           *int    `json:"auto_ban" gorm:"default:1"`
	OtherInfo         string  `json:"other_info"`
	Tag               *string `json:"tag" gorm:"index"`
	Setting           *string `json:"setting" gorm:"type:text"` // 渠道额外设置
	ParamOverride     *string `json:"param_override" gorm:"type:text"`
	HeaderOverride    *string `json:"header_override" gorm:"type:text"`
	Remark            *string `json:"remark" gorm:"type:varchar(255)" validate:"max=255"`
	// add after v0.8.5
	ChannelInfo ChannelInfo `json:"channel_info" gorm:"type:json"`

	OtherSettings string `json:"settings" gorm:"column:settings"` // 其他设置，存储azure版本等不需要检索的信息，详见dto.ChannelOtherSettings

	// cache info
	Keys []string `json:"-" gorm:"-"`
}

type ChannelInfo struct {
	IsMultiKey             bool                  `json:"is_multi_key"`                        // 是否多Key模式
	MultiKeySize           int                   `json:"multi_key_size"`                      // 多Key模式下的Key数量
	MultiKeyStatusList     map[int]int           `json:"multi_key_status_list"`               // key状态列表，key index -> status
	MultiKeyDisabledReason map[int]string        `json:"multi_key_disabled_reason,omitempty"` // key禁用原因列表，key index -> reason
	MultiKeyDisabledTime   map[int]int64         `json:"multi_key_disabled_time,omitempty"`   // key禁用时间列表，key index -> time
	MultiKeyDisabledUntil  map[int]int64         `json:"multi_key_disabled_until,omitempty"`  // key自动恢复时间列表，key index -> unix time
	MultiKeyPollingIndex   int                   `json:"multi_key_polling_index"`             // 多Key模式下轮询的key索引
	MultiKeyMode           constant.MultiKeyMode `json:"multi_key_mode"`
}

type ChannelSortOptions struct {
	SortBy    string
	SortOrder string
	IDSort    bool
}

var channelSortColumns = map[string]string{
	"id":            "id",
	"name":          "name",
	"priority":      "priority",
	"balance":       "balance",
	"response_time": "response_time",
	"test_time":     "test_time",
}

func NewChannelSortOptions(sortBy string, sortOrder string, idSort bool) ChannelSortOptions {
	normalizedSortBy := strings.ToLower(strings.TrimSpace(sortBy))
	normalizedSortOrder := strings.ToLower(strings.TrimSpace(sortOrder))
	if _, ok := channelSortColumns[normalizedSortBy]; !ok {
		normalizedSortBy = ""
		normalizedSortOrder = ""
	} else if normalizedSortOrder != "asc" {
		normalizedSortOrder = "desc"
	}

	return ChannelSortOptions{
		SortBy:    normalizedSortBy,
		SortOrder: normalizedSortOrder,
		IDSort:    idSort,
	}
}

func (options ChannelSortOptions) Apply(query *gorm.DB) *gorm.DB {
	if columnName, ok := channelSortColumns[options.SortBy]; ok {
		return query.Order(clause.OrderByColumn{
			Column: clause.Column{Name: columnName},
			Desc:   options.SortOrder != "asc",
		})
	}
	if options.IDSort {
		return query.Order(clause.OrderByColumn{
			Column: clause.Column{Name: "id"},
			Desc:   true,
		})
	}
	return query.Order(clause.OrderByColumn{
		Column: clause.Column{Name: "priority"},
		Desc:   true,
	})
}

func resolveChannelSortOptions(idSort bool, sortOptions []ChannelSortOptions) ChannelSortOptions {
	if len(sortOptions) == 0 {
		return NewChannelSortOptions("", "", idSort)
	}
	options := sortOptions[0]
	options.IDSort = options.IDSort || idSort
	return options
}

func NormalizeChannelGroupFilter(group string) string {
	group = strings.TrimSpace(group)
	if group == "" || strings.EqualFold(group, "all") || strings.EqualFold(group, "null") {
		return ""
	}
	return group
}

func channelGroupFilterCondition() string {
	if common.UsingMainDatabase(common.DatabaseTypeMySQL) {
		return `CONCAT(',', ` + commonGroupCol + `, ',') LIKE ? ESCAPE '!'`
	}
	return `(',' || ` + commonGroupCol + ` || ',') LIKE ? ESCAPE '!'`
}

func channelGroupFilterPattern(group string) string {
	group = strings.NewReplacer(
		"!", "!!",
		"%", "!%",
		"_", "!_",
	).Replace(group)
	return "%," + group + ",%"
}

func ApplyChannelGroupFilter(query *gorm.DB, group string) *gorm.DB {
	group = NormalizeChannelGroupFilter(group)
	if group == "" {
		return query
	}
	return query.Where(channelGroupFilterCondition(), channelGroupFilterPattern(group))
}

// Value implements driver.Valuer interface
func (c ChannelInfo) Value() (driver.Value, error) {
	value, err := common.Marshal(&c)
	if err != nil {
		return nil, err
	}
	return string(value), nil
}

// Scan implements sql.Scanner interface
func (c *ChannelInfo) Scan(value interface{}) error {
	var data []byte
	switch typedValue := value.(type) {
	case nil:
		*c = ChannelInfo{}
		return nil
	case string:
		data = []byte(typedValue)
	case []byte:
		data = typedValue
	default:
		return fmt.Errorf("unsupported ChannelInfo scan type %T", value)
	}
	if len(data) == 0 {
		*c = ChannelInfo{}
		return nil
	}
	return common.Unmarshal(data, c)
}

const (
	channelStatusUntilKey       = "status_until"
	channelModelStatusUntilKey  = "model_status_until"
	channelModelStatusReasonKey = "model_status_reason"
	channelModelStatusTimeKey   = "model_status_time"
)

func getInt64FromInterface(value interface{}) int64 {
	switch v := value.(type) {
	case int64:
		return v
	case int:
		return int64(v)
	case float64:
		return int64(v)
	case json.Number:
		n, _ := v.Int64()
		return n
	default:
		return 0
	}
}

func getStringInt64MapFromInterface(value interface{}) map[string]int64 {
	result := make(map[string]int64)
	switch v := value.(type) {
	case map[string]int64:
		for key, val := range v {
			result[key] = val
		}
	case map[string]interface{}:
		for key, val := range v {
			result[key] = getInt64FromInterface(val)
		}
	}
	return result
}

func getStringStringMapFromInterface(value interface{}) map[string]string {
	result := make(map[string]string)
	switch v := value.(type) {
	case map[string]string:
		for key, val := range v {
			result[key] = val
		}
	case map[string]interface{}:
		for key, val := range v {
			if text, ok := val.(string); ok {
				result[key] = text
			}
		}
	}
	return result
}

func (channel *Channel) getStatusUntil() int64 {
	return getInt64FromInterface(channel.GetOtherInfo()[channelStatusUntilKey])
}

func (channel *Channel) GetStatusUntil() int64 {
	if channel == nil {
		return 0
	}
	return channel.getStatusUntil()
}

func (channel *Channel) GetModelStatusUntil(modelName string) int64 {
	if channel == nil || strings.TrimSpace(modelName) == "" {
		return 0
	}
	info := channel.GetOtherInfo()
	return getStringInt64MapFromInterface(info[channelModelStatusUntilKey])[modelName]
}

func (channel *Channel) IsModelCoolingDown(modelName string, now int64) bool {
	return channel.GetModelStatusUntil(modelName) > now
}

func (channel *Channel) releaseExpiredModelCooldowns(now int64) int {
	if channel == nil {
		return 0
	}
	info := channel.GetOtherInfo()
	untilMap := getStringInt64MapFromInterface(info[channelModelStatusUntilKey])
	if len(untilMap) == 0 {
		return 0
	}
	reasonMap := getStringStringMapFromInterface(info[channelModelStatusReasonKey])
	timeMap := getStringInt64MapFromInterface(info[channelModelStatusTimeKey])

	released := 0
	for modelName, until := range untilMap {
		if until <= 0 || until > now {
			continue
		}
		delete(untilMap, modelName)
		delete(reasonMap, modelName)
		delete(timeMap, modelName)
		released++
	}
	if released == 0 {
		return 0
	}
	if len(untilMap) == 0 {
		delete(info, channelModelStatusUntilKey)
	} else {
		info[channelModelStatusUntilKey] = untilMap
	}
	if len(reasonMap) == 0 {
		delete(info, channelModelStatusReasonKey)
	} else {
		info[channelModelStatusReasonKey] = reasonMap
	}
	if len(timeMap) == 0 {
		delete(info, channelModelStatusTimeKey)
	} else {
		info[channelModelStatusTimeKey] = timeMap
	}
	channel.SetOtherInfo(info)
	return released
}

func (c *ChannelInfo) releaseExpiredCooldowns(now int64) bool {
	if c == nil || c.MultiKeyStatusList == nil || c.MultiKeyDisabledUntil == nil {
		return false
	}

	changed := false
	for idx, status := range c.MultiKeyStatusList {
		if status != common.ChannelStatusAutoDisabled {
			continue
		}
		until := c.MultiKeyDisabledUntil[idx]
		if until <= 0 || until > now {
			continue
		}
		delete(c.MultiKeyStatusList, idx)
		if c.MultiKeyDisabledReason != nil {
			delete(c.MultiKeyDisabledReason, idx)
		}
		if c.MultiKeyDisabledTime != nil {
			delete(c.MultiKeyDisabledTime, idx)
		}
		delete(c.MultiKeyDisabledUntil, idx)
		changed = true
	}
	return changed
}

func (channel *Channel) GetKeys() []string {
	if channel.Key == "" {
		return []string{}
	}
	if len(channel.Keys) > 0 {
		return channel.Keys
	}
	trimmed := strings.TrimSpace(channel.Key)
	// If the key starts with '[', try to parse it as a JSON array (e.g., for Vertex AI scenarios)
	if strings.HasPrefix(trimmed, "[") {
		var arr []json.RawMessage
		if err := common.Unmarshal([]byte(trimmed), &arr); err == nil {
			res := make([]string, len(arr))
			for i, v := range arr {
				if err := common.Unmarshal(v, &res[i]); err != nil {
					res[i] = string(v)
				}
			}
			return res
		}
	}
	// A formatted JSON credential is still one key, even if it spans lines.
	if strings.HasPrefix(trimmed, "{") && json.Valid([]byte(trimmed)) {
		return []string{channel.Key}
	}
	// Otherwise, fall back to splitting by newline
	keys := strings.Split(strings.Trim(channel.Key, "\n"), "\n")
	return keys
}

// SetKeys preserves each credential's contents, including embedded newlines.
func (channel *Channel) SetKeys(keys []string) error {
	if keys == nil {
		keys = []string{}
	}
	data, err := common.Marshal(keys)
	if err != nil {
		return err
	}
	channel.Key = string(data)
	channel.Keys = nil
	return nil
}

// ConvertChannelToMultiKey retains the existing credential as one pool entry.
// Repeated requests are harmless and never reset an existing pool's state.
func ConvertChannelToMultiKey(id int) (*Channel, error) {
	lock := GetChannelPollingLock(id)
	lock.Lock()
	defer lock.Unlock()
	var channel Channel
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).First(&channel, id).Error; err != nil {
			return err
		}
		if channel.ChannelInfo.IsMultiKey {
			return nil
		}
		keys := []string{}
		if channel.Key != "" {
			keys = append(keys, channel.Key)
		}
		if err := channel.SetKeys(keys); err != nil {
			return err
		}
		channel.ChannelInfo = ChannelInfo{
			IsMultiKey: true, MultiKeySize: len(keys), MultiKeyMode: constant.MultiKeyModeRandom,
		}
		return tx.Model(&channel).Updates(map[string]any{
			"key": channel.Key, "channel_info": channel.ChannelInfo,
		}).Error
	})
	return &channel, err
}

// UpdateSingleChannelKey refuses to overwrite a pool if a credential refresh or
// OAuth flow started before the channel was converted to multi-key mode.
func UpdateSingleChannelKey(id int, key string) (bool, error) {
	lock := GetChannelPollingLock(id)
	lock.Lock()
	defer lock.Unlock()
	updated := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		var channel Channel
		if err := lockForUpdate(tx).First(&channel, id).Error; err != nil {
			return err
		}
		if channel.ChannelInfo.IsMultiKey {
			return nil
		}
		if err := tx.Model(&channel).Update("key", key).Error; err != nil {
			return err
		}
		updated = true
		return nil
	})
	return updated, err
}

func (channel *Channel) GetNextEnabledKey() (string, int, *types.NewAPIError) {
	// If not in multi-key mode, return the original key string directly.
	if !channel.ChannelInfo.IsMultiKey {
		if strings.TrimSpace(channel.Key) == "" {
			return "", 0, types.NewError(errors.New("no keys available"), types.ErrorCodeChannelNoAvailableKey)
		}
		return channel.Key, 0, nil
	}

	// Obtain all keys (split by \n)
	keys := channel.GetKeys()
	if len(keys) == 0 {
		// No keys available, return error, should disable the channel
		return "", 0, types.NewError(errors.New("no keys available"), types.ErrorCodeChannelNoAvailableKey)
	}

	lock := GetChannelPollingLock(channel.Id)
	lock.Lock()
	defer lock.Unlock()

	if channel.ChannelInfo.releaseExpiredCooldowns(common.GetTimestamp()) {
		if channel.Status == common.ChannelStatusAutoDisabled {
			channel.Status = common.ChannelStatusEnabled
			_ = UpdateAbilityStatus(channel.Id, true)
		}
		_ = channel.SaveWithoutKey()
	}

	statusList := channel.ChannelInfo.MultiKeyStatusList
	// helper to get key status, default to enabled when missing
	getStatus := func(idx int) int {
		if statusList == nil {
			return common.ChannelStatusEnabled
		}
		if status, ok := statusList[idx]; ok {
			return status
		}
		return common.ChannelStatusEnabled
	}

	// Collect indexes of enabled keys
	enabledIdx := make([]int, 0, len(keys))
	for i := range keys {
		if strings.TrimSpace(keys[i]) != "" && getStatus(i) == common.ChannelStatusEnabled {
			enabledIdx = append(enabledIdx, i)
		}
	}
	// If no specific status list or none enabled, return an explicit error so caller can
	// properly handle a channel with no available keys (e.g. mark channel disabled).
	// Returning the first key here caused requests to keep using an already-disabled key.
	if len(enabledIdx) == 0 {
		return "", 0, types.NewError(errors.New("no enabled keys"), types.ErrorCodeChannelNoAvailableKey)
	}

	switch channel.ChannelInfo.MultiKeyMode {
	case constant.MultiKeyModeRandom:
		// Randomly pick one enabled key
		selectedIdx := enabledIdx[rand.Intn(len(enabledIdx))]
		return keys[selectedIdx], selectedIdx, nil
	case constant.MultiKeyModePolling:
		// Use channel-specific lock to ensure thread-safe polling

		channelInfo, err := CacheGetChannelInfo(channel.Id)
		if err != nil {
			return "", 0, types.NewError(err, types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
		}
		defer func() {
			if common.DebugEnabled {
				logger.LogDebug(nil, "channel %d polling index: %d", channel.Id, channel.ChannelInfo.MultiKeyPollingIndex)
			}
			if !common.MemoryCacheEnabled {
				_ = channel.SaveChannelInfo()
			} else {
				// CacheUpdateChannel(channel)
			}
		}()
		// Start from the saved polling index and look for the next enabled key
		start := channelInfo.MultiKeyPollingIndex
		if start < 0 || start >= len(keys) {
			start = 0
		}
		for i := 0; i < len(keys); i++ {
			idx := (start + i) % len(keys)
			if strings.TrimSpace(keys[idx]) != "" && getStatus(idx) == common.ChannelStatusEnabled {
				// update polling index for next call (point to the next position)
				channel.ChannelInfo.MultiKeyPollingIndex = (idx + 1) % len(keys)
				return keys[idx], idx, nil
			}
		}
		// Fallback – should not happen, but return first enabled key
		return keys[enabledIdx[0]], enabledIdx[0], nil
	default:
		// Unknown mode, default to first enabled key (or original key string)
		return keys[enabledIdx[0]], enabledIdx[0], nil
	}
}

func (channel *Channel) HasAvailableKey() bool {
	if channel == nil {
		return false
	}
	if !channel.ChannelInfo.IsMultiKey {
		return strings.TrimSpace(channel.Key) != ""
	}

	keys := channel.GetKeys()
	if len(keys) == 0 {
		return false
	}
	statusList := channel.ChannelInfo.MultiKeyStatusList
	for i := range keys {
		if strings.TrimSpace(keys[i]) == "" {
			continue
		}
		if statusList == nil {
			return true
		}
		status, exists := statusList[i]
		if !exists || status == common.ChannelStatusEnabled {
			return true
		}
	}
	return false
}

func (channel *Channel) SaveChannelInfo() error {
	return DB.Model(channel).Update("channel_info", channel.ChannelInfo).Error
}

func (channel *Channel) GetModels() []string {
	if channel.Models == "" {
		return []string{}
	}
	return strings.Split(strings.Trim(channel.Models, ","), ",")
}

func (channel *Channel) GetGroups() []string {
	if channel.Group == "" {
		return []string{}
	}
	groups := strings.Split(strings.Trim(channel.Group, ","), ",")
	for i, group := range groups {
		groups[i] = strings.TrimSpace(group)
	}
	return groups
}

func (channel *Channel) GetOtherInfo() map[string]interface{} {
	otherInfo := make(map[string]interface{})
	if channel.OtherInfo != "" {
		err := common.Unmarshal([]byte(channel.OtherInfo), &otherInfo)
		if err != nil {
			common.SysLog(fmt.Sprintf("failed to unmarshal other info: channel_id=%d, tag=%s, name=%s, error=%v", channel.Id, channel.GetTag(), channel.Name, err))
		}
	}
	return otherInfo
}

func (channel *Channel) SetOtherInfo(otherInfo map[string]interface{}) {
	otherInfoBytes, err := json.Marshal(otherInfo)
	if err != nil {
		common.SysLog(fmt.Sprintf("failed to marshal other info: channel_id=%d, tag=%s, name=%s, error=%v", channel.Id, channel.GetTag(), channel.Name, err))
		return
	}
	channel.OtherInfo = string(otherInfoBytes)
}

func (channel *Channel) GetTag() string {
	if channel.Tag == nil {
		return ""
	}
	return *channel.Tag
}

func (channel *Channel) SetTag(tag string) {
	channel.Tag = &tag
}

func (channel *Channel) GetAutoBan() bool {
	if channel.AutoBan == nil {
		return false
	}
	return *channel.AutoBan == 1
}

func (channel *Channel) Save() error {
	return DB.Save(channel).Error
}

func (channel *Channel) SaveWithoutKey() error {
	if channel.Id == 0 {
		return errors.New("channel ID is 0")
	}
	return DB.Omit("key").Save(channel).Error
}

func GetAllChannels(startIdx int, num int, selectAll bool, idSort bool, sortOptions ...ChannelSortOptions) ([]*Channel, error) {
	var channels []*Channel
	var err error
	order := resolveChannelSortOptions(idSort, sortOptions)
	if selectAll {
		err = order.Apply(DB).Find(&channels).Error
	} else {
		err = order.Apply(DB).Limit(num).Offset(startIdx).Omit("key").Find(&channels).Error
	}
	return channels, err
}

func GetChannelsByTag(tag string, idSort bool, selectAll bool, sortOptions ...ChannelSortOptions) ([]*Channel, error) {
	var channels []*Channel
	order := resolveChannelSortOptions(idSort, sortOptions)
	query := order.Apply(DB.Where("tag = ?", tag))
	if !selectAll {
		query = query.Omit("key")
	}
	err := query.Find(&channels).Error
	return channels, err
}

func SearchChannels(keyword string, group string, model string, idSort bool, sortOptions ...ChannelSortOptions) ([]*Channel, error) {
	var channels []*Channel
	modelsCol := "`models`"

	// 如果是 PostgreSQL，使用双引号
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		modelsCol = `"models"`
	}

	baseURLCol := "`base_url`"
	// 如果是 PostgreSQL，使用双引号
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		baseURLCol = `"base_url"`
	}

	order := resolveChannelSortOptions(idSort, sortOptions)

	// 构造基础查询
	baseQuery := DB.Model(&Channel{}).Omit("key")

	// 构造WHERE子句
	whereClause := "(id = ? OR name LIKE ? OR " + commonKeyCol + " = ? OR " + baseURLCol + " LIKE ?) AND " + modelsCol + " LIKE ?"
	args := []any{common.String2Int(keyword), "%" + keyword + "%", keyword, "%" + keyword + "%", "%" + model + "%"}
	baseQuery = ApplyChannelGroupFilter(baseQuery.Where(whereClause, args...), group)

	// 执行查询
	err := order.Apply(baseQuery).Find(&channels).Error
	if err != nil {
		return nil, err
	}
	return channels, nil
}

func GetChannelById(id int, selectAll bool) (*Channel, error) {
	channel := &Channel{Id: id}
	var err error = nil
	if selectAll {
		err = DB.First(channel, "id = ?", id).Error
	} else {
		err = DB.Omit("key").First(channel, "id = ?", id).Error
	}
	if err != nil {
		return nil, err
	}
	return channel, nil
}

func BatchInsertChannels(channels []Channel) error {
	if len(channels) == 0 {
		return nil
	}
	tx := DB.Begin()
	if tx.Error != nil {
		return tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	for _, chunk := range lo.Chunk(channels, 50) {
		if err := tx.Create(&chunk).Error; err != nil {
			tx.Rollback()
			return err
		}
		for _, channel_ := range chunk {
			if err := channel_.AddAbilities(tx); err != nil {
				tx.Rollback()
				return err
			}
		}
	}
	return tx.Commit().Error
}

func BatchDeleteChannels(ids []int) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	// 使用事务 分批删除channel表和abilities表
	tx := DB.Begin()
	if tx.Error != nil {
		return 0, tx.Error
	}
	var deletedCount int64
	for _, chunk := range lo.Chunk(ids, 200) {
		result := tx.Where("id in (?)", chunk).Delete(&Channel{})
		if result.Error != nil {
			tx.Rollback()
			return 0, result.Error
		}
		deletedCount += result.RowsAffected
		if err := tx.Where("channel_id in (?)", chunk).Delete(&Ability{}).Error; err != nil {
			tx.Rollback()
			return 0, err
		}
	}
	if err := tx.Commit().Error; err != nil {
		return 0, err
	}
	return deletedCount, nil
}

func (channel *Channel) GetPriority() int64 {
	if channel.Priority == nil {
		return 0
	}
	return *channel.Priority
}

func (channel *Channel) GetWeight() int {
	if channel.Weight == nil {
		return 0
	}
	return int(*channel.Weight)
}

func (channel *Channel) GetBaseURL() string {
	if channel.BaseURL == nil {
		return ""
	}
	url := *channel.BaseURL
	if url == "" {
		url = constant.ChannelBaseURLs[channel.Type]
	}
	return url
}

func (channel *Channel) GetModelMapping() string {
	if channel.ModelMapping == nil {
		return ""
	}
	return *channel.ModelMapping
}

func (channel *Channel) GetStatusCodeMapping() string {
	if channel.StatusCodeMapping == nil {
		return ""
	}
	return *channel.StatusCodeMapping
}

func (channel *Channel) Insert() error {
	var err error
	err = DB.Create(channel).Error
	if err != nil {
		return err
	}
	err = channel.AddAbilities(nil)
	return err
}

func (channel *Channel) Update() error {
	// If this is a multi-key channel, recalculate MultiKeySize based on the current key list to avoid inconsistency after editing keys
	if channel.ChannelInfo.IsMultiKey {
		var keyStr string
		if channel.Key != "" {
			keyStr = channel.Key
		} else {
			// If key is not provided, read the existing key from the database
			if existing, err := GetChannelById(channel.Id, true); err == nil {
				keyStr = existing.Key
			}
		}
		keys := (&Channel{Key: keyStr}).GetKeys()
		channel.ChannelInfo.MultiKeySize = len(keys)
		// Clean up status data that exceeds the new key count to prevent index out of range
		if channel.ChannelInfo.MultiKeyStatusList != nil {
			for idx := range channel.ChannelInfo.MultiKeyStatusList {
				if idx >= channel.ChannelInfo.MultiKeySize {
					delete(channel.ChannelInfo.MultiKeyStatusList, idx)
				}
			}
		}
		if channel.ChannelInfo.MultiKeyDisabledReason != nil {
			for idx := range channel.ChannelInfo.MultiKeyDisabledReason {
				if idx >= channel.ChannelInfo.MultiKeySize {
					delete(channel.ChannelInfo.MultiKeyDisabledReason, idx)
				}
			}
		}
		if channel.ChannelInfo.MultiKeyDisabledTime != nil {
			for idx := range channel.ChannelInfo.MultiKeyDisabledTime {
				if idx >= channel.ChannelInfo.MultiKeySize {
					delete(channel.ChannelInfo.MultiKeyDisabledTime, idx)
				}
			}
		}
		if channel.ChannelInfo.MultiKeyDisabledUntil != nil {
			for idx := range channel.ChannelInfo.MultiKeyDisabledUntil {
				if idx >= channel.ChannelInfo.MultiKeySize {
					delete(channel.ChannelInfo.MultiKeyDisabledUntil, idx)
				}
			}
		}
	}
	var err error
	query := DB.Model(channel)
	// A stale single-key edit must not undo a completed one-way conversion.
	if !channel.ChannelInfo.IsMultiKey {
		query = query.Omit("channel_info")
	}
	err = query.Updates(channel).Error
	if err != nil {
		return err
	}
	DB.Model(channel).First(channel, "id = ?", channel.Id)
	err = channel.UpdateAbilities(nil)
	return err
}

func (channel *Channel) UpdateResponseTime(responseTime int64) {
	err := DB.Model(channel).Select("response_time", "test_time").Updates(Channel{
		TestTime:     common.GetTimestamp(),
		ResponseTime: int(responseTime),
	}).Error
	if err != nil {
		common.SysLog(fmt.Sprintf("failed to update response time: channel_id=%d, error=%v", channel.Id, err))
	}
}

func (channel *Channel) UpdateBalance(balance float64) {
	err := DB.Model(channel).Select("balance_updated_time", "balance").Updates(Channel{
		BalanceUpdatedTime: common.GetTimestamp(),
		Balance:            balance,
	}).Error
	if err != nil {
		common.SysLog(fmt.Sprintf("failed to update balance: channel_id=%d, error=%v", channel.Id, err))
	}
}

func (channel *Channel) Delete() error {
	var err error
	err = DB.Delete(channel).Error
	if err != nil {
		return err
	}
	err = channel.DeleteAbilities()
	return err
}

var channelStatusLock sync.Mutex

// channelPollingLocks stores locks for each channel.id to ensure thread-safe polling
var channelPollingLocks sync.Map

// GetChannelPollingLock returns or creates a mutex for the given channel ID
func GetChannelPollingLock(channelId int) *sync.Mutex {
	if lock, exists := channelPollingLocks.Load(channelId); exists {
		return lock.(*sync.Mutex)
	}
	// Create new lock for this channel
	newLock := &sync.Mutex{}
	actual, _ := channelPollingLocks.LoadOrStore(channelId, newLock)
	return actual.(*sync.Mutex)
}

// CleanupChannelPollingLocks removes locks for channels that no longer exist
// This is optional and can be called periodically to prevent memory leaks
func CleanupChannelPollingLocks() {
	var activeChannelIds []int
	DB.Model(&Channel{}).Pluck("id", &activeChannelIds)

	activeChannelSet := make(map[int]bool)
	for _, id := range activeChannelIds {
		activeChannelSet[id] = true
	}

	channelPollingLocks.Range(func(key, value interface{}) bool {
		channelId := key.(int)
		if !activeChannelSet[channelId] {
			channelPollingLocks.Delete(channelId)
		}
		return true
	})
}

func handlerMultiKeyUpdate(channel *Channel, usingKey string, status int, reason string, disabledUntil int64) {
	keys := channel.GetKeys()
	if len(keys) == 0 {
		channel.Status = status
	} else {
		keyIndex := -1
		for i, key := range keys {
			if key == usingKey {
				keyIndex = i
				break
			}
		}
		if keyIndex < 0 {
			if usingKey != "" {
				common.SysLog(fmt.Sprintf("failed to update multi-key status: channel_id=%d, using key not found", channel.Id))
				return
			}
			channel.Status = status
			info := channel.GetOtherInfo()
			info["status_reason"] = reason
			info["status_time"] = common.GetTimestamp()
			channel.SetOtherInfo(info)
			return
		}
		if channel.ChannelInfo.MultiKeyStatusList == nil {
			channel.ChannelInfo.MultiKeyStatusList = make(map[int]int)
		}
		if status == common.ChannelStatusEnabled {
			delete(channel.ChannelInfo.MultiKeyStatusList, keyIndex)
			if channel.ChannelInfo.MultiKeyDisabledReason != nil {
				delete(channel.ChannelInfo.MultiKeyDisabledReason, keyIndex)
			}
			if channel.ChannelInfo.MultiKeyDisabledTime != nil {
				delete(channel.ChannelInfo.MultiKeyDisabledTime, keyIndex)
			}
			if channel.ChannelInfo.MultiKeyDisabledUntil != nil {
				delete(channel.ChannelInfo.MultiKeyDisabledUntil, keyIndex)
			}
			if channel.Status == common.ChannelStatusAutoDisabled {
				channel.Status = common.ChannelStatusEnabled
			}
		} else {
			channel.ChannelInfo.MultiKeyStatusList[keyIndex] = status
			if channel.ChannelInfo.MultiKeyDisabledReason == nil {
				channel.ChannelInfo.MultiKeyDisabledReason = make(map[int]string)
			}
			if channel.ChannelInfo.MultiKeyDisabledTime == nil {
				channel.ChannelInfo.MultiKeyDisabledTime = make(map[int]int64)
			}
			channel.ChannelInfo.MultiKeyDisabledReason[keyIndex] = reason
			channel.ChannelInfo.MultiKeyDisabledTime[keyIndex] = common.GetTimestamp()
			if disabledUntil > 0 {
				if channel.ChannelInfo.MultiKeyDisabledUntil == nil {
					channel.ChannelInfo.MultiKeyDisabledUntil = make(map[int]int64)
				}
				channel.ChannelInfo.MultiKeyDisabledUntil[keyIndex] = disabledUntil
			} else if channel.ChannelInfo.MultiKeyDisabledUntil != nil {
				delete(channel.ChannelInfo.MultiKeyDisabledUntil, keyIndex)
			}
		}
		if !hasEnabledMultiKey(keys, channel.ChannelInfo.MultiKeyStatusList) {
			channel.Status = common.ChannelStatusAutoDisabled
			info := channel.GetOtherInfo()
			info["status_reason"] = "All keys are disabled"
			info["status_time"] = common.GetTimestamp()
			if disabledUntil > 0 {
				info[channelStatusUntilKey] = disabledUntil
			} else {
				delete(info, channelStatusUntilKey)
			}
			channel.SetOtherInfo(info)
		} else if status == common.ChannelStatusEnabled {
			channel.Status = common.ChannelStatusEnabled
		}
	}
}

func hasEnabledMultiKey(keys []string, statusList map[int]int) bool {
	for i := range keys {
		if statusList == nil {
			return true
		}
		status, ok := statusList[i]
		if !ok || status == common.ChannelStatusEnabled {
			return true
		}
	}
	return false
}

func UpdateChannelStatus(channelId int, usingKey string, status int, reason string) bool {
	changed, err := UpdateChannelStatusWithError(channelId, usingKey, status, reason)
	if err != nil {
		common.SysLog(fmt.Sprintf("failed to update channel status: channel_id=%d, status=%d, error=%v", channelId, status, err))
	}
	return changed
}

func UpdateChannelStatusWithError(channelId int, usingKey string, status int, reason string) (bool, error) {
	return updateChannelStatusUntil(channelId, usingKey, status, reason, 0)
}

func UpdateChannelModelStatusUntil(channelId int, modelName string, reason string, disabledUntil int64) bool {
	modelName = strings.TrimSpace(modelName)
	if channelId <= 0 || modelName == "" || disabledUntil <= 0 {
		return false
	}
	channelStatusLock.Lock()
	defer channelStatusLock.Unlock()

	channel, err := GetChannelById(channelId, true)
	if err != nil || channel == nil {
		return false
	}
	if channel.GetModelStatusUntil(modelName) == disabledUntil {
		return false
	}

	info := channel.GetOtherInfo()
	untilMap := getStringInt64MapFromInterface(info[channelModelStatusUntilKey])
	reasonMap := getStringStringMapFromInterface(info[channelModelStatusReasonKey])
	timeMap := getStringInt64MapFromInterface(info[channelModelStatusTimeKey])
	untilMap[modelName] = disabledUntil
	reasonMap[modelName] = reason
	timeMap[modelName] = common.GetTimestamp()
	info[channelModelStatusUntilKey] = untilMap
	info[channelModelStatusReasonKey] = reasonMap
	info[channelModelStatusTimeKey] = timeMap
	channel.SetOtherInfo(info)

	if err := channel.SaveWithoutKey(); err != nil {
		common.SysLog(fmt.Sprintf("failed to update channel model status until: channel_id=%d, model=%s, error=%v", channel.Id, modelName, err))
		return false
	}
	CacheUpdateChannel(channel)
	return true
}

func UpdateChannelStatusUntil(channelId int, usingKey string, status int, reason string, disabledUntil int64) bool {
	changed, err := updateChannelStatusUntil(channelId, usingKey, status, reason, disabledUntil)
	if err != nil {
		common.SysLog(fmt.Sprintf("failed to update channel status until: channel_id=%d, status=%d, error=%v", channelId, status, err))
	}
	return changed
}

func updateChannelStatusUntil(channelId int, usingKey string, status int, reason string, disabledUntil int64) (bool, error) {
	channelStatusLock.Lock()
	defer channelStatusLock.Unlock()

	channel, err := GetChannelById(channelId, true)
	if err != nil {
		return false, fmt.Errorf("get channel %d: %w", channelId, err)
	}

	shouldUpdateAbilities := false
	if (!channel.ChannelInfo.IsMultiKey || usingKey == "") && channel.Status == status {
		if (status == common.ChannelStatusAutoDisabled || status == common.ChannelStatusRateLimited) && disabledUntil > 0 && channel.getStatusUntil() != disabledUntil {
			info := channel.GetOtherInfo()
			info["status_reason"] = reason
			info["status_time"] = common.GetTimestamp()
			info[channelStatusUntilKey] = disabledUntil
			channel.SetOtherInfo(info)
		} else {
			return false, nil
		}
	} else if channel.ChannelInfo.IsMultiKey && usingKey != "" {
		beforeStatus := channel.Status
		pollingLock := GetChannelPollingLock(channelId)
		pollingLock.Lock()
		handlerMultiKeyUpdate(channel, usingKey, status, reason, disabledUntil)
		pollingLock.Unlock()
		shouldUpdateAbilities = beforeStatus != channel.Status
	} else {
		info := channel.GetOtherInfo()
		info["status_reason"] = reason
		info["status_time"] = common.GetTimestamp()
		if (status == common.ChannelStatusAutoDisabled || status == common.ChannelStatusRateLimited) && disabledUntil > 0 {
			info[channelStatusUntilKey] = disabledUntil
		} else {
			delete(info, channelStatusUntilKey)
		}
		channel.SetOtherInfo(info)
		channel.Status = status
		shouldUpdateAbilities = true
	}

	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Omit("key").Save(channel).Error; err != nil {
			return err
		}
		if shouldUpdateAbilities {
			return tx.Model(&Ability{}).
				Where("channel_id = ?", channelId).
				Select("enabled").
				Update("enabled", channel.Status == common.ChannelStatusEnabled).Error
		}
		return nil
	})
	if err != nil {
		return false, fmt.Errorf("save channel %d status: %w", channelId, err)
	}

	CacheUpdateChannelStatus(channel)
	return true, nil
}

func ReleaseExpiredPlanQuotaCooldowns(now int64, batchSize int) (int, int, int, error) {
	if batchSize <= 0 {
		batchSize = 500
	}

	releasedChannels := 0
	releasedKeys := 0
	releasedModels := 0
	offset := 0
	for {
		var channels []*Channel
		err := DB.
			Select("id", "name", "status", "other_info", "channel_info").
			Order("id asc").
			Limit(batchSize).
			Offset(offset).
			Find(&channels).Error
		if err != nil {
			return releasedChannels, releasedKeys, releasedModels, err
		}
		if len(channels) == 0 {
			break
		}
		offset += batchSize

		for _, channel := range channels {
			if channel == nil {
				continue
			}

			changed := false
			abilityChanged := false

			if released := channel.releaseExpiredModelCooldowns(now); released > 0 {
				changed = true
				releasedModels += released
			}

			if channel.Status == common.ChannelStatusAutoDisabled || channel.Status == common.ChannelStatusRateLimited {
				if until := channel.getStatusUntil(); until > 0 && until <= now {
					info := channel.GetOtherInfo()
					delete(info, channelStatusUntilKey)
					delete(info, "status_reason")
					delete(info, "status_time")
					channel.SetOtherInfo(info)
					channel.Status = common.ChannelStatusEnabled
					changed = true
					abilityChanged = true
					releasedChannels++
				}
			}

			if channel.ChannelInfo.IsMultiKey && channel.ChannelInfo.releaseExpiredCooldowns(now) {
				changed = true
				releasedKeys++
				if channel.Status == common.ChannelStatusAutoDisabled {
					channel.Status = common.ChannelStatusEnabled
					abilityChanged = true
					info := channel.GetOtherInfo()
					delete(info, channelStatusUntilKey)
					delete(info, "status_reason")
					delete(info, "status_time")
					channel.SetOtherInfo(info)
				}
			}

			if !changed {
				continue
			}
			if err := DB.Transaction(func(tx *gorm.DB) error {
				// The scan loads only recovery metadata. Saving the whole struct would
				// overwrite the channel's routing and provider configuration with zeros.
				if err := tx.Model(channel).
					Select("status", "other_info", "channel_info").
					Updates(channel).Error; err != nil {
					return err
				}
				if abilityChanged {
					return tx.Model(&Ability{}).
						Where("channel_id = ?", channel.Id).
						Select("enabled").
						Update("enabled", channel.Status == common.ChannelStatusEnabled).Error
				}
				return nil
			}); err != nil {
				return releasedChannels, releasedKeys, releasedModels, err
			}
			updatedChannel, err := GetChannelById(channel.Id, true)
			if err != nil {
				return releasedChannels, releasedKeys, releasedModels, err
			}
			if abilityChanged {
				CacheUpdateChannelStatus(updatedChannel)
			} else {
				CacheUpdateChannel(updatedChannel)
			}
		}

		if len(channels) < batchSize {
			break
		}
	}

	return releasedChannels, releasedKeys, releasedModels, nil
}

func EnableChannelByTag(tag string) error {
	return updateChannelStatusByTag(tag, common.ChannelStatusEnabled)
}

func DisableChannelByTag(tag string) error {
	return updateChannelStatusByTag(tag, common.ChannelStatusManuallyDisabled)
}

func updateChannelStatusByTag(tag string, status int) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&Channel{}).Where("tag = ?", tag).Update("status", status).Error; err != nil {
			return err
		}
		return tx.Model(&Ability{}).
			Where("tag = ?", tag).
			Select("enabled").
			Update("enabled", status == common.ChannelStatusEnabled).Error
	})
}

func EditChannelByTag(tag string, newTag *string, modelMapping *string, models *string, group *string, priority *int64, weight *uint, paramOverride *string, headerOverride *string) error {
	updateData := Channel{}
	shouldReCreateAbilities := false
	updatedTag := tag
	// 如果 newTag 不为空且不等于 tag，则更新 tag
	if newTag != nil && *newTag != tag {
		updateData.Tag = newTag
		updatedTag = *newTag
	}
	if modelMapping != nil {
		updateData.ModelMapping = modelMapping
	}
	if models != nil && *models != "" {
		shouldReCreateAbilities = true
		updateData.Models = *models
	}
	if group != nil && *group != "" {
		shouldReCreateAbilities = true
		updateData.Group = *group
	}
	if priority != nil {
		updateData.Priority = priority
	}
	if weight != nil {
		updateData.Weight = weight
	}
	if paramOverride != nil {
		updateData.ParamOverride = paramOverride
	}
	if headerOverride != nil {
		updateData.HeaderOverride = headerOverride
	}

	err := DB.Model(&Channel{}).Where("tag = ?", tag).Updates(updateData).Error
	if err != nil {
		return err
	}
	if shouldReCreateAbilities {
		channels, err := GetChannelsByTag(updatedTag, false, false)
		if err == nil {
			for _, channel := range channels {
				err = channel.UpdateAbilities(nil)
				if err != nil {
					common.SysLog(fmt.Sprintf("failed to update abilities: channel_id=%d, tag=%s, error=%v", channel.Id, channel.GetTag(), err))
				}
			}
		}
	} else {
		err := UpdateAbilityByTag(tag, newTag, priority, weight)
		if err != nil {
			return err
		}
	}
	return nil
}

func UpdateChannelUsedQuota(id int, quota int) {
	if common.BatchUpdateEnabled {
		addNewRecord(BatchUpdateTypeChannelUsedQuota, id, quota)
		return
	}
	updateChannelUsedQuota(id, quota)
}

func updateChannelUsedQuota(id int, quota int) {
	err := DB.Model(&Channel{}).Where("id = ?", id).Update("used_quota", gorm.Expr("used_quota + ?", quota)).Error
	if err != nil {
		common.SysLog(fmt.Sprintf("failed to update channel used quota: channel_id=%d, delta_quota=%d, error=%v", id, quota, err))
	}
}

func DeleteChannelByStatus(status int64) (int64, error) {
	result := DB.Where("status = ?", status).Delete(&Channel{})
	return result.RowsAffected, result.Error
}

func DeleteDisabledChannel() (int64, error) {
	result := DB.Where("status = ? or status = ?", common.ChannelStatusAutoDisabled, common.ChannelStatusManuallyDisabled).Delete(&Channel{})
	return result.RowsAffected, result.Error
}

func GetPaginatedTags(offset int, limit int) ([]*string, error) {
	return GetPaginatedChannelTags(DB.Model(&Channel{}), offset, limit)
}

func GetPaginatedChannelTags(query *gorm.DB, offset int, limit int) ([]*string, error) {
	var tags []*string
	err := query.
		Select("DISTINCT tag").
		Where("tag is not null AND tag != ''").
		Order(clause.OrderByColumn{Column: clause.Column{Name: "tag"}}).
		Offset(offset).
		Limit(limit).
		Find(&tags).Error
	return tags, err
}

func SearchTags(keyword string, group string, model string, idSort bool) ([]*string, error) {
	var tags []*string
	modelsCol := "`models`"

	// 如果是 PostgreSQL，使用双引号
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		modelsCol = `"models"`
	}

	baseURLCol := "`base_url`"
	// 如果是 PostgreSQL，使用双引号
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		baseURLCol = `"base_url"`
	}

	order := "priority desc"
	if idSort {
		order = "id desc"
	}

	// 构造基础查询
	baseQuery := DB.Model(&Channel{}).Omit("key")

	// 构造WHERE子句
	whereClause := "(id = ? OR name LIKE ? OR " + commonKeyCol + " = ? OR " + baseURLCol + " LIKE ?) AND " + modelsCol + " LIKE ?"
	args := []any{common.String2Int(keyword), "%" + keyword + "%", keyword, "%" + keyword + "%", "%" + model + "%"}
	baseQuery = ApplyChannelGroupFilter(baseQuery.Where(whereClause, args...), group)

	subQuery := baseQuery.
		Select("tag").
		Where("tag != ''").
		Order(order)

	err := DB.Table("(?) as sub", subQuery).
		Select("DISTINCT tag").
		Find(&tags).Error

	if err != nil {
		return nil, err
	}

	return tags, nil
}

func (channel *Channel) ValidateSettings() error {
	channelParams := &dto.ChannelSettings{}
	if channel.Setting != nil && *channel.Setting != "" {
		err := common.Unmarshal([]byte(*channel.Setting), channelParams)
		if err != nil {
			return err
		}
	}
	if _, err := common.ParseProxyURLStrict(channelParams.Proxy); err != nil {
		return fmt.Errorf("invalid channel proxy: %w", err)
	}
	if err := channelParams.ValidateHTTPTransport(); err != nil {
		return err
	}
	channelOtherSettings := &dto.ChannelOtherSettings{}
	if channel.OtherSettings != "" {
		err := common.UnmarshalJsonStr(channel.OtherSettings, channelOtherSettings)
		if err != nil {
			return err
		}
	}
	if channel.Type == constant.ChannelTypeAdvancedCustom && channelOtherSettings.AdvancedCustom == nil {
		return fmt.Errorf("advanced_custom is required")
	}
	if channelOtherSettings.AdvancedCustom != nil {
		if err := channelOtherSettings.AdvancedCustom.Validate(); err != nil {
			return err
		}
	}
	return nil
}

func (channel *Channel) GetSetting() dto.ChannelSettings {
	setting := dto.ChannelSettings{}
	if channel.Setting != nil && *channel.Setting != "" {
		err := common.Unmarshal([]byte(*channel.Setting), &setting)
		if err != nil {
			common.SysLog(fmt.Sprintf("failed to unmarshal setting: channel_id=%d, error=%v", channel.Id, err))
			channel.Setting = nil // 清空设置以避免后续错误
			_ = channel.Save()    // 保存修改
		}
	}
	return setting
}

func (channel *Channel) SetSetting(setting dto.ChannelSettings) {
	settingBytes, err := common.Marshal(setting)
	if err != nil {
		common.SysLog(fmt.Sprintf("failed to marshal setting: channel_id=%d, error=%v", channel.Id, err))
		return
	}
	channel.Setting = common.GetPointer[string](string(settingBytes))
}

func (channel *Channel) GetOtherSettings() dto.ChannelOtherSettings {
	setting := dto.ChannelOtherSettings{}
	if channel.OtherSettings != "" {
		err := common.UnmarshalJsonStr(channel.OtherSettings, &setting)
		if err != nil {
			common.SysLog(fmt.Sprintf("failed to unmarshal setting: channel_id=%d, error=%v", channel.Id, err))
			channel.OtherSettings = "{}" // 清空设置以避免后续错误
			_ = channel.Save()           // 保存修改
		}
	}
	return setting
}

func (channel *Channel) SetOtherSettings(setting dto.ChannelOtherSettings) {
	settingBytes, err := common.Marshal(setting)
	if err != nil {
		common.SysLog(fmt.Sprintf("failed to marshal setting: channel_id=%d, error=%v", channel.Id, err))
		return
	}
	channel.OtherSettings = string(settingBytes)
}

func (channel *Channel) GetParamOverride() map[string]interface{} {
	paramOverride := make(map[string]interface{})
	if channel.ParamOverride != nil && *channel.ParamOverride != "" {
		err := common.Unmarshal([]byte(*channel.ParamOverride), &paramOverride)
		if err != nil {
			common.SysLog(fmt.Sprintf("failed to unmarshal param override: channel_id=%d, error=%v", channel.Id, err))
		}
	}
	return paramOverride
}

func (channel *Channel) GetHeaderOverride() map[string]interface{} {
	headerOverride := make(map[string]interface{})
	if channel.HeaderOverride != nil && *channel.HeaderOverride != "" {
		err := common.Unmarshal([]byte(*channel.HeaderOverride), &headerOverride)
		if err != nil {
			common.SysLog(fmt.Sprintf("failed to unmarshal header override: channel_id=%d, error=%v", channel.Id, err))
		}
	}
	return headerOverride
}

func GetChannelsByIds(ids []int) ([]*Channel, error) {
	var channels []*Channel
	err := DB.Where("id in (?)", ids).Find(&channels).Error
	return channels, err
}

func BatchSetChannelTag(ids []int, tag *string) error {
	// 开启事务
	tx := DB.Begin()
	if tx.Error != nil {
		return tx.Error
	}

	// 更新标签
	err := tx.Model(&Channel{}).Where("id in (?)", ids).Update("tag", tag).Error
	if err != nil {
		tx.Rollback()
		return err
	}

	// update ability status
	channels, err := GetChannelsByIds(ids)
	if err != nil {
		tx.Rollback()
		return err
	}

	for _, channel := range channels {
		err = channel.UpdateAbilities(tx)
		if err != nil {
			tx.Rollback()
			return err
		}
	}

	// 提交事务
	return tx.Commit().Error
}

// CountAllChannels returns total channels in DB
func CountAllChannels() (int64, error) {
	var total int64
	err := DB.Model(&Channel{}).Count(&total).Error
	return total, err
}

// CountAllTags returns number of non-empty distinct tags
func CountAllTags() (int64, error) {
	return CountChannelTags(DB.Model(&Channel{}))
}

func CountChannelTags(query *gorm.DB) (int64, error) {
	var total int64
	err := query.Where("tag is not null AND tag != ''").Distinct("tag").Count(&total).Error
	return total, err
}

// Get channels of specified type with pagination
func GetChannelsByType(startIdx int, num int, idSort bool, channelType int) ([]*Channel, error) {
	var channels []*Channel
	order := "priority desc"
	if idSort {
		order = "id desc"
	}
	err := DB.Where("type = ?", channelType).Order(order).Limit(num).Offset(startIdx).Omit("key").Find(&channels).Error
	return channels, err
}

// Count channels of specific type
func CountChannelsByType(channelType int) (int64, error) {
	var count int64
	err := DB.Model(&Channel{}).Where("type = ?", channelType).Count(&count).Error
	return count, err
}

// Return map[type]count for all channels
func CountChannelsGroupByType() (map[int64]int64, error) {
	type result struct {
		Type  int64 `gorm:"column:type"`
		Count int64 `gorm:"column:count"`
	}
	var results []result
	err := DB.Model(&Channel{}).Select("type, count(*) as count").Group("type").Find(&results).Error
	if err != nil {
		return nil, err
	}
	counts := make(map[int64]int64)
	for _, r := range results {
		counts[r.Type] = r.Count
	}
	return counts, nil
}
