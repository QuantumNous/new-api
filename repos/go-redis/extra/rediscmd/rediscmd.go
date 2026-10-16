package rediscmd

import (
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
)

func CmdString(cmd redis.Cmder) string {
	b := make([]byte, 0, 32)
	b = AppendCmd(b, cmd)
	return String(b)
}

func CmdsString(cmds []redis.Cmder) (string, string) {
	const numCmdLimit = 100
	const numNameLimit = 10

	seen := make(map[string]struct{}, numNameLimit)
	unqNames := make([]string, 0, numNameLimit)

	b := make([]byte, 0, 32*len(cmds))

	for i, cmd := range cmds {
		if i > numCmdLimit {
			break
		}

		if i > 0 {
			b = append(b, '\n')
		}
		b = AppendCmd(b, cmd)

		if len(unqNames) >= numNameLimit {
			continue
		}

		name := cmd.FullName()
		if _, ok := seen[name]; !ok {
			seen[name] = struct{}{}
			unqNames = append(unqNames, name)
		}
	}

	summary := strings.Join(unqNames, " ")
	return summary, String(b)
}

func AppendCmd(b []byte, cmd redis.Cmder) []byte {
	const numArgLimit = 32

	for i, arg := range cmd.Args() {
		if i > numArgLimit {
			break
		}
		if i > 0 {
			b = append(b, ' ')
		}
		b = appendArg(b, arg)
	}

	if err := cmd.Err(); err != nil {
		b = append(b, ": "...)
		b = append(b, err.Error()...)
	}

	return b
}

func appendArg(b []byte, v interface{}) []byte {
	const argLenLimit = 64

	switch v := v.(type) {
	case nil:
		return append(b, "<nil>"...)
	case string:
		if len(v) > argLenLimit {
			v = v[:argLenLimit]
		}
		return appendUTF8String(b, Bytes(v))
	case []byte:
		if len(v) > argLenLimit {
			v = v[:argLenLimit]
		}
		return appendUTF8String(b, v)
	case int:
		return strconv.AppendInt(b, int64(v), 10)
	case int8:
		return strconv.AppendInt(b, int64(v), 10)
	case int16:
		return strconv.AppendInt(b, int64(v), 10)
	case int32:
		return strconv.AppendInt(b, int64(v), 10)
	case int64:
		return strconv.AppendInt(b, v, 10)
	case uint:
		return strconv.AppendUint(b, uint64(v), 10)
	case uint8:
		return strconv.AppendUint(b, uint64(v), 10)
	case uint16:
		return strconv.AppendUint(b, uint64(v), 10)
	case uint32:
		return strconv.AppendUint(b, uint64(v), 10)
	case uint64:
		return strconv.AppendUint(b, v, 10)
	case float32:
		return strconv.AppendFloat(b, float64(v), 'f', -1, 64)
	case float64:
		return strconv.AppendFloat(b, v, 'f', -1, 64)
	case bool:
		if v {
			return append(b, "true"...)
		}
		return append(b, "false"...)
	case time.Time:
		return v.AppendFormat(b, time.RFC3339Nano)
	default:
		return append(b, fmt.Sprint(v)...)
	}
}

func appendUTF8String(dst []byte, src []byte) []byte {
	if isSimple(src) {
		dst = append(dst, src...)
		return dst
	}

	s := len(dst)
	dst = append(dst, make([]byte, hex.EncodedLen(len(src)))...)
	hex.Encode(dst[s:], src)
	return dst
}

func isSimple(b []byte) bool {
	for _, c := range b {
		if !isSimpleByte(c) {
			return false
		}
	}
	return true
}

func isSimpleByte(c byte) bool {
	return c >= 0x21 && c <= 0x7e
}
