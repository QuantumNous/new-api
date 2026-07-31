package controller

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/systemupdate"

	"github.com/gin-gonic/gin"
)

func init() {
	// Keep updater version in sync with process version string.
	systemupdate.CurrentVersion = common.Version
}

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

// CheckSystemUpdate GET /api/system-update/check
func CheckSystemUpdate(c *gin.Context) {
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
	var req struct {
		Version string `json:"version"`
	}
	if c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&req); err != nil {
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
