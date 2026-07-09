package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupImageGenerationControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	gin.SetMode(gin.TestMode)
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false

	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db
	require.NoError(t, db.AutoMigrate(&model.ImageGeneration{}))

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func TestGetImageGenerationContentRequiresValidSignature(t *testing.T) {
	db := setupImageGenerationControllerTestDB(t)

	storageDir := t.TempDir()
	t.Setenv("IMAGE_GENERATION_STORAGE_DIR", storageDir)

	relativePath := filepath.Join("20260710", "user-1", "image.png")
	absolutePath := filepath.Join(storageDir, relativePath)
	require.NoError(t, os.MkdirAll(filepath.Dir(absolutePath), 0750))
	require.NoError(t, os.WriteFile(absolutePath, []byte("png-data"), 0600))

	record := &model.ImageGeneration{
		UserId:    1,
		RequestId: "req_image",
		FilePath:  relativePath,
		MimeType:  "image/png",
		Status:    model.ImageGenerationStatusSuccess,
		CreatedAt: time.Now().Unix(),
		ExpireAt:  time.Now().Add(time.Hour).Unix(),
	}
	require.NoError(t, db.Create(record).Error)

	router := gin.New()
	router.GET("/api/image-generations/:id/content", GetImageGenerationContent)

	missingSignature := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/image-generations/%d/content", record.Id), nil)
	router.ServeHTTP(missingSignature, req)
	require.Equal(t, http.StatusUnauthorized, missingSignature.Code)

	expires := record.ExpireAt
	signature := model.GenerateImageGenerationContentSignature(record, expires)
	valid := httptest.NewRecorder()
	req = httptest.NewRequest(
		http.MethodGet,
		fmt.Sprintf("/api/image-generations/%d/content?expires=%d&signature=%s", record.Id, expires, signature),
		nil,
	)
	router.ServeHTTP(valid, req)
	require.Equal(t, http.StatusOK, valid.Code)
	require.Equal(t, "png-data", valid.Body.String())
}
