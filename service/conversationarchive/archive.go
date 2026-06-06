package conversationarchive

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/tidwall/gjson"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

const (
	defaultSessionHeader = "X-Session-Id"
	defaultQueueSize     = 10000
	defaultWorkerCount   = 2
	defaultDumpBatchSize = 1000
	defaultDumpMinute    = 10
	tablePrefix          = "conversation_archive_"
)

type Config struct {
	Enabled       bool
	DSN           string
	SessionHeader string
	QueueSize     int
	WorkerCount   int
	Strict        bool
	DumpEnabled   bool
	DumpDir       string
	DumpTimezone  string
	DumpHour      int
	DumpMinute    int
}

type Record struct {
	SessionID        string
	RequestTime      time.Time
	ResponseTime     time.Time
	RequestBodyGzip  []byte
	ResponseBodyGzip []byte
}

type archiveRow struct {
	ID               uint64
	SessionID        string
	RequestTime      time.Time
	ResponseTime     time.Time
	RequestBodyGzip  []byte
	ResponseBodyGzip []byte
}

type service struct {
	cfg           Config
	db            *gorm.DB
	queue         chan Record
	ensuredTables map[string]struct{}
	tableMu       sync.Mutex
}

var (
	current   *service
	currentMu sync.RWMutex
)

func InitFromEnv() error {
	cfg := Config{
		Enabled:       common.GetEnvOrDefaultBool("CONVERSATION_ARCHIVE_ENABLED", false),
		DSN:           strings.TrimSpace(os.Getenv("CONVERSATION_ARCHIVE_DSN")),
		SessionHeader: common.GetEnvOrDefaultString("CONVERSATION_ARCHIVE_SESSION_HEADER", defaultSessionHeader),
		QueueSize:     common.GetEnvOrDefault("CONVERSATION_ARCHIVE_QUEUE_SIZE", defaultQueueSize),
		WorkerCount:   common.GetEnvOrDefault("CONVERSATION_ARCHIVE_WORKERS", defaultWorkerCount),
		Strict:        common.GetEnvOrDefaultBool("CONVERSATION_ARCHIVE_STRICT", false),
		DumpEnabled:   common.GetEnvOrDefaultBool("CONVERSATION_ARCHIVE_DUMP_ENABLED", false),
		DumpDir:       common.GetEnvOrDefaultString("CONVERSATION_ARCHIVE_DUMP_DIR", ""),
		DumpTimezone:  common.GetEnvOrDefaultString("CONVERSATION_ARCHIVE_TIMEZONE", "Asia/Shanghai"),
		DumpHour:      common.GetEnvOrDefault("CONVERSATION_ARCHIVE_DUMP_HOUR", 0),
		DumpMinute:    common.GetEnvOrDefault("CONVERSATION_ARCHIVE_DUMP_MINUTE", defaultDumpMinute),
	}
	return Init(cfg)
}

func Init(cfg Config) error {
	if !cfg.Enabled {
		setCurrent(nil)
		return nil
	}
	if cfg.DSN == "" {
		return fmt.Errorf("CONVERSATION_ARCHIVE_DSN 不能为空")
	}
	if !strings.HasPrefix(cfg.DSN, "postgres://") && !strings.HasPrefix(cfg.DSN, "postgresql://") {
		return fmt.Errorf("会话归档库当前仅支持 PostgreSQL DSN")
	}
	if cfg.SessionHeader == "" {
		cfg.SessionHeader = defaultSessionHeader
	}
	if cfg.QueueSize <= 0 {
		cfg.QueueSize = defaultQueueSize
	}
	if cfg.WorkerCount <= 0 {
		cfg.WorkerCount = defaultWorkerCount
	}
	if cfg.DumpMinute < 0 || cfg.DumpMinute > 59 {
		cfg.DumpMinute = defaultDumpMinute
	}
	if cfg.DumpHour < 0 || cfg.DumpHour > 23 {
		cfg.DumpHour = 0
	}

	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  cfg.DSN,
		PreferSimpleProtocol: true,
	}), &gorm.Config{PrepareStmt: true})
	if err != nil {
		return err
	}

	svc := &service{
		cfg:           cfg,
		db:            db,
		queue:         make(chan Record, cfg.QueueSize),
		ensuredTables: map[string]struct{}{},
	}
	setCurrent(svc)
	for i := 0; i < cfg.WorkerCount; i++ {
		gopool.Go(svc.worker)
	}
	logger.LogInfo(context.Background(), "会话归档已启用")
	return nil
}

func setCurrent(svc *service) {
	currentMu.Lock()
	defer currentMu.Unlock()
	current = svc
}

func Enabled() bool {
	currentMu.RLock()
	defer currentMu.RUnlock()
	return current != nil
}

func SessionHeader() string {
	currentMu.RLock()
	defer currentMu.RUnlock()
	if current == nil {
		return defaultSessionHeader
	}
	return current.cfg.SessionHeader
}

func Enqueue(record Record) {
	currentMu.RLock()
	svc := current
	currentMu.RUnlock()
	if svc == nil {
		return
	}
	if record.SessionID == "" {
		record.SessionID = "unknown"
	}
	if svc.cfg.Strict {
		svc.queue <- record
		return
	}
	select {
	case svc.queue <- record:
	default:
		logger.LogWarn(context.Background(), "会话归档队列已满，本条归档记录被跳过")
	}
}

func Close() error {
	currentMu.Lock()
	svc := current
	current = nil
	currentMu.Unlock()
	if svc == nil || svc.db == nil {
		return nil
	}
	sqlDB, err := svc.db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

func (s *service) worker() {
	for record := range s.queue {
		if err := s.insert(record); err != nil {
			logger.LogWarn(context.Background(), fmt.Sprintf("会话归档写入失败: %v", err))
		}
	}
}

func (s *service) insert(record Record) error {
	tableName := tableNameFor(record.RequestTime)
	if err := s.ensureTable(tableName); err != nil {
		return err
	}
	row := archiveRow{
		SessionID:        record.SessionID,
		RequestTime:      record.RequestTime,
		ResponseTime:     record.ResponseTime,
		RequestBodyGzip:  record.RequestBodyGzip,
		ResponseBodyGzip: record.ResponseBodyGzip,
	}
	return s.db.Table(tableName).Create(&row).Error
}

func (s *service) ensureTable(tableName string) error {
	s.tableMu.Lock()
	defer s.tableMu.Unlock()
	if _, ok := s.ensuredTables[tableName]; ok {
		return nil
	}
	if !strings.HasPrefix(tableName, tablePrefix) {
		return fmt.Errorf("非法归档表名: %s", tableName)
	}
	createSQL := fmt.Sprintf(`CREATE TABLE IF NOT EXISTS "%s" (
id BIGSERIAL PRIMARY KEY,
session_id TEXT NOT NULL,
request_time TIMESTAMPTZ NOT NULL,
response_time TIMESTAMPTZ NOT NULL,
request_body_gzip BYTEA NOT NULL,
response_body_gzip BYTEA NOT NULL
)`, tableName)
	if err := s.db.Exec(createSQL).Error; err != nil {
		return err
	}
	suffix := strings.TrimPrefix(tableName, tablePrefix)
	if err := s.db.Exec(fmt.Sprintf(`CREATE INDEX IF NOT EXISTS "idx_conv_archive_%s_request_time" ON "%s" (request_time)`, suffix, tableName)).Error; err != nil {
		return err
	}
	if err := s.db.Exec(fmt.Sprintf(`CREATE INDEX IF NOT EXISTS "idx_conv_archive_%s_session_time" ON "%s" (session_id, request_time)`, suffix, tableName)).Error; err != nil {
		return err
	}
	s.ensuredTables[tableName] = struct{}{}
	return nil
}

func tableNameFor(t time.Time) string {
	return tablePrefix + t.Format("20060102")
}

func CompressBytes(data []byte) ([]byte, error) {
	return CompressReader(bytes.NewReader(data))
}

func CompressReader(reader io.Reader) ([]byte, error) {
	var buf bytes.Buffer
	zw, err := gzip.NewWriterLevel(&buf, gzip.BestSpeed)
	if err != nil {
		return nil, err
	}
	if _, err := io.Copy(zw, reader); err != nil {
		_ = zw.Close()
		return nil, err
	}
	if err := zw.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func DecompressBytes(data []byte) ([]byte, error) {
	zr, err := gzip.NewReader(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	defer zr.Close()
	return io.ReadAll(zr)
}

func ResolveSessionID(headerValue string, requestBody []byte, fallback string) string {
	for _, candidate := range []string{
		strings.TrimSpace(headerValue),
		jsonStringValue(requestBody, "metadata.session_id"),
		jsonStringValue(requestBody, "session_id"),
		jsonStringValue(requestBody, "conversation_id"),
		strings.TrimSpace(fallback),
	} {
		if candidate != "" {
			return candidate
		}
	}
	return common.GetUUID()
}

func jsonStringValue(body []byte, path string) string {
	if len(bytes.TrimSpace(body)) == 0 || !gjson.ValidBytes(body) {
		return ""
	}
	value := gjson.GetBytes(body, path)
	if !value.Exists() {
		return ""
	}
	if value.Type == gjson.String {
		return strings.TrimSpace(value.String())
	}
	return ""
}

type ResponseRecorder struct {
	buf    bytes.Buffer
	writer *gzip.Writer
	closed bool
}

func NewResponseRecorder() *ResponseRecorder {
	recorder := &ResponseRecorder{}
	writer, err := gzip.NewWriterLevel(&recorder.buf, gzip.BestSpeed)
	if err != nil {
		writer = gzip.NewWriter(&recorder.buf)
	}
	recorder.writer = writer
	return recorder
}

func (r *ResponseRecorder) Write(data []byte) {
	if r == nil || r.closed || len(data) == 0 {
		return
	}
	_, _ = r.writer.Write(data)
}

func (r *ResponseRecorder) Close() ([]byte, error) {
	if r == nil {
		return nil, nil
	}
	if !r.closed {
		r.closed = true
		if err := r.writer.Close(); err != nil {
			return nil, err
		}
	}
	return r.buf.Bytes(), nil
}

type exportRow struct {
	SessionID    string `json:"session_id"`
	RequestTime  string `json:"request_time"`
	ResponseTime string `json:"response_time"`
	RequestBody  any    `json:"request_body"`
	ResponseBody any    `json:"response_body"`
}

func StartDumpTask() {
	currentMu.RLock()
	svc := current
	currentMu.RUnlock()
	if svc == nil || !svc.cfg.DumpEnabled {
		return
	}
	gopool.Go(func() {
		logger.LogInfo(context.Background(), "会话归档每日导出任务已启动")
		for {
			next := svc.nextDumpTime(time.Now())
			time.Sleep(time.Until(next))
			date := next.AddDate(0, 0, -1)
			if err := svc.DumpDate(date); err != nil {
				logger.LogWarn(context.Background(), fmt.Sprintf("会话归档每日导出失败: %v", err))
			}
		}
	})
}

func DumpDate(date time.Time) error {
	currentMu.RLock()
	svc := current
	currentMu.RUnlock()
	if svc == nil {
		return fmt.Errorf("会话归档未启用")
	}
	return svc.DumpDate(date)
}

func (s *service) nextDumpTime(now time.Time) time.Time {
	loc := s.dumpLocation()
	localNow := now.In(loc)
	next := time.Date(localNow.Year(), localNow.Month(), localNow.Day(), s.cfg.DumpHour, s.cfg.DumpMinute, 0, 0, loc)
	if !next.After(localNow) {
		next = next.AddDate(0, 0, 1)
	}
	return next
}

func (s *service) dumpLocation() *time.Location {
	loc, err := time.LoadLocation(s.cfg.DumpTimezone)
	if err != nil {
		return time.Local
	}
	return loc
}

func (s *service) DumpDate(date time.Time) error {
	if s.cfg.DumpDir == "" {
		return fmt.Errorf("CONVERSATION_ARCHIVE_DUMP_DIR 不能为空")
	}
	loc := s.dumpLocation()
	localDate := date.In(loc)
	tableName := tableNameFor(localDate)
	if !s.db.Migrator().HasTable(tableName) {
		return nil
	}
	if err := os.MkdirAll(s.cfg.DumpDir, 0755); err != nil {
		return err
	}
	fileName := fmt.Sprintf("%s%s.jsonl.gz", tablePrefix, localDate.Format("20060102"))
	finalPath := filepath.Join(s.cfg.DumpDir, fileName)
	tmpPath := finalPath + ".tmp"
	file, err := os.OpenFile(tmpPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return err
	}
	gzipWriter := gzip.NewWriter(file)
	if err := s.writeDumpRows(gzipWriter, tableName, loc); err != nil {
		_ = gzipWriter.Close()
		_ = file.Close()
		return err
	}
	if err := gzipWriter.Close(); err != nil {
		_ = file.Close()
		return err
	}
	if err := file.Close(); err != nil {
		return err
	}
	return os.Rename(tmpPath, finalPath)
}

func (s *service) writeDumpRows(writer io.Writer, tableName string, loc *time.Location) error {
	var lastID uint64
	for {
		var rows []archiveRow
		err := s.db.Table(tableName).
			Where("id > ?", lastID).
			Order("id ASC").
			Limit(defaultDumpBatchSize).
			Find(&rows).Error
		if err != nil {
			return err
		}
		if len(rows) == 0 {
			return nil
		}
		for _, row := range rows {
			requestBody, err := DecompressBytes(row.RequestBodyGzip)
			if err != nil {
				return err
			}
			responseBody, err := DecompressBytes(row.ResponseBodyGzip)
			if err != nil {
				return err
			}
			export := exportRow{
				SessionID:    row.SessionID,
				RequestTime:  row.RequestTime.In(loc).Format(time.RFC3339Nano),
				ResponseTime: row.ResponseTime.In(loc).Format(time.RFC3339Nano),
				RequestBody:  bodyForExport(requestBody),
				ResponseBody: bodyForExport(responseBody),
			}
			line, err := common.Marshal(export)
			if err != nil {
				return err
			}
			if _, err := writer.Write(line); err != nil {
				return err
			}
			if _, err := writer.Write([]byte("\n")); err != nil {
				return err
			}
			lastID = row.ID
		}
	}
}

func bodyForExport(body []byte) any {
	trimmed := bytes.TrimSpace(body)
	if len(trimmed) == 0 {
		return ""
	}
	if gjson.ValidBytes(trimmed) {
		return json.RawMessage(trimmed)
	}
	return string(body)
}
