package claude

import (
	"strings"
	"unicode/utf16"
	"unicode/utf8"
)

type customInputState int

const (
	customStateInitial customInputState = iota
	customStateInObject
	customStateInKey
	customStateAfterKey
	customStateBeforeValue
	customStateInTargetValue
	customStateInTargetValueEscape
	customStateInTargetValueUnicode
	customStateInIgnoredValue
	customStateInIgnoredString
	customStateInIgnoredStringEscape
	customStateDone
	customStateFailed
)

// customInputStreamer 针对 {"input":"<raw string>"} schema 做字节级增量解析，
// 每次 Feed 返回新解析出的 raw string 字符，用于发 custom_tool_call_input.delta 流事件。
// 仅处理我们自己定义的 schema（custom tool 降级为单 input 字段），不通用 JSON 解析；
// 但状态机是 token-aware 的：能跳过 string/object/array value，避免 value 内的 "input" 误触发。
type customInputStreamer struct {
	state                customInputState
	pending              strings.Builder
	finishedRaw          string
	parsed               bool
	currentKey           strings.Builder
	currentKeyIsInput    bool
	ignoredNesting       int
	unicodeHex           []byte
	pendingHighSurrogate rune
	scanned              int
	maxScan              int
	maxInputBytes        int
}

const (
	defaultCustomMaxScanBytes  = 4 * 1024 * 1024
	defaultCustomMaxInputBytes = 1 * 1024 * 1024
)

func newCustomInputStreamer() *customInputStreamer {
	return &customInputStreamer{
		state:         customStateInitial,
		maxScan:       defaultCustomMaxScanBytes,
		maxInputBytes: defaultCustomMaxInputBytes,
	}
}

// Feed 增量喂入 partial_json，返回新解析出的 input raw string 字符。
// Parsed/Failed 反映当前状态机进度，调用方根据其决定是否走 fallback。
func (p *customInputStreamer) Feed(chunk string) string {
	if chunk == "" || p.state == customStateDone || p.state == customStateFailed {
		return ""
	}
	var out strings.Builder
	for i := 0; i < len(chunk); i++ {
		b := chunk[i]
		p.scanned++
		if p.scanned > p.maxScan {
			p.state = customStateFailed
			return out.String()
		}
		if p.pending.Len() > p.maxInputBytes {
			p.state = customStateFailed
			return out.String()
		}
		p.step(b, &out)
		if p.state == customStateDone || p.state == customStateFailed {
			break
		}
	}
	return out.String()
}

func (p *customInputStreamer) step(b byte, out *strings.Builder) {
	switch p.state {
	case customStateInitial:
		switch {
		case isJSONWhitespace(b):
		case b == '{':
			p.state = customStateInObject
		default:
			p.state = customStateFailed
		}
	case customStateInObject:
		switch {
		case isJSONWhitespace(b) || b == ',':
		case b == '}':
			p.state = customStateDone
		case b == '"':
			p.currentKey.Reset()
			p.state = customStateInKey
		default:
			p.state = customStateFailed
		}
	case customStateInKey:
		if b == '"' {
			p.currentKeyIsInput = p.currentKey.String() == "input"
			p.state = customStateAfterKey
		} else {
			p.currentKey.WriteByte(b)
		}
	case customStateAfterKey:
		switch {
		case isJSONWhitespace(b):
		case b == ':':
			p.state = customStateBeforeValue
		default:
			p.state = customStateFailed
		}
	case customStateBeforeValue:
		switch {
		case isJSONWhitespace(b):
		case b == '"':
			if p.currentKeyIsInput {
				p.state = customStateInTargetValue
			} else {
				p.state = customStateInIgnoredString
			}
		case b == '{' || b == '[':
			if p.currentKeyIsInput {
				p.state = customStateFailed
				return
			}
			p.ignoredNesting = 1
			p.state = customStateInIgnoredValue
		default:
			if p.currentKeyIsInput {
				p.state = customStateFailed
				return
			}
			p.state = customStateInIgnoredValue
		}
	case customStateInTargetValue:
		switch b {
		case '"':
			p.finishedRaw = p.pending.String()
			p.parsed = true
			p.state = customStateDone
		case '\\':
			p.state = customStateInTargetValueEscape
		default:
			out.WriteByte(b)
			p.pending.WriteByte(b)
		}
	case customStateInTargetValueEscape:
		switch b {
		case 'u':
			p.state = customStateInTargetValueUnicode
			p.unicodeHex = p.unicodeHex[:0]
		case '"', '\\', '/':
			out.WriteByte(b)
			p.pending.WriteByte(b)
			p.state = customStateInTargetValue
		case 'b':
			p.writeRune('\b', out)
			p.state = customStateInTargetValue
		case 'f':
			p.writeRune('\f', out)
			p.state = customStateInTargetValue
		case 'n':
			p.writeRune('\n', out)
			p.state = customStateInTargetValue
		case 'r':
			p.writeRune('\r', out)
			p.state = customStateInTargetValue
		case 't':
			p.writeRune('\t', out)
			p.state = customStateInTargetValue
		default:
			out.WriteByte(b)
			p.pending.WriteByte(b)
			p.state = customStateInTargetValue
		}
	case customStateInTargetValueUnicode:
		p.unicodeHex = append(p.unicodeHex, b)
		if len(p.unicodeHex) == 4 {
			r := decodeHexQuad(p.unicodeHex)
			p.unicodeHex = p.unicodeHex[:0]
			if utf16.IsSurrogate(r) {
				if p.pendingHighSurrogate == 0 && r >= 0xD800 && r <= 0xDBFF {
					p.pendingHighSurrogate = r
				} else if p.pendingHighSurrogate != 0 && r >= 0xDC00 && r <= 0xDFFF {
					combined := utf16.DecodeRune(p.pendingHighSurrogate, r)
					p.pendingHighSurrogate = 0
					p.writeRune(combined, out)
				} else {
					p.pendingHighSurrogate = 0
					p.writeRune(utf8.RuneError, out)
				}
			} else {
				if p.pendingHighSurrogate != 0 {
					p.writeRune(utf8.RuneError, out)
					p.pendingHighSurrogate = 0
				}
				p.writeRune(r, out)
			}
			p.state = customStateInTargetValue
		}
	case customStateInIgnoredString:
		switch b {
		case '"':
			if p.ignoredNesting == 0 {
				p.state = customStateInObject
			} else {
				p.state = customStateInIgnoredValue
			}
		case '\\':
			p.state = customStateInIgnoredStringEscape
		}
	case customStateInIgnoredStringEscape:
		p.state = customStateInIgnoredString
	case customStateInIgnoredValue:
		switch b {
		case '{', '[':
			p.ignoredNesting++
		case '}', ']':
			p.ignoredNesting--
			if p.ignoredNesting <= 0 {
				p.state = customStateInObject
				p.ignoredNesting = 0
			}
		case '"':
			p.state = customStateInIgnoredString
		}
	}
}

func (p *customInputStreamer) writeRune(r rune, out *strings.Builder) {
	var buf [utf8.UTFMax]byte
	n := utf8.EncodeRune(buf[:], r)
	out.Write(buf[:n])
	p.pending.Write(buf[:n])
}

// FinalInput 返回完整解析出的 input 字符串。
// Parsed=true 时返回 finishedRaw；否则返回 pending，让 truncated 已 emit 的字节不丢。
func (p *customInputStreamer) FinalInput() string {
	if p.parsed {
		return p.finishedRaw
	}
	return p.pending.String()
}

func (p *customInputStreamer) Parsed() bool { return p.parsed }
func (p *customInputStreamer) Failed() bool { return p.state == customStateFailed }

func isJSONWhitespace(b byte) bool {
	return b == ' ' || b == '\t' || b == '\n' || b == '\r'
}

func decodeHexQuad(hex []byte) rune {
	r := rune(0)
	for _, c := range hex {
		r <<= 4
		switch {
		case c >= '0' && c <= '9':
			r |= rune(c - '0')
		case c >= 'a' && c <= 'f':
			r |= rune(c-'a') + 10
		case c >= 'A' && c <= 'F':
			r |= rune(c-'A') + 10
		default:
			return utf8.RuneError
		}
	}
	return r
}
