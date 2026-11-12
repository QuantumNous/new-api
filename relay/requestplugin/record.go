package requestplugin

import (
	"maps"
	"slices"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/pkg/requestpatch"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/tidwall/gjson"
)

// Bounds of one public record entry.
const (
	maxRecordChanges    = 20
	maxRecordPathRunes  = 256
	maxRecordValueRunes = 64
)

// pluginName is the plugin name a log shows, in every locale it has.
func pluginName(meta jsplugin.Meta) map[string]string {
	if len(meta.NameI18n) > 0 {
		return maps.Clone(meta.NameI18n)
	}
	return map[string]string{"en": meta.Name}
}

// recorded reports an entry that changed the request or the answer, found
// something or stopped it, or looked at its attachments; the public record
// leaves out the others.
func recorded(entry relaycommon.RequestPluginRecord) bool {
	return len(entry.Changes) > 0 || entry.Headers != nil || entry.ReasoningEffort != "" ||
		len(entry.Media) > 0 || len(entry.Attachments) > 0 || entry.Masked > 0 || len(entry.Findings) > 0 || entry.Rejected != nil || entry.Unchecked
}

// describeChanges lists the json.patch operations of effects as users read
// them, the first 20 and the count of the rest. before and after are the
// body around the effects; they tell array items from object members.
func describeChanges(effects []requestpatch.Effect, before, after []byte) ([]relaycommon.RequestPluginChange, int) {
	var changes []relaycommon.RequestPluginChange
	more := 0
	for _, effect := range effects {
		if effect.Type != requestpatch.EffectJSONPatch {
			continue
		}
		for _, op := range effect.Ops {
			if op.Op == "test" {
				continue
			}
			if len(changes) == maxRecordChanges {
				more++
				continue
			}
			change := relaycommon.RequestPluginChange{Op: op.Op, Path: dottedPath(op.Path, before, after), Pointer: op.Path}
			switch op.Op {
			case "move", "copy":
				change.From = dottedPath(op.From, before, after)
			case "add", "replace":
				describeValue(&change, op.Value)
			}
			changes = append(changes, change)
		}
	}
	return changes, more
}

// describeValue shows a short scalar new value as it is, and only the type
// and length of any other.
func describeValue(change *relaycommon.RequestPluginChange, raw []byte) {
	value := gjson.ParseBytes(raw)
	length := 0
	switch {
	case value.Type == gjson.String && utf8.RuneCountInString(value.Str) <= maxRecordValueRunes,
		value.Type == gjson.Number, value.Type == gjson.True, value.Type == gjson.False, value.Type == gjson.Null:
		change.Value = append([]byte(nil), value.Raw...)
		return
	case value.Type == gjson.String:
		change.Type, length = "string", utf8.RuneCountInString(value.Str)
	case value.IsArray():
		change.Type, length = "array", len(value.Array())
	default:
		change.Type = "object"
		value.ForEach(func(_, _ gjson.Result) bool {
			length++
			return true
		})
	}
	change.Length = &length
}

// dottedPath renders a JSON Pointer as a.b[1].c. An array item takes
// brackets: a token whose parent is an array in one of bodies, or, where no
// body has the parent, a token that is an index.
func dottedPath(pointer string, bodies ...[]byte) string {
	values := make([]gjson.Result, len(bodies))
	for index, body := range bodies {
		values[index] = gjson.ParseBytes(body)
	}
	var path strings.Builder
	for _, raw := range strings.Split(pointer, "/")[1:] {
		token := strings.ReplaceAll(strings.ReplaceAll(raw, "~1", "/"), "~0", "~")
		array, known := false, false
		for _, value := range values {
			if value.IsArray() || value.IsObject() {
				array, known = value.IsArray(), true
				break
			}
		}
		if !known {
			_, err := strconv.Atoi(token)
			array = token == "-" || err == nil
		}
		if array {
			path.WriteString("[" + token + "]")
		} else {
			if path.Len() > 0 {
				path.WriteByte('.')
			}
			path.WriteString(token)
		}
		for index, value := range values {
			values[index] = childOf(value, token)
		}
	}
	text := path.String()
	if utf8.RuneCountInString(text) > maxRecordPathRunes {
		text = string([]rune(text)[:maxRecordPathRunes])
	}
	return text
}

func childOf(value gjson.Result, token string) gjson.Result {
	var child gjson.Result
	switch {
	case value.IsArray():
		if index, err := strconv.Atoi(token); err == nil && index >= 0 {
			child = value.Get(token)
		}
	case value.IsObject():
		value.ForEach(func(key, member gjson.Result) bool {
			if key.Str == token {
				child = member
				return false
			}
			return true
		})
	}
	return child
}

// describeHeaders names the headers header.patch effects set and removed.
func describeHeaders(effects []requestpatch.Effect) *relaycommon.RequestPluginHeaderChange {
	var set, removed []string
	for _, effect := range effects {
		for name := range effect.Set {
			set = append(set, strings.ToLower(strings.TrimSpace(name)))
		}
		for _, name := range effect.Remove {
			removed = append(removed, strings.ToLower(strings.TrimSpace(name)))
		}
	}
	if len(set) == 0 && len(removed) == 0 {
		return nil
	}
	slices.Sort(set)
	slices.Sort(removed)
	return &relaycommon.RequestPluginHeaderChange{Set: slices.Compact(set), Remove: slices.Compact(removed)}
}
