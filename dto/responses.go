package dto

import (
	"context"
	"net/http"
	"net/url"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/go-fuego/fuego"
)

// FuegoCtx is a constraint satisfied by both fuego.ContextNoBody and
// fuego.ContextWithBody[B]. Use it for helper functions that need to work
// with any native fuego context type.
type FuegoCtx interface {
	context.Context
	Context() context.Context
	Request() *http.Request
	Response() http.ResponseWriter
	PathParam(string) string
	PathParamInt(string) int
	PathParamIntErr(string) (int, error)
	QueryParam(string) string
	QueryParamArr(string) []string
	QueryParamInt(string) int
	QueryParamIntErr(string) (int, error)
	QueryParamBool(string) bool
	QueryParamBoolErr(string) (bool, error)
	QueryParams() url.Values
	Header(string) string
	SetHeader(string, string)
	Cookie(string) (*http.Cookie, error)
	SetCookie(http.Cookie)
	HasHeader(string) bool
	HasCookie(string) bool
	HasQueryParam(string) bool
	SetStatus(int)
	MainLang() string
	MainLocale() string
	Redirect(int, string) (any, error)
	Render(string, any, ...string) (fuego.CtxRenderer, error)
	GetOpenAPIParams() map[string]fuego.OpenAPIParam
}

// --- Standalone helper functions for native fuego handlers ---

// GinCtx extracts the underlying *gin.Context from any fuego context.
func GinCtx(c FuegoCtx) *gin.Context       { return c.Context().(*gin.Context) }
func UserID(c FuegoCtx) int                 { return GinCtx(c).GetInt("id") }
func UserRole(c FuegoCtx) int               { return GinCtx(c).GetInt("role") }
func TokenID(c FuegoCtx) int                { return GinCtx(c).GetInt("token_id") }
func PageInfo(c FuegoCtx) *common.PageInfo  { return common.GetPageQuery(GinCtx(c)) }
func Decode(c FuegoCtx, v any) error        { return common.DecodeJson(c.Request().Body, v) }
func QueryDefault(c FuegoCtx, name, def string) string {
	return GinCtx(c).DefaultQuery(name, def)
}

// Response is the generic typed API response wrapper.
// All API endpoints return this shape: {"success": true, "message": "", "data": <T>}
type Response[T any] struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    T      `json:"data"`
}

// PageData is the typed pagination wrapper for list endpoints.
type PageData[T any] struct {
	Page     int `json:"page"`
	PageSize int `json:"page_size"`
	Total    int `json:"total"`
	Items    []T `json:"items"`
}

// MessageResponse is a response with no data field, just success + message.
type MessageResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// Msg returns a success response with no data.
func Msg(msg string) (MessageResponse, error) {
	return MessageResponse{Success: true, Message: msg}, nil
}

// FailMsg returns a message-only error response (no data field).
func FailMsg(msg string) (MessageResponse, error) {
	return MessageResponse{Success: false, Message: msg}, nil
}

// OkAny returns a success response with untyped data.
// Use instead of Ok when the data type would produce an invalid OpenAPI schema name
// (e.g. slices, pointers, maps, any — Go generics bake these into reflect type names
// with characters like *, [], {} that violate OpenAPI's naming rules).
func OkAny(data any) (ApiResponse, error) {
	return ApiResponse{Success: true, Data: data}, nil
}

// OkMsgAny returns a success response with a message and untyped data.
func OkMsgAny(msg string, data any) (ApiResponse, error) {
	return ApiResponse{Success: true, Message: msg, Data: data}, nil
}

// FailAny returns an error response with untyped data field.
func FailAny(msg string) (ApiResponse, error) {
	return ApiResponse{Success: false, Message: msg}, nil
}

// Ok returns a typed success response (pointer to avoid Go 1.25.x compiler ICE
// with generic types >= 192 bytes).
func Ok[T any](data T) (*Response[T], error) {
	return &Response[T]{Success: true, Data: data}, nil
}

// OkMsg returns a typed success response with a message.
func OkMsg[T any](msg string, data T) (*Response[T], error) {
	return &Response[T]{Success: true, Message: msg, Data: data}, nil
}

// Fail returns a typed error response with no data.
func Fail[T any](msg string) (*Response[T], error) {
	return &Response[T]{Message: msg}, nil
}

// OkPage returns a typed paginated response from a PageInfo and items slice.
func OkPage[T any](p *common.PageInfo, items []T, total int) (*Response[PageData[T]], error) {
	return &Response[PageData[T]]{
		Success: true,
		Data: PageData[T]{
			Page:     p.GetPage(),
			PageSize: p.GetPageSize(),
			Total:    total,
			Items:    items,
		},
	}, nil
}

// FailPage returns a typed paginated error response.
func FailPage[T any](msg string) (*Response[PageData[T]], error) {
	return &Response[PageData[T]]{Message: msg}, nil
}

// Resp returns an option that overrides the 200 response schema in the OpenAPI spec.
// Use on routes returning ApiResponse to restore typed response documentation.
// The schema will be Response[T] (i.e. {success, message, data: T}).
func Resp[T any]() func(*fuego.BaseRoute) {
	return fuego.OptionAddResponse(http.StatusOK, "OK", fuego.Response{Type: &Response[T]{}})
}

// PageParams returns options that declare the standard pagination query parameters (p, page_size).
func PageParams() func(*fuego.BaseRoute) {
	return fuego.GroupOptions(
		fuego.OptionQueryInt("p", "Page number (1-based)"),
		fuego.OptionQueryInt("page_size", "Items per page"),
	)
}
