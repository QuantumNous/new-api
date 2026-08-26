package controller

import (
	"bytes"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// BackupExport 导出选中的数据为 ZIP 文件下载。
// POST /api/admin/backup/export
func BackupExport(c *gin.Context) {
	var req dto.BackupExportRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if len(req.Categories) == 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	result, err := service.ExportBackup(req)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	stamp := time.Now().UTC().Format("20060102-150405")
	filename := fmt.Sprintf("new-api-backup-%s.zip", stamp)
	if !req.IncludeSecret {
		filename = fmt.Sprintf("new-api-backup-nosecret-%s.zip", stamp)
	}

	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Transfer-Encoding", "binary")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	c.Data(http.StatusOK, "application/zip", result.ZipBytes)
}

// BackupImport 上传 ZIP 文件恢复数据。
// POST /api/admin/backup/import
func BackupImport(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	defer file.Close()

	categoriesRaw := c.Request.FormValue("categories")
	skipExisting := c.Request.FormValue("skip_existing") == "true"
	overwriteSecret := c.Request.FormValue("overwrite_secret") == "true"

	var cats []dto.BackupCategory
	for _, s := range strings.Split(categoriesRaw, ",") {
		s = strings.TrimSpace(s)
		if s != "" {
			cats = append(cats, dto.BackupCategory(s))
		}
	}

	buf := &bytes.Buffer{}
	if _, err := buf.ReadFrom(file); err != nil {
		common.ApiError(c, err)
		return
	}

	res, err := service.ImportBackup(buf.Bytes(), dto.BackupImportRequest{
		Categories:      cats,
		SkipExisting:    skipExisting,
		OverwriteSecret: overwriteSecret,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"filename": header.Filename,
		"results":  res.Results,
	})
}

// BackupCategories 返回可选的备份类别清单（用于前端渲染）。
// GET /api/admin/backup/categories
func BackupCategories(c *gin.Context) {
	out := make([]gin.H, 0, len(dto.AllBackupCategories))
	for _, cat := range dto.AllBackupCategories {
		out = append(out, gin.H{
			"key":      cat.Key,
			"display":  cat.Display,
			"is_large": cat.IsLarge,
		})
	}
	common.ApiSuccess(c, out)
}

// BackupPreview 快速预览某个类别有多少行（不下载 ZIP），方便用户估算大小。
// GET /api/admin/backup/preview?category=channels
func BackupPreview(c *gin.Context) {
	cat := dto.BackupCategory(c.Query("category"))
	if cat == "" {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	count, err := service.PreviewCategoryCount(cat)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"category": cat, "rows": count})
}
