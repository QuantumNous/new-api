package jsrt

import (
	"encoding/json"
	"net/url"
	"one-api/common"
	"strings"

	"github.com/dop251/goja"
	"gorm.io/gorm"
)

func setDB(vm *goja.Runtime, db *gorm.DB, name string) {
	if db == nil {
		common.SysError("JS DB is nil")
		return
	}

	obj := vm.NewObject()
	obj.Set("query", func(sql string, params ...any) []map[string]any {
		return dbQuery(db, sql, params...)
	})
	obj.Set("exec", func(sql string, params ...any) map[string]any {
		return dbExec(db, sql, params...)
	})
	if err := vm.Set(name, obj); err != nil {
		common.SysError("Failed to set JS DB: " + err.Error())
		return
	}
}

func parseBodyByType(bodyBytes []byte, contentType string) any {
	if len(bodyBytes) == 0 {
		return ""
	}

	bodyStr := string(bodyBytes)
	contentLower := strings.ToLower(contentType)

	switch {
	case strings.Contains(contentLower, "application/json"):
		var jsonObj any
		if err := json.Unmarshal(bodyBytes, &jsonObj); err == nil {
			return jsonObj
		}
		return bodyStr

	case strings.Contains(contentLower, "application/x-www-form-urlencoded"):
		if values, err := url.ParseQuery(bodyStr); err == nil {
			result := make(map[string]string, len(values))
			for k, v := range values {
				if len(v) > 0 {
					result[k] = v[0]
				}
			}
			return result
		}
		return bodyStr

	case strings.Contains(contentLower, "multipart/form-data"):
		return bodyBytes

	case strings.Contains(contentLower, "text/"):
		return bodyStr

	default:
		// 尝试JSON解析
		var jsonObj any
		if json.Unmarshal(bodyBytes, &jsonObj) == nil {
			return jsonObj
		}

		// 尝试form解析
		if values, err := url.ParseQuery(bodyStr); err == nil && len(values) > 0 {
			result := make(map[string]string, len(values))
			for k, v := range values {
				if len(v) > 0 {
					result[k] = v[0]
				}
			}
			return result
		}

		return bodyStr
	}
}