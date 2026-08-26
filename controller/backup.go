package controller

import (
	"bytes"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
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

	filename := fmt.Sprintf("new-api-backup-%s.zip", time.Now().UTC().Format("20060102-150405"))
	if !req.IncludeSecret {
		filename = fmt.Sprintf("new-api-backup-nosecret-%s.zip", time.Now().UTC().Format("20060102-150405"))
	}

	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	c.Header("Content-Length", strconv.FormatInt(int64(len(result.ZipBytes)), 10))
	c.Data(http.StatusOK, "application/zip", result.ZipBytes)
}

// BackupImport 上传 ZIP 文件恢复数据。
// POST /api/admin/backup/import
func BackupImport(c *gin.Context) {
	if err := c.Request.ParseMultipartForm(64 << 20); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	defer file.Close()

	// 可选：导入类别、跳过已存在、覆盖密钥（form fields）
	categoriesRaw := c.Request.FormValue("categories")
	skipExisting := c.Request.FormValue("skip_existing") == "true"
	overwriteSecret := c.Request.FormValue("overwrite_secret") == "true"

	var cats []dto.BackupCategory
	if categoriesRaw != "" {
		// 简单按逗号分隔（避免引入 encoding/json 解析 multipart value 复杂度）
		for _, s := range splitCSV(categoriesRaw) {
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
	for _, c := range dto.AllBackupCategories {
		out = append(out, gin.H{
			"key":     c.Key,
			"display": c.Display,
			"is_large": c.IsLarge,
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

func splitCSV(s string) []string {
	if s == "" {
		return nil
	}
	out := make([]string, 0)
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == ',' {
			out = append(out, trim(s[start:i]))
			start = i + 1
		}
	}
	out = append(out, trim(s[start:]))
	return out
}

func trim(s string) string {
	for len(s) > 0 && (s[0] == ' ' || s[0] == '\t') {
		s = s[1:]
	}
	for len(s) > 0 && (s[len(s)-1] == ' ' || s[len(s)-1] == '\t') {
		s = s[:len(s)-1]
	}
	return s
}

// ensure unused import in some builds (model.DB used inside service)
var _ = model.DB
