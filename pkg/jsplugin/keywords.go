package jsplugin

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"unicode/utf8"
	"unsafe"

	"github.com/MoeForge/moejs"
	goahocorasick "github.com/anknown/ahocorasick"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

// maxKeywordMatches bounds the keywords one utils.keywords call returns.
const maxKeywordMatches = 32

// keywordSearchChunk is how many runes of text one automaton search reads at
// least. A search keeps every match it finds, so text is searched a chunk at
// a time until the limit of keywords is found.
const keywordSearchChunk = 4096

// keywordBuilds counts the matchers built, for tests.
var keywordBuilds atomic.Int64

// keywordList is the parsed value of a keywords format field: its distinct
// non-empty lines, trimmed. Its matchers are built when a hook first matches
// with them and then shared by every call.
type keywordList struct {
	hash    [sha256.Size]byte
	words   []string
	longest int
	once    [2]sync.Once
	built   [2]*keywordMatcher
}

type keywordMatcher struct {
	// machine is nil when the list is empty.
	machine *goahocorasick.Machine
	// longest is the rune length of the longest keyword.
	longest int
	// spelling maps a lowercased keyword to its spelling in the list; nil
	// for a case-sensitive matcher.
	spelling map[string]string
}

func newKeywordList(text string, hash [sha256.Size]byte) *keywordList {
	list := &keywordList{hash: hash}
	seen := make(map[string]struct{})
	for line := range strings.SplitSeq(text, "\n") {
		word := strings.TrimSpace(line)
		if word == "" {
			continue
		}
		if _, duplicate := seen[word]; duplicate {
			continue
		}
		seen[word] = struct{}{}
		list.words = append(list.words, word)
		list.longest = max(list.longest, UTF16Len(word))
	}
	return list
}

func (l *keywordList) matcher(caseSensitive bool) *keywordMatcher {
	variant := 0
	if caseSensitive {
		variant = 1
	}
	l.once[variant].Do(func() {
		keywordBuilds.Add(1)
		matcher := &keywordMatcher{}
		keywords := make([][]rune, 0, len(l.words))
		if !caseSensitive {
			matcher.spelling = make(map[string]string, len(l.words))
		}
		for _, word := range l.words {
			if !caseSensitive {
				lowered := strings.ToLower(word)
				if _, duplicate := matcher.spelling[lowered]; duplicate {
					continue
				}
				matcher.spelling[lowered] = word
				word = lowered
			}
			runes := []rune(word)
			keywords = append(keywords, runes)
			matcher.longest = max(matcher.longest, len(runes))
		}
		if len(keywords) > 0 {
			machine := new(goahocorasick.Machine)
			if machine.Build(keywords) == nil {
				matcher.machine = machine
			}
		}
		l.built[variant] = matcher
	})
	return l.built[variant]
}

// find returns the distinct keywords in text, as the list spells them, in
// the order they first end in text; at most limit.
func (m *keywordMatcher) find(text string, limit int) []string {
	if m.machine == nil || text == "" {
		return nil
	}
	if m.spelling != nil {
		text = strings.ToLower(text)
	}
	var found []string
	// Each chunk starts with the last runes of the one before, one fewer
	// than the longest keyword, so a keyword across two chunks lies whole in
	// the second; one that ends in those runes was found in the first.
	chunk := make([]rune, 0, max(keywordSearchChunk, 2*m.longest))
	for rest := text; ; {
		for len(chunk) < cap(chunk) && rest != "" {
			char, size := utf8.DecodeRuneInString(rest)
			chunk = append(chunk, char)
			rest = rest[size:]
		}
		for _, term := range m.machine.MultiPatternSearch(chunk, false) {
			word := string(term.Word)
			if m.spelling != nil {
				word = m.spelling[word]
			}
			if slices.Contains(found, word) {
				continue
			}
			if found = append(found, word); len(found) == limit {
				return found
			}
		}
		if rest == "" {
			return found
		}
		chunk = append(chunk[:0], chunk[len(chunk)-(m.longest-1):]...)
	}
}

// instanceKeywords is what an instance config's keywords fields hold, for
// the config as the instance had it: the bytes of Config, by address, and
// the config hooks read in ctx.config.
type instanceKeywords struct {
	config *byte
	length int
	fields []string
	lists  map[string]*keywordList
	view   json.RawMessage
}

type keywordConfigKey struct {
	plugin, instance string
}

// keywordConfigs maps a plugin key and instance id to its instanceKeywords.
// An instance's config is parsed again whenever the options reload, so the
// entry is matched by address first and by content hash after that; a list
// whose content did not change keeps its matchers.
var keywordConfigs sync.Map

// maxKeywordConfigs bounds keywordConfigs; past it the map starts again
// empty, dropping the entries of removed instances.
const maxKeywordConfigs = 256

var keywordConfigCount atomic.Int64

// instanceKeywordsOf returns the keywords of tctx's instance config for the
// keywords fields of its plugin.
func instanceKeywordsOf(pluginKey string, tctx *TransformContext) *instanceKeywords {
	fields := tctx.keywordFields
	config := tctx.Config
	key := keywordConfigKey{plugin: pluginKey, instance: tctx.Instance.ID}
	var previous *instanceKeywords
	if tctx.Instance.ID != "" {
		if cached, ok := keywordConfigs.Load(key); ok {
			previous = cached.(*instanceKeywords)
			if previous.config == unsafe.SliceData(config) && previous.length == len(config) && slices.Equal(previous.fields, fields) {
				return previous
			}
		}
	}
	entry := &instanceKeywords{config: unsafe.SliceData(config), length: len(config), fields: fields, lists: make(map[string]*keywordList, len(fields)), view: config}
	for _, field := range fields {
		value := gjson.GetBytes(config, gjson.Escape(field))
		if value.Type != gjson.String {
			continue
		}
		hash := sha256.Sum256([]byte(value.Str))
		list := (*keywordList)(nil)
		if previous != nil && previous.lists[field] != nil && previous.lists[field].hash == hash {
			list = previous.lists[field]
		} else {
			list = newKeywordList(value.Str, hash)
		}
		entry.lists[field] = list
		summary := fmt.Sprintf(`{"count":%d,"longest":%d}`, len(list.words), list.longest)
		if view, err := sjson.SetRawBytes(entry.view, gjson.Escape(field), []byte(summary)); err == nil {
			entry.view = view
		}
	}
	if tctx.Instance.ID != "" {
		if previous == nil && keywordConfigCount.Add(1) > maxKeywordConfigs {
			keywordConfigs.Clear()
			keywordConfigCount.Store(1)
		}
		keywordConfigs.Store(key, entry)
	}
	return entry
}

// hookConfig is ctx.config: the instance config with each keywords field
// read as {count, longest}, the number of keywords and the UTF-16 length of
// the longest.
func (p *LoadedPlugin) hookConfig(tctx *TransformContext) json.RawMessage {
	if len(tctx.keywordFields) == 0 || len(tctx.Config) == 0 {
		return tctx.Config
	}
	return instanceKeywordsOf(p.Engine.key, tctx).view
}

// keywords is utils.keywords(field, text, {caseSensitive?}): the distinct
// keywords of the instance config's keywords field that text contains.
func (c *runtimeCall) keywords(r *moejs.Realm, fieldArgument, textArgument, optionsArgument moejs.Value) (moejs.Value, error) {
	if c.transform == nil {
		return moejs.Undefined(), fmt.Errorf("utils.keywords is available in request processing hooks only")
	}
	field, err := stringValue(r, fieldArgument)
	if err != nil {
		return moejs.Undefined(), err
	}
	if !slices.Contains(c.transform.keywordFields, field) {
		return moejs.Undefined(), r.TypeError("utils.keywords: %q is not a keywords field of the instance config", field)
	}
	text, err := stringValue(r, textArgument)
	if err != nil {
		return moejs.Undefined(), err
	}
	caseSensitive := false
	if !optionsArgument.IsNullish() {
		if !optionsArgument.IsObject() {
			return moejs.Undefined(), r.TypeError("utils.keywords options must be an object")
		}
		value, err := optionsArgument.AsObject().GetProp(r, r.KeyFromGoString("caseSensitive"))
		if err != nil {
			return moejs.Undefined(), err
		}
		if !value.IsUndefined() && !value.IsBool() {
			return moejs.Undefined(), r.TypeError("utils.keywords caseSensitive must be a boolean")
		}
		caseSensitive = value.IsTrue()
	}
	var found []string
	if list := instanceKeywordsOf(c.engine.key, c.transform).lists[field]; list != nil {
		found = list.matcher(caseSensitive).find(text, maxKeywordMatches)
	}
	items := make([]moejs.Value, len(found))
	for index, word := range found {
		items[index] = moejs.String(word)
	}
	return r.FromGo(r.NewArrayFromSlice(items))
}
