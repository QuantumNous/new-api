package operation_setting

import (
	"net/textproto"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

const (
	RelayDumpModeError = "error"
	RelayDumpModeAll   = "all"
)

const (
	RelayDumpOutputFile = "file"
	RelayDumpOutputLog  = "log"
	RelayDumpOutputBoth = "both"
)

// RelayDumpSetting 中转抓包设置：把发往上游的请求头/请求体、响应头/响应体
// 保存为文件或打印到日志，仅用于排障。启用后文件可能包含用户对话内容，
// 请自行确保落盘目录的安全。
type RelayDumpSetting struct {
	// Enabled 总开关，默认关闭
	Enabled bool `json:"enabled"`
	// Mode 抓取范围："error" 仅失败请求（默认），"all" 全部请求
	Mode string `json:"mode"`
	// Output 输出位置："file"（默认）、"log"、"both"
	Output string `json:"output"`
	// Directory 落盘目录，默认 ./relay-dump
	Directory string `json:"directory"`
	// MaxBodyKB 单个请求体/响应体的截断上限，默认 64
	MaxBodyKB int `json:"max_body_kb"`
	// MaxFiles 目录保留文件上限，超出删除最旧，默认 500
	MaxFiles int `json:"max_files"`
	// RedactHeaders 是否脱敏内置敏感请求头，默认 true
	RedactHeaders bool `json:"redact_headers"`
	// RedactList 自定义追加脱敏的请求头名单（不区分大小写）
	RedactList []string `json:"redact_list"`
}

var relayDumpSetting = RelayDumpSetting{
	Enabled:       false,
	Mode:          RelayDumpModeError,
	Output:        RelayDumpOutputFile,
	Directory:     "relay-dump",
	MaxBodyKB:     64,
	MaxFiles:      500,
	RedactHeaders: true,
	RedactList:    nil,
}

func init() {
	config.GlobalConfig.Register("relay_dump_setting", &relayDumpSetting)
}

func GetRelayDumpSetting() *RelayDumpSetting {
	return &relayDumpSetting
}

func (s *RelayDumpSetting) DumpAll() bool {
	return strings.TrimSpace(s.Mode) == RelayDumpModeAll
}

func (s *RelayDumpSetting) WriteToFile() bool {
	return s.Output == RelayDumpOutputFile || s.Output == RelayDumpOutputBoth
}

func (s *RelayDumpSetting) WriteToLog() bool {
	return s.Output == RelayDumpOutputLog || s.Output == RelayDumpOutputBoth
}

func (s *RelayDumpSetting) MaxBodyBytes() int64 {
	return int64(max(s.MaxBodyKB, 1)) * 1024
}

func (s *RelayDumpSetting) ResolvedDirectory() string {
	dir := strings.TrimSpace(s.Directory)
	if dir == "" {
		dir = "relay-dump"
	}
	return filepath.Clean(dir)
}

// ExtraRedactHeaders 返回管理员自定义的追加脱敏头（规范化为标准 MIME 头名）。
func (s *RelayDumpSetting) ExtraRedactHeaders() []string {
	result := make([]string, 0, len(s.RedactList))
	for _, name := range s.RedactList {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		result = append(result, textproto.CanonicalMIMEHeaderKey(name))
	}
	return result
}

func ValidateRelayDumpOption(key string, value string) error {
	switch key {
	case "relay_dump_setting.mode":
		v := strings.TrimSpace(value)
		if v != RelayDumpModeError && v != RelayDumpModeAll {
			return common.NewMessage("Relay dump mode must be error or all")
		}
	case "relay_dump_setting.output":
		v := strings.TrimSpace(value)
		if v != RelayDumpOutputFile && v != RelayDumpOutputLog && v != RelayDumpOutputBoth {
			return common.NewMessage("Relay dump output must be file, log or both")
		}
	case "relay_dump_setting.max_body_kb":
		size, err := strconv.Atoi(strings.TrimSpace(value))
		if err != nil || size < 1 || size > 8192 {
			return common.NewMessage("Relay dump body limit must be between 1 and 8192 KB")
		}
	case "relay_dump_setting.max_files":
		files, err := strconv.Atoi(strings.TrimSpace(value))
		if err != nil || files < 1 || files > 100000 {
			return common.NewMessage("Relay dump file limit must be between 1 and 100000")
		}
	case "relay_dump_setting.directory":
		dir := strings.TrimSpace(value)
		if dir == "" {
			return common.NewMessage("Relay dump directory cannot be empty")
		}
		cleaned := filepath.Clean(dir)
		if cleaned == "." || cleaned == ".." || strings.HasPrefix(cleaned, ".."+string(filepath.Separator)) {
			return common.NewMessage("Relay dump directory must not point to the parent directory")
		}
		if len(cleaned) > 200 {
			return common.NewMessage("Relay dump directory is too long")
		}
	}
	return nil
}
