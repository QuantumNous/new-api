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

package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GetNavigationTree 用户侧获取导航树 API
func GetNavigationTree(c *gin.Context) {
	menuKey := c.DefaultQuery("menu_key", "default_web_top")
	
	// 从 Context 中提取语言，默认为 zh-CN
	locale := c.GetString("lang")
	if locale == "" {
		locale = c.DefaultQuery("lang", "zh-CN")
	}

	// 提取用户登录态与权限
	userID := c.GetInt("id")
	userRole := c.GetInt("role")
	userGroup := c.GetString("group")
	
	isAuthenticated := userID > 0

	tree, err := service.NavService.GetVisibleNavigationTree(menuKey, locale, userRole, userGroup, isAuthenticated)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    tree,
	})
}

// ================= 管理侧菜单 CRUD 接口 =================

// AdminGetMenus 获取所有菜单容器列表
func AdminGetMenus(c *gin.Context) {
	var menus []model.NavigationMenu
	if err := model.DB.Order("id asc").Find(&menus).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": menus})
}

// AdminCreateMenu 创建新的菜单配置
func AdminCreateMenu(c *gin.Context) {
	var menu model.NavigationMenu
	if err := c.ShouldBindJSON(&menu); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	menu.IsSystem = false // 管理员手工创建的绝非系统菜单
	if err := model.DB.Create(&menu).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	service.NavService.InvalidateCache()
	c.JSON(http.StatusOK, gin.H{"success": true, "data": menu})
}

// AdminUpdateMenu 更新菜单元数据
func AdminUpdateMenu(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid menu id"})
		return
	}

	var menu model.NavigationMenu
	if err := model.DB.First(&menu, id).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "menu not found"})
		return
	}

	var input model.NavigationMenu
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	// 仅允许修改名称、启用状态
	menu.Name = input.Name
	menu.Enabled = input.Enabled

	if err := model.DB.Save(&menu).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	service.NavService.InvalidateCache()
	c.JSON(http.StatusOK, gin.H{"success": true, "data": menu})
}

// AdminDeleteMenu 删除非系统级菜单
func AdminDeleteMenu(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid menu id"})
		return
	}

	var menu model.NavigationMenu
	if err := model.DB.First(&menu, id).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "menu not found"})
		return
	}

	if menu.IsSystem {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "system menu cannot be deleted"})
		return
	}

	// 在事务中级联清理 Menu 关联的所有 Item
	err = model.DB.Transaction(func(tx *gorm.DB) error {
		var items []model.NavigationItem
		if err := tx.Where("menu_id = ?", menu.ID).Find(&items).Error; err != nil {
			return err
		}

		for _, item := range items {
			// 触发级联物理删除 Translations & Rules
			if err := tx.Delete(&item).Error; err != nil {
				return err
			}
		}

		return tx.Delete(&menu).Error
	})

	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	service.NavService.InvalidateCache()
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "menu deleted successfully"})
}

// ================= 管理侧菜单节点 CRUD 接口 =================

// AdminGetItems 获取某个菜单下所有的平铺节点（含级联预加载翻译和规则，由前端还原树）
func AdminGetItems(c *gin.Context) {
	menuIDStr := c.Query("menu_id")
	if menuIDStr == "" {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "menu_id query parameter is required"})
		return
	}

	menuID, err := strconv.Atoi(menuIDStr)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid menu_id"})
		return
	}

	var items []model.NavigationItem
	err = model.DB.Where("menu_id = ?", menuID).
		Order("sort_order asc, id asc").
		Preload("Translations").
		Preload("Rules").
		Find(&items).Error
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": items})
}

// AdminCreateItem 创建菜单节点（包含多语言和可见性规则的一体化保存）
func AdminCreateItem(c *gin.Context) {
	var item model.NavigationItem
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	// 1. URL 协议安全性拦截校验（防 XSS 注入）
	if err := service.NavService.ValidateItemURL(item.Type, item.URL); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	// 2. 事务级联创建节点及其子集合
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Omit("Translations", "Rules").Create(&item).Error; err != nil {
			return err
		}

		// 保存多语言
		for i := range item.Translations {
			item.Translations[i].ItemID = item.ID
			if err := tx.Create(&item.Translations[i]).Error; err != nil {
				return err
			}
		}

		// 保存可见性规则
		for i := range item.Rules {
			item.Rules[i].ItemID = item.ID
			if err := tx.Create(&item.Rules[i]).Error; err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	service.NavService.InvalidateCache()
	c.JSON(http.StatusOK, gin.H{"success": true, "data": item})
}

// AdminUpdateItem 更新菜单节点及其子属性（采用 FullSaveAssociations 完整事务更新）
func AdminUpdateItem(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid item id"})
		return
	}

	var item model.NavigationItem
	if err := model.DB.Preload("Translations").Preload("Rules").First(&item, id).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "item not found"})
		return
	}

	var input model.NavigationItem
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	// 1. 安全性 URL 校验
	if err := service.NavService.ValidateItemURL(input.Type, input.URL); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	// 2. 级联事务全量覆盖更新
	err = model.DB.Transaction(func(tx *gorm.DB) error {
		// 清理旧的多语言翻译和可见性规则，避免级联更新产生废弃记录
		if err := tx.Where("item_id = ?", item.ID).Delete(&model.NavigationItemTranslation{}).Error; err != nil {
			return err
		}
		if err := tx.Where("item_id = ?", item.ID).Delete(&model.NavigationVisibilityRule{}).Error; err != nil {
			return err
		}

		// 更新字段
		item.ParentID = input.ParentID
		item.Type = input.Type
		item.ModuleKey = input.ModuleKey
		item.Path = input.Path
		item.URL = input.URL
		item.IconKey = input.IconKey
		item.SortOrder = input.SortOrder
		item.Enabled = input.Enabled
		item.OpenInNewTab = input.OpenInNewTab
		item.ExactActive = input.ExactActive

		// 保存主体，忽略关联表的自动保存，避免与接下来的手动保存发生冲突
		if err := tx.Omit("Translations", "Rules").Save(&item).Error; err != nil {
			return err
		}

		// 创建新的 Translations
		for i := range input.Translations {
			input.Translations[i].ItemID = item.ID
			input.Translations[i].ID = 0 // 重置 ID 确保插入
			if err := tx.Create(&input.Translations[i]).Error; err != nil {
				return err
			}
		}

		// 创建新的 Rules
		for i := range input.Rules {
			input.Rules[i].ItemID = item.ID
			input.Rules[i].ID = 0 // 重置 ID 确保插入
			if err := tx.Create(&input.Rules[i]).Error; err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	service.NavService.InvalidateCache()
	c.JSON(http.StatusOK, gin.H{"success": true, "data": item})
}

// AdminDeleteItem 删除节点（级联物理删除关联的 Translations 和 Rules）
func AdminDeleteItem(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid item id"})
		return
	}

	var item model.NavigationItem
	if err := model.DB.First(&item, id).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "item not found"})
		return
	}

	err = model.DB.Transaction(func(tx *gorm.DB) error {
		// 如果有子节点，将其父节点引用置为空，使子节点不致变成废弃不可达孤儿节点（或者可以选择级联删除子项）
		// 在这里，按严谨级联规则，我们将子节点的 parent_id 设为 nil
		if err := tx.Model(&model.NavigationItem{}).Where("parent_id = ?", item.ID).Update("parent_id", nil).Error; err != nil {
			return err
		}

		// 删除主体，触发外键约束自动级联删除 translations 和 rules
		return tx.Delete(&item).Error
	})

	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	service.NavService.InvalidateCache()
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "item deleted successfully"})
}

type ReorderInput struct {
	ItemID    uint `json:"item_id"`
	SortOrder int  `json:"sort_order"`
}

// AdminReorderItems 批量节点重新排序接口
func AdminReorderItems(c *gin.Context) {
	var inputs []ReorderInput
	if err := c.ShouldBindJSON(&inputs); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	err := model.DB.Transaction(func(tx *gorm.DB) error {
		for _, input := range inputs {
			if err := tx.Model(&model.NavigationItem{}).Where("id = ?", input.ItemID).Update("sort_order", input.SortOrder).Error; err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	service.NavService.InvalidateCache()
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "items reordered successfully"})
}
