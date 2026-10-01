package common

import (
	"strconv"

	"github.com/gin-gonic/gin"
)

type PageInfo struct {
	Page     int `json:"page"`      // page num 页码
	PageSize int `json:"page_size"` // page size 页大小

	Total int `json:"total"` // 总条数，后设置
	Items any `json:"items"` // 数据，后设置
}

func (p *PageInfo) GetStartIdx() int {
	return (p.Page - 1) * p.PageSize
}

func (p *PageInfo) GetEndIdx() int {
	return p.Page * p.PageSize
}

func (p *PageInfo) GetPageSize() int {
	return p.PageSize
}

func (p *PageInfo) GetPage() int {
	return p.Page
}

func (p *PageInfo) SetTotal(total int) {
	p.Total = total
}

func (p *PageInfo) SetItems(items any) {
	p.Items = items
}

// GetPageQuery 从 c 解析分页参数，maxPageSize 可选指定每页上限（默认 100），返回分页信息
func GetPageQuery(c *gin.Context, maxPageSize ...int) *PageInfo {
	pageInfo := &PageInfo{}
	// 手动获取并处理每个参数
	if page, err := strconv.Atoi(c.Query("p")); err == nil {
		pageInfo.Page = page
	}
	if pageSize, err := strconv.Atoi(c.Query("page_size")); err == nil {
		pageInfo.PageSize = pageSize
	}
	if pageInfo.Page < 1 {
		// 兼容
		page, _ := strconv.Atoi(c.Query("p"))
		if page != 0 {
			pageInfo.Page = page
		} else {
			pageInfo.Page = 1
		}
	}

	if pageInfo.PageSize == 0 {
		// 兼容
		pageSize, _ := strconv.Atoi(c.Query("ps"))
		if pageSize != 0 {
			pageInfo.PageSize = pageSize
		}
		if pageInfo.PageSize == 0 {
			pageSize, _ = strconv.Atoi(c.Query("size")) // token page
			if pageSize != 0 {
				pageInfo.PageSize = pageSize
			}
		}
		if pageInfo.PageSize == 0 {
			pageInfo.PageSize = ItemsPerPage
		}
	}

	limit := 100
	if len(maxPageSize) > 0 {
		limit = max(1, maxPageSize[0])
	}
	if pageInfo.PageSize > limit {
		pageInfo.PageSize = limit
	}

	return pageInfo
}
