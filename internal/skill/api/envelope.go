package api

import (
	"net/http"
	"reflect"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	"github.com/gin-gonic/gin"
)

const defaultRateLimitRetryAfterSeconds = 60

type Meta struct {
	RequestID string `json:"request_id"`
}

type SuccessEnvelope struct {
	Data any  `json:"data"`
	Meta Meta `json:"meta"`
}

type ListEnvelope struct {
	Data       any        `json:"data"`
	Pagination Pagination `json:"pagination"`
	Meta       Meta       `json:"meta"`
}

type ErrorEnvelope struct {
	Error ErrorBody `json:"error"`
}

type ErrorBody struct {
	Code       errcodes.ErrorCode `json:"code"`
	Message    string             `json:"message"`
	Detail     any                `json:"detail,omitempty"`
	RequestID  string             `json:"request_id"`
	RetryAfter *int               `json:"retry_after"`
}

func RequestID(c *gin.Context) string {
	if id := c.GetString(common.RequestIdKey); id != "" {
		c.Header(common.RequestIdKey, id)
		return id
	}
	if id := c.GetHeader(common.RequestIdKey); id != "" {
		c.Set(common.RequestIdKey, id)
		return id
	}
	id := common.GetTimeString() + common.GetRandomString(8)
	c.Set(common.RequestIdKey, id)
	c.Header(common.RequestIdKey, id)
	return id
}

func Success(c *gin.Context, data any) {
	c.JSON(http.StatusOK, SuccessEnvelope{
		Data: normalizeSuccessData(data),
		Meta: Meta{RequestID: RequestID(c)},
	})
}

func List(c *gin.Context, data any, pagination Pagination) {
	c.JSON(http.StatusOK, ListEnvelope{
		Data:       normalizeListData(data),
		Pagination: pagination,
		Meta:       Meta{RequestID: RequestID(c)},
	})
}

func Error(c *gin.Context, code errcodes.ErrorCode, message string, detail any) {
	ErrorWithRetryAfter(c, code, message, detail, nil)
}

func ErrorWithRetryAfter(c *gin.Context, code errcodes.ErrorCode, message string, detail any, retryAfter *int) {
	if !code.Valid() {
		code = errcodes.ErrSkillInternalError
	}
	if code == errcodes.ErrSkillRateLimited && retryAfter == nil {
		v := defaultRateLimitRetryAfterSeconds
		retryAfter = &v
	}
	if retryAfter != nil && *retryAfter <= 0 {
		retryAfter = nil
	}
	if retryAfter != nil {
		c.Header("Retry-After", strconv.Itoa(*retryAfter))
	}
	c.JSON(errcodes.HTTPStatusFor(code), ErrorEnvelope{
		Error: ErrorBody{
			Code:       code,
			Message:    message,
			Detail:     detail,
			RequestID:  RequestID(c),
			RetryAfter: retryAfter,
		},
	})
}

func normalizeSuccessData(data any) any {
	if data == nil {
		return gin.H{}
	}
	return normalizeNilSlice(data)
}

func normalizeListData(data any) any {
	if data == nil {
		return []any{}
	}
	return normalizeNilSlice(data)
}

func normalizeNilSlice(data any) any {
	v := reflect.ValueOf(data)
	if v.Kind() == reflect.Slice && v.IsNil() {
		return []any{}
	}
	return data
}
