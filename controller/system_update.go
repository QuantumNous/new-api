package controller

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/systemupdate"

	"github.com/gin-gonic/gin"
)

// systemUpdateTimeout bounds long-running download/replace operations.
// Detached from the request context so proxy/browser timeouts do not cancel mid-download.
const systemUpdateTimeout = 15 * time.Minute

func systemUpdateContext(parent context.Context) (context.Context, context.CancelFunc) {
	base := context.Background()
	if parent != nil {
		base = context.WithoutCancel(parent)
	}
	return context.WithTimeout(base, systemUpdateTimeout)
}

func syncUpdateVersion() {
	// Must run after common.InitEnv() so VERSION env / build tags are final.
	systemupdate.CurrentVersion = common.Version
}

// CheckSystemUpdate GET /api/system-update/check
func CheckSystemUpdate(c *gin.Context) {
	syncUpdateVersion()
	force := c.Query("force") == "true"
	info, err := systemupdate.GetSystemUpdateService().CheckUpdate(c.Request.Context(), force)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, info)
}

// PerformSystemUpdate POST /api/system-update/apply
func PerformSystemUpdate(c *gin.Context) {
	syncUpdateVersion()
	ctx, cancel := systemUpdateContext(c.Request.Context())
	defer cancel()

	err := systemupdate.GetSystemUpdateService().PerformUpdate(ctx)
	if err != nil {
		if errors.Is(err, systemupdate.ErrNoUpdateAvailable) {
			info, _ := systemupdate.GetSystemUpdateService().CheckUpdate(ctx, false)
			current, latest := "", ""
			if info != nil {
				current, latest = info.CurrentVersion, info.LatestVersion
			}
			common.ApiSuccess(c, gin.H{
				"message":            "Already up to date",
				"already_up_to_date": true,
				"need_restart":       false,
				"current_version":    current,
				"latest_version":     latest,
			})
			return
		}
		if errors.Is(err, systemupdate.ErrUpdateNotSupportedEnv) {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": err.Error() + "; for Docker: docker compose pull && docker compose up -d",
			})
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"message":      "Update completed. Please restart the new-api process to load the new binary.",
		"need_restart": true,
	})
}

// ListSystemRollbackVersions GET /api/system-update/rollback-versions
func ListSystemRollbackVersions(c *gin.Context) {
	syncUpdateVersion()
	versions, err := systemupdate.GetSystemUpdateService().ListRollbackVersions(c.Request.Context())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"versions": versions})
}

// PerformSystemRollback POST /api/system-update/rollback
// Body optional: {"version":"1.0.0"} to download a specific older release;
// empty body restores the local .backup from the last update.
func PerformSystemRollback(c *gin.Context) {
	syncUpdateVersion()
	var req struct {
		Version string `json:"version"`
	}
	// Do not gate on ContentLength: chunked bodies report -1 and would skip binding.
	if err := c.ShouldBindJSON(&req); err != nil {
		// Empty body is valid (rollback to local .backup).
		if !errors.Is(err, io.EOF) && !isEmptyJSONBodyError(err) {
			common.ApiErrorMsg(c, "invalid request body")
			return
		}
	}
	target := strings.TrimSpace(req.Version)

	ctx, cancel := systemUpdateContext(c.Request.Context())
	defer cancel()

	var err error
	if target != "" {
		err = systemupdate.GetSystemUpdateService().RollbackToVersion(ctx, target)
	} else {
		err = systemupdate.GetSystemUpdateService().Rollback()
	}
	if err != nil {
		if errors.Is(err, systemupdate.ErrUpdateNotSupportedEnv) ||
			errors.Is(err, systemupdate.ErrRollbackVersionNotAllowed) ||
			errors.Is(err, systemupdate.ErrNoBackupFound) {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"message":      "Rollback completed. Please restart the new-api process.",
		"need_restart": true,
		"version":      target,
	})
}

func isEmptyJSONBodyError(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return msg == "EOF" ||
		strings.Contains(msg, "unexpected end of JSON input") ||
		strings.Contains(msg, "EOF")
}
