package model

import (
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// TestFeedbackAutoMigrate 验证三张工单表（含复合索引标签）能在 SQLite 上 AutoMigrate，
// 并跑通核心写/读路径（建工单→回复→未读计数→关闭清未读）。
func TestFeedbackAutoMigrate(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:feedback_migrate?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&FeedbackTopic{}, &FeedbackMessage{}, &FeedbackImage{}); err != nil {
		t.Fatalf("AutoMigrate: %v", err)
	}

	// 直接用本地 db 走一遍最小写/读，绕过包级全局 DB。
	now := time.Now()
	topic := &FeedbackTopic{
		UserId: 42, Category: FeedbackCategoryBug, Title: "无法登录",
		Status: FeedbackStatusPending, MessageCount: 1,
		LastReplyAt: now, LastReplyRole: FeedbackAuthorUser, AdminUnread: true,
	}
	if err := db.Create(topic).Error; err != nil {
		t.Fatalf("create topic: %v", err)
	}
	if err := db.Create(&FeedbackMessage{
		TopicId: topic.Id, UserId: 42, AuthorRole: FeedbackAuthorUser,
		Content: "登录报错", CreatedAt: now,
	}).Error; err != nil {
		t.Fatalf("create message: %v", err)
	}

	var unread int64
	db.Model(&FeedbackTopic{}).
		Where("admin_unread = ? AND status != ?", true, FeedbackStatusClosed).
		Count(&unread)
	if unread != 1 {
		t.Fatalf("admin unread = %d, want 1", unread)
	}

	// 关闭后未读清零
	db.Model(&FeedbackTopic{}).Where("id = ?", topic.Id).
		Updates(map[string]interface{}{"status": FeedbackStatusClosed, "admin_unread": false})
	db.Model(&FeedbackTopic{}).
		Where("admin_unread = ? AND status != ?", true, FeedbackStatusClosed).
		Count(&unread)
	if unread != 0 {
		t.Fatalf("admin unread after close = %d, want 0", unread)
	}
}
