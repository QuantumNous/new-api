package logger

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/phuslu/log"
)

func SetupLogger() {
	var consoleWriter log.Writer = &log.ConsoleWriter{ColorOutput: true, Formatter: func(w io.Writer, a *log.FormatterArgs) (int, error) {
		id := a.Get(common.RequestIdKey)
		scene := "SYS"
		// gin web server
		fromWeb := a.Get("from_web")
		if fromWeb == "true" {
			scene = "GIN"
			return fmt.Fprintf(w, "[%s] %s | %s | %s | %s | %13v | %15s | %7s %s\n", scene, a.Time, strings.ToUpper(a.Level), id, a.Get("status"), a.Get("latency"), a.Get("ip"), a.Get("method"), a.Get("path"))
		}
		if id == "SYS" {
			scene = "SYS"
		}
		return fmt.Fprintf(w, "[%s] %v | %s | %s\n", scene, a.Time, strings.ToUpper(a.Level), a.Message)
	}}
	// 控制台输出使用json格式
	consoleLogJson := os.Getenv("CONSOLE_LOG_JSON")
	if consoleLogJson == "true" {
		consoleWriter = log.IOWriter{Writer: os.Stdout}
	}
	log.DefaultLogger.TimeFormat = "2006/01/02 - 15:04:05"
	//log.DefaultLogger.TimeFormat = "20060102150405"

	var writer log.Writer = consoleWriter
	if *common.LogDir != "" {
		multiLevelFileWriter := &log.MultiLevelWriter{
			InfoWriter: &log.FileWriter{
				Filename:     fmt.Sprintf("%s/newapi.info.log", *common.LogDir),
				FileMode:     0600,
				MaxSize:      100 * 1024 * 1024,
				EnsureFolder: true,
				TimeFormat:   "20060102150405",
			},
			WarnWriter: &log.FileWriter{
				Filename:     fmt.Sprintf("%s/newapi.warn.log", *common.LogDir),
				FileMode:     0600,
				MaxSize:      100 * 1024 * 1024,
				EnsureFolder: true,
				TimeFormat:   "20060102150405",
			},
			ErrorWriter: &log.FileWriter{
				Filename:     fmt.Sprintf("%s/newapi.error.log", *common.LogDir),
				FileMode:     0600,
				MaxSize:      100 * 1024 * 1024,
				EnsureFolder: true,
				TimeFormat:   "20060102150405",
			},
		}
		writer = &log.MultiEntryWriter{
			consoleWriter,
			multiLevelFileWriter,
		}
	}
	log.DefaultLogger.Writer = writer
}

func LogInfo(ctx context.Context, msg string) {
	logHelper(ctx, log.InfoLevel, msg)
}

func LogWarn(ctx context.Context, msg string) {
	logHelper(ctx, log.WarnLevel, msg)
}

func LogError(ctx context.Context, msg string) {
	logHelper(ctx, log.ErrorLevel, msg)
}

func LogDebug(ctx context.Context, msg string, args ...any) {
	if common.DebugEnabled {
		logHelper(ctx, log.DebugLevel, msg, args)
	}
}

func logHelper(ctx context.Context, level log.Level, msg string, args ...any) {
	entry := &log.Entry{}
	switch level {
	case log.InfoLevel:
		entry = log.Info()
		break
	case log.ErrorLevel:
		entry = log.Error()
		break
	case log.DebugLevel:
		entry = log.Debug()
		break
	case log.WarnLevel:
		entry = log.Warn()
		break
	default:
		entry = log.Debug()
	}
	id := ctx.Value(common.RequestIdKey)
	if id == nil {
		entry.Str(common.RequestIdKey, "SYS")
	} else {
		idStr, ok := id.(string)
		if !ok {
			entry.Str(common.RequestIdKey, "INVALID_ID")
		}
		entry.Str(common.RequestIdKey, idStr)
	}
	if len(args) > 0 {
		entry.Msgf(msg, args)
	} else {
		entry.Msg(msg)
	}
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
