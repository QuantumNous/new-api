package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/google/uuid"
)

var upscaleHeartbeat atomic.Int64
var upscaleCleanupAt atomic.Int64
var upscaleSlots = make(chan struct{}, 4)

func ReserveImageUpscaleSlot() (func(), bool) {
	select {
	case upscaleSlots <- struct{}{}:
		return func() { <-upscaleSlots }, true
	default:
		return nil, false
	}
}

func CleanupImageUpscaleJobs() {
	now := time.Now().Unix()
	last := upscaleCleanupAt.Load()
	if now-last < 60 || !upscaleCleanupAt.CompareAndSwap(last, now) {
		return
	}
	var jobs []model.ImageUpscaleJob
	if model.DB.Where("expires_at < ?", now-60).Limit(100).Find(&jobs).Error != nil {
		return
	}
	for _, job := range jobs {
		input, err := ImageUpscaleFile(job.ID, ".input")
		if err != nil {
			continue
		}
		if err = os.Remove(input); err != nil && !os.IsNotExist(err) {
			continue
		}
		if job.Lease != "" {
			output, e := ImageUpscaleFile(job.Lease, ".output")
			if e != nil {
				continue
			}
			if e = os.Remove(output); e != nil && !os.IsNotExist(e) {
				continue
			}
		}
		model.DB.Where("id = ? AND expires_at < ?", job.ID, now-60).Delete(&model.ImageUpscaleJob{})
	}
}

func ImageUpscaleTarget(name string) int {
	switch name {
	case "gpt-image-2.5-2k":
		return 2048
	case "gpt-image-2.5-4k":
		return 4096
	}
	return 0
}

func TouchImageUpscaleWorker() { upscaleHeartbeat.Store(time.Now().Unix()) }

func ImageUpscaleReady() bool {
	return len(DrawingOption("ImageUpscaleWorkerToken", "")) >= 32 && time.Now().Unix()-upscaleHeartbeat.Load() < 45
}

// Validate before generating a paid upstream image. The initial contract is
// one non-streamed PNG per request; clients can use durable image tasks.
func PrepareImageUpscaleRequest(request *dto.ImageRequest) error {
	if request.Stream != nil && *request.Stream {
		return errors.New("upscale models require stream=false")
	}
	if request.N != nil && *request.N != 1 {
		return errors.New("upscale models currently require n=1")
	}
	var format, background string
	_ = common.Unmarshal(request.OutputFormat, &format)
	_ = common.Unmarshal(request.Background, &background)
	if format != "" && format != "png" {
		return errors.New("upscale models currently output PNG only")
	}
	if background == "transparent" {
		return errors.New("transparent output is not supported by the upscale worker")
	}
	w, h := 1024, 1024
	if request.Size != "" && request.Size != "auto" {
		parts := strings.Split(request.Size, "x")
		if len(parts) != 2 {
			return errors.New("size must be WIDTHxHEIGHT or auto")
		}
		var err error
		w, err = strconv.Atoi(parts[0])
		if err != nil {
			return errors.New("invalid image width")
		}
		h, err = strconv.Atoi(parts[1])
		if err != nil {
			return errors.New("invalid image height")
		}
		if w < 1 || h < 1 || w > 8192 || h > 8192 || float64(max(w, h))/float64(min(w, h)) > 4 {
			return errors.New("unsupported image dimensions")
		}
	}
	factor := 1024 / float64(max(w, h))
	request.Size = fmt.Sprintf("%dx%d", int(math.Round(float64(w)*factor)), int(math.Round(float64(h)*factor)))
	request.OutputFormat = json.RawMessage(`"png"`)
	request.ResponseFormat = "b64_json"
	return nil
}

func ImageUpscaleFile(id, suffix string) (string, error) {
	parsed, err := uuid.Parse(id)
	if err != nil || parsed.String() != id {
		return "", errors.New("invalid job id")
	}
	if suffix != ".input" && suffix != ".output" {
		return "", errors.New("invalid file type")
	}
	return filepath.Join(DrawingStorageDir(), "upscale", id+suffix), nil
}

func UpscaleImageResponse(ctx context.Context, body []byte, target int) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()
	body, err := EnsureImageBase64Response(ctx, body)
	if err != nil {
		return nil, err
	}
	var response map[string]json.RawMessage
	var items []map[string]json.RawMessage
	if common.Unmarshal(body, &response) != nil || common.Unmarshal(response["data"], &items) != nil || len(items) != 1 {
		return nil, errors.New("upscale expected exactly one generated image")
	}
	var encoded string
	if common.Unmarshal(items[0]["b64_json"], &encoded) != nil || int64(len(encoded)) > MaxDrawingResponseBytes {
		return nil, errors.New("invalid generated image")
	}
	input, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || int64(len(input)) > MaxDrawingBytes {
		return nil, errors.New("invalid generated image")
	}
	config, _, err := image.DecodeConfig(bytes.NewReader(input))
	if err != nil || config.Width < 1 || config.Height < 1 || config.Width > 4096 || config.Height > 4096 || int64(config.Width)*int64(config.Height) > 4194304 || max(config.Width, config.Height)*4 < target {
		return nil, errors.New("generated image dimensions cannot be upscaled")
	}
	factor := float64(target) / float64(max(config.Width, config.Height))
	job := model.ImageUpscaleJob{ID: uuid.NewString(), Status: "queued", Target: target, Width: int(math.Round(float64(config.Width) * factor)), Height: int(math.Round(float64(config.Height) * factor)), CreatedAt: time.Now().Unix(), ExpiresAt: time.Now().Add(10 * time.Minute).Unix()}
	inputPath, _ := ImageUpscaleFile(job.ID, ".input")
	if err = os.MkdirAll(filepath.Dir(inputPath), 0700); err != nil {
		return nil, err
	}
	if err = os.WriteFile(inputPath, input, 0600); err != nil {
		return nil, err
	}
	defer func() {
		model.DB.Model(&model.ImageUpscaleJob{}).Where("id = ? AND status IN ?", job.ID, []string{"queued", "running"}).Update("status", "cancelled")
		_ = os.Remove(inputPath)
		if job.Lease != "" {
			path, _ := ImageUpscaleFile(job.Lease, ".output")
			_ = os.Remove(path)
		}
	}()
	if err = model.DB.Create(&job).Error; err != nil {
		return nil, err
	}
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil, errors.New("upscale timed out or request cancelled; do not regenerate automatically")
		case <-ticker.C:
		}
		if err = model.DB.First(&job, "id = ?", job.ID).Error; err != nil {
			return nil, err
		}
		if job.Status == "failed" || job.Status == "cancelled" {
			return nil, errors.New("GPU upscale failed; do not regenerate automatically")
		}
		if job.Status == "succeeded" {
			break
		}
	}
	outputPath, _ := ImageUpscaleFile(job.Lease, ".output")
	output, err := os.ReadFile(outputPath)
	if err != nil {
		return nil, err
	}
	items[0]["b64_json"], err = common.Marshal(base64.StdEncoding.EncodeToString(output))
	if err != nil {
		return nil, err
	}
	delete(items[0], "url")
	items[0]["upscale"], err = common.Marshal(map[string]any{"method": "realesrgan-x4plus", "source_size": fmt.Sprintf("%dx%d", config.Width, config.Height), "target": target})
	if err != nil {
		return nil, err
	}
	response["data"], err = common.Marshal(items)
	if err != nil {
		return nil, err
	}
	result, err := common.Marshal(response)
	if err != nil {
		return nil, err
	}
	if int64(len(result)) > MaxDrawingResponseBytes {
		return nil, errors.New("upscaled response exceeds delivery limit")
	}
	return result, nil
}
