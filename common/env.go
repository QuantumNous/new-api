package common

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

func GetEnvOrDefault(env string, defaultValue int) int {
	value := strings.TrimSpace(os.Getenv(env))
	if env == "" || value == "" {
		return defaultValue
	}
	num, err := strconv.Atoi(value)
	if err != nil {
		SysError(fmt.Sprintf("failed to parse %s: %s, using default value: %d", env, err.Error(), defaultValue))
		return defaultValue
	}
	return num
}

func GetEnvOrDefaultString(env string, defaultValue string) string {
	if env == "" || os.Getenv(env) == "" {
		return defaultValue
	}
	return os.Getenv(env)
}

func GetEnvOrDefaultBool(env string, defaultValue bool) bool {
	value := strings.TrimSpace(os.Getenv(env))
	if env == "" || value == "" {
		return defaultValue
	}
	b, err := strconv.ParseBool(value)
	if err != nil {
		SysError(fmt.Sprintf("failed to parse %s: %s, using default value: %t", env, err.Error(), defaultValue))
		return defaultValue
	}
	return b
}
