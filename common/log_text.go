package common

import "fmt"

// SetLogLanguage remains for upstream callers. Orbit server logs are English.
func SetLogLanguage(_ string) {}

// LogText preserves formatting without loading translated server messages.
func LogText(format string, args ...any) string {
	return fmt.Sprintf(format, args...)
}
