package controller

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupFeedbackControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	gin.SetMode(gin.TestMode)
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}
	model.DB = db
	model.LOG_DB = db
	if err := db.AutoMigrate(&model.Feedback{}); err != nil {
		t.Fatalf("failed to migrate feedback table: %v", err)
	}
	return db
}

func TestSubmitFeedbackCreatesRecord(t *testing.T) {
	setupFeedbackControllerTestDB(t)

	body := []byte(`{"username":"alice","email":"alice@example.com","category":"bug","content":"there is a reproducible bug in the contact flow"}`)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/contact/feedback", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	SubmitFeedback(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}
	if !strings.Contains(recorder.Body.String(), `"success":true`) {
		t.Fatalf("expected success response, got %s", recorder.Body.String())
	}

	var count int64
	if err := model.DB.Model(&model.Feedback{}).Count(&count).Error; err != nil {
		t.Fatalf("count feedbacks: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 feedback record, got %d", count)
	}
}

func TestUploadLogoRejectsInvalidExtension(t *testing.T) {
	tmpDir := t.TempDir()
	previousDir, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	if err := os.Chdir(tmpDir); err != nil {
		t.Fatalf("chdir: %v", err)
	}
	t.Cleanup(func() {
		_ = os.Chdir(previousDir)
	})

	body := &bytes.Buffer{}
	writer := multipartWriter(t, body, "file", "logo.txt", "not-an-image")
	if err := writer.Close(); err != nil {
		t.Fatalf("close writer: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/upload/logo", body)
	ctx.Request.Header.Set("Content-Type", writer.FormDataContentType())

	UploadLogo(ctx)

	if !strings.Contains(recorder.Body.String(), "仅支持") {
		t.Fatalf("expected invalid extension error, got %s", recorder.Body.String())
	}
}

func TestUploadLogoStoresImage(t *testing.T) {
	tmpDir := t.TempDir()
	previousDir, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	if err := os.Chdir(tmpDir); err != nil {
		t.Fatalf("chdir: %v", err)
	}
	t.Cleanup(func() {
		_ = os.Chdir(previousDir)
	})

	body := &bytes.Buffer{}
	writer := multipartWriter(t, body, "file", "logo.png", "fake-png-content")
	if err := writer.Close(); err != nil {
		t.Fatalf("close writer: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/upload/logo", body)
	ctx.Request.Header.Set("Content-Type", writer.FormDataContentType())

	UploadLogo(ctx)

	if !strings.Contains(recorder.Body.String(), `/uploads/branding/logo-`) {
		t.Fatalf("expected uploaded logo url, got %s", recorder.Body.String())
	}
	matches, err := filepath.Glob(filepath.Join(tmpDir, "uploads", "branding", "logo-*"))
	if err != nil {
		t.Fatalf("glob uploads: %v", err)
	}
	if len(matches) != 1 {
		t.Fatalf("expected one uploaded file, got %d", len(matches))
	}
}
