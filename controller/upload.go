package controller

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
)

const maxLogoUploadSize = 2 << 20

func UploadLogo(c *gin.Context) {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "未找到上传文件"})
		return
	}
	if fileHeader.Size > maxLogoUploadSize {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "Logo 文件不能超过 2MB"})
		return
	}

	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	switch ext {
	case ".png", ".jpg", ".jpeg", ".webp", ".gif":
	default:
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "仅支持 png、jpg、jpeg、webp、gif 图片"})
		return
	}

	src, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "打开上传文件失败"})
		return
	}
	defer src.Close()

	uploadDir := filepath.Join(".", "uploads", "branding")
	if err := os.MkdirAll(uploadDir, 0o755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "创建上传目录失败"})
		return
	}

	filename := fmt.Sprintf("logo-%d%s", common.GetTimestamp(), ext)
	targetPath := filepath.Join(uploadDir, filename)
	dst, err := os.Create(targetPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "创建目标文件失败"})
		return
	}
	defer dst.Close()

	if _, err = io.Copy(dst, src); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "保存上传文件失败"})
		return
	}

	accessiblePath := "/uploads/branding/" + filename
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"url": accessiblePath,
		},
	})
}
