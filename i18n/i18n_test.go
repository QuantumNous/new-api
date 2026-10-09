package i18n

import (
	"errors"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io/fs"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"testing"
	"unicode"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

// The web console saves its own language codes (zhCN, zhTW, fr, ...) in the
// user setting; backend messages must follow them, and languages without a
// backend locale fall back to English.
func TestLanguageFromUserSetting(t *testing.T) {
	require.NoError(t, Init())
	for _, tc := range []struct {
		saved string
		want  string
	}{
		{"zhCN", LangZhCN},
		{"zhTW", LangZhTW},
		{"zh-HK", LangZhTW},
		{"zh-Hant-TW", LangZhTW},
		{"zh", LangZhCN},
		{"en", LangEn},
		{"fr", LangEn},
		{"ja", LangEn},
	} {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest("GET", "/v1/chat/completions", nil)
		c.Set(string(constant.ContextKeyUserSetting), dto.UserSetting{Language: tc.saved})
		assert.Equal(t, tc.want, StatedLang(c), tc.saved)
	}
}

// Other gateways match the Chinese text of the errors that existed before the
// backend translated them, so a reader who states no language still gets that
// text. A saved language or an Accept-Language header selects a translation.
func TestUnstatedLanguageKeepsOriginalText(t *testing.T) {
	require.NoError(t, Init())
	quota := map[string]any{"Remaining": "$0.10"}
	for _, tc := range []struct {
		name           string
		saved          string
		acceptLanguage string
		key            string
		want           string
	}{
		{"nothing stated", "", "", MsgQuotaUserInsufficient, "用户额度不足, 剩余额度: $0.10"},
		{"no preference header", "", "*", MsgQuotaUserInsufficient, "用户额度不足, 剩余额度: $0.10"},
		{"header", "", "en-US,en;q=0.9", MsgQuotaUserInsufficient, "Insufficient user quota, remaining quota: $0.10"},
		{"header in a language without a locale", "", "fr-FR", MsgQuotaUserInsufficient, "Insufficient user quota, remaining quota: $0.10"},
		{"saved language wins over the header", "zhTW", "en-US", MsgQuotaUserInsufficient, "使用者額度不足，剩餘額度：$0.10"},
		{"saved language", "en", "", MsgQuotaUserInsufficient, "Insufficient user quota, remaining quota: $0.10"},
		{"key that was never Chinese only", "", "", MsgDistributorInvalidChannelId, "Invalid channel ID"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
			if tc.acceptLanguage != "" {
				c.Request.Header.Set("Accept-Language", tc.acceptLanguage)
			}
			if tc.saved != "" {
				c.Set(string(constant.ContextKeyUserSetting), dto.UserSetting{Language: tc.saved})
			}
			assert.Equal(t, tc.want, T(c, tc.key, quota))
		})
	}
}

// A key missing from a locale, or a template that does not parse, reaches
// clients as the raw key.
func TestLocalesRenderEveryKey(t *testing.T) {
	require.NoError(t, Init())
	keysFile, err := parser.ParseFile(token.NewFileSet(), "keys.go", nil, parser.SkipObjectResolution)
	require.NoError(t, err)
	var declared []string
	ast.Inspect(keysFile, func(node ast.Node) bool {
		if spec, ok := node.(*ast.ValueSpec); ok {
			for _, value := range spec.Values {
				if literal, ok := value.(*ast.BasicLit); ok {
					key, err := strconv.Unquote(literal.Value)
					require.NoError(t, err)
					declared = append(declared, key)
				}
			}
		}
		return true
	})
	slices.Sort(declared)
	for _, key := range chineseByDefault {
		assert.Contains(t, declared, key)
	}

	keysByLang := make(map[string][]string)
	for _, lang := range SupportedLanguages() {
		data, err := localeFS.ReadFile("locales/" + lang + ".yaml")
		require.NoError(t, err)
		var messages map[string]string
		require.NoError(t, yaml.Unmarshal(data, &messages))
		for key := range messages {
			keysByLang[lang] = append(keysByLang[lang], key)
		}
		slices.Sort(keysByLang[lang])
	}
	for _, lang := range SupportedLanguages() {
		assert.Equal(t, declared, keysByLang[lang], lang)
		for _, key := range keysByLang[lang] {
			text := Translate(lang, key, map[string]any{})
			assert.NotEqual(t, key, text, "%s %s", lang, key)
			assert.False(t, strings.Contains(text, "{{"), "%s %s: %s", lang, key, text)
		}
	}
}

// Web console responses carry the English source text as message_key plus its
// params, and the web console translates them. The backend sends the same body
// whatever language the request asks for.
func TestWebConsoleMessageResponse(t *testing.T) {
	require.NoError(t, Init())
	for _, tc := range []struct {
		name string
		err  error
		want string
	}{
		{
			name: "params",
			err:  common.NewMessage("Channel {{name}} (#{{id}}) does not exist", map[string]any{"name": "{{id}}", "id": 7}),
			want: `{"success":false,"message":"Channel {{id}} (#7) does not exist","message_key":"Channel {{name}} (#{{id}}) does not exist","message_params":{"id":7,"name":"{{id}}"}}`,
		},
		{
			name: "no params",
			err:  common.NewMessage("Invalid parameters"),
			want: `{"success":false,"message":"Invalid parameters","message_key":"Invalid parameters"}`,
		},
		{
			name: "plain error",
			err:  errors.New("record not found"),
			want: `{"success":false,"message":"record not found"}`,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest("GET", "/api/channel/7", nil)
			c.Request.Header.Set("Accept-Language", "zh-CN")
			common.ApiError(c, tc.err)
			assert.JSONEq(t, tc.want, recorder.Body.String())
		})
	}
}

// repoGoFiles parses the non-test Go files of the repository, keyed by path
// relative to the repository root.
func repoGoFiles(t *testing.T) (*token.FileSet, map[string]*ast.File) {
	t.Helper()
	fset := token.NewFileSet()
	files := make(map[string]*ast.File)
	err := filepath.WalkDir("..", func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		name := entry.Name()
		if entry.IsDir() {
			if path != ".." && (strings.HasPrefix(name, ".") || name == "web" || name == "electron" || name == "node_modules" || name == "bench") {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(name, ".go") || strings.HasSuffix(name, "_test.go") {
			return nil
		}
		file, err := parser.ParseFile(fset, path, nil, parser.SkipObjectResolution)
		if err != nil {
			return err
		}
		rel, err := filepath.Rel("..", path)
		if err != nil {
			return err
		}
		files[filepath.ToSlash(rel)] = file
		return nil
	})
	require.NoError(t, err)
	return fset, files
}

// Text for people goes through i18n, so Go string literals are English. The
// files listed here hold data that must stay as written.
func TestGoStringLiteralsAreEnglish(t *testing.T) {
	dataFiles := []string{
		"common/init.go",                                   // SESSION_SECRET startup warning, printed in English and Chinese
		"controller/channel-test.go",                       // token name stored with channel test logs
		"controller/ratio_sync.go",                         // preset names matched by the web console
		"dto/video.go",                                     // API example
		"model/pricing_default.go",                         // vendor names
		"setting/chat.go",                                  // default chat app names
		"setting/operation_setting/payment_setting_old.go", // default payment method names
	}
	fset, files := repoGoFiles(t)
	for path, file := range files {
		if slices.Contains(dataFiles, path) {
			continue
		}
		ast.Inspect(file, func(node ast.Node) bool {
			literal, ok := node.(*ast.BasicLit)
			if !ok || literal.Kind != token.STRING {
				return true
			}
			if strings.ContainsFunc(literal.Value, func(r rune) bool { return unicode.Is(unicode.Han, r) }) {
				t.Errorf("%s:%d: non-English string literal %s; see .agents/rules/i18n.md", path, fset.Position(literal.Pos()).Line, literal.Value)
			}
			return true
		})
	}
}

// The web console translates the keys of common.NewMessage, common.ApiErrorT
// and common.ApiSuccessT. A key missing from a locale file reaches users in
// English, and a placeholder without a param reaches them as "{{name}}".
func TestWebConsoleMessageKeysAreTranslated(t *testing.T) {
	placeholder := regexp.MustCompile(`\{\{\s*(\w+)\s*\}\}`)
	placeholders := func(text string) []string {
		var names []string
		for _, match := range placeholder.FindAllStringSubmatch(text, -1) {
			if !slices.Contains(names, match[1]) {
				names = append(names, match[1])
			}
		}
		slices.Sort(names)
		return names
	}

	locales := make(map[string]map[string]string)
	for _, lang := range []string{"en", "zh", "zh-TW", "fr", "ja", "ru", "vi"} {
		data, err := os.ReadFile("../web/src/i18n/locales/" + lang + ".json")
		require.NoError(t, err)
		var locale struct {
			Translation map[string]string `json:"translation"`
		}
		require.NoError(t, common.Unmarshal(data, &locale))
		locales[lang] = locale.Translation
	}

	// Position of the key and the params among the arguments of each function.
	messageFuncs := map[string][2]int{"NewMessage": {0, 1}, "ApiErrorT": {1, 2}, "ApiSuccessT": {1, 3}}
	fset, files := repoGoFiles(t)
	constants := make(map[string]map[string]ast.Expr) // package directory -> constant name -> value
	for path, file := range files {
		dir := filepath.Dir(path)
		if constants[dir] == nil {
			constants[dir] = make(map[string]ast.Expr)
		}
		for _, decl := range file.Decls {
			general, ok := decl.(*ast.GenDecl)
			if !ok || general.Tok != token.CONST {
				continue
			}
			for _, spec := range general.Specs {
				value := spec.(*ast.ValueSpec)
				for i, name := range value.Names {
					if i < len(value.Values) {
						constants[dir][name.Name] = value.Values[i]
					}
				}
			}
		}
	}
	var literalText func(dir string, expr ast.Expr) (string, bool)
	literalText = func(dir string, expr ast.Expr) (string, bool) {
		switch value := expr.(type) {
		case *ast.BasicLit:
			text, err := strconv.Unquote(value.Value)
			return text, err == nil && value.Kind == token.STRING
		case *ast.Ident:
			if constant, ok := constants[dir][value.Name]; ok {
				return literalText(dir, constant)
			}
		case *ast.BinaryExpr:
			left, leftOK := literalText(dir, value.X)
			right, rightOK := literalText(dir, value.Y)
			return left + right, leftOK && rightOK && value.Op == token.ADD
		case *ast.ParenExpr:
			return literalText(dir, value.X)
		}
		return "", false
	}

	checked := 0
	for path, file := range files {
		dir := filepath.Dir(path)
		commonName := ""
		if file.Name.Name == "common" && dir == "common" {
			commonName = "."
		}
		for _, spec := range file.Imports {
			if spec.Path.Value != `"github.com/QuantumNous/new-api/common"` {
				continue
			}
			commonName = "common"
			if spec.Name != nil {
				commonName = spec.Name.Name
			}
		}
		if commonName == "" {
			continue
		}
		ast.Inspect(file, func(node ast.Node) bool {
			call, ok := node.(*ast.CallExpr)
			if !ok {
				return true
			}
			funcName := ""
			switch fun := call.Fun.(type) {
			case *ast.Ident:
				if commonName == "." {
					funcName = fun.Name
				}
			case *ast.SelectorExpr:
				if pkg, ok := fun.X.(*ast.Ident); ok && pkg.Name == commonName {
					funcName = fun.Sel.Name
				}
			}
			args, ok := messageFuncs[funcName]
			if !ok || len(call.Args) <= args[0] {
				return true
			}
			// A key picked at run time (a parameter, a table entry) cannot be
			// checked here.
			key, ok := literalText(dir, call.Args[args[0]])
			if !ok {
				return true
			}
			site := fmt.Sprintf("%s:%d", path, fset.Position(call.Pos()).Line)
			checked++
			if len(call.Args) > args[1] {
				if params, ok := call.Args[args[1]].(*ast.CompositeLit); ok {
					var names []string
					for _, element := range params.Elts {
						if name, ok := literalText(dir, element.(*ast.KeyValueExpr).Key); ok {
							names = append(names, name)
						}
					}
					slices.Sort(names)
					assert.Equal(t, placeholders(key), names, "%s: params of %q", site, key)
				}
			} else {
				assert.Empty(t, placeholders(key), "%s: %q has placeholders but no params", site, key)
			}
			for lang, locale := range locales {
				translation, ok := locale[key]
				if !assert.True(t, ok, "%s: %q is missing from web/src/i18n/locales/%s.json", site, key, lang) {
					continue
				}
				assert.Equal(t, placeholders(key), placeholders(translation), "%s: placeholders of %q in %s.json", site, key, lang)
			}
			return true
		})
	}
	assert.NotZero(t, checked)
}
