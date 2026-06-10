package model

import (
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// TestGetFeedbackAdminTopicsScan 实测 GetFeedbackAdminTopics（Scan 进 []*FeedbackAdminRow
// 的指针切片 + JOIN users 回填 username）能否正确填充——验证 review 第①条 P1 是否成立。
func TestGetFeedbackAdminTopicsScan(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:feedback_admin?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&User{}, &FeedbackTopic{}, &FeedbackMessage{}, &FeedbackImage{}); err != nil {
		t.Fatalf("AutoMigrate: %v", err)
	}

	// 用包级全局 DB（GetFeedbackAdminTopics 走全局 DB），测试后恢复。
	orig := DB
	DB = db
	defer func() { DB = orig }()

	if err := db.Create(&User{Id: 7, Username: "alice", Role: 1, Status: 1}).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	now := time.Now()
	if err := db.Create(&FeedbackTopic{
		UserId: 7, Category: FeedbackCategorySuggestion, Title: "希望支持暗色主题",
		Status: FeedbackStatusPending, MessageCount: 1, LastReplyAt: now,
		LastReplyRole: FeedbackAuthorUser, AdminUnread: true,
	}).Error; err != nil {
		t.Fatalf("create topic: %v", err)
	}

	rows, total, err := GetFeedbackAdminTopics(0, 0, 0, "", "", 1, 10)
	if err != nil {
		t.Fatalf("GetFeedbackAdminTopics: %v", err)
	}
	if total != 1 || len(rows) != 1 {
		t.Fatalf("total=%d len=%d, want 1/1", total, len(rows))
	}
	if rows[0].Title != "希望支持暗色主题" {
		t.Fatalf("title not populated: %q", rows[0].Title)
	}
	if rows[0].Username != "alice" {
		t.Fatalf("username JOIN not populated: %q", rows[0].Username)
	}

	// 按用户名模糊筛选也应命中
	rows2, total2, err := GetFeedbackAdminTopics(0, 0, 0, "ali", "", 1, 10)
	if err != nil || total2 != 1 || len(rows2) != 1 {
		t.Fatalf("username filter failed: total=%d len=%d err=%v", total2, len(rows2), err)
	}
}
