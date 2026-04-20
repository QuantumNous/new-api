package controller

import (
	"fmt"
	"mime"
	"net/http"
	"path"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

const skillHubDownloadBaseURL = "https://api.skillhub.cn/api/v1/download?slug="

// ClientProxySkillHubDownload 代理下载 SkillHub zip 包。
//
// 当前版本先做最小可用链路：
// 1. myclaw 只请求 NewAPI
// 2. NewAPI 代为访问 SkillHub 下载入口
// 3. 把最终 zip 流直接回传给客户端
//
// 后续如需“预缓存/镜像 zip”，可以在这里落盘缓存并优先命中本地文件。
func ClientProxySkillHubDownload(c *gin.Context) {
	slug := strings.TrimSpace(c.Query("slug"))
	if slug == "" {
		common.ApiErrorMsg(c, "缺少 slug 参数")
		return
	}

	upstreamURL := skillHubDownloadBaseURL + slug
	resp, err := service.DoDownloadRequest(upstreamURL, "skillhub skill download proxy", slug)
	if err != nil {
		common.SysError(fmt.Sprintf("skillhub download proxy failed, slug=%s, err=%v", slug, err))
		common.ApiErrorMsg(c, "SkillHub 下载失败")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		common.SysError(fmt.Sprintf("skillhub download proxy bad status, slug=%s, status=%d", slug, resp.StatusCode))
		common.ApiErrorMsg(c, "SkillHub 下载失败")
		return
	}

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/zip"
	}

	fileName := extractDownloadFilename(resp.Header.Get("Content-Disposition"))
	if fileName == "" {
		if resp.Request != nil && resp.Request.URL != nil {
			base := path.Base(resp.Request.URL.Path)
			if base != "." && base != "/" && base != "" {
				fileName = base
			}
		}
	}
	if fileName == "" {
		fileName = slug + ".zip"
	}
	if !strings.HasSuffix(strings.ToLower(fileName), ".zip") {
		fileName += ".zip"
	}

	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", fileName))
	c.Header("Cache-Control", "private, no-store")
	c.DataFromReader(http.StatusOK, resp.ContentLength, contentType, resp.Body, nil)
}

func extractDownloadFilename(contentDisposition string) string {
	if contentDisposition == "" {
		return ""
	}

	_, params, err := mime.ParseMediaType(contentDisposition)
	if err != nil {
		return ""
	}

	if fileName := strings.TrimSpace(params["filename*"]); fileName != "" {
		return fileName
	}
	if fileName := strings.TrimSpace(params["filename"]); fileName != "" {
		return fileName
	}
	return ""
}
