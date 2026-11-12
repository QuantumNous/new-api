package requestpatch

import (
	"net/http"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func decode(t *testing.T, text string) []Effect {
	t.Helper()
	effects, err := DecodeEffects([]byte(text))
	require.NoError(t, err)
	return effects
}

func TestApplyJSONPatchOperations(t *testing.T) {
	body := []byte(`{"b":1,"a":{"x":[1,2,3]},"long":12345678901234567890,"text":"é"}`)
	effects := decode(t, `[{"type":"json.patch","ops":[
		{"op":"test","path":"/a/x/1","value":2.0},
		{"op":"add","path":"/a/x/-","value":4},
		{"op":"add","path":"/a/x/0","value":0},
		{"op":"replace","path":"/b","value":{"nested":true}},
		{"op":"remove","path":"/a/x/1"},
		{"op":"copy","from":"/b","path":"/c"},
		{"op":"move","from":"/c/nested","path":"/d"},
		{"op":"add","path":"/slash~1name","value":"s"},
		{"op":"add","path":"/tilde~0name","value":"t"}
	]}]`)

	patched, _, err := Apply(body, http.Header{}, effects, nil)

	require.NoError(t, err)
	assert.Equal(t, `{"b":{"nested":true},"a":{"x":[0,2,3,4]},"long":12345678901234567890,"text":"é","c":{},"d":true,"slash/name":"s","tilde~name":"t"}`, string(patched))
}

// The body is written from its parsed text, so a patch changes only what it
// addresses: numbers keep their digits and members keep their order.
func TestApplyKeepsUntouchedTextExactly(t *testing.T) {
	body := []byte(`{"z":1.10,"y":1e3,"x":"a\/b"}`)
	patched, _, err := Apply(body, nil, decode(t, `[{"type":"json.patch","ops":[{"op":"add","path":"/w","value":1}]}]`), nil)
	require.NoError(t, err)
	assert.Equal(t, `{"z":1.10,"y":1e3,"x":"a\/b","w":1}`, string(patched))
}

func TestApplyFailuresAreAtomic(t *testing.T) {
	body := []byte(`{"a":1}`)
	header := http.Header{"X-Keep": {"1"}}
	for name, text := range map[string]string{
		"failed test":        `[{"type":"header.patch","set":{"X-New":"1"}},{"type":"json.patch","ops":[{"op":"add","path":"/b","value":2},{"op":"test","path":"/a","value":2}]}]`,
		"missing member":     `[{"type":"json.patch","ops":[{"op":"remove","path":"/missing"}]}]`,
		"replace missing":    `[{"type":"json.patch","ops":[{"op":"replace","path":"/missing","value":1}]}]`,
		"array out of range": `[{"type":"json.patch","ops":[{"op":"add","path":"/list","value":[]},{"op":"add","path":"/list/1","value":1}]}]`,
		"leading zero":       `[{"type":"json.patch","ops":[{"op":"add","path":"/list","value":[1]},{"op":"remove","path":"/list/00"}]}]`,
		"bad escape":         `[{"type":"json.patch","ops":[{"op":"remove","path":"/a~2"}]}]`,
		"no leading slash":   `[{"type":"json.patch","ops":[{"op":"remove","path":"a"}]}]`,
		"remove document":    `[{"type":"json.patch","ops":[{"op":"remove","path":""}]}]`,
		"move into itself":   `[{"type":"json.patch","ops":[{"op":"move","from":"/a","path":"/a/b"}]}]`,
		"protected header":   `[{"type":"json.patch","ops":[{"op":"add","path":"/b","value":2}]},{"type":"header.patch","set":{"Authorization":"x"}}]`,
	} {
		t.Run(name, func(t *testing.T) {
			effects := decode(t, text)
			patched, patchedHeader, err := Apply(body, header, effects, nil)
			require.Error(t, err)
			assert.Nil(t, patched)
			assert.Nil(t, patchedHeader)
			assert.Equal(t, `{"a":1}`, string(body))
			assert.Equal(t, http.Header{"X-Keep": {"1"}}, header)
		})
	}
}

func TestApplyHeaderPatch(t *testing.T) {
	header := http.Header{"X-Remove": {"1"}, "X-Keep": {"1"}}

	body, patched, err := Apply(nil, header, decode(t, `[{"type":"header.patch","set":{"X-Set":"yes"},"remove":["x-remove"]}]`), nil)

	require.NoError(t, err)
	assert.Nil(t, body)
	assert.Equal(t, http.Header{"X-Keep": {"1"}, "X-Set": {"yes"}}, patched)
	assert.Equal(t, "1", header.Get("X-Remove"), "the input header stays as it was")
}

func TestHeaderPatchRejectsProtectedHeaders(t *testing.T) {
	for _, name := range []string{
		"Authorization", "authorization", "Proxy-Authorization", "Cookie", "Host", "Content-Length", "Content-Type",
		"Content-Encoding", "Connection", "Keep-Alive", "Proxy-Connection", "Proxy-Authenticate", "TE", "Trailer",
		"Transfer-Encoding", "Upgrade",
	} {
		t.Run(name, func(t *testing.T) {
			_, _, err := Apply(nil, http.Header{}, []Effect{{Type: EffectHeaderPatch, Set: map[string]string{name: "x"}}}, nil)
			require.ErrorContains(t, err, "is protected")
			_, _, err = Apply(nil, http.Header{}, []Effect{{Type: EffectHeaderPatch, Remove: []string{name}}}, nil)
			require.ErrorContains(t, err, "is protected")
		})
	}
}

func TestHeaderPatchHonorsCallerProtection(t *testing.T) {
	protected := func(name string) bool { return name == "X-Credential" }
	_, _, err := Apply(nil, http.Header{}, []Effect{{Type: EffectHeaderPatch, Set: map[string]string{"X-Credential": "x"}}}, protected)
	require.ErrorContains(t, err, "is protected")
	_, patched, err := Apply(nil, http.Header{}, []Effect{{Type: EffectHeaderPatch, Set: map[string]string{"X-Other": "x"}}}, protected)
	require.NoError(t, err)
	assert.Equal(t, "x", patched.Get("X-Other"))
}

func TestHeaderPatchRejectsInjection(t *testing.T) {
	_, _, err := Apply(nil, http.Header{}, []Effect{{Type: EffectHeaderPatch, Set: map[string]string{"X-A": "a\r\nX-B: b"}}}, nil)
	require.ErrorContains(t, err, "invalid or oversized")
	_, _, err = Apply(nil, http.Header{}, []Effect{{Type: EffectHeaderPatch, Set: map[string]string{"X A": "a"}}}, nil)
	require.ErrorContains(t, err, "is invalid")
}

func TestDecodeEffectsRejectsMalformedEffects(t *testing.T) {
	for name, text := range map[string]string{
		"not an array":    `{}`,
		"unknown type":    `[{"type":"body.replace"}]`,
		"unknown member":  `[{"type":"json.patch","ops":[],"extra":1}]`,
		"missing ops":     `[{"type":"json.patch"}]`,
		"unknown op":      `[{"type":"json.patch","ops":[{"op":"merge","path":"/a"}]}]`,
		"op extra member": `[{"type":"json.patch","ops":[{"op":"remove","path":"/a","value":1}]}]`,
		"missing value":   `[{"type":"json.patch","ops":[{"op":"add","path":"/a"}]}]`,
		"missing from":    `[{"type":"json.patch","ops":[{"op":"move","path":"/a"}]}]`,
		"set not strings": `[{"type":"header.patch","set":{"X":1}}]`,
		"remove a string": `[{"type":"header.patch","remove":"X"}]`,
	} {
		t.Run(name, func(t *testing.T) {
			_, err := DecodeEffects([]byte(text))
			require.Error(t, err)
		})
	}
}

func TestDecodeTransformEffects(t *testing.T) {
	outbound := []string{EffectJSONPatch, EffectHeaderPatch, EffectMediaReencode}
	for name, tc := range map[string]struct {
		text    string
		allowed []string
		want    []Effect
		message string
	}{
		"reasoning.set": {
			text: `[{"type":"reasoning.set","effort":"high"},{"type":"reasoning.set","effort":"none","override":true}]`, allowed: []string{EffectReasoningSet},
			want: []Effect{{Type: EffectReasoningSet, Effort: "high"}, {Type: EffectReasoningSet, Effort: "none", Override: true}},
		},
		"media.reencode": {
			text: `[{"type":"media.reencode","media":0,"format":"auto"},{"type":"media.reencode","media":2,"format":"jpeg","quality":85,"maxSide":2048},{"type":"media.reencode","media":3,"format":"webp","maxSide":1024}]`, allowed: outbound,
			want: []Effect{{Type: EffectMediaReencode, Format: "auto"}, {Type: EffectMediaReencode, Media: 2, Format: "jpeg", Quality: 85, MaxSide: 2048}, {Type: EffectMediaReencode, Media: 3, Format: "webp", MaxSide: 1024}},
		},
		"patches decode as before": {
			text: `[{"type":"header.patch","set":{"X-A":"1"}},{"type":"json.patch","ops":[{"op":"remove","path":"/a"}]}]`, allowed: outbound,
			want: []Effect{{Type: EffectHeaderPatch, Set: map[string]string{"X-A": "1"}}, {Type: EffectJSONPatch, Ops: []Operation{{Op: "remove", Path: "/a"}}}},
		},
		"no effect allowed, none given": {text: `[]`, want: []Effect{}},
		"type not allowed":              {text: `[{"type":"reasoning.set","effort":"high"}]`, allowed: outbound, message: `effects[0].type "reasoning.set" is not supported`},
		"nothing allowed":               {text: `[{"type":"header.patch"}]`, message: `effects[0].type "header.patch" is not supported`},
		"effort missing":                {text: `[{"type":"reasoning.set"}]`, allowed: []string{EffectReasoningSet}, message: "effects[0].effort must be a non-empty string of at most 32 characters"},
		"effort empty":                  {text: `[{"type":"reasoning.set","effort":""}]`, allowed: []string{EffectReasoningSet}, message: "effects[0].effort must be a non-empty string"},
		"effort too long":               {text: `[{"type":"reasoning.set","effort":"` + strings.Repeat("h", 33) + `"}]`, allowed: []string{EffectReasoningSet}, message: "effects[0].effort must be a non-empty string"},
		"override not a boolean":        {text: `[{"type":"reasoning.set","effort":"high","override":"yes"}]`, allowed: []string{EffectReasoningSet}, message: "effects[0].override must be a boolean"},
		"reasoning unknown member":      {text: `[{"type":"reasoning.set","effort":"high","budget":1}]`, allowed: []string{EffectReasoningSet}, message: `effects[0] has unknown member "budget"`},
		"media missing":                 {text: `[{"type":"media.reencode","format":"png"}]`, allowed: outbound, message: "effects[0].media must be a non-negative integer"},
		"media negative":                {text: `[{"type":"media.reencode","media":-1,"format":"png"}]`, allowed: outbound, message: "effects[0].media must be a non-negative integer"},
		"media fractional":              {text: `[{"type":"media.reencode","media":1.5,"format":"png"}]`, allowed: outbound, message: "effects[0].media must be a non-negative integer"},
		"format unknown":                {text: `[{"type":"media.reencode","media":0,"format":"gif"}]`, allowed: outbound, message: "effects[0].format must be auto, jpeg, png or webp"},
		"quality with webp":             {text: `[{"type":"media.reencode","media":0,"format":"webp","quality":80}]`, allowed: outbound, message: "effects[0].quality does not apply to webp"},
		"quality below 1":               {text: `[{"type":"media.reencode","media":0,"format":"jpeg","quality":0}]`, allowed: outbound, message: "effects[0].quality must be an integer from 1 to 100"},
		"quality above 100":             {text: `[{"type":"media.reencode","media":0,"format":"jpeg","quality":101}]`, allowed: outbound, message: "effects[0].quality must be an integer from 1 to 100"},
		"maxSide below 16":              {text: `[{"type":"media.reencode","media":0,"format":"png","maxSide":15}]`, allowed: outbound, message: "effects[0].maxSide must be an integer from 16 to 16384"},
		"maxSide above 16384":           {text: `[{"type":"media.reencode","media":0,"format":"png","maxSide":16385}]`, allowed: outbound, message: "effects[0].maxSide must be an integer from 16 to 16384"},
		"media unknown member":          {text: `[{"type":"media.reencode","media":0,"format":"png","width":10}]`, allowed: outbound, message: `effects[0] has unknown member "width"`},
	} {
		t.Run(name, func(t *testing.T) {
			effects, err := DecodeTransformEffects([]byte(tc.text), tc.allowed...)
			if tc.message != "" {
				require.ErrorContains(t, err, tc.message)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.want, effects)
		})
	}
	_, err := DecodeEffects([]byte(`[{"type":"reasoning.set","effort":"high"}]`))
	require.ErrorContains(t, err, "is not supported", "prepareRequest keeps json.patch and header.patch only")
}

func TestEffectLimits(t *testing.T) {
	many := func(count int, item string) string {
		text := "["
		for index := range count {
			if index > 0 {
				text += ","
			}
			text += item
		}
		return text + "]"
	}
	_, err := DecodeEffects([]byte(many(MaxEffects, `{"type":"header.patch"}`)))
	require.NoError(t, err)
	_, err = DecodeEffects([]byte(many(MaxEffects+1, `{"type":"header.patch"}`)))
	require.ErrorContains(t, err, "must not exceed")
	operation := `{"op":"remove","path":"/a"}`
	_, err = DecodeEffects([]byte(`[{"type":"json.patch","ops":` + many(MaxOperations, operation) + `}]`))
	require.NoError(t, err)
	_, err = DecodeEffects([]byte(`[{"type":"json.patch","ops":` + many(MaxOperations+1, operation) + `}]`))
	require.ErrorContains(t, err, "must not exceed")
}

func TestJSONPatchNeedsJSONBody(t *testing.T) {
	_, _, err := Apply([]byte("plain text"), nil, decode(t, `[{"type":"json.patch","ops":[{"op":"add","path":"/a","value":1}]}]`), nil)
	require.ErrorContains(t, err, "needs a JSON body")
}

// Each copy of the root doubles the document: the patch fails once the
// document would pass the request body limit, before it is built.
func TestCopyStopsAtTheBodyLimit(t *testing.T) {
	limit := constant.MaxRequestBodyMB
	constant.MaxRequestBodyMB = 1
	t.Cleanup(func() { constant.MaxRequestBodyMB = limit })
	body := []byte(`{"a":"` + strings.Repeat("x", 1000) + `"}`)
	ops := make([]string, 0, MaxOperations)
	for index := range MaxOperations {
		ops = append(ops, `{"op":"copy","from":"","path":"/k`+strconv.Itoa(index)+`"}`)
	}
	_, _, err := Apply(body, nil, decode(t, `[{"type":"json.patch","ops":[`+strings.Join(ops, ",")+`]}]`), nil)
	require.ErrorIs(t, err, common.ErrRequestBodyTooLarge)

	patched, _, err := Apply(body, nil, decode(t, `[{"type":"json.patch","ops":[`+strings.Join(ops[:9], ",")+`]}]`), nil)
	require.NoError(t, err)
	assert.Greater(t, len(patched), 500_000)
}
