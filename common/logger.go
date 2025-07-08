package common

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"

	"one-api/metrics"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

// 是否开启透传日志打印
var LogPassthroughEnabled = false

// 日志打印采样比例（0-100之间的整数，表示百分比）
var LogSampleRatio = 100

const (
	loggerINFO  = "INFO"
	loggerWarn  = "WARN"
	loggerError = "ERR"
	// 10GB in bytes
	maxLogFileSize = 20 * 1024 * 1024 * 1024
	// 保留最近的1个日志文件
	maxLogFiles = 1
	// 日志计数上限
	maxLogCount = 1000000
)

// 错误类型常量
const (
	ErrorTypeOther              = "other"
	ErrorTypeParameter          = "parameter_error"
	ErrorTypeNoCandidates       = "no_candidates"
	ErrorTypeRequestFailed      = "request_failed"
	ErrorTypeBadGateway         = "bad_gateway"
	ErrorTypeResponseFailed     = "response_failed"
	ErrorTypeConnectionTimeout  = "connection_timeout"
	ErrorTypeTokenUnavailable   = "token_unavailable"
	ErrorTypeBadRequest         = "bad_request"
	ErrorTypeNoAvailableChannel = "no_available_channel"
)

var logCount int
var setupLogLock sync.Mutex
var setupLogWorking bool

func SetupLogger() {
	if *LogDir != "" {
		ok := setupLogLock.TryLock()
		if !ok {
			log.Println("setup log is already working")
			return
		}
		defer func() {
			setupLogLock.Unlock()
			setupLogWorking = false
		}()

		// 创建日志目录
		if _, err := os.Stat(*LogDir); os.IsNotExist(err) {
			if err := os.MkdirAll(*LogDir, 0755); err != nil {
				log.Fatal("failed to create log directory")
			}
		}

		// 检查并清理旧的日志文件
		cleanOldLogs()

		logPath := filepath.Join(*LogDir, fmt.Sprintf("oneapi-%s.log", time.Now().Format("20060102150405")))
		fd, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if err != nil {
			log.Fatal("failed to open log file")
		}

		// 创建一个自定义的 writer，用于检查文件大小
		writer := &logWriter{
			file:     fd,
			filepath: logPath,
			size:     0,
		}

		gin.DefaultWriter = io.MultiWriter(os.Stdout, writer)
		gin.DefaultErrorWriter = io.MultiWriter(os.Stderr, writer)
	}
}

// logWriter 是一个自定义的 writer，用于跟踪文件大小
type logWriter struct {
	file     *os.File
	filepath string
	size     int64
	mu       sync.Mutex
}

func (w *logWriter) Write(p []byte) (n int, err error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	// 写入数据
	n, err = w.file.Write(p)
	if err != nil {
		return n, err
	}

	// 更新文件大小
	w.size += int64(n)

	// 检查文件大小是否超过限制
	if w.size >= maxLogFileSize {
		// 关闭当前文件
		w.file.Close()

		// 清理旧日志并创建新文件
		cleanOldLogs()

		// 创建新的日志文件
		logPath := filepath.Join(*LogDir, fmt.Sprintf("oneapi-%s.log", time.Now().Format("20060102150405")))
		fd, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if err != nil {
			return n, fmt.Errorf("failed to create new log file: %v", err)
		}

		// 更新 writer 状态
		w.file = fd
		w.filepath = logPath
		w.size = 0

		// 更新 gin 的 writer
		gin.DefaultWriter = io.MultiWriter(os.Stdout, w)
		gin.DefaultErrorWriter = io.MultiWriter(os.Stderr, w)
	}

	return n, nil
}

// cleanOldLogs 清理旧的日志文件，只保留最近的几个文件
func cleanOldLogs() {
	files, err := filepath.Glob(filepath.Join(*LogDir, "oneapi-*.log"))
	if err != nil {
		log.Printf("failed to list log files: %v", err)
		return
	}

	// 按修改时间排序
	sort.Slice(files, func(i, j int) bool {
		fi, _ := os.Stat(files[i])
		fj, _ := os.Stat(files[j])
		return fi.ModTime().After(fj.ModTime())
	})

	// 删除旧文件
	for i := maxLogFiles; i < len(files); i++ {
		if err := os.Remove(files[i]); err != nil {
			log.Printf("failed to remove old log file %s: %v", files[i], err)
		}
	}
}

func getCallerInfo() string {
	_, file, line, ok := runtime.Caller(3) // 增加调用栈深度到3，跳过日志函数本身
	if !ok {
		return "unknown:0"
	}
	// 返回完整路径
	return fmt.Sprintf("%s:%d", file, line)
}

func SysLog(s string) {
	t := time.Now()
	caller := getCallerInfo()
	_, _ = fmt.Fprintf(gin.DefaultWriter, "[SYS] %v | %s | %s \n", t.Format("2006/01/02 - 15:04:05"), caller, s)
}

func SysError(s string) {
	t := time.Now()
	caller := getCallerInfo()
	_, _ = fmt.Fprintf(gin.DefaultErrorWriter, "[SYS] %v | %s | %s \n", t.Format("2006/01/02 - 15:04:05"), caller, s)
}

func LogInfo(ctx context.Context, msg string) {
	logHelper(ctx, loggerINFO, msg)
}

func LogWarn(ctx context.Context, msg string) {
	logHelper(ctx, loggerWarn, msg)
}

func LogError(ctx context.Context, msg string) {
	logHelper(ctx, loggerError, msg)
}

// 获取错误类型
func getErrorType(msg string) (string, string) {
	// 提取错误码（如果有）
	errorCode := "unknown"
	if strings.Contains(msg, "status code:") {
		parts := strings.Split(msg, "status code:")
		if len(parts) > 1 {
			errorCode = strings.TrimSpace(parts[1])
		}
	}

	// 根据错误消息内容判断错误类型
	switch {
	case strings.Contains(msg, "One or more parameter"):
		return ErrorTypeParameter, errorCode
	case strings.Contains(msg, "No candidates"):
		return ErrorTypeNoCandidates, errorCode
	case strings.Contains(msg, "do request failed"):
		return ErrorTypeRequestFailed, errorCode
	case strings.Contains(msg, "status code: 502"):
		return ErrorTypeBadGateway, errorCode
	case strings.Contains(msg, "doResponse failed"):
		return ErrorTypeResponseFailed, errorCode
	case strings.Contains(msg, "write: connection timed out"):
		return ErrorTypeConnectionTimeout, errorCode
	case strings.Contains(msg, "该令牌状态不可用"):
		return ErrorTypeTokenUnavailable, errorCode
	case strings.Contains(msg, "bad response status code 400"):
		return ErrorTypeBadRequest, errorCode
	case strings.Contains(msg, "无可用渠道"):
		return ErrorTypeNoAvailableChannel, errorCode
	default:
		return ErrorTypeOther, errorCode
	}
}

func logHelper(ctx context.Context, level string, msg string) {
	// 获取请求ID
	var requestId string
	if id := ctx.Value(RequestIdKey); id != nil {
		requestId = id.(string)
	}

	// 如果有请求ID，则检查是否需要打印日志
	if requestId != "" {
		// 从上下文中获取哈希值
		if ginCtx, ok := ctx.Value("gin_context").(*gin.Context); ok {
			hashValue := ginCtx.GetInt("hash_value")
			if hashValue > int(LogSampleRatio) {
				return
			}
		}
	}

	writer := gin.DefaultErrorWriter
	if level == loggerINFO {
		writer = gin.DefaultWriter
	}
	now := time.Now()
	caller := getCallerInfo()
	_, _ = fmt.Fprintf(writer, "[%s] %v | %s | %s | %s \n", level, now.Format("2006/01/02 - 15:04:05"), requestId, caller, msg)

	// 如果是错误日志，增加错误计数
	if level == loggerError {
		errorType, errorCode := getErrorType(msg)
		// 从上下文中获取相关信息
		channel := "unknown"
		channelName := "unknown"
		model := "unknown"
		group := "unknown"
		tokenName := "unknown"
		userId := "unknown"
		userName := "unknown"

		if ginCtx, ok := ctx.Value("gin_context").(*gin.Context); ok {
			if ch := ginCtx.GetString("channel"); ch != "" {
				channel = ch
			}
			if chName := ginCtx.GetString("channel_name"); chName != "" {
				channelName = chName
			}
			if m := ginCtx.GetString("model"); m != "" {
				model = m
			}
			if g := ginCtx.GetString("group"); g != "" {
				group = g
			}
			if tn := ginCtx.GetString("token_name"); tn != "" {
				tokenName = tn
			}
			if userId := ginCtx.GetString("user_id"); userId != "" {
				userId = userId
			}
			if userName := ginCtx.GetString("user_name"); userName != "" {
				userName = userName
			}
		}

		metrics.IncrementErrorLog(channel, channelName, errorCode, errorType, model, group, tokenName, userId, userName, 1.0)
	}

	logCount++ // we don't need accurate count, so no lock here
	if logCount > maxLogCount && !setupLogWorking {
		logCount = 0
		setupLogWorking = true
		gopool.Go(func() {
			SetupLogger()
		})
	}
}

func FatalLog(v ...any) {
	t := time.Now()
	caller := getCallerInfo()
	_, _ = fmt.Fprintf(gin.DefaultErrorWriter, "[FATAL] %v | %s | %v \n", t.Format("2006/01/02 - 15:04:05"), caller, v)
	os.Exit(1)
}

func LogQuota(quota int) string {
	if DisplayInCurrencyEnabled {
		return fmt.Sprintf("＄%.6f 额度", float64(quota)/QuotaPerUnit)
	} else {
		return fmt.Sprintf("%d 点额度", quota)
	}
}

func FormatQuota(quota int) string {
	if DisplayInCurrencyEnabled {
		return fmt.Sprintf("＄%.6f", float64(quota)/QuotaPerUnit)
	} else {
		return fmt.Sprintf("%d", quota)
	}
}

// LogJson 仅供测试使用 only for test
func LogJson(ctx context.Context, msg string, obj any) {
	jsonStr, err := json.Marshal(obj)
	if err != nil {
		LogError(ctx, fmt.Sprintf("json marshal failed: %s", err.Error()))
		return
	}
	LogInfo(ctx, fmt.Sprintf("%s | %s", msg, string(jsonStr)))
}
