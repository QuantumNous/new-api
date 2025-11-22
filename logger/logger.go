package logger

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

const (
	// 日志轮转配置
	defaultMaxLogSize   = 100 * 1024 * 1024 // 100MB
	defaultMaxLogFiles  = 7                 // 保留最近7个日志文件
	defaultLogFileName  = "newapi.log"
	checkRotateInterval = 1000 // 每1000次写入检查一次是否需要轮转
)

var (
	logMutex        sync.RWMutex
	rotateCheckLock sync.Mutex
	defaultLogger   *slog.Logger
	logFile         *os.File
	logFilePath     string
	logDirPath      string
	writeCount      int64
	maxLogSize      int64 = defaultMaxLogSize
	maxLogFiles     int   = defaultMaxLogFiles
	useJSONFormat   bool
)

func init() {
	// Initialize with a text handler to stdout
	handler := createHandler(os.Stdout)
	defaultLogger = slog.New(handler)
	slog.SetDefault(defaultLogger)
}

// SetupLogger 初始化日志系统
func SetupLogger() {
	logMutex.Lock()
	defer logMutex.Unlock()

	// 读取环境变量配置
	if maxSize := os.Getenv("LOG_MAX_SIZE_MB"); maxSize != "" {
		if size, err := fmt.Sscanf(maxSize, "%d", &maxLogSize); err == nil && size > 0 {
			maxLogSize = maxLogSize * 1024 * 1024 // 转换为字节
		}
	}
	if maxFiles := os.Getenv("LOG_MAX_FILES"); maxFiles != "" {
		fmt.Sscanf(maxFiles, "%d", &maxLogFiles)
	}
	if os.Getenv("LOG_FORMAT") == "json" {
		useJSONFormat = true
	}

	if *common.LogDir == "" {
		// 如果没有配置日志目录，只输出到标准输出
		handler := createHandler(os.Stdout)
		defaultLogger = slog.New(handler)
		slog.SetDefault(defaultLogger)
		return
	}

	logDirPath = *common.LogDir
	logFilePath = filepath.Join(logDirPath, defaultLogFileName)

	// 检查日志文件是否需要按日期轮转（仅在启动时检查）
	if err := checkAndRotateOnStartup(); err != nil {
		slog.Error("failed to check log file on startup", "error", err)
	}

	// 打开或创建日志文件
	if err := openLogFile(); err != nil {
		slog.Error("failed to open log file", "error", err)
		return
	}

	// 创建多路输出（控制台 + 文件）
	multiWriter := io.MultiWriter(os.Stdout, logFile)

	// 更新 gin 的默认输出
	gin.DefaultWriter = multiWriter
	gin.DefaultErrorWriter = multiWriter

	// 更新 slog handler
	handler := createHandler(multiWriter)
	defaultLogger = slog.New(handler)
	slog.SetDefault(defaultLogger)

	slog.Info("logger initialized",
		"log_dir", logDirPath,
		"max_size_mb", maxLogSize/(1024*1024),
		"max_files", maxLogFiles,
		"format", getLogFormat())
}

// createHandler 创建日志处理器
func createHandler(w io.Writer) slog.Handler {
	if useJSONFormat {
		opts := &slog.HandlerOptions{
			Level: getLogLevel(),
		}
		return slog.NewJSONHandler(w, opts)
	}
	return NewReadableTextHandler(w, getLogLevel())
}

// ReadableTextHandler 自定义的易读文本处理器
type ReadableTextHandler struct {
	w     io.Writer
	level slog.Level
	mu    sync.Mutex
}

// NewReadableTextHandler 创建一个新的易读文本处理器
func NewReadableTextHandler(w io.Writer, level slog.Level) *ReadableTextHandler {
	return &ReadableTextHandler{
		w:     w,
		level: level,
	}
}

// Enabled 检查是否启用该级别
func (h *ReadableTextHandler) Enabled(_ context.Context, level slog.Level) bool {
	return level >= h.level
}

// Handle 处理日志记录
func (h *ReadableTextHandler) Handle(_ context.Context, r slog.Record) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	// 格式: [LEVEL] YYYY/MM/DD - HH:mm:ss | request_id | message | key=value ...
	buf := make([]byte, 0, 256)

	// 日志级别
	level := r.Level.String()
	switch r.Level {
	case slog.LevelDebug:
		level = "DEBUG"
	case slog.LevelInfo:
		level = "INFO"
	case slog.LevelWarn:
		level = "WARN"
	case slog.LevelError:
		level = "ERROR"
	}
	buf = append(buf, '[')
	buf = append(buf, level...)
	buf = append(buf, "] "...)

	// 时间
	buf = append(buf, r.Time.Format("2006/01/02 - 15:04:05")...)
	buf = append(buf, " | "...)

	// 提取 request_id 和 component
	var requestID, component string
	otherAttrs := make([]slog.Attr, 0)

	r.Attrs(func(a slog.Attr) bool {
		switch a.Key {
		case "request_id":
			requestID = a.Value.String()
		case "component":
			component = a.Value.String()
		default:
			otherAttrs = append(otherAttrs, a)
		}
		return true
	})

	// 输出 request_id 或 component
	if requestID != "" {
		buf = append(buf, requestID...)
		buf = append(buf, " | "...)
	} else if component != "" {
		buf = append(buf, component...)
		buf = append(buf, " | "...)
	}

	// 消息
	buf = append(buf, r.Message...)

	// 其他属性
	if len(otherAttrs) > 0 {
		buf = append(buf, " | "...)
		for i, a := range otherAttrs {
			if i > 0 {
				buf = append(buf, ", "...)
			}
			buf = append(buf, a.Key...)
			buf = append(buf, '=')
			buf = appendValue(buf, a.Value)
		}
	}

	buf = append(buf, '\n')
	_, err := h.w.Write(buf)
	return err
}

// appendValue 追加值到缓冲区
func appendValue(buf []byte, v slog.Value) []byte {
	switch v.Kind() {
	case slog.KindString:
		s := v.String()
		// 如果字符串包含空格或特殊字符，加引号
		if strings.ContainsAny(s, " \t\n\r,=") {
			buf = append(buf, '"')
			buf = append(buf, s...)
			buf = append(buf, '"')
		} else {
			buf = append(buf, s...)
		}
	case slog.KindInt64:
		buf = append(buf, fmt.Sprintf("%d", v.Int64())...)
	case slog.KindUint64:
		buf = append(buf, fmt.Sprintf("%d", v.Uint64())...)
	case slog.KindFloat64:
		buf = append(buf, fmt.Sprintf("%g", v.Float64())...)
	case slog.KindBool:
		buf = append(buf, fmt.Sprintf("%t", v.Bool())...)
	case slog.KindDuration:
		buf = append(buf, v.Duration().String()...)
	case slog.KindTime:
		buf = append(buf, v.Time().Format("2006-01-02 15:04:05")...)
	default:
		buf = append(buf, fmt.Sprintf("%v", v.Any())...)
	}
	return buf
}

// WithAttrs 返回一个新的处理器，包含指定的属性
func (h *ReadableTextHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	// 简化实现：不支持 With
	return h
}

// WithGroup 返回一个新的处理器，使用指定的组
func (h *ReadableTextHandler) WithGroup(name string) slog.Handler {
	// 简化实现：不支持组
	return h
}

// checkAndRotateOnStartup 启动时检查日志文件是否需要按日期轮转
func checkAndRotateOnStartup() error {
	// 检查日志文件是否存在
	fileInfo, err := os.Stat(logFilePath)
	if err != nil {
		if os.IsNotExist(err) {
			// 文件不存在，不需要轮转
			return nil
		}
		return fmt.Errorf("failed to stat log file: %w", err)
	}

	// 获取文件的修改时间
	modTime := fileInfo.ModTime()
	modDate := modTime.Format("2006-01-02")
	today := time.Now().Format("2006-01-02")

	// 如果文件的日期和今天不同，进行轮转
	if modDate != today {
		// 生成归档文件名（使用文件的修改日期）
		timestamp := modTime.Format("2006-01-02-150405")
		archivePath := filepath.Join(logDirPath, fmt.Sprintf("newapi.%s.log", timestamp))

		// 重命名日志文件
		if err := os.Rename(logFilePath, archivePath); err != nil {
			return fmt.Errorf("failed to archive old log file: %w", err)
		}

		slog.Info("rotated old log file on startup",
			"archive", archivePath,
			"reason", "date changed")

		// 清理旧的日志文件
		gopool.Go(func() {
			cleanOldLogFiles()
		})
	}

	return nil
}

// openLogFile 打开日志文件
func openLogFile() error {
	// 关闭旧的日志文件
	if logFile != nil {
		logFile.Close()
	}

	// 打开新的日志文件
	fd, err := os.OpenFile(logFilePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("failed to open log file: %w", err)
	}

	logFile = fd
	writeCount = 0
	return nil
}

// rotateLogFile 轮转日志文件
func rotateLogFile() error {
	if logFile == nil {
		return nil
	}

	rotateCheckLock.Lock()
	defer rotateCheckLock.Unlock()

	// 获取当前日志文件信息
	fileInfo, err := logFile.Stat()
	if err != nil {
		return fmt.Errorf("failed to stat log file: %w", err)
	}

	// 检查文件大小是否需要轮转
	if fileInfo.Size() < maxLogSize {
		return nil
	}

	// 关闭当前日志文件
	logFile.Close()

	// 生成归档文件名
	timestamp := time.Now().Format("2006-01-02-150405")
	archivePath := filepath.Join(logDirPath, fmt.Sprintf("newapi.%s.log", timestamp))

	// 重命名当前日志文件为归档文件
	if err := os.Rename(logFilePath, archivePath); err != nil {
		// 如果重命名失败，尝试复制
		if copyErr := copyFile(logFilePath, archivePath); copyErr != nil {
			return fmt.Errorf("failed to archive log file: %w", err)
		}
		os.Truncate(logFilePath, 0)
	}

	// 清理旧的日志文件
	gopool.Go(func() {
		cleanOldLogFiles()
	})

	// 打开新的日志文件
	if err := openLogFile(); err != nil {
		return err
	}

	// 重新设置日志输出
	multiWriter := io.MultiWriter(os.Stdout, logFile)
	gin.DefaultWriter = multiWriter
	gin.DefaultErrorWriter = multiWriter

	handler := createHandler(multiWriter)
	logMutex.Lock()
	defaultLogger = slog.New(handler)
	slog.SetDefault(defaultLogger)
	logMutex.Unlock()

	slog.Info("log file rotated",
		"reason", "size limit reached",
		"archive", archivePath)

	return nil
}

// cleanOldLogFiles 清理旧的日志文件
func cleanOldLogFiles() {
	if logDirPath == "" {
		return
	}

	files, err := os.ReadDir(logDirPath)
	if err != nil {
		slog.Error("failed to read log directory", "error", err)
		return
	}

	// 收集所有归档日志文件
	var logFiles []os.DirEntry
	for _, file := range files {
		if !file.IsDir() && strings.HasPrefix(file.Name(), "newapi.") &&
			strings.HasSuffix(file.Name(), ".log") &&
			file.Name() != defaultLogFileName {
			logFiles = append(logFiles, file)
		}
	}

	// 如果归档文件数量超过限制，删除最旧的
	if len(logFiles) > maxLogFiles {
		// 按名称排序（文件名包含时间戳）
		sort.Slice(logFiles, func(i, j int) bool {
			return logFiles[i].Name() < logFiles[j].Name()
		})

		// 删除最旧的文件
		deleteCount := len(logFiles) - maxLogFiles
		for i := 0; i < deleteCount; i++ {
			filePath := filepath.Join(logDirPath, logFiles[i].Name())
			if err := os.Remove(filePath); err != nil {
				slog.Error("failed to remove old log file",
					"file", filePath,
					"error", err)
			} else {
				slog.Info("removed old log file", "file", logFiles[i].Name())
			}
		}
	}
}

// copyFile 复制文件
func copyFile(src, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	destFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destFile.Close()

	_, err = io.Copy(destFile, sourceFile)
	return err
}

// getLogLevel 获取日志级别
func getLogLevel() slog.Level {
	// 支持环境变量配置
	if level := os.Getenv("LOG_LEVEL"); level != "" {
		switch strings.ToUpper(level) {
		case "DEBUG":
			return slog.LevelDebug
		case "INFO":
			return slog.LevelInfo
		case "WARN", "WARNING":
			return slog.LevelWarn
		case "ERROR":
			return slog.LevelError
		}
	}

	if common.DebugEnabled {
		return slog.LevelDebug
	}
	return slog.LevelInfo
}

// getLogFormat 获取日志格式
func getLogFormat() string {
	if useJSONFormat {
		return "json"
	}
	return "text"
}

// checkAndRotateLog 检查并轮转日志
func checkAndRotateLog() {
	if logFile == nil {
		return
	}

	writeCount++
	if writeCount%checkRotateInterval == 0 {
		gopool.Go(func() {
			if err := rotateLogFile(); err != nil {
				slog.Error("failed to rotate log file", "error", err)
			}
		})
	}
}

// LogInfo 记录信息级别日志
func LogInfo(ctx context.Context, msg string) {
	if ctx == nil {
		ctx = context.Background()
	}
	id := getRequestID(ctx)
	logMutex.RLock()
	logger := defaultLogger
	logMutex.RUnlock()
	logger.InfoContext(ctx, msg, "request_id", id)
	checkAndRotateLog()
}

// LogWarn 记录警告级别日志
func LogWarn(ctx context.Context, msg string) {
	if ctx == nil {
		ctx = context.Background()
	}
	id := getRequestID(ctx)
	logMutex.RLock()
	logger := defaultLogger
	logMutex.RUnlock()
	logger.WarnContext(ctx, msg, "request_id", id)
	checkAndRotateLog()
}

// LogError 记录错误级别日志
func LogError(ctx context.Context, msg string) {
	if ctx == nil {
		ctx = context.Background()
	}
	id := getRequestID(ctx)
	logMutex.RLock()
	logger := defaultLogger
	logMutex.RUnlock()
	logger.ErrorContext(ctx, msg, "request_id", id)
	checkAndRotateLog()
}

// LogSystemInfo 记录系统信息
func LogSystemInfo(msg string) {
	logMutex.RLock()
	logger := defaultLogger
	logMutex.RUnlock()
	logger.Info(msg, "request_id", "SYSTEM")
	checkAndRotateLog()
}

// LogSystemError 记录系统错误
func LogSystemError(msg string) {
	logMutex.RLock()
	logger := defaultLogger
	logMutex.RUnlock()
	logger.Error(msg, "request_id", "SYSTEM")
	checkAndRotateLog()
}

// LogDebug 记录调试级别日志
func LogDebug(ctx context.Context, msg string, args ...any) {
	if !common.DebugEnabled && getLogLevel() > slog.LevelDebug {
		return
	}

	if ctx == nil {
		ctx = context.Background()
	}
	id := getRequestID(ctx)
	if len(args) > 0 {
		msg = fmt.Sprintf(msg, args...)
	}
	logMutex.RLock()
	logger := defaultLogger
	logMutex.RUnlock()
	logger.DebugContext(ctx, msg, "request_id", id)
	checkAndRotateLog()
}

// getRequestID 从上下文中获取请求ID
func getRequestID(ctx context.Context) string {
	if ctx == nil {
		return "SYSTEM"
	}
	id := ctx.Value(common.RequestIdKey)
	if id == nil {
		return "SYSTEM"
	}
	if strID, ok := id.(string); ok {
		return strID
	}
	return "SYSTEM"
}

func LogQuota(quota int) string {
	// 新逻辑：根据额度展示类型输出
	q := float64(quota)
	switch operation_setting.GetQuotaDisplayType() {
	case operation_setting.QuotaDisplayTypeCNY:
		usd := q / common.QuotaPerUnit
		cny := usd * operation_setting.USDExchangeRate
		return fmt.Sprintf("¥%.6f 额度", cny)
	case operation_setting.QuotaDisplayTypeCustom:
		usd := q / common.QuotaPerUnit
		rate := operation_setting.GetGeneralSetting().CustomCurrencyExchangeRate
		symbol := operation_setting.GetGeneralSetting().CustomCurrencySymbol
		if symbol == "" {
			symbol = "¤"
		}
		if rate <= 0 {
			rate = 1
		}
		v := usd * rate
		return fmt.Sprintf("%s%.6f 额度", symbol, v)
	case operation_setting.QuotaDisplayTypeTokens:
		return fmt.Sprintf("%d 点额度", quota)
	default: // USD
		return fmt.Sprintf("＄%.6f 额度", q/common.QuotaPerUnit)
	}
}

func FormatQuota(quota int) string {
	q := float64(quota)
	switch operation_setting.GetQuotaDisplayType() {
	case operation_setting.QuotaDisplayTypeCNY:
		usd := q / common.QuotaPerUnit
		cny := usd * operation_setting.USDExchangeRate
		return fmt.Sprintf("¥%.6f", cny)
	case operation_setting.QuotaDisplayTypeCustom:
		usd := q / common.QuotaPerUnit
		rate := operation_setting.GetGeneralSetting().CustomCurrencyExchangeRate
		symbol := operation_setting.GetGeneralSetting().CustomCurrencySymbol
		if symbol == "" {
			symbol = "¤"
		}
		if rate <= 0 {
			rate = 1
		}
		v := usd * rate
		return fmt.Sprintf("%s%.6f", symbol, v)
	case operation_setting.QuotaDisplayTypeTokens:
		return fmt.Sprintf("%d", quota)
	default:
		return fmt.Sprintf("＄%.6f", q/common.QuotaPerUnit)
	}
}

// LogJson 仅供测试使用 only for test
func LogJson(ctx context.Context, msg string, obj any) {
	jsonStr, err := json.Marshal(obj)
	if err != nil {
		LogError(ctx, fmt.Sprintf("json marshal failed: %s", err.Error()))
		return
	}
	LogDebug(ctx, fmt.Sprintf("%s | %s", msg, string(jsonStr)))
}
