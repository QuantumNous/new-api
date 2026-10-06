package common

import (
	"bytes"

	"github.com/QuantumNous/new-api/constant"

	"github.com/gin-gonic/gin"
)

const (
	responseModelKey = `"model"`
	responseErrorKey = `"error"`
	sseDataPrefix    = "data:"
	// maxResponseModelHold bounds how many trailing bytes a stream chunk may carry
	// over to the next chunk while a model occurrence is still unresolved.
	maxResponseModelHold = 64 << 10
)

const (
	valueFound = iota
	valueAbsent
	valueUnresolved
)

func SetResponseModelRewriteTarget(c *gin.Context, model string) {
	if c == nil {
		return
	}
	SetContextKey(c, constant.ContextKeyResponseModelName, model)
}

func ResponseModelRewriteTarget(c *gin.Context) string {
	if c == nil {
		return ""
	}
	target, _ := GetContextKeyType[string](c, constant.ContextKeyResponseModelName)
	return target
}

// RewriteResponseModelName rewrites every model value of a complete payload.
func RewriteResponseModelName(body []byte, model string) []byte {
	if model == "" || len(body) == 0 {
		return body
	}
	if !bytes.Contains(body, []byte(responseModelKey)) {
		return body
	}
	target := quotedJSONString(model)
	if len(target) == 0 {
		return body
	}

	rewritten, hold := rewritePayload(body, target)
	if hold == 0 {
		return rewritten
	}
	complete := make([]byte, 0, len(rewritten)+hold)
	complete = append(complete, rewritten...)
	return append(complete, body[len(body)-hold:]...)
}

// RewriteResponseModelChunk rewrites a payload chunk that may end in the middle of a
// model occurrence. It returns the rewritten prefix plus the number of trailing input
// bytes that are unresolved; the caller must re-present those bytes together with the
// next chunk instead of writing them, otherwise the chunk boundary leaks the upstream
// model name.
func RewriteResponseModelChunk(chunk []byte, model string) ([]byte, int) {
	if model == "" || len(chunk) == 0 {
		return chunk, 0
	}
	target := quotedJSONString(model)
	if len(target) == 0 {
		return chunk, 0
	}
	return rewritePayload(chunk, target)
}

func quotedJSONString(value string) []byte {
	encoded, err := Marshal(value)
	if err != nil {
		return nil
	}
	return encoded
}

func rewritePayload(chunk []byte, target []byte) ([]byte, int) {
	if bytes.IndexByte(chunk, '\n') < 0 {
		return rewriteValues(chunk, target)
	}

	rewritten := make([]byte, 0, len(chunk))
	changed := false
	offset := 0
	for _, line := range bytes.SplitAfter(chunk, []byte("\n")) {
		content, terminator := splitLineTerminator(line)
		lineOut, hold := rewriteLine(content, target)
		if hold > 0 {
			rewritten = append(rewritten, lineOut...)
			return rewritten, len(chunk) - offset - len(content) + hold
		}
		if !bytes.Equal(lineOut, content) {
			changed = true
		}
		rewritten = append(rewritten, lineOut...)
		rewritten = append(rewritten, terminator...)
		offset += len(line)
	}
	if !changed {
		return chunk, 0
	}
	return rewritten, 0
}

func splitLineTerminator(line []byte) ([]byte, []byte) {
	if bytes.HasSuffix(line, []byte("\r\n")) {
		return line[:len(line)-2], line[len(line)-2:]
	}
	if bytes.HasSuffix(line, []byte("\n")) {
		return line[:len(line)-1], line[len(line)-1:]
	}
	return line, nil
}

func rewriteLine(line []byte, target []byte) ([]byte, int) {
	payloadStart := sseDataPayloadStart(line)
	if payloadStart < 0 {
		return rewriteValues(line, target)
	}
	payload := line[payloadStart:]
	out, hold := rewriteValues(payload, target)
	if hold == 0 && bytes.Equal(out, payload) {
		return line, 0
	}

	rewritten := make([]byte, 0, payloadStart+len(out))
	rewritten = append(rewritten, line[:payloadStart]...)
	return append(rewritten, out...), hold
}

func sseDataPayloadStart(line []byte) int {
	prefixEnd := 0
	for prefixEnd < len(line) && (line[prefixEnd] == ' ' || line[prefixEnd] == '\t') {
		prefixEnd++
	}
	if !bytes.HasPrefix(line[prefixEnd:], []byte(sseDataPrefix)) {
		return -1
	}

	payloadStart := prefixEnd + len(sseDataPrefix)
	for payloadStart < len(line) && line[payloadStart] == ' ' {
		payloadStart++
	}
	return payloadStart
}

// rewriteValues rewrites the model values of one payload. Watched keys are matched as
// literal bytes at a key position, so the scan does not depend on where a string token
// starts: a JSON string cannot contain that literal, because an inner quote has to be
// escaped and the escape lands inside the match. Only the occurrence the payload ends
// in the middle of is reported as unresolved.
func rewriteValues(payload []byte, target []byte) ([]byte, int) {
	var rewritten []byte
	unflushed := 0
	changed := false
	holdStart := -1
	from := 0
	for {
		start, key := findWatchedKey(payload, from)
		if start < 0 {
			holdStart = partialKeyHold(payload)
			break
		}
		if start > 0 && !startsJSONKey(payload[start-1]) {
			from = start + 1
			continue
		}

		value, state := jsonValueStart(payload, start+len(key))
		if state == valueUnresolved {
			holdStart = holdFrom(payload, start)
			break
		}
		if key == responseErrorKey {
			// A failed response keeps the upstream model name: rewriting it would hide
			// the upstream identity an operator needs to diagnose the failure.
			if state == valueFound && payload[value] == '{' {
				objectEnd := scanJSONObject(payload, value)
				if objectEnd < 0 {
					holdStart = holdFrom(payload, start)
					break
				}
				from = objectEnd
				continue
			}
			from = start + len(key)
			continue
		}
		if state == valueAbsent || payload[value] != '"' {
			from = start + len(key)
			continue
		}

		valueEnd := scanJSONString(payload, value)
		if valueEnd < 0 {
			holdStart = holdFrom(payload, start)
			break
		}
		if !bytes.Equal(payload[value:valueEnd], target) {
			rewritten = append(rewritten, payload[unflushed:value]...)
			rewritten = append(rewritten, target...)
			unflushed = valueEnd
			changed = true
		}
		from = valueEnd
	}

	if holdStart >= 0 {
		if !changed {
			return payload[:holdStart], len(payload) - holdStart
		}
		return append(rewritten, payload[unflushed:holdStart]...), len(payload) - holdStart
	}
	if !changed {
		return payload, 0
	}
	return append(rewritten, payload[unflushed:]...), 0
}

// findWatchedKey returns the earliest watched key at or after from.
func findWatchedKey(payload []byte, from int) (int, string) {
	start := -1
	matched := ""
	for _, key := range [...]string{responseModelKey, responseErrorKey} {
		offset := bytes.Index(payload[from:], []byte(key))
		if offset < 0 {
			continue
		}
		if start < 0 || from+offset < start {
			start = from + offset
			matched = key
		}
	}
	return start, matched
}

// partialKeyHold reports where payload ends inside a watched key, so that the fragment
// is carried over instead of being read as a key once the next chunk arrives.
func partialKeyHold(payload []byte) int {
	for n := min(len(payload), len(responseModelKey)-1); n > 0; n-- {
		start := len(payload) - n
		if start > 0 && !startsJSONKey(payload[start-1]) {
			continue
		}
		tail := payload[start:]
		for _, key := range [...]string{responseModelKey, responseErrorKey} {
			if len(key) > n && bytes.Equal(tail, []byte(key[:n])) {
				return holdFrom(payload, start)
			}
		}
	}
	return -1
}

// jsonValueStart locates the value that follows a key. It reports valueAbsent when the
// key is not followed by a colon, and valueUnresolved when the payload ends before that
// value can be read.
func jsonValueStart(payload []byte, keyEnd int) (int, int) {
	colon := skipJSONSpace(payload, keyEnd)
	if colon >= len(payload) {
		return 0, valueUnresolved
	}
	if payload[colon] != ':' {
		return 0, valueAbsent
	}
	value := skipJSONSpace(payload, colon+1)
	if value >= len(payload) {
		return 0, valueUnresolved
	}
	return value, valueFound
}

func scanJSONString(payload []byte, start int) int {
	if start >= len(payload) || payload[start] != '"' {
		return -1
	}
	for i := start + 1; i < len(payload); i++ {
		switch payload[i] {
		case '\\':
			i++
		case '"':
			return i + 1
		}
	}
	return -1
}

func scanJSONObject(payload []byte, start int) int {
	depth := 0
	for i := start; i < len(payload); {
		switch payload[i] {
		case '"':
			objectEnd := scanJSONString(payload, i)
			if objectEnd < 0 {
				return -1
			}
			i = objectEnd
			continue
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return i + 1
			}
		}
		i++
	}
	return -1
}

func skipJSONSpace(payload []byte, start int) int {
	for start < len(payload) {
		switch payload[start] {
		case ' ', '\t', '\n', '\r':
			start++
		default:
			return start
		}
	}
	return start
}

// startsJSONKey reports whether previous can directly precede a JSON key.
func startsJSONKey(previous byte) bool {
	switch previous {
	case '{', '[', ',', ' ', '\t', '\n', '\r':
		return true
	}
	return false
}

// holdFrom reports start unless the unresolved fragment is so large that carrying it
// over costs more than writing it as-is.
func holdFrom(payload []byte, start int) int {
	if len(payload)-start > maxResponseModelHold {
		return -1
	}
	return start
}
