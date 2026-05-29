/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

package service

import (
	"errors"
	"fmt"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

// NavigationItemDTO 下发给前端的统一菜单节点格式
type NavigationItemDTO struct {
	ID           uint                `json:"id"`
	Type         string              `json:"type"`
	ModuleKey    string              `json:"module_key,omitempty"`
	Label        string              `json:"label"`
	Path         string              `json:"path,omitempty"`
	URL          string              `json:"url,omitempty"`
	IconKey      string              `json:"icon_key,omitempty"`
	OpenInNewTab bool                `json:"open_in_new_tab"`
	ExactActive  bool                `json:"exact_active"`
	Children     []NavigationItemDTO `json:"children,omitempty"`
}

type NavigationService struct {
	cache   map[string][]NavigationItemDTO
	cacheMu sync.RWMutex
}

var NavService = &NavigationService{
	cache: make(map[string][]NavigationItemDTO),
}

// GetVisibleNavigationTree 获取指定菜单可见的过滤树（线程安全，基于内存缓存）
func (s *NavigationService) GetVisibleNavigationTree(menuKey string, locale string, userRole int, userGroup string, isAuthenticated bool) ([]NavigationItemDTO, error) {
	cacheKey := s.buildCacheKey(menuKey, locale, userRole, userGroup, isAuthenticated)

	// 1. 读缓存
	s.cacheMu.RLock()
	if cachedData, ok := s.cache[cacheKey]; ok {
		s.cacheMu.RUnlock()
		return cachedData, nil
	}
	s.cacheMu.RUnlock()

	// 2. 查数据库并拼装
	var menu model.NavigationMenu
	err := model.DB.Where("key = ? AND enabled = ?", menuKey, true).First(&menu).Error
	if err != nil {
		return nil, fmt.Errorf("menu not found: %w", err)
	}

	var items []model.NavigationItem
	err = model.DB.Where("menu_id = ? AND enabled = ?", menu.ID, true).
		Order("sort_order asc, id asc").
		Preload("Translations").
		Preload("Rules").
		Find(&items).Error
	if err != nil {
		return nil, fmt.Errorf("failed to fetch menu items: %w", err)
	}

	// 3. 过滤并翻译
	visibleItems := make([]model.NavigationItem, 0, len(items))
	for _, item := range items {
		if s.checkVisibility(item.Rules, userRole, userGroup, isAuthenticated) {
			visibleItems = append(visibleItems, item)
		}
	}

	// 4. 构建树形结构
	tree := s.buildTree(visibleItems, locale)

	// 5. 写入缓存
	s.cacheMu.Lock()
	s.cache[cacheKey] = tree
	s.cacheMu.Unlock()

	return tree, nil
}

// InvalidateCache 清空所有缓存（在管理端 CRUD 修改导航后调用）
func (s *NavigationService) InvalidateCache() {
	s.cacheMu.Lock()
	s.cache = make(map[string][]NavigationItemDTO)
	s.cacheMu.Unlock()
	common.SysLog("Navigation memory cache invalidated")
}

// buildCacheKey 构造唯一的缓存 Key
func (s *NavigationService) buildCacheKey(menuKey, locale string, userRole int, userGroup string, isAuthenticated bool) string {
	return fmt.Sprintf("%s:%s:%d:%s:%t", menuKey, locale, userRole, userGroup, isAuthenticated)
}

// checkVisibility 验证节点权限，实施 RBAC 可见性过滤规则
func (s *NavigationService) checkVisibility(rules []model.NavigationVisibilityRule, userRole int, userGroup string, isAuthenticated bool) bool {
	if len(rules) == 0 {
		return true // 无规则限制，默认所有人可见
	}

	hasAllowRules := false
	allowMatched := false

	for _, rule := range rules {
		matched := s.evaluateRuleSubject(rule.SubjectType, rule.SubjectValue, userRole, userGroup, isAuthenticated)

		if rule.Effect == "deny" {
			if matched {
				return false // 只要命中任何一条 deny 规则，立即不可见
			}
		} else if rule.Effect == "allow" {
			hasAllowRules = true
			if matched {
				allowMatched = true
			}
		}
	}

	// 如果配置了 allow 规则，必须命中至少一条 allow 规则才可见
	if hasAllowRules {
		return allowMatched
	}

	return true
}

// evaluateRuleSubject 判断用户是否符合规则主体
func (s *NavigationService) evaluateRuleSubject(subjectType, subjectValue string, userRole int, userGroup string, isAuthenticated bool) bool {
	switch subjectType {
	case "everyone":
		return true
	case "anonymous":
		return !isAuthenticated
	case "authenticated":
		return isAuthenticated
	case "role":
		if !isAuthenticated {
			return false
		}
		// 角色判断规范：
		// "root" (100) -> 仅 root 匹配
		// "admin" (10) -> admin (10) 和 root (100) 匹配
		// "user" (1) -> 所有登录用户匹配
		switch strings.ToLower(subjectValue) {
		case "root":
			return userRole == common.RoleRootUser
		case "admin":
			return userRole >= common.RoleAdminUser
		case "user":
			return userRole >= common.RoleCommonUser
		default:
			return false
		}
	case "user_group":
		if !isAuthenticated {
			return false
		}
		return userGroup == subjectValue
	default:
		return false
	}
}

// buildTree 一次性遍历将扁平列表组装为树形结构，并应用翻译 fallback 规则
func (s *NavigationService) buildTree(items []model.NavigationItem, locale string) []NavigationItemDTO {
	// 初始化节点映射表
	dtoMap := make(map[uint]*NavigationItemDTO)
	for _, item := range items {
		dto := &NavigationItemDTO{
			ID:           item.ID,
			Type:         item.Type,
			ModuleKey:    item.ModuleKey,
			Path:         item.Path,
			URL:          item.URL,
			IconKey:      item.IconKey,
			OpenInNewTab: item.OpenInNewTab,
			ExactActive:  item.ExactActive,
			Label:        s.translateLabel(item.Translations, item.ModuleKey, locale),
			Children:     []NavigationItemDTO{},
		}
		dtoMap[item.ID] = dto
	}

	var rootDTOs []NavigationItemDTO

	// 二次遍历组装树状父子层级
	for _, item := range items {
		dto := dtoMap[item.ID]
		if dto == nil {
			continue
		}

		if item.ParentID == nil {
			// 顶级菜单
			rootDTOs = append(rootDTOs, *dto)
		} else {
			// 子菜单，挂载到父节点下
			parentDTO := dtoMap[*item.ParentID]
			if parentDTO != nil {
				parentDTO.Children = append(parentDTO.Children, *dto)
			} else {
				// 父节点已在权限过滤中被裁剪或被禁用，降级作为顶级项（这里按严谨重构规范：无父节点的子项如果无有效父节点，不显示）
				// 或者可以选择放入 rootDTOs。在此设计中，如果父节点被权限过滤掉，其子节点在软件工程规范中应该同步不可见
			}
		}
	}

	// 重新深拷贝或扁平复制以消除多级嵌套中由于引用的子对象在 map 树组装时的错乱
	var result []NavigationItemDTO
	for _, rootItem := range rootDTOs {
		result = append(result, s.deepCopyDTO(rootItem, dtoMap))
	}

	return result
}

// deepCopyDTO 保证树的深拷贝以维持嵌套结构的正确格式
func (s *NavigationService) deepCopyDTO(node NavigationItemDTO, dtoMap map[uint]*NavigationItemDTO) NavigationItemDTO {
	actualNode := dtoMap[node.ID]
	if actualNode == nil {
		return node
	}

	var copiedChildren []NavigationItemDTO
	for _, child := range actualNode.Children {
		copiedChildren = append(copiedChildren, s.deepCopyDTO(child, dtoMap))
	}

	node.Children = copiedChildren
	return node
}

// translateLabel 多语言 Fallback 精准解析
func (s *NavigationService) translateLabel(translations []model.NavigationItemTranslation, moduleKey string, targetLocale string) string {
	if len(translations) == 0 {
		return moduleKey // 极端无翻译记录下的兜底，展示内置模块键名
	}

	transMap := make(map[string]string)
	for _, t := range translations {
		transMap[strings.ToLower(t.Locale)] = t.Label
	}

	target := strings.ToLower(targetLocale)
	
	// 1. 精确匹配（如 zh-cn）
	if label, ok := transMap[target]; ok {
		return label
	}

	// 2. 去除区域后缀的模糊匹配（如 zh-tw -> zh）
	if parts := strings.Split(target, "-"); len(parts) > 1 {
		if label, ok := transMap[parts[0]]; ok {
			return label
		}
	}

	// 2.5 基础语言前缀模糊匹配（如 target="zh"，则匹配 "zh-cn" 或 "zh-tw"）
	for k, v := range transMap {
		if strings.HasPrefix(k, target+"-") {
			return v
		}
	}

	// 3. Fallback 到英语 "en"
	if label, ok := transMap["en"]; ok {
		return label
	}
	if label, ok := transMap["en-us"]; ok {
		return label
	}

	// 4. Fallback 到中文 "zh-cn"
	if label, ok := transMap["zh-cn"]; ok {
		return label
	}
	if label, ok := transMap["zh"]; ok {
		return label
	}

	// 5. Fallback 到第一条已有翻译
	return translations[0].Label
}

// SaveMenuWithTransaction 用于管理端安全保存（包含子节点和翻译等的事务性级联保存）
func (s *NavigationService) SaveMenuWithTransaction(menu *model.NavigationMenu) error {
	// 可在此实现需要强事务绑定的复杂业务逻辑
	return model.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(menu).Error; err != nil {
			return err
		}
		s.InvalidateCache()
		return nil
	})
}

// ValidateItemURL 拦截恶意 URL 并防范 XSS 漏洞
func (s *NavigationService) ValidateItemURL(itemType string, itemURL string) error {
	if itemType != "external_url" {
		return nil
	}

	trimmedURL := strings.TrimSpace(itemURL)
	if trimmedURL == "" {
		return errors.New("external URL cannot be empty")
	}

	lowerURL := strings.ToLower(trimmedURL)
	// 拦截包含 javascript: 等具有运行脚本能力的恶意协议
	if strings.HasPrefix(lowerURL, "javascript:") || strings.HasPrefix(lowerURL, "data:") {
		return errors.New("malicious URL protocol detected")
	}

	// 必须以 http:// 或 https:// 开头
	if !strings.HasPrefix(lowerURL, "http://") && !strings.HasPrefix(lowerURL, "https://") {
		return errors.New("external URL must start with http:// or https://")
	}

	return nil
}
