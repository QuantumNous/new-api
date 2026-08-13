package common

import (
	"strconv"

	"github.com/gin-gonic/gin"
)

// MaxPageSize caps the page_size accepted from query parameters. List
// endpoints use PageSize directly as SQL LIMIT; an unbounded value would let a
// single request pull every matching row into memory (F-37).
const MaxPageSize = 1000

// MaxPage caps the page number so (page-1)*pageSize cannot overflow into a
// negative SQL OFFSET (F-37 hardening).
const MaxPage = 100000

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
	// F-37: cap page size. List endpoints use PageSize directly as SQL LIMIT;
	// an unbounded value (e.g. page_size=2000000000) makes a single request
	// pull every matching row into memory (memory/DB exhaustion DoS).
	if pageInfo.PageSize > MaxPageSize {
		pageInfo.PageSize = MaxPageSize
	}
	if pageInfo.PageSize < 1 {
		pageInfo.PageSize = 1
	}
	if pageInfo.Page > MaxPage {
		pageInfo.Page = MaxPage
	}
	if pageInfo.Page < 1 {
		pageInfo.Page = 1
	}

	if pageInfo.PageSize > 100 {
		pageInfo.PageSize = 100
	}

	return pageInfo
}
