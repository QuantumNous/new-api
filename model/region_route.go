package model

import (
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// RegionRoute 区域路由策略配置。
// 由 ResolveRegionRouting 解析后接入 model/channel_cache.go、model/ability.go 的选渠道链路。
type RegionRoute struct {
	Id         int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	Region     string `json:"region" gorm:"type:varchar(16);not null;index"`  // cn | us | eu | global ...
	Model      string `json:"model" gorm:"type:varchar(64);not null;default:'*'"` // '*' 表示全部模型
	ChannelIds string `json:"channel_ids" gorm:"type:varchar(512)"`           // 逗号分隔的渠道 id 列表
	Tag        string `json:"tag" gorm:"type:varchar(64)"`                    // 或按 tag 选择渠道
	Strategy   string `json:"strategy" gorm:"type:varchar(16);not null;default:'availability'"` // cost | latency | availability | fixed
	Priority   int    `json:"priority" gorm:"default:0"`
	Weight     int    `json:"weight" gorm:"default:0"`
	// 不能使用 gorm default:true：GORM 在 Create 时会忽略零值字段，导致显式禁用的策略被写成启用。
	// 缺省启用由 controller 层负责（请求未带 enabled 时置 true）。
	Enabled bool `json:"enabled" gorm:"index"`
	CreatedAt  int64  `json:"created_at" gorm:"bigint;index"`
	UpdatedAt  int64  `json:"updated_at" gorm:"bigint"`
}

// 区域路由策略白名单。
var AllowedRegionRouteStrategies = map[string]bool{
	"cost":         true,
	"latency":      true,
	"availability": true,
	"fixed":        true,
}

// CreateRegionRoute 创建区域路由策略。
func CreateRegionRoute(m *RegionRoute) error {
	now := time.Now().Unix()
	m.CreatedAt = now
	m.UpdatedAt = now
	err := DB.Create(m).Error
	if err == nil {
		InvalidateRegionRoutingCache()
	}
	return err
}

// GetRegionRouteById 按 id 获取策略。
func GetRegionRouteById(id int64) (*RegionRoute, error) {
	var m RegionRoute
	if err := DB.Where("id = ?", id).First(&m).Error; err != nil {
		return nil, err
	}
	return &m, nil
}

// SearchRegionRoutes 分页列出策略；region/model 为空时不过滤。
func SearchRegionRoutes(page, pageSize int, region, model string) ([]*RegionRoute, int64, error) {
	var items []*RegionRoute
	var total int64
	q := DB.Model(&RegionRoute{})
	if strings.TrimSpace(region) != "" {
		q = q.Where("region = ?", region)
	}
	if strings.TrimSpace(model) != "" {
		q = q.Where("model = ?", model)
	}
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset := (page - 1) * pageSize
	if err := q.Order("id DESC").Offset(offset).Limit(pageSize).Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// UpdateRegionRoute 更新策略可编辑字段。
func UpdateRegionRoute(m *RegionRoute) error {
	updates := map[string]interface{}{
		"region":      m.Region,
		"model":       m.Model,
		"channel_ids": m.ChannelIds,
		"tag":         m.Tag,
		"strategy":    m.Strategy,
		"priority":    m.Priority,
		"weight":      m.Weight,
		"enabled":     m.Enabled,
		"updated_at":  time.Now().Unix(),
	}
	err := DB.Model(&RegionRoute{}).Where("id = ?", m.Id).Updates(updates).Error
	if err == nil {
		InvalidateRegionRoutingCache()
	}
	return err
}

// DeleteRegionRoute 删除策略。
func DeleteRegionRoute(id int64) error {
	err := DB.Where("id = ?", id).Delete(&RegionRoute{}).Error
	if err == nil {
		InvalidateRegionRoutingCache()
	}
	return err
}

// GetEnabledRegionRoutes 取某区域下启用的策略。
// region 同时匹配 'global' 兜底策略；model 支持具体模型或 '*'（通配）匹配。
func GetEnabledRegionRoutes(region, model string) ([]*RegionRoute, error) {
	var items []*RegionRoute
	err := DB.Where("enabled = ? AND region IN (?) AND (model = ? OR model = '*')",
		true, []string{region, RegionGlobal}, model).
		Order("priority DESC").Order("id ASC").Find(&items).Error
	if err != nil {
		return nil, err
	}
	return items, nil
}

// RegionGlobal 是兜底区域标识：配置在该区域下的策略对所有区域生效。
const RegionGlobal = "global"

// maxRegionLength 限制区域标识长度，避免异常请求头把超长字符串带进 SQL 查询。
const maxRegionLength = 16

// NormalizeRegion 归一化区域标识：去空格、转小写、截断超长值。
func NormalizeRegion(region string) string {
	region = strings.ToLower(strings.TrimSpace(region))
	if len(region) > maxRegionLength {
		region = region[:maxRegionLength]
	}
	return region
}

// RegionRouting 是区域路由的解析结果，供选渠道链路使用。
type RegionRouting struct {
	// Active 为 false 时调用方应完全退回默认选渠道逻辑。
	Active bool
	// Region 归一化后的区域标识。
	Region string
	// Strategy 命中的排序策略（cost | latency | availability | fixed），可能为空。
	Strategy string
	// AllowedIds 允许使用的渠道 id 白名单，按配置顺序去重。
	AllowedIds []int64
}

// 区域路由解析结果缓存。选渠道位于转发热路径，逐请求查库不可接受，
// 因此在开启内存缓存时按 region|model 缓存解析结果，TTL 内管理端改动最多延迟生效 regionRoutingCacheTTL。
type regionRoutingCacheEntry struct {
	routing   RegionRouting
	expiresAt time.Time
}

const regionRoutingCacheTTL = 60 * time.Second

var regionRoutingCache sync.Map // string -> regionRoutingCacheEntry

// ResolveRegionRouting 解析某区域 + 模型命中的路由策略，返回渠道白名单与排序策略。
// region 为空、无启用策略、或策略未圈定任何渠道时返回 Active=false，
// 此时调用方保持原有选渠道行为不变。
func ResolveRegionRouting(region, modelName string) RegionRouting {
	region = NormalizeRegion(region)
	if region == "" || DB == nil {
		return RegionRouting{}
	}
	if !common.MemoryCacheEnabled {
		return resolveRegionRouting(region, modelName)
	}
	key := region + "|" + modelName
	if cached, ok := regionRoutingCache.Load(key); ok {
		if entry, ok := cached.(regionRoutingCacheEntry); ok && time.Now().Before(entry.expiresAt) {
			return entry.routing
		}
	}
	routing := resolveRegionRouting(region, modelName)
	regionRoutingCache.Store(key, regionRoutingCacheEntry{
		routing:   routing,
		expiresAt: time.Now().Add(regionRoutingCacheTTL),
	})
	return routing
}

// InvalidateRegionRoutingCache 清空区域路由解析缓存，管理端增删改策略后调用。
func InvalidateRegionRoutingCache() {
	regionRoutingCache.Range(func(key, _ any) bool {
		regionRoutingCache.Delete(key)
		return true
	})
}

func resolveRegionRouting(region, modelName string) RegionRouting {
	result := RegionRouting{}
	routes, err := GetEnabledRegionRoutes(region, modelName)
	if err != nil || len(routes) == 0 {
		return result
	}

	seen := make(map[int64]bool)
	ids := make([]int64, 0, len(routes))
	tags := make([]string, 0, len(routes))
	strategy := ""
	for _, r := range routes {
		// routes 已按 priority DESC, id ASC 排序，首个合法策略即最高优先级策略
		if strategy == "" && AllowedRegionRouteStrategies[r.Strategy] {
			strategy = r.Strategy
		}
		for _, id := range r.ChannelIdsAsSlice() {
			if !seen[id] {
				seen[id] = true
				ids = append(ids, id)
			}
		}
		if tag := strings.TrimSpace(r.Tag); tag != "" {
			tags = append(tags, tag)
		}
	}

	if len(tags) > 0 {
		var tagged []int64
		if err := DB.Model(&Channel{}).Where("tag IN (?)", tags).Pluck("id", &tagged).Error; err == nil {
			for _, id := range tagged {
				if !seen[id] {
					seen[id] = true
					ids = append(ids, id)
				}
			}
		}
	}

	if len(ids) == 0 {
		return result
	}
	result.Active = true
	result.Region = region
	result.Strategy = strategy
	result.AllowedIds = ids
	return result
}

// regionStrategyScore 按区域策略给渠道打分，分数越大越优先被选中。
// 返回值直接替代默认的 channel.GetPriority()，因此需与优先级同量纲（int64）。
func regionStrategyScore(channel *Channel, strategy string) int64 {
	if channel == nil {
		return 0
	}
	switch strategy {
	case "latency":
		// 响应时间越短越优先
		return -int64(channel.ResponseTime)
	case "availability":
		// 可用渠道优先，其次比较响应时间
		var score int64
		if channel.Status == common.ChannelStatusEnabled {
			score = 1_000_000_000
		}
		return score - int64(channel.ResponseTime)
	case "cost":
		// 约定：优先级越低的渠道为越便宜的备用渠道，因此反向取优先级
		return -channel.GetPriority()
	default:
		// fixed / 未知策略：沿用渠道自身优先级
		return channel.GetPriority()
	}
}

// ChannelIdsAsSlice 将逗号分隔的渠道 id 解析为 int64 切片。
func (r *RegionRoute) ChannelIdsAsSlice() []int64 {
	ids := make([]int64, 0)
	for _, s := range strings.Split(r.ChannelIds, ",") {
		s = strings.TrimSpace(s)
		if s == "" {
			continue
		}
		if id, err := strconv.ParseInt(s, 10, 64); err == nil {
			ids = append(ids, id)
		}
	}
	return ids
}
