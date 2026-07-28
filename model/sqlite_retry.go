package model

import (
	"errors"
	"strings"
)

const (
	sqliteBusyBaseCode   = 5
	sqliteLockedBaseCode = 6
)

type sqliteErrorCoder interface {
	Code() int
}

func IsSQLiteBusyError(err error) bool {
	if err == nil {
		return false
	}
	var codedError sqliteErrorCoder
	if errors.As(err, &codedError) {
		baseCode := codedError.Code() & 0xff
		if baseCode == sqliteBusyBaseCode || baseCode == sqliteLockedBaseCode {
			return true
		}
	}
	message := strings.ToUpper(err.Error())
	return strings.Contains(message, "SQLITE_BUSY") ||
		strings.Contains(message, "SQLITE_LOCKED") ||
		strings.Contains(message, "DATABASE IS LOCKED") ||
		strings.Contains(message, "DATABASE TABLE IS LOCKED")
}
