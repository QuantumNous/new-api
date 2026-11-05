package common

import (
	"mime/multipart"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/internal/constant"
	"github.com/QuantumNous/new-api/internal/transport/contract"
)

// Framework-neutral transport helpers: every business call site goes through
// contract.Context; only the active transport adapter (fiberadapter) knows
// which framework is underneath.

// H is the framework-neutral equivalent of a JSON object map.
type H = map[string]any

func SetCtxKey(c contract.Context, key constant.ContextKey, value any) {
	c.Set(string(key), value)
}

func GetCtxKey(c contract.Context, key constant.ContextKey) (any, bool) {
	return c.Get(string(key))
}

func GetCtxKeyString(c contract.Context, key constant.ContextKey) string {
	return c.GetString(string(key))
}

func GetCtxKeyInt(c contract.Context, key constant.ContextKey) int {
	return c.GetInt(string(key))
}

func GetCtxKeyBool(c contract.Context, key constant.ContextKey) bool {
	return c.GetBool(string(key))
}

func GetCtxKeyTime(c contract.Context, key constant.ContextKey) time.Time {
	return c.GetTime(string(key))
}

func GetCtxKeyType[T any](c contract.Context, key constant.ContextKey) (T, bool) {
	if value, ok := c.Get(string(key)); ok {
		if v, ok := value.(T); ok {
			return v, true
		}
	}
	var t T
	return t, false
}

func CtxApiError(c contract.Context, err error) {
	c.JSON(http.StatusOK, H{
		"success": false,
		"message": err.Error(),
	})
}

func CtxApiErrorMsg(c contract.Context, msg string) {
	c.JSON(http.StatusOK, H{
		"success": false,
		"message": msg,
	})
}

func CtxApiSuccess(c contract.Context, data any) {
	c.JSON(http.StatusOK, H{
		"success": true,
		"message": "",
		"data":    data,
	})
}

// CtxApiErrorI18n returns a translated error message based on the user's
// language preference. key is the i18n message key, args is optional template
// data.
func CtxApiErrorI18n(c contract.Context, key string, args ...map[string]any) {
	c.JSON(http.StatusOK, H{
		"success": false,
		"message": TranslateCtxMessage(c, key, args...),
	})
}

// CtxApiSuccessI18n returns a translated success message based on the user's
// language preference.
func CtxApiSuccessI18n(c contract.Context, key string, data any, args ...map[string]any) {
	c.JSON(http.StatusOK, H{
		"success": true,
		"message": TranslateCtxMessage(c, key, args...),
		"data":    data,
	})
}

// TranslateCtxMessage is assigned by the i18n package during initialization.
// It lives here for the same reason as TranslateMessage: i18n imports common,
// so common cannot import i18n.
var TranslateCtxMessage func(c contract.Context, key string, args ...map[string]any) string

func init() {
	// Default until i18n installs the real implementation. Mirrors the header
	// marker set so a missing init stays observable.
	TranslateCtxMessage = func(c contract.Context, key string, args ...map[string]any) string {
		c.SetHeader("X-Translate-id", "d5e7afdfc7f03414b941f9c1e7096be9966510e7")
		return key
	}
}

// UnmarshalCtxBodyReusable decodes the request body while leaving it readable
// for the outbound relay request.
func UnmarshalCtxBodyReusable(c contract.Context, v any) error {
	return c.BindJSON(v)
}

// ParseCtxMultipartForm returns the parsed multipart form, keeping the body
// replayable.
func ParseCtxMultipartForm(c contract.Context) (*multipart.Form, error) {
	return c.MultipartForm()
}

// MIME types business code matches on.
const (
	MIMEPOSTForm          = "application/x-www-form-urlencoded"
	MIMEMultipartPOSTForm = "multipart/form-data"
)
