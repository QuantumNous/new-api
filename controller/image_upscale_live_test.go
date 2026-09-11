package controller

import (
	"bytes"
	"context"
	"encoding/base64"
	"image"
	"image/color"
	"image/png"
	"net"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

// Opt-in integration with the real remote GPU; no paid generation is invoked.
func TestLiveGPUUpscaleWorker(t *testing.T) {
	configPath := os.Getenv("GPU_UPSCALE_LIVE_CONFIG")
	if configPath == "" {
		t.Skip("requires real GPU worker and SSH tunnel")
	}
	_, _ = setupDrawingTests(t)
	require.NoError(t, model.DB.AutoMigrate(&model.ImageUpscaleJob{}))
	token := uuid.NewString() + uuid.NewString()
	common.OptionMapRWMutex.Lock()
	if common.OptionMap == nil {
		common.OptionMap = map[string]string{}
	}
	old := common.OptionMap["ImageUpscaleWorkerToken"]
	common.OptionMap["ImageUpscaleWorkerToken"] = token
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap["ImageUpscaleWorkerToken"] = old
		common.OptionMapRWMutex.Unlock()
	})
	r := gin.New()
	group := r.Group("/internal/image-upscale", ImageUpscaleWorkerAuth)
	group.POST("/heartbeat", ImageUpscaleWorkerHeartbeat)
	group.POST("/claim", ClaimImageUpscaleJob)
	group.GET("/:id/input", ImageUpscaleJobIO)
	group.POST("/:id/result", ImageUpscaleJobIO)
	group.POST("/:id/fail", ImageUpscaleJobIO)
	listener, err := net.Listen("tcp", "127.0.0.1:18191")
	require.NoError(t, err)
	server := &http.Server{Handler: r}
	go server.Serve(listener)
	defer server.Close()
	config, err := common.Marshal(map[string]string{"base_url": "http://127.0.0.1:18191", "token": token})
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(configPath, config, 0600))
	defer os.Remove(configPath)
	t.Log("GPU integration endpoint ready")
	require.Eventually(t, service.ImageUpscaleReady, 3*time.Minute, time.Second)
	im := image.NewRGBA(image.Rect(0, 0, 1024, 576))
	for y := 0; y < 576; y++ {
		for x := 0; x < 1024; x++ {
			im.SetRGBA(x, y, color.RGBA{uint8(x / 4), uint8(y / 3), uint8((x/32 + y/32) % 2 * 200), 255})
		}
	}
	var buf bytes.Buffer
	require.NoError(t, png.Encode(&buf, im))
	body, err := common.Marshal(map[string]any{"data": []map[string]string{{"b64_json": base64.StdEncoding.EncodeToString(buf.Bytes())}}})
	require.NoError(t, err)
	for _, target := range []int{2048, 4096} {
		started := time.Now()
		result, err := service.UpscaleImageResponse(context.Background(), body, target)
		require.NoError(t, err)
		data, err := base64.StdEncoding.DecodeString(gjson.GetBytes(result, "data.0.b64_json").String())
		require.NoError(t, err)
		actual, _, err := image.DecodeConfig(bytes.NewReader(data))
		require.NoError(t, err)
		require.Equal(t, target, actual.Width)
		require.Equal(t, target*9/16, actual.Height)
		t.Logf("Real GPU result %dx%d, end-to-end %s", actual.Width, actual.Height, time.Since(started).Round(time.Millisecond))
	}
}
