package service

import (
	"encoding/base64"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

const (
	RecentCallsContextKeyID = "recent_calls_id"

	DefaultRecentCallsCapacity = 100

	DefaultMaxRequestBodyBytes  = 64 << 10  // 64KiB
	DefaultMaxResponseBodyBytes = 256 << 10 // 256KiB

	DefaultMaxStreamChunkBytes = 8 << 10   // 8KiB
	DefaultMaxStreamTotalBytes = 256 << 10 // 256KiB
)

type RecentCallsCacheConfig struct {
	Capacity int

	MaxRequestBodyBytes  int
	MaxResponseBodyBytes int

	MaxStreamChunkBytes int
	MaxStreamTotalBytes int
}

type RecentCallRequest struct {
	Method string            `json:"method"`
	Path   string            `json:"path"`
	Header map[string]string `json:"headers,omitempty"`

	BodyType  string `json:"body_type,omitempty"`  // json/text/binary/unknown/omitted
	Body      string `json:"body,omitempty"`       // truncated string or base64 (when BodyType=binary)
	Truncated bool   `json:"truncated,omitempty"`  // body truncated
	Omitted   bool   `json:"omitted,omitempty"`    // body not recorded
	OmitReason string `json:"omit_reason,omitempty"`
}

type RecentCallUpstreamResponse struct {
	StatusCode int               `json:"status_code"`
	Header     map[string]string `json:"headers,omitempty"`

	BodyType  string `json:"body_type,omitempty"`  // json/text/binary/unknown/omitted
	Body      string `json:"body,omitempty"`       // raw upstream body (string or base64)
	Truncated bool   `json:"truncated,omitempty"`
	Omitted   bool   `json:"omitted,omitempty"`
	OmitReason string `json:"omit_reason,omitempty"`
}

type RecentCallUpstreamStream struct {
	Chunks              []string `json:"chunks,omitempty"`             // raw SSE data payload lines
	ChunksTruncated     bool     `json:"chunks_truncated,omitempty"`   // some chunks dropped/truncated due to limits
	AggregatedText      string   `json:"aggregated_text,omitempty"`    // best-effort aggregated assistant text
	AggregatedTruncated bool     `json:"aggregated_truncated,omitempty"`

	StreamBytes int `json:"-"`
}

type RecentCallErrorInfo struct {
	Message string `json:"message,omitempty"`
	Type    string `json:"type,omitempty"`
	Code    string `json:"code,omitempty"`
	Status  int    `json:"status,omitempty"`
}

type RecentCallRecord struct {
	ID        uint64    `json:"id"`
	CreatedAt time.Time `json:"created_at"`

	UserID    int    `json:"user_id"`
	ChannelID int    `json:"channel_id,omitempty"`
	ModelName string `json:"model_name,omitempty"`

	Method string `json:"method"`
	Path   string `json:"path"`

	Request  RecentCallRequest          `json:"request"`
	Response *RecentCallUpstreamResponse `json:"response,omitempty"`
	Stream   *RecentCallUpstreamStream   `json:"stream,omitempty"`
	Error    *RecentCallErrorInfo        `json:"error,omitempty"`
}

type recentCallsCache struct {
	cfg RecentCallsCacheConfig

	nextID atomic.Uint64

	mu     sync.RWMutex
	buffer []*RecentCallRecord
}

var recentCallsSingleton = newRecentCallsCache(RecentCallsCacheConfig{
	Capacity: DefaultRecentCallsCapacity,

	MaxRequestBodyBytes:  DefaultMaxRequestBodyBytes,
	MaxResponseBodyBytes: DefaultMaxResponseBodyBytes,

	MaxStreamChunkBytes: DefaultMaxStreamChunkBytes,
	MaxStreamTotalBytes: DefaultMaxStreamTotalBytes,
})

func RecentCallsCache() *recentCallsCache {
	return recentCallsSingleton
}

func newRecentCallsCache(cfg RecentCallsCacheConfig) *recentCallsCache {
	if cfg.Capacity <= 0 {
		cfg.Capacity = DefaultRecentCallsCapacity
	}
	if cfg.MaxRequestBodyBytes <= 0 {
		cfg.MaxRequestBodyBytes = DefaultMaxRequestBodyBytes
	}
	if cfg.MaxResponseBodyBytes <= 0 {
		cfg.MaxResponseBodyBytes = DefaultMaxResponseBodyBytes
	}
	if cfg.MaxStreamChunkBytes <= 0 {
		cfg.MaxStreamChunkBytes = DefaultMaxStreamChunkBytes
	}
	if cfg.MaxStreamTotalBytes <= 0 {
		cfg.MaxStreamTotalBytes = DefaultMaxStreamTotalBytes
	}

	return &recentCallsCache{
		cfg:    cfg,
		buffer: make([]*RecentCallRecord, cfg.Capacity),
	}
}

func (cch *recentCallsCache) BeginFromContext(c *gin.Context, info *relaycommon.RelayInfo, rawRequestBody []byte) uint64 {
	if cch == nil || c == nil {
		return 0
	}

	id := cch.nextID.Add(1)

	path := ""
	if c.Request != nil && c.Request.URL != nil {
		path = c.Request.URL.Path
	}
	method := ""
	if c.Request != nil {
		method = c.Request.Method
	}

	userID := common.GetContextKeyInt(c, constant.ContextKeyUserId)
	channelID := common.GetContextKeyInt(c, constant.ContextKeyChannelId)

	modelName := ""
	if info != nil {
		modelName = info.OriginModelName
		if modelName == "" {
			modelName = info.UpstreamModelName
		}
	}

	rec := &RecentCallRecord{
		ID:        id,
		CreatedAt: time.Now().UTC(),

		UserID:    userID,
		ChannelID: channelID,
		ModelName: modelName,

		Method: method,
		Path:   path,

		Request: RecentCallRequest{
			Method: method,
			Path:   path,
			Header: sanitizeHeaders(c.Request.Header),
		},
	}

	rec.Request.BodyType, rec.Request.Body, rec.Request.Truncated, rec.Request.Omitted, rec.Request.OmitReason =
		encodeBodyForRecord(c.Request.Header.Get("Content-Type"), rawRequestBody, cch.cfg.MaxRequestBodyBytes)

	c.Set(RecentCallsContextKeyID, id)
	cch.put(rec)
	return id
}

func (cch *recentCallsCache) UpsertErrorByContext(c *gin.Context, errMsg string, errType string, errCode string, status int) {
	if cch == nil || c == nil {
		return
	}
	id := getRecentCallID(c)
	if id == 0 {
		return
	}
	cch.mu.Lock()
	defer cch.mu.Unlock()
	rec := cch.getLocked(id)
	if rec == nil {
		return
	}
	rec.Error = &RecentCallErrorInfo{
		Message: errMsg,
		Type:    errType,
		Code:    errCode,
		Status:  status,
	}
}

func (cch *recentCallsCache) UpsertUpstreamResponseByContext(c *gin.Context, resp *http.Response, rawUpstreamBody []byte) {
	if cch == nil || c == nil {
		return
	}
	id := getRecentCallID(c)
	if id == 0 {
		return
	}

	header := map[string]string(nil)
	statusCode := 0
	contentType := ""
	if resp != nil {
		statusCode = resp.StatusCode
		contentType = resp.Header.Get("Content-Type")
		header = sanitizeHeaders(resp.Header)
	}

	bodyType, body, truncated, omitted, omitReason := encodeBodyForRecord(contentType, rawUpstreamBody, cch.cfg.MaxResponseBodyBytes)

	cch.mu.Lock()
	defer cch.mu.Unlock()
	rec := cch.getLocked(id)
	if rec == nil {
		return
	}
	rec.Response = &RecentCallUpstreamResponse{
		StatusCode: statusCode,
		Header:     header,
		BodyType:   bodyType,
		Body:       body,
		Truncated:  truncated,
		Omitted:    omitted,
		OmitReason: omitReason,
	}
}

func (cch *recentCallsCache) EnsureStreamByContext(c *gin.Context, resp *http.Response) {
	if cch == nil || c == nil {
		return
	}
	id := getRecentCallID(c)
	if id == 0 {
		return
	}

	cch.mu.Lock()
	defer cch.mu.Unlock()
	rec := cch.getLocked(id)
	if rec == nil {
		return
	}
	if rec.Stream == nil {
		rec.Stream = &RecentCallUpstreamStream{
			Chunks: make([]string, 0, 32),
		}
	}
	if rec.Response == nil && resp != nil {
		rec.Response = &RecentCallUpstreamResponse{
			StatusCode: resp.StatusCode,
			Header:     sanitizeHeaders(resp.Header),
		}
	}
}

func (cch *recentCallsCache) AppendStreamChunkByContext(c *gin.Context, chunk string) {
	if cch == nil || c == nil || chunk == "" {
		return
	}
	id := getRecentCallID(c)
	if id == 0 {
		return
	}

	chunkTruncated := false
	if cch.cfg.MaxStreamChunkBytes > 0 && len(chunk) > cch.cfg.MaxStreamChunkBytes {
		chunk = chunk[:cch.cfg.MaxStreamChunkBytes]
		chunkTruncated = true
	}

	cch.mu.Lock()
	defer cch.mu.Unlock()
	rec := cch.getLocked(id)
	if rec == nil {
		return
	}
	if rec.Stream == nil {
		rec.Stream = &RecentCallUpstreamStream{
			Chunks: make([]string, 0, 32),
		}
	}

	if chunkTruncated {
		rec.Stream.ChunksTruncated = true
	}

	if cch.cfg.MaxStreamTotalBytes > 0 && rec.Stream.StreamBytes+len(chunk) > cch.cfg.MaxStreamTotalBytes {
		rec.Stream.ChunksTruncated = true
		return
	}

	rec.Stream.Chunks = append(rec.Stream.Chunks, chunk)
	rec.Stream.StreamBytes += len(chunk)
}

func (cch *recentCallsCache) FinalizeStreamAggregatedTextByContext(c *gin.Context, aggregated string) {
	if cch == nil || c == nil {
		return
	}
	id := getRecentCallID(c)
	if id == 0 {
		return
	}

	truncated := false
	if cch.cfg.MaxResponseBodyBytes > 0 && len(aggregated) > cch.cfg.MaxResponseBodyBytes {
		aggregated = aggregated[:cch.cfg.MaxResponseBodyBytes]
		truncated = true
	}

	cch.mu.Lock()
	defer cch.mu.Unlock()
	rec := cch.getLocked(id)
	if rec == nil {
		return
	}
	if rec.Stream == nil {
		rec.Stream = &RecentCallUpstreamStream{
			Chunks: make([]string, 0, 32),
		}
	}
	rec.Stream.AggregatedText = aggregated
	rec.Stream.AggregatedTruncated = truncated
}

func (cch *recentCallsCache) Get(id uint64) (*RecentCallRecord, bool) {
	if cch == nil || id == 0 {
		return nil, false
	}
	cch.mu.RLock()
	defer cch.mu.RUnlock()
	rec := cch.getLocked(id)
	if rec == nil {
		return nil, false
	}
	dup := *rec
	if rec.Response != nil {
		r := *rec.Response
		dup.Response = &r
	}
	if rec.Stream != nil {
		s := *rec.Stream
		if rec.Stream.Chunks != nil {
			s.Chunks = append([]string(nil), rec.Stream.Chunks...)
		}
		s.StreamBytes = 0
		dup.Stream = &s
	}
	if rec.Error != nil {
		e := *rec.Error
		dup.Error = &e
	}
	return &dup, true
}

func (cch *recentCallsCache) List(limit int, beforeID uint64) []*RecentCallRecord {
	if cch == nil {
		return nil
	}
	if limit <= 0 {
		limit = cch.cfg.Capacity
	}
	if limit > cch.cfg.Capacity {
		limit = cch.cfg.Capacity
	}

	cch.mu.RLock()
	defer cch.mu.RUnlock()

	items := make([]*RecentCallRecord, 0, limit)
	for _, rec := range cch.buffer {
		if rec == nil {
			continue
		}
		if beforeID != 0 && rec.ID >= beforeID {
			continue
		}
		items = append(items, rec)
	}

	sort.Slice(items, func(i, j int) bool { return items[i].ID > items[j].ID })
	if len(items) > limit {
		items = items[:limit]
	}

	out := make([]*RecentCallRecord, 0, len(items))
	for _, rec := range items {
		dup := *rec
		if rec.Response != nil {
			r := *rec.Response
			dup.Response = &r
		}
		if rec.Stream != nil {
			s := *rec.Stream
			if rec.Stream.Chunks != nil {
				s.Chunks = append([]string(nil), rec.Stream.Chunks...)
			}
			s.StreamBytes = 0
			dup.Stream = &s
		}
		if rec.Error != nil {
			e := *rec.Error
			dup.Error = &e
		}
		out = append(out, &dup)
	}
	return out
}

func (cch *recentCallsCache) put(rec *RecentCallRecord) {
	if cch == nil || rec == nil {
		return
	}
	idx := int(rec.ID % uint64(cch.cfg.Capacity))
	cch.mu.Lock()
	cch.buffer[idx] = rec
	cch.mu.Unlock()
}

func (cch *recentCallsCache) getLocked(id uint64) *RecentCallRecord {
	if cch == nil || id == 0 {
		return nil
	}
	idx := int(id % uint64(cch.cfg.Capacity))
	rec := cch.buffer[idx]
	if rec == nil || rec.ID != id {
		return nil
	}
	return rec
}

func getRecentCallID(c *gin.Context) uint64 {
	if c == nil {
		return 0
	}
	v, ok := c.Get(RecentCallsContextKeyID)
	if !ok || v == nil {
		return 0
	}
	switch t := v.(type) {
	case uint64:
		return t
	case uint:
		return uint64(t)
	case int:
		if t < 0 {
			return 0
		}
		return uint64(t)
	case int64:
		if t < 0 {
			return 0
		}
		return uint64(t)
	case string:
		parsed, _ := strconv.ParseUint(t, 10, 64)
		return parsed
	default:
		return 0
	}
}

func sanitizeHeaders(h http.Header) map[string]string {
	if h == nil {
		return nil
	}
	out := make(map[string]string, len(h))
	for k, vals := range h {
		if len(vals) == 0 {
			continue
		}
		v := strings.Join(vals, ",")
		switch strings.ToLower(k) {
		case "authorization", "x-api-key", "x-goog-api-key", "proxy-authorization":
			out[k] = "***masked***"
		default:
			out[k] = v
		}
	}
	return out
}

func encodeBodyForRecord(contentType string, body []byte, limit int) (bodyType string, encoded string, truncated bool, omitted bool, omitReason string) {
	if len(body) == 0 {
		return "unknown", "", false, true, "empty"
	}

	ct := strings.ToLower(strings.TrimSpace(contentType))
	if strings.HasPrefix(ct, "application/json") || strings.HasPrefix(ct, "text/") || strings.Contains(ct, "application/x-www-form-urlencoded") {
		bodyType = "text"
		if strings.HasPrefix(ct, "application/json") {
			bodyType = "json"
		}
		s := string(body)
		if limit > 0 && len(s) > limit {
			s = s[:limit]
			truncated = true
		}
		return bodyType, s, truncated, false, ""
	}

	if strings.Contains(ct, "multipart/form-data") {
		return "binary", "", false, true, "multipart_form_data"
	}

	if strings.HasPrefix(ct, "application/octet-stream") {
		// base64 with limit
		b := body
		if limit > 0 && len(b) > limit {
			b = b[:limit]
			truncated = true
		}
		return "binary", base64.StdEncoding.EncodeToString(b), truncated, false, ""
	}

	// Unknown content-type: best-effort treat as text if printable-ish, otherwise omit
	bodyType = "unknown"
	s := string(body)
	if limit > 0 && len(s) > limit {
		s = s[:limit]
		truncated = true
	}
	return bodyType, s, truncated, false, ""
}