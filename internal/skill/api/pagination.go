package api

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	"github.com/gin-gonic/gin"
)

const (
	DefaultPage  = 1
	DefaultLimit = 20
	MaxLimit     = 100
)

type Pagination struct {
	Page    int   `json:"page"`
	Limit   int   `json:"limit"`
	Total   int64 `json:"total"`
	HasNext bool  `json:"has_next"`
}

type PageParams struct {
	Page   int
	Limit  int
	Offset int
}

type QueryValidationError struct {
	Code    errcodes.ErrorCode
	Message string
	Detail  any
}

func (e *QueryValidationError) Error() string {
	return e.Message
}

func ParsePageParams(c *gin.Context) (PageParams, *QueryValidationError) {
	page, err := parsePositiveInt(c.Query("page"), DefaultPage, "page")
	if err != nil {
		return PageParams{}, err
	}
	limit, err := parsePositiveInt(c.Query("limit"), DefaultLimit, "limit")
	if err != nil {
		return PageParams{}, err
	}
	if limit > MaxLimit {
		return PageParams{}, badQuery("INVALID_PAGINATION", fmt.Sprintf("limit must be <= %d", MaxLimit))
	}
	return PageParams{
		Page:   page,
		Limit:  limit,
		Offset: (page - 1) * limit,
	}, nil
}

func NewPagination(page, limit int, total int64) Pagination {
	if page < DefaultPage {
		page = DefaultPage
	}
	if limit < 1 {
		limit = DefaultLimit
	}
	if limit > MaxLimit {
		limit = MaxLimit
	}
	return Pagination{
		Page:    page,
		Limit:   limit,
		Total:   total,
		HasNext: int64(page*limit) < total,
	}
}

func ValidateSort(sort string, allowed map[string]struct{}) *QueryValidationError {
	if sort == "" {
		return nil
	}
	key := strings.TrimPrefix(sort, "-")
	if _, ok := allowed[key]; ok {
		return nil
	}
	return badQuery("INVALID_SORT", fmt.Sprintf("unsupported sort key %q", sort))
}

func ValidateFilter(name, value string, allowed map[string]struct{}) *QueryValidationError {
	if value == "" {
		return nil
	}
	if _, ok := allowed[value]; ok {
		return nil
	}
	return badQuery("INVALID_FILTER", fmt.Sprintf("unsupported %s filter value %q", name, value))
}

func AbortQueryError(c *gin.Context, err *QueryValidationError) {
	if err == nil {
		return
	}
	Error(c, err.Code, err.Message, err.Detail)
	c.Abort()
}

func parsePositiveInt(raw string, def int, name string) (int, *QueryValidationError) {
	if raw == "" {
		return def, nil
	}
	v, err := strconv.Atoi(raw)
	if err != nil || v < 1 {
		return 0, badQuery("INVALID_PAGINATION", fmt.Sprintf("%s must be an integer >= 1", name))
	}
	return v, nil
}

func badQuery(reason, message string) *QueryValidationError {
	return &QueryValidationError{
		Code:    errcodes.ErrInvalidRequest,
		Message: message,
		Detail:  gin.H{"reason": reason},
	}
}
