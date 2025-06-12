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
	"sync"
	"time"

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
)

const maxLogCount = 1000000

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
		logPath := filepath.Join(*LogDir, fmt.Sprintf("oneapi-%s.log", time.Now().Format("20060102150405")))
		fd, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if err != nil {
			log.Fatal("failed to open log file")
		}
		gin.DefaultWriter = io.MultiWriter(os.Stdout, fd)
		gin.DefaultErrorWriter = io.MultiWriter(os.Stderr, fd)
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

func logHelper(ctx context.Context, level string, msg string) {
	// 获取请求ID
	id := ctx.Value(RequestIdKey)

	// 如果有请求ID，则检查是否需要打印日志
	if id != nil {
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
	_, _ = fmt.Fprintf(writer, "[%s] %v | %s | %s | %s \n", level, now.Format("2006/01/02 - 15:04:05"), id, caller, msg)
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
