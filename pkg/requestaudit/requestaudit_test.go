package requestaudit

import (
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestShouldSampleStable(t *testing.T) {
	id := "20260526013754192623098268d9d6M5ecz1Xo"
	a := shouldSample(id, 50)
	b := shouldSample(id, 50)
	if a != b {
		t.Fatalf("expected stable sample decision, got %v then %v", a, b)
	}
}

func TestSaveRecordAndJoinByRequestId(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&RelayAuditRecord{}); err != nil {
		t.Fatal(err)
	}

	rid := "test-request-id-join"
	body := `{"model":"gpt-4","max_tokens":98304}`
	rec := &RelayAuditRecord{
		RequestId:   rid,
		Method:      "POST",
		Path:        "/v1/chat/completions",
		ClientIp:    "127.0.0.1",
		ContentType: "application/json",
		Body:        body,
		BodySize:    len(body),
		CreatedAt:   time.Now().Unix(),
	}
	if err := saveRecord(db, rec); err != nil {
		t.Fatal(err)
	}

	var loaded RelayAuditRecord
	if err := db.Where("request_id = ?", rid).First(&loaded).Error; err != nil {
		t.Fatal(err)
	}
	if loaded.Body != body {
		t.Fatalf("body mismatch: got %q", loaded.Body)
	}
}
