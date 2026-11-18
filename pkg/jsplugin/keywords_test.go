package jsplugin

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

// keywordPlugin returns what its hook saw: ctx.config, and the keywords of
// the words field that req.body.text holds, when it has a text.
const keywordPlugin = `export const meta = {apiVersion: 1, key: "rp-keywords", name: "Keywords", version: "1.0.0", author: {name: "Test"},
  configSchema: {type: "object", properties: {
    words: {type: "string", format: "keywords", title: "Words", default: ""},
    other: {type: "string", title: "Other", default: ""}}}};
export function validateConfig(config) {
  if (typeof config.words !== "object") throw new Error("validateConfig read the words");
}
export function ingress(ctx, req) {
  const seen = {config: ctx.config};
  if (req.body.text !== undefined) seen.found = utils.keywords(req.body.field || "words", req.body.text, req.body.options);
  return {action: "continue", effects: [seen]};
}`

func callKeywords(t *testing.T, plugin *LoadedPlugin, config []byte, body string) (gjson.Result, error) {
	t.Helper()
	result, err := plugin.CallTransform(context.Background(), TransformContext{Stage: "ingress", Instance: TransformInstance{ID: "rp_words"}, Config: config}, TransformRequest{Body: json.RawMessage(body)})
	if err != nil {
		return gjson.Result{}, err
	}
	return gjson.ParseBytes(result.Effects).Get("0"), nil
}

// A keywords field reads as its count and longest length in hooks and in
// validateConfig; utils.keywords matches it in Go, in either letter case.
func TestKeywordsField(t *testing.T) {
	plugin, err := CompilePlugin(keywordPlugin, Options{})
	require.NoError(t, err)
	config, err := plugin.ValidateConfig(json.RawMessage(`{"words":"Foo\nbar\n  \nfoo\n中文\nbar"}`))
	require.NoError(t, err)

	seen, err := callKeywords(t, plugin, config, `{"text":"FOO, Bar and 中文"}`)
	require.NoError(t, err)
	assert.JSONEq(t, `{"words":{"count":4,"longest":3},"other":""}`, seen.Get("config").Raw)
	assert.JSONEq(t, `["Foo","bar","中文"]`, seen.Get("found").Raw)

	seen, err = callKeywords(t, plugin, config, `{"text":"foo Foo BAR","options":{"caseSensitive":true}}`)
	require.NoError(t, err)
	assert.JSONEq(t, `["foo","Foo"]`, seen.Get("found").Raw)

	_, err = callKeywords(t, plugin, config, `{"text":"x","field":"other"}`)
	var hookErr *HookError
	require.ErrorAs(t, err, &hookErr)
	assert.Contains(t, hookErr.Message, `"other" is not a keywords field of the instance config`)

	// The format applies to properties of configSchema itself.
	_, err = CompilePlugin(strings.Replace(keywordPlugin, `other: {type: "string", title: "Other", default: ""}`,
		`other: {type: "object", title: "Other", properties: {inner: {type: "string", format: "keywords", title: "Inner"}}}`, 1), Options{})
	require.ErrorContains(t, err, "format keywords applies to the properties of configSchema itself")
}

// 10,000 keywords and a 20 KiB prompt: the matcher is built once, on the
// first match, and every later call reuses the parsed list by address; a
// reloaded config with the same words keeps it too.
func TestKeywordsTenThousandOnALargePrompt(t *testing.T) {
	plugin, err := CompilePlugin(keywordPlugin, Options{})
	require.NoError(t, err)
	words := make([]string, 10_000)
	for index := range words {
		words[index] = fmt.Sprintf("forbidden-%05d", index)
	}
	config, err := plugin.ValidateConfig(json.RawMessage(`{"words":"` + strings.Join(words, `\n`) + `"}`))
	require.NoError(t, err)
	prompt := strings.Repeat("an ordinary sentence of the prompt. ", 20<<10/36) + "FORBIDDEN-09999"
	body := `{"text":"` + prompt + `"}`

	builds := keywordBuilds.Load()
	started := time.Now()
	seen, err := callKeywords(t, plugin, config, body)
	first := time.Since(started)
	require.NoError(t, err)
	assert.JSONEq(t, `["forbidden-09999"]`, seen.Get("found").Raw)
	assert.Equal(t, int64(1), keywordBuilds.Load()-builds)
	entry, _ := keywordConfigs.Load(keywordConfigKey{plugin: "rp-keywords", instance: "rp_words"})

	const calls = 50
	started = time.Now()
	for range calls {
		_, err = callKeywords(t, plugin, config, body)
		require.NoError(t, err)
	}
	perCall := time.Since(started) / calls
	assert.Equal(t, int64(1), keywordBuilds.Load()-builds, "no call after the first builds a matcher")
	again, _ := keywordConfigs.Load(keywordConfigKey{plugin: "rp-keywords", instance: "rp_words"})
	assert.Same(t, entry, again, "a call reuses the parsed config")

	// The options reload parses every config again: new bytes, same words.
	reloaded := append(json.RawMessage(nil), config...)
	_, err = callKeywords(t, plugin, reloaded, body)
	require.NoError(t, err)
	fresh, _ := keywordConfigs.Load(keywordConfigKey{plugin: "rp-keywords", instance: "rp_words"})
	assert.Same(t, entry.(*instanceKeywords).lists["words"], fresh.(*instanceKeywords).lists["words"])
	assert.Equal(t, int64(1), keywordBuilds.Load()-builds)

	tctx := &TransformContext{Instance: TransformInstance{ID: "rp_words"}, Config: reloaded, keywordFields: []string{"words"}}
	lookups := testing.AllocsPerRun(100, func() { _ = plugin.hookConfig(tctx) })
	assert.Zero(t, lookups, "reading ctx.config of a cached instance allocates nothing")
	matcher := fresh.(*instanceKeywords).lists["words"].matcher(false)
	searchAllocs := testing.AllocsPerRun(20, func() { _ = matcher.find(prompt, maxKeywordMatches) })
	assert.LessOrEqual(t, searchAllocs, 8.0)
	started = time.Now()
	for range calls {
		_ = matcher.find(prompt, maxKeywordMatches)
	}
	search := time.Since(started) / calls
	t.Logf("10,000 keywords, %d byte prompt: first call %v (builds the matcher), later calls %v each, Go search %v and %.0f allocations each",
		len(prompt), first, perCall, search, searchAllocs)
}

// A search stops once it has found the limit of keywords: the text after
// them is not searched, however often the keywords repeat in it. A keyword
// across the end of a search chunk is found.
func TestKeywordsSearchStopsAtTheLimit(t *testing.T) {
	words := make([]string, 40)
	for index := range words {
		words[index] = fmt.Sprintf("k%02d", index)
	}
	matcher := newKeywordList(strings.Join(words, "\n"), [32]byte{}).matcher(true)
	text := strings.Join(words, " ") + strings.Repeat(" k00", 1<<18)
	var found []string
	allocs := testing.AllocsPerRun(1, func() { found = matcher.find(text, maxKeywordMatches) })
	assert.Equal(t, words[:maxKeywordMatches], found)
	assert.Less(t, allocs, 10_000.0)

	spanning := newKeywordList("abcd", [32]byte{}).matcher(false)
	assert.Equal(t, []string{"abcd"}, spanning.find(strings.Repeat("x", keywordSearchChunk-2)+"ABCD", maxKeywordMatches))
}

// A hook that never matches costs no matcher, and a plugin without a
// keywords field reads its config as it is.
func TestKeywordsUnusedBuildNothing(t *testing.T) {
	plugin, err := CompilePlugin(keywordPlugin, Options{})
	require.NoError(t, err)
	builds := keywordBuilds.Load()
	seen, err := callKeywords(t, plugin, []byte(`{"words":"a\nb","other":""}`), `{}`)
	require.NoError(t, err)
	assert.JSONEq(t, `{"words":{"count":2,"longest":1},"other":""}`, seen.Get("config").Raw)
	assert.Equal(t, builds, keywordBuilds.Load())

	plain, err := CompilePlugin(`export const meta = {apiVersion: 1, key: "rp-plain", name: "Plain", version: "1.0.0", author: {name: "Test"}};
export function ingress() { return {action: "continue"}; }`, Options{})
	require.NoError(t, err)
	tctx := &TransformContext{Config: []byte(`{}`), keywordFields: plain.Meta.ConfigSchema.KeywordFields()}
	assert.Zero(t, testing.AllocsPerRun(100, func() { _ = plain.hookConfig(tctx) }))
}
