package claude

import (
	"strings"
	"testing"
)

type streamCase struct {
	name      string
	chunks    []string
	wantDelta string
	wantFinal string
}

func TestCustomInputStreamerCases(t *testing.T) {
	cases := []streamCase{
		{
			name:      "simple split",
			chunks:    []string{`{"input":"abc`, `def"}`},
			wantDelta: "abcdef",
			wantFinal: "abcdef",
		},
		{
			name:      "single chunk",
			chunks:    []string{`{"input":"hello world"}`},
			wantDelta: "hello world",
			wantFinal: "hello world",
		},
		{
			name:      "escape quote split mid-escape",
			chunks:    []string{`{"input":"he`, `\"`, `llo"}`},
			wantDelta: `he"llo`,
			wantFinal: `he"llo`,
		},
		{
			name:      "newline escape",
			chunks:    []string{`{"input":"line1\n`, `line2"}`},
			wantDelta: "line1\nline2",
			wantFinal: "line1\nline2",
		},
		{
			name:      "unicode escape split across chunks",
			chunks:    []string{`{"input":"\u00`, `e9"}`},
			wantDelta: "é",
			wantFinal: "é",
		},
		{
			name:      "backslash escape",
			chunks:    []string{`{"input":"a\\b"}`},
			wantDelta: `a\b`,
			wantFinal: `a\b`,
		},
		{
			name:      "whitespace between tokens",
			chunks:    []string{`{ "input" : "x" }`},
			wantDelta: "x",
			wantFinal: "x",
		},
		{
			name:      "truncated mid-string returns partial",
			chunks:    []string{`{"input":"abcd`},
			wantDelta: "abcd",
			wantFinal: "abcd",
		},
		{
			name:      "lark grammar style patch text with newlines",
			chunks:    []string{`{"input":"*** Begin Patch\n`, `*** End Patch\n"}`},
			wantDelta: "*** Begin Patch\n*** End Patch\n",
			wantFinal: "*** Begin Patch\n*** End Patch\n",
		},
		{
			name:      "byte-by-byte feed",
			chunks:    splitToBytes(`{"input":"hi"}`),
			wantDelta: "hi",
			wantFinal: "hi",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			s := newCustomInputStreamer()
			got := ""
			for _, c := range tc.chunks {
				got += s.Feed(c)
			}
			if got != tc.wantDelta {
				t.Errorf("incremental delta=%q want %q", got, tc.wantDelta)
			}
			if final := s.FinalInput(); final != tc.wantFinal {
				t.Errorf("final=%q want %q", final, tc.wantFinal)
			}
		})
	}
}

func splitToBytes(s string) []string {
	parts := make([]string, len(s))
	for i := 0; i < len(s); i++ {
		parts[i] = string(s[i])
	}
	return parts
}

func TestCustomInputStreamerSkipsValueInputMention(t *testing.T) {
	// value 里出现 "input" 字面值不应误触发
	s := newCustomInputStreamer()
	got := s.Feed(`{"foo":"this contains \"input\" word","input":"real"}`)
	if got != "real" {
		t.Errorf("got=%q want real", got)
	}
	if !s.Parsed() {
		t.Error("should be parsed")
	}
}

func TestCustomInputStreamerSkipsKeyContainingInputSubstring(t *testing.T) {
	// key "user_input" 不能误匹配 "input"
	s := newCustomInputStreamer()
	got := s.Feed(`{"user_input":"wrong","input":"correct"}`)
	if got != "correct" {
		t.Errorf("got=%q want correct", got)
	}
}

func TestCustomInputStreamerSkipsNestedObject(t *testing.T) {
	s := newCustomInputStreamer()
	got := s.Feed(`{"meta":{"input":"nested wrong"},"input":"real"}`)
	if got != "real" {
		t.Errorf("got=%q want real, nested 'input' inside meta should be skipped", got)
	}
}

func TestCustomInputStreamerSkipsArrayValue(t *testing.T) {
	s := newCustomInputStreamer()
	got := s.Feed(`{"arr":["input","x"],"input":"real"}`)
	if got != "real" {
		t.Errorf("got=%q want real", got)
	}
}

func TestCustomInputStreamerSurrogatePair(t *testing.T) {
	// 😀 = U+1F600 = \uD83D\uDE00
	s := newCustomInputStreamer()
	got := s.Feed(`{"input":"\uD83D\uDE00"}`)
	if got != "😀" {
		t.Errorf("got=%q (% x) want 😀", got, []byte(got))
	}
}

func TestCustomInputStreamerSurrogatePairAcrossChunks(t *testing.T) {
	s := newCustomInputStreamer()
	got := s.Feed(`{"input":"\uD83D`) + s.Feed(`\uDE00"}`)
	if got != "😀" {
		t.Errorf("got=%q want 😀", got)
	}
}

func TestCustomInputStreamerNonStringInputFails(t *testing.T) {
	for _, tc := range []string{
		`{"input":null}`,
		`{"input":123}`,
		`{"input":{"x":"y"}}`,
		`{"input":["a","b"]}`,
		`{"input":true}`,
	} {
		t.Run(tc, func(t *testing.T) {
			s := newCustomInputStreamer()
			s.Feed(tc)
			if s.Parsed() {
				t.Error("non-string input should NOT be parsed (caller falls back to raw)")
			}
		})
	}
}

func TestCustomInputStreamerScanLimit(t *testing.T) {
	s := newCustomInputStreamer()
	s.maxScan = 10
	got := s.Feed(`{"input":"this is more than 10 bytes of scanned data"}`)
	if !s.Failed() {
		t.Errorf("should fail past max scan, parsed=%v failed=%v got=%q", s.Parsed(), s.Failed(), got)
	}
}

func TestCustomInputStreamerInputSizeLimit(t *testing.T) {
	s := newCustomInputStreamer()
	s.maxInputBytes = 10
	huge := strings.Repeat("a", 100)
	s.Feed(`{"input":"` + huge + `"}`)
	if !s.Failed() {
		t.Error("should fail past max input size")
	}
}

func TestExtractCustomToolInputDistinguishesStates(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{"string input", `{"input":"hello"}`, "hello"},
		{"empty string input", `{"input":""}`, ""},
		{"missing key returns raw", `{"text":"x"}`, `{"text":"x"}`},
		{"non-string returns raw", `{"input":123}`, `{"input":123}`},
		{"array input returns raw", `{"input":["a"]}`, `{"input":["a"]}`},
		{"object input returns raw", `{"input":{"k":"v"}}`, `{"input":{"k":"v"}}`},
		{"invalid json returns raw", `not json`, `not json`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := extractCustomToolInput(tc.in)
			if got != tc.want {
				t.Errorf("got=%q want=%q", got, tc.want)
			}
		})
	}
}
