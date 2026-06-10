package controller

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

func GetRobotsTxt(c *gin.Context) {
	c.String(http.StatusOK, service.BuildRobotsTxt(publicBaseURL(c)))
}

func GetLLMsTxt(c *gin.Context) {
	categories, posts := blogSEOData()
	c.String(http.StatusOK, service.BuildLLMsTxt(publicBaseURL(c), categories, posts))
}

func GetSitemapXML(c *gin.Context) {
	categories, posts := blogSEOData()
	c.Data(http.StatusOK, "application/xml; charset=utf-8", []byte(service.BuildBlogSitemap(publicBaseURL(c), categories, posts)))
}

func blogSEOData() ([]service.BlogCategory, []service.BlogPost) {
	categories, err := service.FetchBlogCategories(service.NewBlogCategoryParams())
	if err != nil {
		categories = nil
	}

	posts := make([]service.BlogPost, 0)
	result, err := service.FetchBlogList(service.NewBlogListParams(1, 50, "", nil))
	if err == nil {
		posts = result.List
	}

	return categories, posts
}

func publicBaseURL(c *gin.Context) string {
	if base := strings.TrimSpace(system_setting.ServerAddress); base != "" {
		return base
	}

	proto := strings.TrimSpace(c.GetHeader("X-Forwarded-Proto"))
	if proto == "" {
		proto = "https"
		if c.Request.TLS == nil && strings.HasPrefix(c.Request.Host, "localhost") {
			proto = "http"
		}
	}

	host := strings.TrimSpace(c.GetHeader("X-Forwarded-Host"))
	if host == "" {
		host = c.Request.Host
	}
	if host == "" {
		return ""
	}
	return proto + "://" + host
}
