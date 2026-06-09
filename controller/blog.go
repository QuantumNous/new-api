package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

func GetBlogList(c *gin.Context) {
	pageNo, _ := strconv.Atoi(c.DefaultQuery("page", c.DefaultQuery("pageNo", "1")))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "18"))
	categoryIDs := service.ParseBlogCategoryIDs(c.Query("categoryIds"))

	result, err := service.FetchBlogList(service.NewBlogListParams(
		pageNo,
		pageSize,
		c.Query("q"),
		categoryIDs,
	))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}

func GetBlogPost(c *gin.Context) {
	result, err := service.FetchBlogPost(service.NewBlogPostParams(
		c.Param("slug"),
		service.ParseBlogCategoryIDs(c.Query("categoryIds")),
	))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}
