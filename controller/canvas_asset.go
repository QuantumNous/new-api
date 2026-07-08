package controller

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/mediastore"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// 画布素材库(/api/canvas/assets,UserAuth)。
// 二进制统一存 OBS,key 命名空间 canvas/assets/{user_id}/{yyyy}/{mm}/{asset_id}.{ext};
// 数据库只存元数据。按用户总占用限制容量(普通默认 200MB / 高级默认 1TB,可配置),
// 素材存储配额与 AI 调用 token quota 相互独立。

var canvasAssetMediaTypes = map[string]string{
	"image": "image",
	"video": "video",
	"audio": "audio",
}

var canvasAssetExtByMime = map[string]string{
	"image/png":  "png",
	"image/jpeg": "jpg",
	"image/webp": "webp",
	"image/gif":  "gif",
	"video/mp4":  "mp4",
	"video/webm": "webm",
	"audio/mpeg": "mp3",
	"audio/wav":  "wav",
	"audio/ogg":  "ogg",
	"audio/mp4":  "m4a",
	"audio/aac":  "aac",
	"audio/flac": "flac",
	"image/heic": "heic",
	"image/avif": "avif",
}

// canvasStorageLimitBytes 解析用户的素材库容量上限。
// 优先级:用户组配置映射 > 有生效订阅按高级值 > 系统默认值。-1 表示不限制。
func canvasStorageLimitBytes(userId int) int64 {
	settings := system_setting.GetCanvasSettings()
	userCache, err := model.GetUserCache(userId)
	if err == nil && settings.GroupStorageLimits != "" {
		groupLimits := map[string]int64{}
		if err := common.UnmarshalJsonStr(settings.GroupStorageLimits, &groupLimits); err == nil {
			if limit, ok := groupLimits[userCache.Group]; ok && limit != 0 {
				return limit
			}
		}
	}
	if hasSub, err := model.HasActiveUserSubscription(userId); err == nil && hasSub {
		if settings.PremiumStorageLimitBytes != 0 {
			return settings.PremiumStorageLimitBytes
		}
	}
	if settings.DefaultStorageLimitBytes != 0 {
		return settings.DefaultStorageLimitBytes
	}
	return 200 * 1024 * 1024
}

func canvasAssetKey(userId int, assetId, ext string, at time.Time) string {
	return fmt.Sprintf("canvas/assets/%d/%s/%s.%s", userId, at.UTC().Format("2006/01"), assetId, ext)
}

func canvasAssetMediaType(mimeType string) string {
	prefix, _, _ := strings.Cut(mimeType, "/")
	return canvasAssetMediaTypes[prefix]
}

func ListCanvasAssets(c *gin.Context) {
	userId := c.GetInt("id")
	page := parsePositiveInt(c.Query("page"), 1, 1<<30)
	pageSize := parsePositiveInt(c.Query("page_size"), 20, 100)
	assets, total, err := model.GetCanvasAssetsByUser(userId, c.Query("media_type"), c.Query("project_id"), c.Query("keyword"), (page-1)*pageSize, pageSize)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": gin.H{"items": assets, "total": total, "page": page, "page_size": pageSize}})
}

func UploadCanvasAsset(c *gin.Context) {
	userId := c.GetInt("id")
	if !mediastore.Enabled() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"success": false, "message": "媒体存储未启用,无法上传素材"})
		return
	}
	limitBytes := canvasStorageLimitBytes(userId)
	usage, err := model.GetCanvasStorageUsage(userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "缺少上传文件"})
		return
	}
	// 预检查:Content-Length 声明的大小先挡一道,实际写入以真实字节数为准
	if limitBytes >= 0 && usage.UsedBytes+fileHeader.Size > limitBytes {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"success": false, "message": "素材库容量不足,请清理素材或升级套餐"})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	defer file.Close()
	// 限制最大读取字节:不能只信 Content-Length
	maxRead := fileHeader.Size + 1
	data, err := io.ReadAll(io.LimitReader(file, maxRead))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "读取上传内容失败: " + err.Error()})
		return
	}
	if int64(len(data)) > fileHeader.Size {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "上传内容与声明大小不符"})
		return
	}

	mimeType := fileHeader.Header.Get("Content-Type")
	mimeType, _, _ = strings.Cut(mimeType, ";")
	mimeType = strings.TrimSpace(strings.ToLower(mimeType))
	mediaType := canvasAssetMediaType(mimeType)
	if mediaType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "仅支持图片、视频、音频素材"})
		return
	}
	ext := canvasAssetExtByMime[mimeType]
	if ext == "" {
		ext = strings.TrimPrefix(strings.ToLower(path.Ext(fileHeader.Filename)), ".")
		if ext == "" || len(ext) > 8 || strings.ContainsAny(ext, "/\\") {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无法识别的素材格式"})
			return
		}
	}

	now := time.Now()
	// asset_id 服务端生成,不使用用户原始文件名,防路径注入与重名覆盖
	assetId := "ca_" + common.GetRandomString(20)
	obsKey := canvasAssetKey(userId, assetId, ext, now)
	if err := mediastore.Persist(c.Request.Context(), obsKey, mediastore.PersistSource{Data: data, ContentType: mimeType}, map[string]string{
		"canvas-user": strconv.Itoa(userId),
	}); err != nil {
		if errors.Is(err, mediastore.ErrObjectTooLarge) {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"success": false, "message": "单个素材超过系统允许的最大对象大小"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "上传媒体存储失败: " + err.Error()})
		return
	}

	asset := &model.CanvasAsset{
		UserId:    userId,
		AssetId:   assetId,
		ProjectId: c.PostForm("project_id"),
		Name:      strings.TrimSpace(fileHeader.Filename),
		MediaType: mediaType,
		MimeType:  mimeType,
		SizeBytes: int64(len(data)),
		ObsKey:    obsKey,
		Source:    "upload",
	}
	if err := model.CreateCanvasAssetWithQuota(asset, limitBytes); err != nil {
		// OBS 上传成功但 DB 失败:best-effort 删除刚上传对象,避免游离
		go func(key string) {
			_ = mediastore.Delete(context.Background(), key)
		}(obsKey)
		if errors.Is(err, model.ErrCanvasStorageQuotaExceeded) {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"success": false, "message": "素材库容量不足,请清理素材或升级套餐"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": asset})
}

func GetCanvasAssetURL(c *gin.Context) {
	userId := c.GetInt("id")
	asset, err := model.GetCanvasAsset(userId, c.Param("asset_id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "素材不存在"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	signed, err := mediastore.Sign(c.Request.Context(), asset.ObsKey)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "生成访问链接失败: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": gin.H{"url": signed, "mime_type": asset.MimeType, "media_type": asset.MediaType}})
}

func DeleteCanvasAsset(c *gin.Context) {
	userId := c.GetInt("id")
	asset, err := model.SoftDeleteCanvasAsset(userId, c.Param("asset_id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "素材不存在"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	// OBS 对象异步删除,失败重试,不阻塞用户操作;DB 已软删并扣减占用
	go func(key string) {
		for attempt := 0; attempt < 3; attempt++ {
			if err := mediastore.Delete(context.Background(), key); err == nil {
				return
			}
			time.Sleep(time.Duration(attempt+1) * 5 * time.Second)
		}
		common.SysLog("画布素材 OBS 对象删除失败(已放弃重试): " + key)
	}(asset.ObsKey)
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}

func GetCanvasStorage(c *gin.Context) {
	userId := c.GetInt("id")
	usage, err := model.GetCanvasStorageUsage(userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	limitBytes := canvasStorageLimitBytes(userId)
	remaining := int64(-1)
	if limitBytes >= 0 {
		remaining = limitBytes - usage.UsedBytes
		if remaining < 0 {
			remaining = 0
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": gin.H{
		"used_bytes":      usage.UsedBytes,
		"limit_bytes":     limitBytes,
		"remaining_bytes": remaining,
		"asset_count":     usage.AssetCount,
	}})
}
