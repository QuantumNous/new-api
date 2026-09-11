package controller

import (
	"bytes"
	"crypto/subtle"
	"image"
	"image/png"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

func DownloadImageUpscaleWorkerConfig(c *gin.Context) {
	address, err := url.Parse(strings.TrimRight(system_setting.ServerAddress, "/"))
	if err != nil || address.Scheme != "https" || address.Host == "" || address.User != nil || address.RawQuery != "" || address.Fragment != "" {
		c.JSON(503, gin.H{"error": "Configure the public HTTPS server address first"})
		return
	}
	token := service.DrawingOption("ImageUpscaleWorkerToken", "")
	if len(token) < 32 {
		c.Status(503)
		return
	}
	c.Header("Cache-Control", "no-store")
	c.Header("Content-Disposition", `attachment; filename="hardy-upscale-config.json"`)
	recordManageAudit(c, "upscale.worker_config.download", map[string]interface{}{})
	c.JSON(200, gin.H{"base_url": address.String(), "token": token})
}

func ImageUpscaleWorkerAuth(c *gin.Context) {
	expected := service.DrawingOption("ImageUpscaleWorkerToken", "")
	provided := strings.TrimPrefix(c.GetHeader("Authorization"), "Bearer ")
	if len(expected) < 32 || subtle.ConstantTimeCompare([]byte(expected), []byte(provided)) != 1 {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}
	c.Next()
}

func ImageUpscaleWorkerHeartbeat(c *gin.Context) {
	service.TouchImageUpscaleWorker()
	c.Status(http.StatusNoContent)
}

func ClaimImageUpscaleJob(c *gin.Context) {
	service.TouchImageUpscaleWorker()
	service.CleanupImageUpscaleJobs()
	job, err := model.ClaimImageUpscaleJob(time.Now().Unix())
	if err != nil {
		c.Status(503)
		return
	}
	if job == nil {
		c.Status(204)
		return
	}
	c.JSON(200, job)
}

func ImageUpscaleJobIO(c *gin.Context) {
	var job model.ImageUpscaleJob
	if model.DB.First(&job, "id = ?", c.Param("id")).Error != nil || job.Lease == "" || subtle.ConstantTimeCompare([]byte(job.Lease), []byte(c.GetHeader("X-Upscale-Lease"))) != 1 {
		c.Status(404)
		return
	}
	if job.ExpiresAt <= time.Now().Unix() || job.Status == "cancelled" {
		c.Status(410)
		return
	}
	if c.Request.Method == http.MethodGet {
		if job.Status != "running" {
			c.Status(409)
			return
		}
		path, err := service.ImageUpscaleFile(job.ID, ".input")
		if err != nil {
			c.Status(400)
			return
		}
		c.File(path)
		return
	}
	// A lost upload acknowledgement must not cause another upscale or generation.
	if job.Status == "succeeded" {
		c.Status(204)
		return
	}
	if job.Status != "running" {
		c.Status(409)
		return
	}
	if strings.HasSuffix(c.Request.URL.Path, "/fail") {
		result := model.DB.Model(&model.ImageUpscaleJob{}).Where("id = ? AND lease = ? AND status = ?", job.ID, job.Lease, "running").Update("status", "failed")
		if result.Error != nil {
			c.Status(503)
			return
		}
		c.Status(204)
		return
	}
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, service.MaxDrawingBytes+1))
	if err != nil || int64(len(body)) > service.MaxDrawingBytes {
		c.Status(413)
		return
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(body))
	if err != nil || (format != "png" && format != "webp") || config.Width != job.Width || config.Height != job.Height {
		c.Status(422)
		return
	}
	// Decode the complete file before committing; a valid header alone is insufficient.
	decoded, _, err := image.Decode(bytes.NewReader(body))
	if err != nil {
		c.Status(422)
		return
	}
	if format == "webp" {
		var encoded bytes.Buffer
		if err = png.Encode(&encoded, decoded); err != nil {
			c.Status(422)
			return
		}
		if int64(encoded.Len()) > service.MaxDrawingBytes {
			c.Status(413)
			return
		}
		body = encoded.Bytes()
	}
	path, _ := service.ImageUpscaleFile(job.Lease, ".output")
	if err = os.WriteFile(path, body, 0600); err != nil {
		c.Status(503)
		return
	}
	result := model.DB.Model(&model.ImageUpscaleJob{}).Where("id = ? AND lease = ? AND status = ? AND expires_at > ?", job.ID, job.Lease, "running", time.Now().Unix()).Update("status", "succeeded")
	if result.Error != nil {
		c.Status(503)
		return
	}
	if result.RowsAffected != 1 {
		var current model.ImageUpscaleJob
		if model.DB.First(&current, "id = ?", job.ID).Error != nil {
			c.Status(503)
			return
		}
		if current.Status == "succeeded" && current.Lease == job.Lease {
			c.Status(204)
			return
		}
		_ = os.Remove(path)
		c.Status(409)
		return
	}
	c.Status(204)
}
