package common

import (
	"github.com/gin-gonic/gin"
	"strconv"
)

type PageInfo struct {
	Page           int   `json:"page"`            // page num 页码
	PageSize       int   `json:"page_size"`       // page size 页大小
	StartTimestamp int64 `json:"start_timestamp"` // 秒级
	EndTimestamp   int64 `json:"end_timestamp"`   // 秒级

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

func GetPageQuery(c *gin.Context) (*PageInfo, error) {
	pageInfo := &PageInfo{}
	err := c.BindQuery(pageInfo)
	if err != nil {
		return nil, err
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
		pageInfo.PageSize = ItemsPerPage
	}
	return pageInfo, nil
}
