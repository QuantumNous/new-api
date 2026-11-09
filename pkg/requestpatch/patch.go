// Package requestpatch applies the request changes a plugin returns as
// effects: json.patch, an RFC 6902 JSON Patch on the JSON body, and
// header.patch on the business headers. Plugins never edit a request
// themselves; the host checks every effect and applies all of them or none.
package requestpatch

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"slices"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/tidwall/gjson"
	"golang.org/x/net/http/httpguts"
)

const (
	EffectJSONPatch   = "json.patch"
	EffectHeaderPatch = "header.patch"
	// EffectReasoningSet, EffectMediaReencode and EffectMediaText are
	// request processing effects; the host applies them itself.
	EffectReasoningSet  = "reasoning.set"
	EffectMediaReencode = "media.reencode"
	EffectMediaText     = "media.text"
)

// Bounds on one effects list.
const (
	MaxEffects    = 32
	MaxOperations = 512
	MaxHeaders    = 64
	maxDepth      = 128
	// maxEffortLength bounds a reasoning.set effort; the host maps the value.
	maxEffortLength = 32
	// MaxMediaTextBytes bounds the UTF-8 text of a media.text effect.
	MaxMediaTextBytes = 1 << 20
)

// Effect is one change a plugin asks the host to make.
type Effect struct {
	Type string
	// Ops is the JSON Patch of a json.patch effect.
	Ops []Operation
	// Set and Remove are the header changes of a header.patch effect.
	Set    map[string]string
	Remove []string
	// Effort and Override are a reasoning.set effect: Override replaces an
	// effort the client or a model modifier already set.
	Effort   string
	Override bool
	// Media, Format, Quality and MaxSide are a media.reencode effect: the
	// media index, the target format and the optional quality and longest
	// side, 0 when absent. A media.text effect has Media and Text, the new
	// content of a text attachment.
	Media   int
	Format  string
	Quality int
	MaxSide int
	Text    string
}

// Operation is one RFC 6902 operation.
type Operation struct {
	Op    string
	Path  string
	From  string
	Value json.RawMessage
}

// DecodeEffects reads the effects array of prepareRequest from its JSON text:
// json.patch and header.patch. Unknown members are rejected.
func DecodeEffects(data []byte) ([]Effect, error) {
	return decodeEffects(data, EffectJSONPatch, EffectHeaderPatch)
}

// DecodeTransformEffects reads the effects array of a request processing
// hook. Types outside allowed are rejected, and each effect's members and
// bounds are checked.
func DecodeTransformEffects(data []byte, allowed ...string) ([]Effect, error) {
	return decodeEffects(data, allowed...)
}

func decodeEffects(data []byte, allowed ...string) ([]Effect, error) {
	var items []json.RawMessage
	if err := common.Unmarshal(data, &items); err != nil {
		return nil, fmt.Errorf("effects must be an array")
	}
	if len(items) > MaxEffects {
		return nil, fmt.Errorf("effects must not exceed %d entries", MaxEffects)
	}
	effects := make([]Effect, 0, len(items))
	operations := 0
	for index, item := range items {
		members, err := objectMembers(item, fmt.Sprintf("effects[%d]", index))
		if err != nil {
			return nil, err
		}
		var effect Effect
		if err = decodeString(members["type"], &effect.Type); err != nil || effect.Type == "" {
			return nil, fmt.Errorf("effects[%d].type must be a string", index)
		}
		if !slices.Contains(allowed, effect.Type) {
			return nil, fmt.Errorf("effects[%d].type %q is not supported", index, effect.Type)
		}
		switch effect.Type {
		case EffectJSONPatch:
			if err = onlyMembers(members, fmt.Sprintf("effects[%d]", index), "type", "ops"); err != nil {
				return nil, err
			}
			effect.Ops, err = decodeOperations(members["ops"], index)
			if err != nil {
				return nil, err
			}
			operations += len(effect.Ops)
			if operations > MaxOperations {
				return nil, fmt.Errorf("effects must not exceed %d json.patch operations", MaxOperations)
			}
		case EffectHeaderPatch:
			if err = onlyMembers(members, fmt.Sprintf("effects[%d]", index), "type", "set", "remove"); err != nil {
				return nil, err
			}
			if raw, ok := members["set"]; ok && !isNull(raw) {
				if err = common.Unmarshal(raw, &effect.Set); err != nil {
					return nil, fmt.Errorf("effects[%d].set must map header names to strings", index)
				}
			}
			if raw, ok := members["remove"]; ok && !isNull(raw) {
				if err = common.Unmarshal(raw, &effect.Remove); err != nil {
					return nil, fmt.Errorf("effects[%d].remove must be an array of header names", index)
				}
			}
			if len(effect.Set)+len(effect.Remove) > MaxHeaders {
				return nil, fmt.Errorf("effects[%d] must not change more than %d headers", index, MaxHeaders)
			}
		case EffectReasoningSet:
			if err = onlyMembers(members, fmt.Sprintf("effects[%d]", index), "type", "effort", "override"); err != nil {
				return nil, err
			}
			if err = decodeString(members["effort"], &effect.Effort); err != nil || effect.Effort == "" || len(effect.Effort) > maxEffortLength {
				return nil, fmt.Errorf("effects[%d].effort must be a non-empty string of at most %d characters", index, maxEffortLength)
			}
			if raw, ok := members["override"]; ok && !isNull(raw) {
				if err = common.Unmarshal(raw, &effect.Override); err != nil {
					return nil, fmt.Errorf("effects[%d].override must be a boolean", index)
				}
			}
		case EffectMediaReencode:
			if err = onlyMembers(members, fmt.Sprintf("effects[%d]", index), "type", "media", "format", "quality", "maxSide"); err != nil {
				return nil, err
			}
			if err = decodeInt(members["media"], &effect.Media); err != nil || effect.Media < 0 {
				return nil, fmt.Errorf("effects[%d].media must be a non-negative integer", index)
			}
			if err = decodeString(members["format"], &effect.Format); err != nil || !slices.Contains([]string{"auto", "jpeg", "png", "webp"}, effect.Format) {
				return nil, fmt.Errorf("effects[%d].format must be auto, jpeg, png or webp", index)
			}
			// webp is lossless, so it takes no quality.
			if raw, ok := members["quality"]; ok && !isNull(raw) && effect.Format == "webp" {
				return nil, fmt.Errorf("effects[%d].quality does not apply to webp", index)
			}
			for _, bound := range []struct {
				name      string
				target    *int
				low, high int
			}{{"quality", &effect.Quality, 1, 100}, {"maxSide", &effect.MaxSide, 16, 16384}} {
				raw, ok := members[bound.name]
				if !ok || isNull(raw) {
					continue
				}
				if err = decodeInt(raw, bound.target); err != nil || *bound.target < bound.low || *bound.target > bound.high {
					return nil, fmt.Errorf("effects[%d].%s must be an integer from %d to %d", index, bound.name, bound.low, bound.high)
				}
			}
		case EffectMediaText:
			if err = onlyMembers(members, fmt.Sprintf("effects[%d]", index), "type", "media", "text"); err != nil {
				return nil, err
			}
			if err = decodeInt(members["media"], &effect.Media); err != nil || effect.Media < 0 {
				return nil, fmt.Errorf("effects[%d].media must be a non-negative integer", index)
			}
			if err = decodeString(members["text"], &effect.Text); err != nil {
				return nil, fmt.Errorf("effects[%d].text must be a string", index)
			}
			if len(effect.Text) > MaxMediaTextBytes {
				return nil, fmt.Errorf("effects[%d].text must not exceed %d bytes", index, MaxMediaTextBytes)
			}
		default:
			return nil, fmt.Errorf("effects[%d].type %q is not supported", index, effect.Type)
		}
		effects = append(effects, effect)
	}
	return effects, nil
}

func decodeOperations(data json.RawMessage, effectIndex int) ([]Operation, error) {
	var items []json.RawMessage
	if err := common.Unmarshal(data, &items); err != nil || data == nil {
		return nil, fmt.Errorf("effects[%d].ops must be an array", effectIndex)
	}
	operations := make([]Operation, 0, len(items))
	for index, item := range items {
		subject := fmt.Sprintf("effects[%d].ops[%d]", effectIndex, index)
		members, err := objectMembers(item, subject)
		if err != nil {
			return nil, err
		}
		var operation Operation
		if err = decodeString(members["op"], &operation.Op); err != nil {
			return nil, fmt.Errorf("%s.op must be a string", subject)
		}
		if err = decodeString(members["path"], &operation.Path); err != nil {
			return nil, fmt.Errorf("%s.path must be a string", subject)
		}
		allowed := []string{"op", "path"}
		switch operation.Op {
		case "add", "replace", "test":
			raw, ok := members["value"]
			if !ok {
				return nil, fmt.Errorf("%s.value is required", subject)
			}
			operation.Value = raw
			allowed = append(allowed, "value")
		case "remove":
		case "move", "copy":
			if err = decodeString(members["from"], &operation.From); err != nil {
				return nil, fmt.Errorf("%s.from must be a string", subject)
			}
			allowed = append(allowed, "from")
		default:
			return nil, fmt.Errorf("%s.op %q is not supported", subject, operation.Op)
		}
		if err = onlyMembers(members, subject, allowed...); err != nil {
			return nil, err
		}
		operations = append(operations, operation)
	}
	return operations, nil
}

func objectMembers(data json.RawMessage, subject string) (map[string]json.RawMessage, error) {
	var members map[string]json.RawMessage
	if err := common.Unmarshal(data, &members); err != nil || members == nil {
		return nil, fmt.Errorf("%s must be an object", subject)
	}
	return members, nil
}

func onlyMembers(members map[string]json.RawMessage, subject string, allowed ...string) error {
	for name := range members {
		known := false
		for _, candidate := range allowed {
			if name == candidate {
				known = true
				break
			}
		}
		if !known {
			return fmt.Errorf("%s has unknown member %q", subject, name)
		}
	}
	return nil
}

func decodeString(data json.RawMessage, target *string) error {
	if data == nil {
		return fmt.Errorf("missing")
	}
	return common.Unmarshal(data, target)
}

func decodeInt(data json.RawMessage, target *int) error {
	if data == nil {
		return fmt.Errorf("missing")
	}
	return common.Unmarshal(data, target)
}

func isNull(data json.RawMessage) bool {
	return bytes.Equal(bytes.TrimSpace(data), []byte("null"))
}

// Apply applies effects in order to a copy of body and header and returns
// the copies. protected reports a header that header.patch must not set or
// remove. On any error nothing is applied. A nil body is valid when no
// json.patch effect is present.
func Apply(body []byte, header http.Header, effects []Effect, protected func(name string) bool) ([]byte, http.Header, error) {
	nextHeader := header.Clone()
	if nextHeader == nil {
		nextHeader = http.Header{}
	}
	var document *node
	for index, effect := range effects {
		switch effect.Type {
		case EffectJSONPatch:
			if document == nil {
				parsed, err := parseDocument(body)
				if err != nil {
					return nil, nil, fmt.Errorf("effects[%d]: %w", index, err)
				}
				document = parsed
			}
			patched, err := applyOperations(document, effect.Ops)
			if err != nil {
				return nil, nil, fmt.Errorf("effects[%d]: %w", index, err)
			}
			document = patched
		case EffectHeaderPatch:
			if err := applyHeaderPatch(nextHeader, effect, protected); err != nil {
				return nil, nil, fmt.Errorf("effects[%d]: %w", index, err)
			}
		default:
			return nil, nil, fmt.Errorf("effects[%d].type %q is not supported", index, effect.Type)
		}
	}
	if document == nil {
		return body, nextHeader, nil
	}
	var encoded bytes.Buffer
	encoded.Grow(len(body))
	document.encode(&encoded)
	return encoded.Bytes(), nextHeader, nil
}

// hopByHopHeaders are the RFC 9110 connection-specific headers.
var hopByHopHeaders = map[string]struct{}{
	"connection":          {},
	"keep-alive":          {},
	"proxy-connection":    {},
	"proxy-authenticate":  {},
	"proxy-authorization": {},
	"te":                  {},
	"trailer":             {},
	"transfer-encoding":   {},
	"upgrade":             {},
}

// IsProtectedHeader reports a header no plugin effect may change: the
// credentials, the request framing and the hop-by-hop headers.
func IsProtectedHeader(name string) bool {
	lower := strings.ToLower(strings.TrimSpace(name))
	switch lower {
	case "authorization", "proxy-authorization", "cookie", "host", "content-length", "content-type", "content-encoding":
		return true
	}
	_, hopByHop := hopByHopHeaders[lower]
	return hopByHop
}

func applyHeaderPatch(header http.Header, effect Effect, protected func(name string) bool) error {
	check := func(name string) error {
		trimmed := strings.TrimSpace(name)
		if !httpguts.ValidHeaderFieldName(trimmed) {
			return fmt.Errorf("header name %q is invalid", name)
		}
		if IsProtectedHeader(trimmed) || (protected != nil && protected(trimmed)) {
			return fmt.Errorf("header %q is protected", trimmed)
		}
		return nil
	}
	for _, name := range effect.Remove {
		if err := check(name); err != nil {
			return err
		}
		header.Del(strings.TrimSpace(name))
	}
	for name, value := range effect.Set {
		if err := check(name); err != nil {
			return err
		}
		if !httpguts.ValidHeaderFieldValue(value) || len(value) > 8192 {
			return fmt.Errorf("header %q has an invalid or oversized value", strings.TrimSpace(name))
		}
		header.Set(strings.TrimSpace(name), value)
	}
	return nil
}

// node is a JSON value that keeps object member order and the text of
// every scalar and member name it was parsed from.
type node struct {
	kind    byte // '{', '[' or 0 for a scalar
	keys    []string
	rawKeys []string
	values  []*node
	raw     string
}

func parseDocument(body []byte) (*node, error) {
	if !gjson.ValidBytes(body) {
		return nil, fmt.Errorf("json.patch needs a JSON body")
	}
	return parseNode(gjson.ParseBytes(body), 0)
}

func parseValue(raw json.RawMessage) (*node, error) {
	if !gjson.ValidBytes(raw) {
		return nil, fmt.Errorf("value is not valid JSON")
	}
	return parseNode(gjson.ParseBytes(raw), 0)
}

func parseNode(value gjson.Result, depth int) (*node, error) {
	if depth > maxDepth {
		return nil, fmt.Errorf("JSON nests deeper than %d levels", maxDepth)
	}
	switch {
	case value.IsObject():
		parsed := &node{kind: '{'}
		var err error
		value.ForEach(func(key, member gjson.Result) bool {
			var child *node
			if child, err = parseNode(member, depth+1); err != nil {
				return false
			}
			parsed.keys = append(parsed.keys, key.String())
			parsed.rawKeys = append(parsed.rawKeys, key.Raw)
			parsed.values = append(parsed.values, child)
			return true
		})
		return parsed, err
	case value.IsArray():
		parsed := &node{kind: '['}
		var err error
		value.ForEach(func(_, item gjson.Result) bool {
			var child *node
			if child, err = parseNode(item, depth+1); err != nil {
				return false
			}
			parsed.values = append(parsed.values, child)
			return true
		})
		return parsed, err
	default:
		return &node{raw: strings.TrimSpace(value.Raw)}, nil
	}
}

func (n *node) clone() *node {
	cloned := &node{kind: n.kind, raw: n.raw}
	if n.kind == 0 {
		return cloned
	}
	cloned.keys = append([]string(nil), n.keys...)
	cloned.rawKeys = append([]string(nil), n.rawKeys...)
	cloned.values = make([]*node, len(n.values))
	for index, value := range n.values {
		cloned.values[index] = value.clone()
	}
	return cloned
}

func (n *node) encode(out *bytes.Buffer) {
	switch n.kind {
	case '{':
		out.WriteByte('{')
		for index, value := range n.values {
			if index > 0 {
				out.WriteByte(',')
			}
			out.WriteString(n.rawKeys[index])
			out.WriteByte(':')
			value.encode(out)
		}
		out.WriteByte('}')
	case '[':
		out.WriteByte('[')
		for index, value := range n.values {
			if index > 0 {
				out.WriteByte(',')
			}
			value.encode(out)
		}
		out.WriteByte(']')
	default:
		out.WriteString(n.raw)
	}
}

func (n *node) member(name string) int {
	for index, key := range n.keys {
		if key == name {
			return index
		}
	}
	return -1
}

func (n *node) setMember(name string, value *node) {
	if index := n.member(name); index >= 0 {
		n.values[index] = value
		return
	}
	encodedName, _ := common.Marshal(name)
	n.keys = append(n.keys, name)
	n.rawKeys = append(n.rawKeys, string(encodedName))
	n.values = append(n.values, value)
}

func (n *node) removeAt(index int) {
	if n.kind == '{' {
		n.keys = append(n.keys[:index], n.keys[index+1:]...)
		n.rawKeys = append(n.rawKeys[:index], n.rawKeys[index+1:]...)
	}
	n.values = append(n.values[:index], n.values[index+1:]...)
}

// parsePointer splits an RFC 6901 JSON Pointer into reference tokens.
func parsePointer(pointer string) ([]string, error) {
	if pointer == "" {
		return nil, nil
	}
	if !strings.HasPrefix(pointer, "/") {
		return nil, fmt.Errorf("path %q must be empty or start with /", pointer)
	}
	tokens := strings.Split(pointer[1:], "/")
	for index, token := range tokens {
		for position := 0; position < len(token); position++ {
			if token[position] != '~' {
				continue
			}
			if position+1 >= len(token) || (token[position+1] != '0' && token[position+1] != '1') {
				return nil, fmt.Errorf("path %q has an invalid ~ escape", pointer)
			}
		}
		tokens[index] = strings.ReplaceAll(strings.ReplaceAll(token, "~1", "/"), "~0", "~")
	}
	return tokens, nil
}

// arrayIndex reads an RFC 6901 array index: digits without a leading zero.
func arrayIndex(token string, length int, allowEnd bool) (int, error) {
	if token == "-" && allowEnd {
		return length, nil
	}
	if token == "" || (len(token) > 1 && token[0] == '0') {
		return 0, fmt.Errorf("array index %q is invalid", token)
	}
	for _, character := range token {
		if character < '0' || character > '9' {
			return 0, fmt.Errorf("array index %q is invalid", token)
		}
	}
	index, err := strconv.Atoi(token)
	if err != nil {
		return 0, fmt.Errorf("array index %q is invalid", token)
	}
	limit := length - 1
	if allowEnd {
		limit = length
	}
	if index > limit {
		return 0, fmt.Errorf("array index %d is out of range", index)
	}
	return index, nil
}

// resolve returns the value at tokens.
func resolve(root *node, tokens []string) (*node, error) {
	current := root
	for _, token := range tokens {
		switch current.kind {
		case '{':
			index := current.member(token)
			if index < 0 {
				return nil, fmt.Errorf("member %q does not exist", token)
			}
			current = current.values[index]
		case '[':
			index, err := arrayIndex(token, len(current.values), false)
			if err != nil {
				return nil, err
			}
			current = current.values[index]
		default:
			return nil, fmt.Errorf("cannot reference %q inside a scalar", token)
		}
	}
	return current, nil
}

func applyOperations(document *node, operations []Operation) (*node, error) {
	root := document.clone()
	for index, operation := range operations {
		var err error
		root, err = applyOperation(root, operation)
		if err != nil {
			return nil, fmt.Errorf("ops[%d] %s %s: %w", index, operation.Op, operation.Path, err)
		}
	}
	return root, nil
}

func applyOperation(root *node, operation Operation) (*node, error) {
	tokens, err := parsePointer(operation.Path)
	if err != nil {
		return nil, err
	}
	switch operation.Op {
	case "add":
		value, err := parseValue(operation.Value)
		if err != nil {
			return nil, err
		}
		return add(root, tokens, value)
	case "remove":
		if len(tokens) == 0 {
			return nil, fmt.Errorf("cannot remove the whole document")
		}
		_, err = remove(root, tokens)
		return root, err
	case "replace":
		value, err := parseValue(operation.Value)
		if err != nil {
			return nil, err
		}
		if len(tokens) == 0 {
			return value, nil
		}
		parent, err := resolve(root, tokens[:len(tokens)-1])
		if err != nil {
			return nil, err
		}
		last := tokens[len(tokens)-1]
		switch parent.kind {
		case '{':
			index := parent.member(last)
			if index < 0 {
				return nil, fmt.Errorf("member %q does not exist", last)
			}
			parent.values[index] = value
		case '[':
			index, err := arrayIndex(last, len(parent.values), false)
			if err != nil {
				return nil, err
			}
			parent.values[index] = value
		default:
			return nil, fmt.Errorf("cannot replace %q inside a scalar", last)
		}
		return root, nil
	case "move":
		fromTokens, err := parsePointer(operation.From)
		if err != nil {
			return nil, err
		}
		if isProperPrefix(fromTokens, tokens) {
			return nil, fmt.Errorf("cannot move a value into itself")
		}
		if len(fromTokens) == 0 {
			if len(tokens) == 0 {
				return root, nil
			}
			return nil, fmt.Errorf("cannot move the whole document")
		}
		value, err := remove(root, fromTokens)
		if err != nil {
			return nil, err
		}
		return add(root, tokens, value)
	case "copy":
		fromTokens, err := parsePointer(operation.From)
		if err != nil {
			return nil, err
		}
		value, err := resolve(root, fromTokens)
		if err != nil {
			return nil, err
		}
		return add(root, tokens, value.clone())
	case "test":
		expected, err := parseValue(operation.Value)
		if err != nil {
			return nil, err
		}
		actual, err := resolve(root, tokens)
		if err != nil {
			return nil, err
		}
		if !equal(actual, expected) {
			return nil, fmt.Errorf("test failed")
		}
		return root, nil
	}
	return nil, fmt.Errorf("unsupported operation")
}

func isProperPrefix(prefix, tokens []string) bool {
	if len(prefix) >= len(tokens) {
		return false
	}
	for index := range prefix {
		if prefix[index] != tokens[index] {
			return false
		}
	}
	return true
}

func add(root *node, tokens []string, value *node) (*node, error) {
	if len(tokens) == 0 {
		return value, nil
	}
	parent, err := resolve(root, tokens[:len(tokens)-1])
	if err != nil {
		return nil, err
	}
	last := tokens[len(tokens)-1]
	switch parent.kind {
	case '{':
		parent.setMember(last, value)
	case '[':
		index, err := arrayIndex(last, len(parent.values), true)
		if err != nil {
			return nil, err
		}
		parent.values = append(parent.values, nil)
		copy(parent.values[index+1:], parent.values[index:])
		parent.values[index] = value
	default:
		return nil, fmt.Errorf("cannot add %q inside a scalar", last)
	}
	return root, nil
}

func remove(root *node, tokens []string) (*node, error) {
	parent, err := resolve(root, tokens[:len(tokens)-1])
	if err != nil {
		return nil, err
	}
	last := tokens[len(tokens)-1]
	switch parent.kind {
	case '{':
		index := parent.member(last)
		if index < 0 {
			return nil, fmt.Errorf("member %q does not exist", last)
		}
		removed := parent.values[index]
		parent.removeAt(index)
		return removed, nil
	case '[':
		index, err := arrayIndex(last, len(parent.values), false)
		if err != nil {
			return nil, err
		}
		removed := parent.values[index]
		parent.removeAt(index)
		return removed, nil
	default:
		return nil, fmt.Errorf("cannot remove %q inside a scalar", last)
	}
}

// equal compares two values as RFC 6902 test does: objects by member set,
// numbers by value and strings after unescaping.
func equal(left, right *node) bool {
	if left.kind != right.kind {
		return false
	}
	switch left.kind {
	case '{':
		if len(left.keys) != len(right.keys) {
			return false
		}
		for index, key := range left.keys {
			other := right.member(key)
			if other < 0 || !equal(left.values[index], right.values[other]) {
				return false
			}
		}
		return true
	case '[':
		if len(left.values) != len(right.values) {
			return false
		}
		for index := range left.values {
			if !equal(left.values[index], right.values[index]) {
				return false
			}
		}
		return true
	}
	leftValue, rightValue := gjson.Parse(left.raw), gjson.Parse(right.raw)
	if leftValue.Type != rightValue.Type {
		return false
	}
	switch leftValue.Type {
	case gjson.String:
		return leftValue.String() == rightValue.String()
	case gjson.Number:
		leftNumber, leftOK := new(big.Rat).SetString(left.raw)
		rightNumber, rightOK := new(big.Rat).SetString(right.raw)
		return leftOK && rightOK && leftNumber.Cmp(rightNumber) == 0
	default:
		return left.raw == right.raw
	}
}
