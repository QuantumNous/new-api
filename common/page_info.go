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

func GetPageQuery(c *gin.Context) *PageInfo {
	pageInfo := &PageInfo{}
	// 手动获取并处理每个参数
	if page, err := strconv.Atoi(c.Query("p")); err == nil {
		pageInfo.Page = page
	}
	if pageSize, err := strconv.Atoi(c.Query("page_size")); err == nil {
		pageInfo.PageSize = pageSize
	}
	// 页码必须 >= 1：负数偏移会让数据库扫描整表。
	if pageInfo.Page < 1 {
		pageInfo.Page = 1
	}

	// 页大小必须落在 [1, 100]：负数或 0 会直接进入 GORM 的 Limit/Offset。
	if pageInfo.PageSize <= 0 {
		// 兼容
		if pageSize, err := strconv.Atoi(c.Query("ps")); err == nil && pageSize > 0 {
			pageInfo.PageSize = pageSize
		}
		if pageInfo.PageSize <= 0 {
			if pageSize, err := strconv.Atoi(c.Query("size")); err == nil && pageSize > 0 { // token page
				pageInfo.PageSize = pageSize
			}
		}
		if pageInfo.PageSize <= 0 {
			pageInfo.PageSize = ItemsPerPage
		}
	}

	if pageInfo.PageSize > 100 {
		pageInfo.PageSize = 100
	}

	return pageInfo
}
