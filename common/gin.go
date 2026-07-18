package common

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net"
	"net/http"
	"net/textproto"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/pkg/errors"

	"github.com/gin-gonic/gin"
)

const KeyRequestBody = "key_request_body"
const KeyBodyStorage = "key_body_storage"

const asyncImageDataURIContentType = "application/x-new-api-image-data-uri"

const keyAsyncImageMultipartStorage = "key_async_image_multipart_storage"

const maxAsyncImageEditBodyBytes int64 = 64 << 20

var ErrRequestBodyTooLarge = errors.New("request body too large")

// ErrUploadIdleTimeout means the client stopped delivering request-body bytes
// and never resumed. It is deliberately an *idle* timeout, not a total one: a
// large upload that keeps making progress is never cut, only one that has
// visibly stalled. Without it a stalled upload holds the request until the
// client's own timeout fires — measured at 300s in prod, five minutes in which
// the user's conversation is simply dead.
var ErrUploadIdleTimeout = errors.New("request body stalled: no bytes received within the upload idle timeout")

func IsRequestBodyTooLargeError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, ErrRequestBodyTooLarge) {
		return true
	}
	var mbe *http.MaxBytesError
	return errors.As(err, &mbe)
}

// IsClientDisconnectError 判断 err 是否为「客户端在我们读完请求体之前掉线」，而不是
// 「客户端发来了一个格式错误的请求」。两者都表现为读 body 失败，但只有后者是客户端
// 的锅，把前者也报成「无效的请求」会把排查引向完全错误的方向。
//
// 仅用于判定读取 *入站* 请求体产生的 error。不要拿它去判定上游（relay）请求的
// error：那边的连接层失败长得一模一样，会被误判成「客户端掉线」而静默吞掉，
// 该重试的不重试、该记渠道健康度的不记。
//
// 两个刻意的边界：
//   - io.EOF 不算：那是干净的结尾（空 body），属于请求本身的问题；
//     只有 io.ErrUnexpectedEOF 才代表收到的字节数少于 Content-Length。
//   - context.Canceled 在优雅关机（srv.Shutdown 取消在途请求）时也会出现，
//     那种情况同样不该计费、不该记渠道账，按掉线处理结果是对的。
func IsClientDisconnectError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, io.ErrUnexpectedEOF) ||
		errors.Is(err, context.Canceled) ||
		errors.Is(err, net.ErrClosed) ||
		errors.Is(err, ErrUploadIdleTimeout) ||
		errors.Is(err, http.ErrBodyReadAfterClose) {
		return true
	}
	// 读连接时的连接层错误（RST、broken pipe 等）归为掉线。只认 "read"：
	// dial/write 不可能出现在读请求体的路径上，放行它们只会扩大误判面。
	var opErr *net.OpError
	return errors.As(err, &opErr) && opErr.Op == "read"
}

// countingReader tallies bytes actually delivered by the client. Only used to
// make a failed body read diagnosable; it adds one indirection per Read.
type countingReader struct {
	r io.Reader
	n int64
}

func (c *countingReader) Read(p []byte) (int, error) {
	n, err := c.r.Read(p)
	c.n += int64(n)
	return n, err
}

func GetRequestBody(c *gin.Context) (io.Seeker, error) {
	// 首先检查是否有 BodyStorage 缓存
	if storage, exists := c.Get(KeyBodyStorage); exists && storage != nil {
		if bs, ok := storage.(BodyStorage); ok {
			if _, err := bs.Seek(0, io.SeekStart); err != nil {
				return nil, fmt.Errorf("failed to seek body storage: %w", err)
			}
			return bs, nil
		}
	}

	// 检查旧的缓存方式
	cached, exists := c.Get(KeyRequestBody)
	if exists && cached != nil {
		if b, ok := cached.([]byte); ok {
			bs, err := CreateBodyStorage(b)
			if err != nil {
				return nil, err
			}
			c.Set(KeyBodyStorage, bs)
			return bs, nil
		}
	}

	maxMB := constant.MaxRequestBodyMB
	if maxMB <= 0 {
		maxMB = 128 // 默认 128MB
	}
	maxBytes := int64(maxMB) << 20
	isAsyncImageEditMultipart := c.Request != nil &&
		(c.Request.URL.Path == "/v1/images/edits" || c.Request.URL.Path == "/v1/edits") &&
		strings.Contains(strings.ToLower(c.Request.Header.Get("Content-Type")), "multipart/form-data")
	if isAsyncImageEditMultipart && maxBytes > maxAsyncImageEditBodyBytes {
		maxBytes = maxAsyncImageEditBodyBytes
	}

	contentLength := c.Request.ContentLength

	// 使用新的存储系统
	// 统计实际读到的字节数：读 body 失败时，「收到了多少」是唯一能区分故障模式的
	// 数字 —— 0 表示客户端压根没发（例如在等 100-continue），读到一半表示上传中途
	// 卡死，接近 Content-Length 则是尾部被截断。io.ReadAll 出错时会丢弃已读数据，
	// 所以只能在这里数。
	counter := &countingReader{r: c.Request.Body}
	var storage BodyStorage
	var err error
	if isAsyncImageEditMultipart {
		storage, err = CreateDiskBodyStorageFromReader(counter, maxBytes)
	} else {
		storage, err = CreateBodyStorageFromReader(counter, contentLength, maxBytes)
	}
	_ = c.Request.Body.Close()

	if err != nil {
		SetContextKey(c, constant.ContextKeyRequestBodyReadBytes, counter.n)
		if IsRequestBodyTooLargeError(err) {
			return nil, errors.Wrap(ErrRequestBodyTooLarge, fmt.Sprintf("request body exceeds %d MB", maxBytes>>20))
		}
		return nil, err
	}

	// 缓存存储对象
	c.Set(KeyBodyStorage, storage)

	return storage, nil
}

// GetBodyStorage 获取请求体存储对象（用于需要多次读取的场景）
func GetBodyStorage(c *gin.Context) (BodyStorage, error) {
	seeker, err := GetRequestBody(c)
	if err != nil {
		return nil, err
	}
	bs, ok := seeker.(BodyStorage)
	if !ok {
		return nil, errors.New("unexpected body storage type")
	}
	return bs, nil
}

// CleanupBodyStorage 清理请求体存储（应在请求结束时调用）
func CleanupBodyStorage(c *gin.Context) {
	if c != nil && c.Request != nil && c.Request.MultipartForm != nil {
		_ = c.Request.MultipartForm.RemoveAll()
		c.Request.MultipartForm = nil
	}
	if storage, exists := c.Get(keyAsyncImageMultipartStorage); exists && storage != nil {
		if bs, ok := storage.(BodyStorage); ok {
			_ = bs.Close()
		}
		c.Set(keyAsyncImageMultipartStorage, nil)
	}
	if storage, exists := c.Get(KeyBodyStorage); exists && storage != nil {
		if bs, ok := storage.(BodyStorage); ok {
			bs.Close()
		}
		c.Set(KeyBodyStorage, nil)
	}
}

func UnmarshalBodyReusable(c *gin.Context, v any) error {
	storage, err := GetBodyStorage(c)
	if err != nil {
		return err
	}
	contentType := c.Request.Header.Get("Content-Type")

	// disk-backed JSON: stream-decode directly from the file to avoid
	// materializing the entire payload back into a transient []byte
	// (diskStorage.Bytes() would ReadFull the whole file into the heap).
	if storage.IsDisk() && strings.HasPrefix(contentType, "application/json") {
		if _, seekErr := storage.Seek(0, io.SeekStart); seekErr != nil {
			return seekErr
		}
		if err := DecodeJson(storage, v); err != nil {
			return err
		}
		if _, seekErr := storage.Seek(0, io.SeekStart); seekErr != nil {
			return seekErr
		}
		c.Request.Body = io.NopCloser(storage)
		return nil
	}

	requestBody, err := storage.Bytes()
	if err != nil {
		return err
	}
	if strings.HasPrefix(contentType, "application/json") {
		err = Unmarshal(requestBody, v)
	} else if strings.Contains(contentType, gin.MIMEPOSTForm) {
		err = parseFormData(requestBody, v)
	} else if strings.Contains(contentType, gin.MIMEMultipartPOSTForm) {
		err = parseMultipartFormData(c, requestBody, v)
	} else {
		// skip for now
		// TODO: someday non json request have variant model, we will need to implementation this
	}
	if err != nil {
		return err
	}
	// Reset request body
	if _, seekErr := storage.Seek(0, io.SeekStart); seekErr != nil {
		return seekErr
	}
	c.Request.Body = io.NopCloser(storage)
	return nil
}

func SetContextKey(c *gin.Context, key constant.ContextKey, value any) {
	c.Set(string(key), value)
}

func GetContextKey(c *gin.Context, key constant.ContextKey) (any, bool) {
	return c.Get(string(key))
}

func GetContextKeyString(c *gin.Context, key constant.ContextKey) string {
	return c.GetString(string(key))
}

func GetContextKeyInt64(c *gin.Context, key constant.ContextKey) int64 {
	v, _ := GetContextKeyType[int64](c, key)
	return v
}

func GetContextKeyInt(c *gin.Context, key constant.ContextKey) int {
	return c.GetInt(string(key))
}

func GetContextKeyBool(c *gin.Context, key constant.ContextKey) bool {
	return c.GetBool(string(key))
}

func GetContextKeyStringSlice(c *gin.Context, key constant.ContextKey) []string {
	return c.GetStringSlice(string(key))
}

func GetContextKeyStringMap(c *gin.Context, key constant.ContextKey) map[string]any {
	return c.GetStringMap(string(key))
}

func GetContextKeyTime(c *gin.Context, key constant.ContextKey) time.Time {
	return c.GetTime(string(key))
}

func GetContextKeyType[T any](c *gin.Context, key constant.ContextKey) (T, bool) {
	if value, ok := c.Get(string(key)); ok {
		if v, ok := value.(T); ok {
			return v, true
		}
	}
	var t T
	return t, false
}

func ApiError(c *gin.Context, err error) {
	c.JSON(http.StatusOK, gin.H{
		"success": false,
		"message": err.Error(),
	})
}

func ApiErrorMsg(c *gin.Context, msg string) {
	c.JSON(http.StatusOK, gin.H{
		"success": false,
		"message": msg,
	})
}

func ApiSuccess(c *gin.Context, data any) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    data,
	})
}

// ApiErrorI18n returns a translated error message based on the user's language preference
// key is the i18n message key, args is optional template data
func ApiErrorI18n(c *gin.Context, key string, args ...map[string]any) {
	msg := TranslateMessage(c, key, args...)
	c.JSON(http.StatusOK, gin.H{
		"success": false,
		"message": msg,
	})
}

// ApiSuccessI18n returns a translated success message based on the user's language preference
func ApiSuccessI18n(c *gin.Context, key string, data any, args ...map[string]any) {
	msg := TranslateMessage(c, key, args...)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": msg,
		"data":    data,
	})
}

// TranslateMessage is a helper function that calls i18n.T
// This function is defined here to avoid circular imports
// The actual implementation will be set during init
var TranslateMessage func(c *gin.Context, key string, args ...map[string]any) string

func init() {
	// Default implementation that returns the key as-is
	// This will be replaced by i18n.T during i18n initialization
	TranslateMessage = func(c *gin.Context, key string, args ...map[string]any) string {
		c.Header("X-Translate-id", "d5e7afdfc7f03414b941f9c1e7096be9966510e7")
		return key
	}
}

func ParseMultipartFormReusable(c *gin.Context) (*multipart.Form, error) {
	if c != nil && c.Request != nil && c.Request.MultipartForm != nil {
		return c.Request.MultipartForm, nil
	}
	storage, err := GetBodyStorage(c)
	if err != nil {
		return nil, err
	}

	// Use the original Content-Type saved on first call to avoid boundary
	// mismatch when callers overwrite c.Request.Header after multipart rebuild.
	var contentType string
	if saved, ok := c.Get("_original_multipart_ct"); ok {
		contentType = saved.(string)
	} else {
		contentType = c.Request.Header.Get("Content-Type")
		c.Set("_original_multipart_ct", contentType)
	}
	boundary, err := parseBoundary(contentType)
	if err != nil {
		return nil, err
	}

	if _, err := storage.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}
	parseStorage := BodyStorage(storage)
	parseBoundary := boundary
	memoryLimit := multipartMemoryLimit()
	if isAsyncImageEditMultipartRequest(c.Request) {
		transformed, transformedBoundary, err := transformAsyncImageEditMultipart(storage, boundary)
		if err != nil {
			return nil, err
		}
		c.Set(keyAsyncImageMultipartStorage, transformed)
		parseStorage = transformed
		parseBoundary = transformedBoundary
		memoryLimit = 0
	}
	reader := multipart.NewReader(ReaderOnly(parseStorage), parseBoundary)
	form, err := reader.ReadForm(memoryLimit)
	if err != nil {
		return nil, err
	}
	c.Request.MultipartForm = form

	// Reset request body
	if _, seekErr := storage.Seek(0, io.SeekStart); seekErr != nil {
		return nil, seekErr
	}
	c.Request.Body = io.NopCloser(storage)
	return form, nil
}

func isAsyncImageEditMultipartRequest(request *http.Request) bool {
	return request != nil && request.URL != nil &&
		(request.URL.Path == "/v1/images/edits" || request.URL.Path == "/v1/edits") &&
		strings.Contains(strings.ToLower(request.Header.Get("Content-Type")), "multipart/form-data")
}

func transformAsyncImageEditMultipart(storage BodyStorage, boundary string) (BodyStorage, string, error) {
	if _, err := storage.Seek(0, io.SeekStart); err != nil {
		return nil, "", err
	}
	pipeReader, pipeWriter := io.Pipe()
	writer := multipart.NewWriter(pipeWriter)
	transformedBoundary := writer.Boundary()
	writeErr := make(chan error, 1)
	go func() {
		reader := multipart.NewReader(ReaderOnly(storage), boundary)
		var resultErr error
		for {
			part, err := reader.NextPart()
			if errors.Is(err, io.EOF) {
				break
			}
			if err != nil {
				resultErr = err
				break
			}
			header := make(textproto.MIMEHeader, len(part.Header))
			for key, values := range part.Header {
				header[key] = append([]string(nil), values...)
			}
			partReader := bufio.NewReader(part)
			prefix, _ := partReader.Peek(len("data:"))
			fieldName := part.FormName()
			isImageField := fieldName == "image" || fieldName == "image[]" || strings.HasPrefix(fieldName, "image[") || fieldName == "mask"
			if part.FileName() == "" && isImageField && strings.EqualFold(string(prefix), "data:") {
				header.Set("Content-Disposition", mime.FormatMediaType("form-data", map[string]string{
					"name":     fieldName,
					"filename": "input.data-uri",
				}))
				header.Set("Content-Type", asyncImageDataURIContentType)
			}
			target, err := writer.CreatePart(header)
			if err == nil {
				_, err = io.Copy(target, partReader)
			}
			closeErr := part.Close()
			if err != nil {
				resultErr = err
				break
			}
			if closeErr != nil {
				resultErr = closeErr
				break
			}
		}
		if resultErr == nil {
			resultErr = writer.Close()
		} else {
			_ = writer.Close()
		}
		_ = pipeWriter.CloseWithError(resultErr)
		writeErr <- resultErr
		close(writeErr)
	}()
	transformed, err := CreateDiskBodyStorageFromReader(pipeReader, maxAsyncImageEditBodyBytes+(1<<20))
	if err != nil {
		_ = pipeReader.CloseWithError(err)
	}
	writerErr := <-writeErr
	if err != nil {
		return nil, "", fmt.Errorf("spool async image edit multipart: %w", err)
	}
	if writerErr != nil {
		_ = transformed.Close()
		return nil, "", fmt.Errorf("transform async image edit multipart: %w", writerErr)
	}
	return transformed, transformedBoundary, nil
}

func IsAsyncImageDataURIFile(header textproto.MIMEHeader) bool {
	return strings.EqualFold(strings.TrimSpace(header.Get("Content-Type")), asyncImageDataURIContentType)
}

func processFormMap(formMap map[string]any, v any) error {
	jsonData, err := Marshal(formMap)
	if err != nil {
		return err
	}

	err = Unmarshal(jsonData, v)
	if err != nil {
		return err
	}

	return nil
}

func parseFormData(data []byte, v any) error {
	values, err := url.ParseQuery(string(data))
	if err != nil {
		return err
	}
	formMap := make(map[string]any)
	for key, vals := range values {
		if len(vals) == 1 {
			formMap[key] = vals[0]
		} else {
			formMap[key] = vals
		}
	}

	return processFormMap(formMap, v)
}

func parseMultipartFormData(c *gin.Context, data []byte, v any) error {
	var contentType string
	if saved, ok := c.Get("_original_multipart_ct"); ok {
		contentType = saved.(string)
	} else {
		contentType = c.Request.Header.Get("Content-Type")
		c.Set("_original_multipart_ct", contentType)
	}
	boundary, err := parseBoundary(contentType)
	if err != nil {
		if errors.Is(err, errBoundaryNotFound) {
			return Unmarshal(data, v) // Fallback to JSON
		}
		return err
	}

	reader := multipart.NewReader(bytes.NewReader(data), boundary)
	form, err := reader.ReadForm(multipartMemoryLimit())
	if err != nil {
		return err
	}
	defer form.RemoveAll()
	formMap := make(map[string]any)
	for key, vals := range form.Value {
		if len(vals) == 1 {
			formMap[key] = vals[0]
		} else {
			formMap[key] = vals
		}
	}

	return processFormMap(formMap, v)
}

var errBoundaryNotFound = errors.New("multipart boundary not found")

// parseBoundary extracts the multipart boundary from the Content-Type header using mime.ParseMediaType
func parseBoundary(contentType string) (string, error) {
	if contentType == "" {
		return "", errBoundaryNotFound
	}
	// Boundary-UUID / boundary-------xxxxxx
	_, params, err := mime.ParseMediaType(contentType)
	if err != nil {
		return "", err
	}
	boundary, ok := params["boundary"]
	if !ok || boundary == "" {
		return "", errBoundaryNotFound
	}
	return boundary, nil
}

// multipartMemoryLimit returns the configured multipart memory limit in bytes
func multipartMemoryLimit() int64 {
	limitMB := constant.MaxFileDownloadMB
	if limitMB <= 0 {
		limitMB = 32
	}
	return int64(limitMB) << 20
}
