package utils

import (
	"database/sql/driver"
	"fmt"
	"path/filepath"
	"reflect"
	"runtime"
	"strconv"
	"strings"
	"unicode"
)

var gormSourceDir string

func init() {
	_, file, _, _ := runtime.Caller(0)
	// compatible solution to get gorm source directory with various operating systems
	gormSourceDir = sourceDir(file)
}

func sourceDir(file string) string {
	dir := filepath.Dir(file)
	dir = filepath.Dir(dir)

	s := filepath.Dir(dir)
	if filepath.Base(s) != "gorm.io" {
		s = dir
	}
	return filepath.ToSlash(s) + "/"
}

// FileWithLineNum return the file name and line number of the current file
func FileWithLineNum() string {
	// the second caller usually from gorm internal, so set i start from 2
	for i := 2; i < 15; i++ {
		_, file, line, ok := runtime.Caller(i)
		if ok && (!strings.HasPrefix(file, gormSourceDir) || strings.HasSuffix(file, "_test.go")) {
			return file + ":" + strconv.FormatInt(int64(line), 10)
		}
	}

	return ""
}

func IsValidDBNameChar(c rune) bool {
	return !unicode.IsLetter(c) && !unicode.IsNumber(c) && c != '.' && c != '*' && c != '_' && c != '$' && c != '@'
}

// CheckTruth check string true or not
func CheckTruth(vals ...string) bool {
	for _, val := range vals {
		if val != "" && !strings.EqualFold(val, "false") {
			return true
		}
	}
	return false
}

func ToStringKey(values ...interface{}) string {
	results := make([]string, len(values))

	for idx, value := range values {
		if valuer, ok := value.(driver.Valuer); ok {
			value, _ = valuer.Value()
		}

		switch v := value.(type) {
		case string:
			results[idx] = v
		case []byte:
			results[idx] = string(v)
		case uint:
			results[idx] = strconv.FormatUint(uint64(v), 10)
		default:
			results[idx] = fmt.Sprint(reflect.Indirect(reflect.ValueOf(v)).Interface())
		}
	}

	return strings.Join(results, "_")
}

func Contains(elems []string, elem string) bool {
	for _, e := range elems {
		if elem == e {
			return true
		}
	}
	return false
}

func AssertEqual(src, dst interface{}) bool {
	if !reflect.DeepEqual(src, dst) {
		if valuer, ok := src.(driver.Valuer); ok {
			src, _ = valuer.Value()
		}

		if valuer, ok := dst.(driver.Valuer); ok {
			dst, _ = valuer.Value()
		}

		return reflect.DeepEqual(src, dst)
	}
	return true
}

func ToString(value interface{}) string {
	switch v := value.(type) {
	case string:
		return v
	case int:
		return strconv.FormatInt(int64(v), 10)
	case int8:
		return strconv.FormatInt(int64(v), 10)
	case int16:
		return strconv.FormatInt(int64(v), 10)
	case int32:
		return strconv.FormatInt(int64(v), 10)
	case int64:
		return strconv.FormatInt(v, 10)
	case uint:
		return strconv.FormatUint(uint64(v), 10)
	case uint8:
		return strconv.FormatUint(uint64(v), 10)
	case uint16:
		return strconv.FormatUint(uint64(v), 10)
	case uint32:
		return strconv.FormatUint(uint64(v), 10)
	case uint64:
		return strconv.FormatUint(v, 10)
	}
	return ""
}

const nestedRelationSplit = "__"

// NestedRelationName nested relationships like `Manager__Company`
func NestedRelationName(prefix, name string) string {
	return prefix + nestedRelationSplit + name
}

// SplitNestedRelationName Split nested relationships to `[]string{"Manager","Company"}`
func SplitNestedRelationName(name string) []string {
	return strings.Split(name, nestedRelationSplit)
}

// JoinNestedRelationNames nested relationships like `Manager__Company`
func JoinNestedRelationNames(relationNames []string) string {
	return strings.Join(relationNames, nestedRelationSplit)
}
