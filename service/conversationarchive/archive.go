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
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/tidwall/gjson"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

const (
	defaultSessionHeader   = "X-Session-Id"
	defaultDumpBatchSize   = 1000
	defaultDrainTimeout    = 600
	defaultDumpMinute      = 10
	tablePrefix            = "conversation_archive_"
	abnormalTablePrefix    = "conversation_archive_abnormal_"
	defaultSpoolMaxMB      = 8192
	defaultCompressWorkers = 2
	defaultJobPollMs       = 500
	defaultJobAttempts     = 3
)

type ArchiveKind string

const (
	ArchiveKindNormal   ArchiveKind = "normal"
	ArchiveKindAbnormal ArchiveKind = "abnormal"
)

type Config struct {
	Enabled          bool
	DSN              string
	SessionHeader    string
	DumpEnabled      bool
	DumpDir          string
	DumpTimezone     string
	DumpHour         int
	DumpMinute       int
	DumpDrainSeconds int
	R2Enabled        bool
	R2Endpoint       string
	R2Bucket         string
	R2AccessKeyID    string
	R2SecretKey      string
	R2Region         string
	R2Prefix         string
	SpoolDir         string
	SpoolMaxBytesMB  int
	CompressWorkers  int
	JobPollMs        int
	JobMaxAttempts   int
}

type Record struct {
	Kind               ArchiveKind
	SessionID          string
	RequestID          string
	RequestTime        time.Time
	ResponseTime       time.Time
	RequestHeadersGzip []byte
	RequestBodyGzip    []byte
	ResponseBodyGzip   []byte
}

type archiveRow struct {
	ID                 uint64
	SessionID          string
	RequestID          string
	RequestTime        time.Time
	ResponseTime       time.Time
	RequestHeadersGzip []byte
	RequestBodyGzip    []byte
	ResponseBodyGzip   []byte
}

func (k ArchiveKind) normalized() ArchiveKind {
	if k == ArchiveKindAbnormal {
		return ArchiveKindAbnormal
	}
	return ArchiveKindNormal
}

type service struct {
	cfg           Config
	db            *gorm.DB
	writtenCount  atomic.Int64
	ensuredTables map[string]struct{}
	tableMu       sync.Mutex
	spoolMaxBytes int64
	spoolBytes    atomic.Int64
	jobTableOnce  sync.Once
	jobTableErr   error
}

var (
	current   *service
	currentMu sync.RWMutex
)

func InitFromEnv() error {
	cfg := Config{
		Enabled:          common.GetEnvOrDefaultBool("CONVERSATION_ARCHIVE_ENABLED", false),
		DSN:              strings.TrimSpace(os.Getenv("CONVERSATION_ARCHIVE_DSN")),
		SessionHeader:    common.GetEnvOrDefaultString("CONVERSATION_ARCHIVE_SESSION_HEADER", defaultSessionHeader),
		DumpEnabled:      common.GetEnvOrDefaultBool("CONVERSATION_ARCHIVE_DUMP_ENABLED", false),
		DumpDir:          common.GetEnvOrDefaultString("CONVERSATION_ARCHIVE_DUMP_DIR", ""),
		DumpTimezone:     common.GetEnvOrDefaultString("CONVERSATION_ARCHIVE_TIMEZONE", "Asia/Shanghai"),
		DumpHour:         common.GetEnvOrDefault("CONVERSATION_ARCHIVE_DUMP_HOUR", 0),
		DumpMinute:       common.GetEnvOrDefault("CONVERSATION_ARCHIVE_DUMP_MINUTE", defaultDumpMinute),
		DumpDrainSeconds: common.GetEnvOrDefault("CONVERSATION_ARCHIVE_DUMP_DRAIN_TIMEOUT_SECONDS", defaultDrainTimeout),
		R2Enabled:        common.GetEnvOrDefaultBool("CONVERSATION_ARCHIVE_R2_ENABLED", false),
		R2Endpoint:       strings.TrimSpace(os.Getenv("CONVERSATION_ARCHIVE_R2_ENDPOINT")),
		R2Bucket:         strings.TrimSpace(os.Getenv("CONVERSATION_ARCHIVE_R2_BUCKET")),
		R2AccessKeyID:    strings.TrimSpace(os.Getenv("CONVERSATION_ARCHIVE_R2_ACCESS_KEY_ID")),
		R2SecretKey:      strings.TrimSpace(os.Getenv("CONVERSATION_ARCHIVE_R2_SECRET_ACCESS_KEY")),
		R2Region:         common.GetEnvOrDefaultString("CONVERSATION_ARCHIVE_R2_REGION", "auto"),
		R2Prefix:         common.GetEnvOrDefaultString("CONVERSATION_ARCHIVE_R2_PREFIX", "newapi-conversation-archive"),
		SpoolDir:         common.GetEnvOrDefaultString("CONVERSATION_ARCHIVE_SPOOL_DIR", ""),
		SpoolMaxBytesMB:  common.GetEnvOrDefault("CONVERSATION_ARCHIVE_SPOOL_MAX_BYTES_MB", defaultSpoolMaxMB),
		CompressWorkers:  common.GetEnvOrDefault("CONVERSATION_ARCHIVE_COMPRESS_WORKERS", 0),
		JobPollMs:        common.GetEnvOrDefault("CONVERSATION_ARCHIVE_JOB_POLL_MS", defaultJobPollMs),
		JobMaxAttempts:   common.GetEnvOrDefault("CONVERSATION_ARCHIVE_JOB_MAX_ATTEMPTS", defaultJobAttempts),
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
	if cfg.SpoolMaxBytesMB <= 0 {
		cfg.SpoolMaxBytesMB = defaultSpoolMaxMB
	}
	if cfg.CompressWorkers <= 0 {
		cfg.CompressWorkers = defaultCompressWorkers
	}
	if cfg.JobPollMs <= 0 {
		cfg.JobPollMs = defaultJobPollMs
	}
	if cfg.JobMaxAttempts <= 0 {
		cfg.JobMaxAttempts = defaultJobAttempts
	}
	if cfg.DumpMinute < 0 || cfg.DumpMinute > 59 {
		cfg.DumpMinute = defaultDumpMinute
	}
	if cfg.DumpHour < 0 || cfg.DumpHour > 23 {
		cfg.DumpHour = 0
	}
	if cfg.DumpDrainSeconds <= 0 {
		cfg.DumpDrainSeconds = defaultDrainTimeout
	}
	if cfg.R2Region == "" {
		cfg.R2Region = "auto"
	}
	if cfg.SpoolDir == "" {
		if cfg.DumpDir != "" {
			cfg.SpoolDir = filepath.Join(filepath.Dir(cfg.DumpDir), "conversation-archive-spool")
		} else {
			cfg.SpoolDir = filepath.Join(os.TempDir(), "new-api-conversation-archive-spool")
		}
	}
	cfg.R2Prefix = strings.Trim(strings.TrimSpace(cfg.R2Prefix), "/")
	if cfg.R2Enabled {
		if cfg.R2Endpoint == "" || cfg.R2Bucket == "" || cfg.R2AccessKeyID == "" || cfg.R2SecretKey == "" {
			return fmt.Errorf("启用会话归档 R2 上传时，endpoint、bucket、access key 与 secret key 均不能为空")
		}
	}

	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  cfg.DSN,
		PreferSimpleProtocol: true,
	}), &gorm.Config{PrepareStmt: true, SkipDefaultTransaction: true})
	if err != nil {
		return err
	}

	svc := &service{
		cfg:           cfg,
		db:            db,
		spoolMaxBytes: int64(cfg.SpoolMaxBytesMB) * 1024 * 1024,
		ensuredTables: map[string]struct{}{},
	}
	if err := os.MkdirAll(cfg.SpoolDir, 0755); err != nil {
		return fmt.Errorf("创建会话归档 spool 目录失败: %w", err)
	}
	svc.spoolBytes.Store(svc.scanSpoolBytes())
	if err := svc.ensureJobTable(); err != nil {
		return err
	}
	if err := svc.resetProcessingJobs(); err != nil {
		return err
	}
	setCurrent(svc)
	for i := 0; i < cfg.CompressWorkers; i++ {
		gopool.Go(svc.compressWorker)
	}
	logger.LogInfo(context.Background(), "会话归档异步压缩已启用")
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

func (s *service) insertBatch(records []Record) error {
	return s.insertBatchWithDB(s.db, records)
}

func (s *service) insertBatchWithDB(db *gorm.DB, records []Record) error {
	recordsByTable := map[string][]Record{}
	for _, record := range records {
		tableName := tableNameForRecord(record)
		recordsByTable[tableName] = append(recordsByTable[tableName], record)
	}
	for tableName, tableRecords := range recordsByTable {
		if err := s.ensureTable(tableName); err != nil {
			return err
		}
		rows := make([]archiveRow, 0, len(tableRecords))
		for _, record := range tableRecords {
			rows = append(rows, archiveRow{
				SessionID:          record.SessionID,
				RequestID:          record.RequestID,
				RequestTime:        record.RequestTime,
				ResponseTime:       record.ResponseTime,
				RequestHeadersGzip: record.RequestHeadersGzip,
				RequestBodyGzip:    record.RequestBodyGzip,
				ResponseBodyGzip:   record.ResponseBodyGzip,
			})
		}
		if err := db.Table(tableName).CreateInBatches(&rows, len(rows)).Error; err != nil {
			return err
		}
	}
	return nil
}

func (s *service) ensureTable(tableName string) error {
	s.tableMu.Lock()
	defer s.tableMu.Unlock()
	if _, ok := s.ensuredTables[tableName]; ok {
		return nil
	}
	if !validArchiveTableName(tableName) {
		return fmt.Errorf("非法归档表名: %s", tableName)
	}
	createSQL := fmt.Sprintf(`CREATE TABLE IF NOT EXISTS "%s" (
id BIGSERIAL PRIMARY KEY,
session_id TEXT NOT NULL,
request_id TEXT NOT NULL DEFAULT '',
request_time TIMESTAMPTZ NOT NULL,
response_time TIMESTAMPTZ NOT NULL,
request_headers_gzip BYTEA NOT NULL DEFAULT decode('', 'hex'),
request_body_gzip BYTEA NOT NULL,
response_body_gzip BYTEA NOT NULL
)`, tableName)
	if err := s.db.Exec(createSQL).Error; err != nil {
		return err
	}
	if err := s.db.Exec(fmt.Sprintf(`ALTER TABLE "%s" ADD COLUMN IF NOT EXISTS request_id TEXT NOT NULL DEFAULT ''`, tableName)).Error; err != nil {
		return err
	}
	if err := s.db.Exec(fmt.Sprintf(`ALTER TABLE "%s" ADD COLUMN IF NOT EXISTS request_headers_gzip BYTEA NOT NULL DEFAULT decode('', 'hex')`, tableName)).Error; err != nil {
		return err
	}
	suffix := archiveIndexSuffix(tableName)
	if err := s.db.Exec(fmt.Sprintf(`CREATE INDEX IF NOT EXISTS "idx_conv_archive_%s_request_id" ON "%s" (request_id)`, suffix, tableName)).Error; err != nil {
		return err
	}
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
	return tableNameForKind(t, ArchiveKindNormal)
}

func tableNameForKind(t time.Time, kind ArchiveKind) string {
	prefix := tablePrefix
	if kind.normalized() == ArchiveKindAbnormal {
		prefix = abnormalTablePrefix
	}
	return prefix + t.Format("20060102")
}

func tableNameForRecord(record Record) string {
	kind := record.Kind.normalized()
	if !record.ResponseTime.IsZero() {
		return tableNameForKind(record.ResponseTime, kind)
	}
	return tableNameForKind(record.RequestTime, kind)
}

func validArchiveTableName(tableName string) bool {
	suffix := archiveTableSuffix(tableName)
	if suffix == "" {
		return false
	}
	if len(suffix) != len("20060102") {
		return false
	}
	for _, ch := range suffix {
		if ch < '0' || ch > '9' {
			return false
		}
	}
	return true
}

func archiveTableSuffix(tableName string) string {
	if strings.HasPrefix(tableName, abnormalTablePrefix) {
		return strings.TrimPrefix(tableName, abnormalTablePrefix)
	}
	if strings.HasPrefix(tableName, tablePrefix) {
		return strings.TrimPrefix(tableName, tablePrefix)
	}
	return ""
}

func archiveIndexSuffix(tableName string) string {
	if strings.HasPrefix(tableName, abnormalTablePrefix) {
		return "abnormal_" + strings.TrimPrefix(tableName, abnormalTablePrefix)
	}
	return strings.TrimPrefix(tableName, tablePrefix)
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

func DecompressOptionalBytes(data []byte) ([]byte, error) {
	if len(data) == 0 {
		return []byte{}, nil
	}
	return DecompressBytes(data)
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

type exportRow struct {
	SessionID      string `json:"session_id"`
	RequestID      string `json:"request_id,omitempty"`
	RequestTime    string `json:"request_time"`
	ResponseTime   string `json:"response_time"`
	RequestHeaders any    `json:"request_headers"`
	RequestBody    any    `json:"request_body"`
	ResponseBody   any    `json:"response_body"`
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
			if !operation_setting.IsConversationArchiveDumpEnabled() {
				continue
			}
			date := next.AddDate(0, 0, -1)
			if err := svc.DumpDate(date); err != nil {
				logger.LogWarn(context.Background(), fmt.Sprintf("会话归档每日导出失败: %v", err))
			}
			if err := svc.DropExpiredTables(next); err != nil {
				logger.LogWarn(context.Background(), fmt.Sprintf("会话归档过期表清理失败: %v", err))
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
	if err := s.waitPendingJobsDrained(tableName); err != nil {
		return err
	}
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
	if err := os.Rename(tmpPath, finalPath); err != nil {
		return err
	}
	if s.shouldUploadDumpToR2() {
		key := s.r2ObjectKey(localDate, fileName)
		if err := s.uploadDumpToR2(context.Background(), finalPath, key); err != nil {
			return err
		}
		if operation_setting.ShouldDeleteConversationArchiveLocalDumpAfterUpload() {
			if err := os.Remove(finalPath); err != nil {
				logger.LogWarn(context.Background(), fmt.Sprintf("删除上传成功的本地会话归档文件失败: %v", err))
			} else {
				logger.LogInfo(context.Background(), fmt.Sprintf("已删除上传成功的本地会话归档文件: %s", finalPath))
			}
		}
	}
	return nil
}

func (s *service) shouldUploadDumpToR2() bool {
	return s.cfg.R2Enabled && operation_setting.IsConversationArchiveR2Enabled()
}

func DropExpiredTables(now time.Time) error {
	currentMu.RLock()
	svc := current
	currentMu.RUnlock()
	if svc == nil {
		return fmt.Errorf("会话归档未启用")
	}
	return svc.DropExpiredTables(now)
}

func (s *service) DropExpiredTables(now time.Time) error {
	retentionDays := operation_setting.ConversationArchiveRetentionDays()
	if retentionDays <= 0 {
		return nil
	}
	loc := s.dumpLocation()
	localNow := now.In(loc)
	cutoff := time.Date(localNow.Year(), localNow.Month(), localNow.Day(), 0, 0, 0, 0, loc).AddDate(0, 0, -retentionDays)
	tables, err := s.listArchiveTables()
	if err != nil {
		return err
	}
	for _, tableName := range tables {
		tableDate, ok := archiveTableDate(tableName, loc)
		if !ok || !tableDate.Before(cutoff) {
			continue
		}
		if err := s.dropArchiveTable(tableName); err != nil {
			return err
		}
	}
	return nil
}

func (s *service) listArchiveTables() ([]string, error) {
	type tableNameRow struct {
		TableName string `gorm:"column:table_name"`
	}
	var rows []tableNameRow
	err := s.db.Raw(
		`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE ? ORDER BY table_name`,
		"conversation_archive%",
	).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	validTables := make([]string, 0, len(rows))
	for _, row := range rows {
		if validArchiveTableName(row.TableName) {
			validTables = append(validTables, row.TableName)
		}
	}
	return validTables, nil
}

func archiveTableDate(tableName string, loc *time.Location) (time.Time, bool) {
	if !validArchiveTableName(tableName) {
		return time.Time{}, false
	}
	datePart := tableName[len(tableName)-8:]
	parsed, err := time.ParseInLocation("20060102", datePart, loc)
	if err != nil {
		return time.Time{}, false
	}
	return parsed, true
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
			requestHeaders, err := DecompressOptionalBytes(row.RequestHeadersGzip)
			if err != nil {
				return err
			}
			requestBody, err := DecompressBytes(row.RequestBodyGzip)
			if err != nil {
				return err
			}
			responseBody, err := DecompressBytes(row.ResponseBodyGzip)
			if err != nil {
				return err
			}
			export := exportRow{
				SessionID:      row.SessionID,
				RequestID:      row.RequestID,
				RequestTime:    row.RequestTime.In(loc).Format(time.RFC3339Nano),
				ResponseTime:   row.ResponseTime.In(loc).Format(time.RFC3339Nano),
				RequestHeaders: headersForExport(requestHeaders),
				RequestBody:    bodyForExport(requestBody),
				ResponseBody:   bodyForExport(responseBody),
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

func headersForExport(headers []byte) any {
	trimmed := bytes.TrimSpace(headers)
	if len(trimmed) == 0 {
		return map[string][]string{}
	}
	return bodyForExport(trimmed)
}

type Detail struct {
	ArchiveKind    ArchiveKind `json:"archive_kind"`
	SessionID      string      `json:"session_id"`
	RequestID      string      `json:"request_id"`
	RequestTime    string      `json:"request_time"`
	ResponseTime   string      `json:"response_time"`
	RequestHeaders any         `json:"request_headers,omitempty"`
	RequestBody    any         `json:"request_body,omitempty"`
	ResponseBody   any         `json:"response_body,omitempty"`
}

type DetailPart string

const (
	DetailPartAll            DetailPart = "all"
	DetailPartRequestHeaders DetailPart = "request_headers"
	DetailPartRequestBody    DetailPart = "request_body"
	DetailPartResponseBody   DetailPart = "response_body"
)

func ParseDetailPart(value string) (DetailPart, error) {
	switch strings.TrimSpace(value) {
	case "", string(DetailPartAll):
		return DetailPartAll, nil
	case string(DetailPartRequestHeaders):
		return DetailPartRequestHeaders, nil
	case string(DetailPartRequestBody):
		return DetailPartRequestBody, nil
	case string(DetailPartResponseBody):
		return DetailPartResponseBody, nil
	default:
		return "", fmt.Errorf("无效的归档详情 part 参数")
	}
}

func (part DetailPart) normalized() DetailPart {
	switch part {
	case DetailPartRequestHeaders, DetailPartRequestBody, DetailPartResponseBody:
		return part
	default:
		return DetailPartAll
	}
}

func GetDetailByRequestID(requestID string, createdAt int64) (*Detail, error) {
	return GetDetailByRequestIDWithPart(requestID, createdAt, DetailPartAll)
}

func GetDetailByRequestIDWithPart(requestID string, createdAt int64, part DetailPart) (*Detail, error) {
	currentMu.RLock()
	svc := current
	currentMu.RUnlock()
	if svc == nil {
		return nil, fmt.Errorf("会话归档未启用")
	}
	return svc.getDetailByRequestID(requestID, createdAt, part)
}

func (s *service) getDetailByRequestID(requestID string, createdAt int64, part DetailPart) (*Detail, error) {
	requestID = strings.TrimSpace(requestID)
	if requestID == "" {
		return nil, fmt.Errorf("日志缺少 request_id，无法定位归档")
	}
	part = part.normalized()
	for _, lookup := range archiveLookupTables(createdAt) {
		tableName := lookup.tableName
		if !s.db.Migrator().HasTable(tableName) {
			continue
		}
		var row archiveRow
		err := s.db.Table(tableName).
			Select(detailSelectColumns(part)).
			Where("request_id = ?", requestID).
			Order("response_time DESC, id DESC").
			Limit(1).
			First(&row).Error
		if err == nil {
			return archiveDetailFromRow(row, lookup.kind, part)
		}
		if err != gorm.ErrRecordNotFound {
			return nil, err
		}
	}
	return nil, fmt.Errorf("未找到该日志对应的会话归档")
}

func detailSelectColumns(part DetailPart) []string {
	columns := []string{"id", "session_id", "request_id", "request_time", "response_time"}
	switch part.normalized() {
	case DetailPartRequestHeaders:
		return append(columns, "request_headers_gzip")
	case DetailPartRequestBody:
		return append(columns, "request_body_gzip")
	case DetailPartResponseBody:
		return append(columns, "response_body_gzip")
	default:
		return append(columns, "request_headers_gzip", "request_body_gzip", "response_body_gzip")
	}
}

type archiveLookupTable struct {
	tableName string
	kind      ArchiveKind
}

func archiveLookupTables(createdAt int64) []archiveLookupTable {
	base := time.Now()
	if createdAt > 0 {
		base = time.Unix(createdAt, 0)
	}
	tables := make([]archiveLookupTable, 0, 6)
	seen := map[string]struct{}{}
	for _, offset := range []int{0, -1, 1} {
		date := base.AddDate(0, 0, offset)
		for _, kind := range []ArchiveKind{ArchiveKindNormal, ArchiveKindAbnormal} {
			tableName := tableNameForKind(date, kind)
			if _, ok := seen[tableName]; ok {
				continue
			}
			seen[tableName] = struct{}{}
			tables = append(tables, archiveLookupTable{
				tableName: tableName,
				kind:      kind,
			})
		}
	}
	return tables
}

func archiveDetailFromRow(row archiveRow, kind ArchiveKind, part DetailPart) (*Detail, error) {
	detail := &Detail{
		ArchiveKind:  kind.normalized(),
		SessionID:    row.SessionID,
		RequestID:    row.RequestID,
		RequestTime:  row.RequestTime.Format(time.RFC3339Nano),
		ResponseTime: row.ResponseTime.Format(time.RFC3339Nano),
	}
	part = part.normalized()
	if part == DetailPartAll || part == DetailPartRequestHeaders {
		requestHeaders, err := DecompressOptionalBytes(row.RequestHeadersGzip)
		if err != nil {
			return nil, err
		}
		detail.RequestHeaders = headersForExport(requestHeaders)
	}
	if part == DetailPartAll || part == DetailPartRequestBody {
		requestBody, err := DecompressBytes(row.RequestBodyGzip)
		if err != nil {
			return nil, err
		}
		detail.RequestBody = bodyForExport(requestBody)
	}
	if part == DetailPartAll || part == DetailPartResponseBody {
		responseBody, err := DecompressBytes(row.ResponseBodyGzip)
		if err != nil {
			return nil, err
		}
		detail.ResponseBody = bodyForExport(responseBody)
	}
	return detail, nil
}
