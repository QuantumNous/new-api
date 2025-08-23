package common

import (
	"fmt"
	"reflect"
)

// StructToMap 递归地把任意结构体 v 转成 map[string]any。
// - 只处理导出字段；未导出字段会被跳过。
// - 优先使用 `json:"name"` 里逗号前的部分作为键；如果是 "-" 则忽略该字段；若无 tag，则使用字段名。
// - 对指针、切片、数组、嵌套结构体、map 做深度遍历，保持原始结构。
func StructToMap(v any) (map[string]any, error) {
	val := reflect.ValueOf(v)
	if !val.IsValid() {
		return nil, fmt.Errorf("nil value")
	}
	for val.Kind() == reflect.Pointer {
		if val.IsNil() {
			return nil, fmt.Errorf("nil pointer")
		}
		val = val.Elem()
	}
	if val.Kind() != reflect.Struct {
		return nil, fmt.Errorf("expect struct, got %s", val.Kind())
	}

	return structValueToMap(val), nil
}

func structValueToMap(val reflect.Value) map[string]any {
	out := make(map[string]any, val.NumField())

	typ := val.Type()
	for i := 0; i < val.NumField(); i++ {
		f := typ.Field(i)
		if f.PkgPath != "" { // 未导出字段
			continue
		}

		// 解析 json tag
		tag := f.Tag.Get("json")
		name, opts := parseTag(tag)
		if name == "-" {
			continue
		}
		if name == "" {
			name = f.Name
		}

		fv := val.Field(i)
		out[name] = valueToAny(fv, opts.Contains("omitempty"))
	}
	return out
}

// valueToAny 递归处理各种值类型。
func valueToAny(v reflect.Value, omitEmpty bool) any {
	if !v.IsValid() {
		return nil
	}

	for v.Kind() == reflect.Pointer {
		if v.IsNil() {
			if omitEmpty {
				return nil
			}
			// 保持与 encoding/json 行为一致，nil 指针写成 null
			return nil
		}
		v = v.Elem()
	}

	switch v.Kind() {

	case reflect.Struct:
		return structValueToMap(v)

	case reflect.Slice, reflect.Array:
		l := v.Len()
		arr := make([]any, l)
		for i := 0; i < l; i++ {
			arr[i] = valueToAny(v.Index(i), false)
		}
		return arr

	case reflect.Map:
		m := make(map[string]any, v.Len())
		iter := v.MapRange()
		for iter.Next() {
			k := iter.Key()
			// 只支持 string key，与 encoding/json 一致
			if k.Kind() == reflect.String {
				m[k.String()] = valueToAny(iter.Value(), false)
			}
		}
		return m

	default:
		// 基本类型直接返回其接口值
		return v.Interface()
	}
}

// tagOptions 用于判断是否包含 "omitempty"
type tagOptions string

func (o tagOptions) Contains(opt string) bool {
	if len(o) == 0 {
		return false
	}
	for _, s := range splitComma(string(o)) {
		if s == opt {
			return true
		}
	}
	return false
}

func parseTag(tag string) (string, tagOptions) {
	if idx := indexComma(tag); idx != -1 {
		return tag[:idx], tagOptions(tag[idx+1:])
	}
	return tag, tagOptions("")
}

// 避免 strings.Split 额外分配
func indexComma(s string) int {
	for i, r := range s {
		if r == ',' {
			return i
		}
	}
	return -1
}

func splitComma(s string) []string {
	var parts []string
	start := 0
	for i, r := range s {
		if r == ',' {
			parts = append(parts, s[start:i])
			start = i + 1
		}
	}
	if start <= len(s) {
		parts = append(parts, s[start:])
	}
	return parts
}