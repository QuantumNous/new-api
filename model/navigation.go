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

package model

// NavigationMenu 定义导航菜单的集合类型（如顶部导航栏、侧边栏等）
type NavigationMenu struct {
	ID        uint   `json:"id" gorm:"primaryKey"`
	Key       string `json:"key" gorm:"type:varchar(64);uniqueIndex;not null"` // 例如 "default_web_top"
	Name      string `json:"name" gorm:"type:varchar(128);not null"`           // 菜单名称
	Client    string `json:"client" gorm:"type:varchar(64);not null"`          // "web_default", "mobile" 等
	Surface   string `json:"surface" gorm:"type:varchar(64);not null"`         // "top", "sidebar", "footer" 等
	Enabled   bool   `json:"enabled" gorm:"not null;default:true"`
	IsSystem  bool   `json:"is_system" gorm:"not null;default:false"`          // 系统置顶菜单，禁止删除
	CreatedAt int64  `json:"created_at" gorm:"type:bigint;autoCreateTime"`
	UpdatedAt int64  `json:"updated_at" gorm:"type:bigint;autoUpdateTime"`
}

// NavigationItem 树状嵌套的菜单节点
type NavigationItem struct {
	ID           uint                        `json:"id" gorm:"primaryKey"`
	MenuID       uint                        `json:"menu_id" gorm:"index;not null"`
	ParentID     *uint                       `json:"parent_id" gorm:"index"`             // 父节点ID，允许为 nil 表示顶级节点
	Type         string                      `json:"type" gorm:"type:varchar(64);not null"` // builtin_module, internal_path, external_url, group, divider
	ModuleKey    string                      `json:"module_key" gorm:"type:varchar(128)"`   // 内置模块对应的 Key（例如 "pricing"）
	Path         string                      `json:"path" gorm:"type:varchar(255)"`         // 站内路径
	URL          string                      `json:"url" gorm:"type:text"`                  // 外部链接
	IconKey      string                      `json:"icon_key" gorm:"type:varchar(128)"`     // Lucide/LobeHub 的图标对应键
	SortOrder    int                         `json:"sort_order" gorm:"not null;default:0"`  // 排序权重
	Enabled      bool                        `json:"enabled" gorm:"not null;default:true"`
	OpenInNewTab bool                        `json:"open_in_new_tab" gorm:"not null;default:false"` // 是否在新标签页打开
	ExactActive  bool                        `json:"exact_active" gorm:"not null;default:false"`   // 路由匹配时是否精确匹配
	CreatedAt    int64                       `json:"created_at" gorm:"type:bigint;autoCreateTime"`
	UpdatedAt    int64                       `json:"updated_at" gorm:"type:bigint;autoUpdateTime"`

	// 关联字段，不写入数据库，由 GORM 自动处理级联操作
	Children     []NavigationItem            `json:"children,omitempty" gorm:"foreignKey:ParentID"`
	Translations []NavigationItemTranslation `json:"translations,omitempty" gorm:"foreignKey:ItemID;constraint:OnDelete:CASCADE"`
	Rules        []NavigationVisibilityRule  `json:"rules,omitempty" gorm:"foreignKey:ItemID;constraint:OnDelete:CASCADE"`
}

// NavigationItemTranslation 支持导航节点多语言翻译的数据表
type NavigationItemTranslation struct {
	ID        uint   `json:"id" gorm:"primaryKey"`
	ItemID    uint   `json:"item_id" gorm:"uniqueIndex:idx_item_locale;not null"`
	Locale    string `json:"locale" gorm:"type:varchar(32);uniqueIndex:idx_item_locale;not null"` // 区域标识，如 "zh-CN", "en-US", "zh-TW"
	Label     string `json:"label" gorm:"type:varchar(255);not null"`                            // 显示给用户的文字
	CreatedAt int64  `json:"created_at" gorm:"type:bigint;autoCreateTime"`
	UpdatedAt int64  `json:"updated_at" gorm:"type:bigint;autoUpdateTime"`
}

// NavigationVisibilityRule 控制导航节点精细可见性（如登录状态、角色等）的权限规则表
type NavigationVisibilityRule struct {
	ID           uint   `json:"id" gorm:"primaryKey"`
	ItemID       uint   `json:"item_id" gorm:"index;not null"`
	Effect       string `json:"effect" gorm:"type:varchar(32);not null;default:'allow'"` // 作用效力："allow" 或 "deny"
	SubjectType  string `json:"subject_type" gorm:"type:varchar(64);not null"`           // 主体类型：everyone, anonymous, authenticated, role, user_group
	SubjectValue string `json:"subject_value" gorm:"type:varchar(255);not null"`          // 主体对应的值（例如：role 时对应 "admin", "root"）
	CreatedAt    int64  `json:"created_at" gorm:"type:bigint;autoCreateTime"`
	UpdatedAt    int64  `json:"updated_at" gorm:"type:bigint;autoUpdateTime"`
}
