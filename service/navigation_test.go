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
	"fmt"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupNavigationTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	oldDB := model.DB
	oldLogDB := model.LOG_DB

	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)

	model.DB = db
	model.LOG_DB = db

	require.NoError(t, db.AutoMigrate(
		&model.NavigationMenu{},
		&model.NavigationItem{},
		&model.NavigationItemTranslation{},
		&model.NavigationVisibilityRule{},
	))

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
		model.DB = oldDB
		model.LOG_DB = oldLogDB
	})

	return db
}

func TestValidateItemURL(t *testing.T) {
	tests := []struct {
		name      string
		itemType  string
		url       string
		expectErr bool
	}{
		{"Valid HTTPS URL", "external_url", "https://google.com/path?query=1", false},
		{"Valid HTTP URL", "external_url", "http://localhost:8080", false},
		{"Empty URL", "external_url", "", true},
		{"Malicious Javascript URL", "external_url", "javascript:alert(1)", true},
		{"Malicious Data URL", "external_url", "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==", true},
		{"No Protocol URL", "external_url", "www.google.com", true},
		{"Non-external type skipped", "builtin_module", "javascript:alert(1)", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := NavService.ValidateItemURL(tt.itemType, tt.url)
			if tt.expectErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestGetVisibleNavigationTree(t *testing.T) {
	db := setupNavigationTestDB(t)

	// Create test menu
	menu := model.NavigationMenu{
		Key:      "test_menu",
		Name:     "Test Menu",
		Client:   "web_default",
		Surface:  "top",
		Enabled:  true,
		IsSystem: false,
	}
	require.NoError(t, db.Create(&menu).Error)

	// Create test items
	// Item 1: Builtin module - Everyone
	item1 := model.NavigationItem{
		MenuID:    menu.ID,
		Type:      "builtin_module",
		ModuleKey: "home",
		SortOrder: 1,
		Enabled:   true,
	}
	require.NoError(t, db.Create(&item1).Error)
	require.NoError(t, db.Create(&model.NavigationItemTranslation{
		ItemID: item1.ID,
		Locale: "zh-CN",
		Label:  "首页",
	}).Error)
	require.NoError(t, db.Create(&model.NavigationItemTranslation{
		ItemID: item1.ID,
		Locale: "en",
		Label:  "Home",
	}).Error)

	// Item 2: Admin only
	item2 := model.NavigationItem{
		MenuID:    menu.ID,
		Type:      "internal_path",
		Path:      "/admin/users",
		SortOrder: 2,
		Enabled:   true,
	}
	require.NoError(t, db.Create(&item2).Error)
	require.NoError(t, db.Create(&model.NavigationItemTranslation{
		ItemID: item2.ID,
		Locale: "zh-CN",
		Label:  "用户管理",
	}).Error)
	require.NoError(t, db.Create(&model.NavigationVisibilityRule{
		ItemID:       item2.ID,
		Effect:       "allow",
		SubjectType:  "role",
		SubjectValue: "admin",
	}).Error)

	// Item 3: VIP Group only
	item3 := model.NavigationItem{
		MenuID:    menu.ID,
		Type:      "external_url",
		URL:       "https://vip.example.com",
		SortOrder: 3,
		Enabled:   true,
	}
	require.NoError(t, db.Create(&item3).Error)
	require.NoError(t, db.Create(&model.NavigationItemTranslation{
		ItemID: item3.ID,
		Locale: "zh-CN",
		Label:  "VIP专属",
	}).Error)
	require.NoError(t, db.Create(&model.NavigationVisibilityRule{
		ItemID:       item3.ID,
		Effect:       "allow",
		SubjectType:  "user_group",
		SubjectValue: "VIP",
	}).Error)

	// Invalidate service cache to ensure fresh DB query
	NavService.InvalidateCache()

	// Case 1: Anonymous user
	t.Run("Anonymous visibility", func(t *testing.T) {
		NavService.InvalidateCache()
		tree, err := NavService.GetVisibleNavigationTree("test_menu", "zh-CN", 0, "", false)
		require.NoError(t, err)
		require.Len(t, tree, 1)
		require.Equal(t, "首页", tree[0].Label)
	})

	// Case 2: Ordinary user (not admin, not VIP)
	t.Run("Ordinary user visibility", func(t *testing.T) {
		NavService.InvalidateCache()
		tree, err := NavService.GetVisibleNavigationTree("test_menu", "zh-CN", common.RoleCommonUser, "default", true)
		require.NoError(t, err)
		require.Len(t, tree, 1)
		require.Equal(t, "首页", tree[0].Label)
	})

	// Case 3: Admin user (role admin)
	t.Run("Admin user visibility", func(t *testing.T) {
		NavService.InvalidateCache()
		tree, err := NavService.GetVisibleNavigationTree("test_menu", "zh-CN", common.RoleAdminUser, "default", true)
		require.NoError(t, err)
		require.Len(t, tree, 2)
		require.Equal(t, "首页", tree[0].Label)
		require.Equal(t, "用户管理", tree[1].Label)
	})

	// Case 4: VIP Group user (ordinary role)
	t.Run("VIP group visibility", func(t *testing.T) {
		NavService.InvalidateCache()
		tree, err := NavService.GetVisibleNavigationTree("test_menu", "zh-CN", common.RoleCommonUser, "VIP", true)
		require.NoError(t, err)
		require.Len(t, tree, 2)
		require.Equal(t, "首页", tree[0].Label)
		require.Equal(t, "VIP专属", tree[1].Label)
	})
}

func TestTranslateLabelFallback(t *testing.T) {
	translations := []model.NavigationItemTranslation{
		{Locale: "zh-CN", Label: "中文简体"},
		{Locale: "zh-TW", Label: "中文繁體"},
		{Locale: "en", Label: "English"},
	}

	tests := []struct {
		locale   string
		expected string
	}{
		{"zh-CN", "中文简体"},
		{"zh-tw", "中文繁體"},
		{"zh-HK", "English"},
		{"en-US", "English"},
		{"fr-FR", "English"},
	}

	for _, tt := range tests {
		t.Run(tt.locale, func(t *testing.T) {
			label := NavService.translateLabel(translations, "fallback_module_key", tt.locale)
			require.Equal(t, tt.expected, label)
		})
	}
}
