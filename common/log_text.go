package common

import (
	_ "embed"
	"fmt"
	"strings"
)

// Server log lines are English. logTextZhCN holds the Chinese text of the
// lines that have one, keyed by their English format.
//
//go:embed log_text.zh-CN.json
var logTextZhCN []byte

// logTexts is the translation table LOG_LANGUAGE selected; nil prints English.
var logTexts map[string]string

// SetLogLanguage selects the language of server log lines. A language that
// starts with "zh" prints the Chinese text; anything else prints English.
func SetLogLanguage(language string) {
	logTexts = nil
	if !strings.HasPrefix(strings.ToLower(strings.TrimSpace(language)), "zh") {
		return
	}
	if err := Unmarshal(logTextZhCN, &logTexts); err != nil {
		SysError("failed to load the Chinese log texts: " + err.Error())
	}
}

// LogText formats a server log line in the language of LOG_LANGUAGE. format is
// the English text and the key of its translation in log_text.zh-CN.json.
func LogText(format string, args ...any) string {
	if translated, ok := logTexts[format]; ok {
		return fmt.Sprintf(translated, args...)
	}
	return fmt.Sprintf(format, args...)
}
