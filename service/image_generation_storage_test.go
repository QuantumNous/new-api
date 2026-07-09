package service

import (
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestSaveImageGenerationResponseStoresFileAndRecord(t *testing.T) {
	truncateServiceImageGenerationTables(t)

	storageDir := t.TempDir()
	t.Setenv("IMAGE_GENERATION_STORAGE_DIR", storageDir)

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set(common.RequestIdKey, "req_image_store")

	responseBody, err := common.Marshal(dto.ImageResponse{
		Data: []dto.ImageData{
			{B64Json: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="},
		},
	})
	require.NoError(t, err)

	relayInfo := &relaycommon.RelayInfo{
		UserId:          7,
		TokenId:         8,
		OriginModelName: "gemini-3.1-flash-image",
		UsingGroup:      "Image",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId: 9,
		},
	}
	request := &dto.ImageRequest{
		Prompt:  "a red cube",
		Size:    "1024x1024",
		Quality: "standard",
	}

	SaveImageGenerationResponse(c, relayInfo, request, responseBody, 50000)

	var records []model.ImageGeneration
	require.NoError(t, model.DB.Find(&records).Error)
	require.Len(t, records, 1)
	require.Equal(t, "req_image_store", records[0].RequestId)
	require.Equal(t, "gemini-3.1-flash-image", records[0].ModelName)
	require.Equal(t, "a red cube", records[0].Prompt)
	require.Equal(t, "1024x1024", records[0].Size)
	require.Equal(t, 50000, records[0].Quota)
	require.Equal(t, model.ImageGenerationStatusSuccess, records[0].Status)
	require.NotEmpty(t, records[0].FilePath)

	_, err = os.Stat(filepath.Join(storageDir, records[0].FilePath))
	require.NoError(t, err)
}

func TestCleanupExpiredImageGenerationsDeletesFileAndMarksExpired(t *testing.T) {
	truncateServiceImageGenerationTables(t)

	storageDir := t.TempDir()
	t.Setenv("IMAGE_GENERATION_STORAGE_DIR", storageDir)

	relativePath := filepath.Join("20260710", "user-1", "expired.png")
	absolutePath := filepath.Join(storageDir, relativePath)
	require.NoError(t, os.MkdirAll(filepath.Dir(absolutePath), 0750))
	require.NoError(t, os.WriteFile(absolutePath, []byte("png"), 0600))

	record := &model.ImageGeneration{
		UserId:    1,
		RequestId: "req_expired",
		FilePath:  relativePath,
		Status:    model.ImageGenerationStatusSuccess,
		CreatedAt: time.Now().Add(-8 * 24 * time.Hour).Unix(),
		ExpireAt:  time.Now().Add(-time.Hour).Unix(),
	}
	require.NoError(t, model.DB.Create(record).Error)

	CleanupExpiredImageGenerations()

	_, err := os.Stat(absolutePath)
	require.True(t, os.IsNotExist(err))

	var reloaded model.ImageGeneration
	require.NoError(t, model.DB.First(&reloaded, record.Id).Error)
	require.Equal(t, model.ImageGenerationStatusExpired, reloaded.Status)
	require.Empty(t, reloaded.FilePath)
}

func truncateServiceImageGenerationTables(t *testing.T) {
	t.Helper()
	require.NoError(t, model.DB.Exec("DELETE FROM image_generations").Error)
}
