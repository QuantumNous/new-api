package common

import (
	"encoding/json"
	"fmt"
	"maps"
	"reflect"
	"slices"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/requestpatch"
	"github.com/tidwall/gjson"
)

// RequestPluginFinding is the audit form of a plugin finding: counts only.
type RequestPluginFinding struct {
	Rule     string `json:"rule"`
	Category string `json:"category,omitempty"`
	Count    int    `json:"count"`
}

// RequestPluginStep is the administrators' audit record of one request
// plugin instance run at one stage. It never holds request content or
// plugin messages.
type RequestPluginStep struct {
	Instance string `json:"instance"`
	Name     string `json:"name"`
	Plugin   string `json:"plugin"`
	Version  string `json:"version"`
	Stage    string `json:"stage"`
	Action   string `json:"action"`
	// RuleID is the rule a rejection names.
	RuleID     string                 `json:"rule,omitempty"`
	Effects    int                    `json:"effects"`
	Findings   []RequestPluginFinding `json:"findings,omitempty"`
	DurationMS int64                  `json:"duration_ms"`
	// Error is the class of a failure.
	Error string `json:"error_class,omitempty"`
}

// RequestPluginRecord is the public log entry of a request plugin instance
// that changed the request, found something in it or stopped it, or that
// could not read the body at a stage (Unchecked). A reply check entry
// (stage "reply") counts the spans it Masked in the answer. It names what
// changed and never holds old values, matched or masked text, header values,
// rule ids, plugin messages or thrown text. The last entry of a capped record
// holds Truncated alone. Audio marks, with Unchecked, an instance that does
// not check the audio input of a Realtime session. Attachments are present
// when the instance looked at the request's attachments.
type RequestPluginRecord struct {
	Plugin          string                     `json:"plugin,omitempty"`
	Name            map[string]string          `json:"name,omitempty"`
	Stage           string                     `json:"stage,omitempty"`
	Unchecked       bool                       `json:"unchecked,omitempty"`
	Audio           bool                       `json:"audio,omitempty"`
	Changes         []RequestPluginChange      `json:"changes,omitempty"`
	MoreChanges     int                        `json:"more_changes,omitempty"`
	Headers         *RequestPluginHeaderChange `json:"headers,omitempty"`
	ReasoningEffort string                     `json:"reasoning_effort,omitempty"`
	Media           []RequestPluginMediaChange `json:"media,omitempty"`
	Attachments     []RequestPluginAttachment  `json:"attachments,omitempty"`
	MoreAttachments int                        `json:"more_attachments,omitempty"`
	Masked          int                        `json:"masked,omitempty"`
	Findings        []RequestPluginCount       `json:"findings,omitempty"`
	Notice          map[string]string          `json:"notice,omitempty"`
	Rejected        *RequestPluginRejected     `json:"rejected,omitempty"`
	Truncated       int                        `json:"truncated,omitempty"`
}

// RequestPluginChange is one json.patch operation in dotted path form. Value
// is the new value when it is a number, a boolean, null or a string of at
// most 64 characters; otherwise Type and Length describe it. Overridden
// marks a change the channel's param override then replaced.
type RequestPluginChange struct {
	Op         string          `json:"op"`
	From       string          `json:"from,omitempty"`
	Path       string          `json:"path"`
	Value      json.RawMessage `json:"value,omitempty"`
	Type       string          `json:"type,omitempty"`
	Length     *int            `json:"length,omitempty"`
	Overridden bool            `json:"overridden,omitempty"`
	// Pointer is the JSON Pointer of Path.
	Pointer string `json:"-"`
}

// RequestPluginHeaderChange names the headers a plugin set and removed, and
// those of them the channel's header override then replaced.
type RequestPluginHeaderChange struct {
	Set        []string `json:"set,omitempty"`
	Remove     []string `json:"remove,omitempty"`
	Overridden []string `json:"overridden,omitempty"`
}

type RequestPluginMediaChange struct {
	Index    int                    `json:"index"`
	From     RequestPluginMediaForm `json:"from"`
	To       RequestPluginMediaForm `json:"to"`
	Lossless bool                   `json:"lossless"`
}

type RequestPluginMediaForm struct {
	Mime  string `json:"mime"`
	Bytes int    `json:"bytes"`
}

// RequestPluginAttachment is what one instance did with one attachment:
// Status checked (read whole or sent to the instance's service), truncated
// (only its first part read) or unchecked, with the Reason when the host
// knows it. Rewritten marks an attachment whose text the instance replaced.
// It never holds file names or content.
type RequestPluginAttachment struct {
	Kind      string `json:"kind"`
	Mime      string `json:"mime"`
	Status    string `json:"status"`
	Reason    string `json:"reason,omitempty"`
	Rewritten bool   `json:"rewritten,omitempty"`
}

// RequestPluginCount is a finding as users see it: its category and count.
type RequestPluginCount struct {
	Category string `json:"category,omitempty"`
	Count    int    `json:"count"`
}

type RequestPluginRejected struct {
	Code string `json:"code"`
}

// Bounds of the public record on a log.
const (
	maxRequestPluginRecords     = 32
	maxRequestPluginRecordBytes = 8 << 10
)

// CapRequestPluginRecord bounds a public record to 32 entries and 8 KB of
// JSON. Trailing entries are dropped and counted in a final {truncated: n}.
// A record capped before, as a Realtime session keeps it, adds its count.
func CapRequestPluginRecord(record []RequestPluginRecord) []RequestPluginRecord {
	counted := 0
	if last := len(record) - 1; last >= 0 && record[last].Truncated > 0 {
		counted, record = record[last].Truncated, record[:last]
	}
	kept := record[:min(len(record), maxRequestPluginRecords)]
	for {
		capped := kept
		if dropped := len(record) - len(kept) + counted; dropped > 0 {
			capped = append(slices.Clip(kept), RequestPluginRecord{Truncated: dropped})
		}
		encoded, err := common.Marshal(capped)
		if err == nil && len(encoded) <= maxRequestPluginRecordBytes || len(kept) == 0 {
			return capped
		}
		kept = kept[:len(kept)-1]
	}
}

// billingFields are the request members whose value sets the price of a
// relay request (billing.md): plugin effects on an upstream body must leave
// them as they are. Max-token caps are not among them: settlement bills the
// usage the upstream reports.
var billingFields = []string{
	"model",
	"stream",
	"stream_options",
	"n",
	"generationConfig.candidateCount",
	"size",
	"quality",
	"resolution",
	"seconds",
	"duration",
	"service_tier",
}

// SameBillingFields rejects a change to any member that prices the request.
// It compares values, not text: applying effects re-encodes the body, which
// reformats members the effects leave alone.
func SameBillingFields(before, after []byte) error {
	for _, field := range billingFields {
		previous, next := gjson.GetBytes(before, field), gjson.GetBytes(after, field)
		if previous.Exists() != next.Exists() || !reflect.DeepEqual(previous.Value(), next.Value()) {
			return fmt.Errorf("effects must not change the billing field %s", field)
		}
	}
	return nil
}

// requestPluginAuthHeaders are the credential headers relay adaptors set
// besides Authorization.
var requestPluginAuthHeaders = []string{"x-api-key", "api-key", "x-goog-api-key"}

// IsRequestPluginProtectedHeader reports a header a request plugin
// header.patch must not change: the requestpatch protected headers and the
// adaptor credential headers.
func IsRequestPluginProtectedHeader(name string) bool {
	return requestpatch.IsProtectedHeader(name) || slices.Contains(requestPluginAuthHeaders, strings.ToLower(strings.TrimSpace(name)))
}

// ApplyPluginParamOverride runs the param override DSL for a request
// plugin's utils.paramOverride. The DSL header context starts from
// baseHeaders, the channel's header override; only the header changes the
// override itself made come back, as lowercase names: the values it set and
// the names it removed.
func ApplyPluginParamOverride(body []byte, override map[string]any, context map[string]any, baseHeaders map[string]any) ([]byte, map[string]string, []string, error) {
	base := sanitizeHeaderOverrideMap(baseHeaders)
	context[paramOverrideContextHeaderOverride] = maps.Clone(base)
	context[paramOverrideContextRequestHeaders] = map[string]any{}
	result, err := ApplyParamOverride(body, override, context)
	if err != nil {
		return nil, nil, nil, err
	}
	after := ensureMapKeyInContext(context, paramOverrideContextHeaderOverride)
	set := map[string]string{}
	for name, value := range after {
		text := strings.TrimSpace(fmt.Sprintf("%v", value))
		previous, existed := base[name]
		if isHeaderPassthroughRuleKeyForOverride(name) || existed && fmt.Sprintf("%v", previous) == text {
			continue
		}
		set[name] = text
	}
	var removed []string
	for name := range base {
		if _, kept := after[name]; !kept && !isHeaderPassthroughRuleKeyForOverride(name) {
			removed = append(removed, name)
		}
	}
	slices.Sort(removed)
	return result, set, removed, nil
}

// SetRequestPluginIngress keeps what the request's ingress stage did, which
// every channel attempt starts from.
func (info *RelayInfo) SetRequestPluginIngress(steps []RequestPluginStep, record []RequestPluginRecord) {
	info.RequestPluginSteps = steps
	info.RequestPluginRecord = record
	info.requestPluginIngressRecord = len(record)
}

// attemptRequestPluginRecord is the record of the current channel attempt,
// the entries after the request's ingress.
func (info *RelayInfo) attemptRequestPluginRecord() []RequestPluginRecord {
	return info.RequestPluginRecord[min(info.requestPluginIngressRecord, len(info.RequestPluginRecord)):]
}

// markRequestPluginOverrides marks the attempt's changes to the body that
// the channel param override replaced: it changed the member a change
// wrote, or set again one a change removed. before and after are the body
// around the param override.
func markRequestPluginOverrides(info *RelayInfo, before, after []byte) {
	if info == nil {
		return
	}
	for _, entry := range info.attemptRequestPluginRecord() {
		for index := range entry.Changes {
			change := &entry.Changes[index]
			var path strings.Builder
			for raw := range strings.SplitSeq(change.Pointer, "/") {
				token := strings.ReplaceAll(strings.ReplaceAll(raw, "~1", "/"), "~0", "~")
				if path.Len() > 0 || token != "" {
					path.WriteString("." + gjson.Escape(token))
				}
			}
			// The root and an array end ("-") name no member to compare.
			if path.Len() == 0 || strings.HasSuffix(path.String(), ".-") {
				continue
			}
			previous, next := gjson.GetBytes(before, path.String()[1:]), gjson.GetBytes(after, path.String()[1:])
			if previous.Exists() != next.Exists() || !reflect.DeepEqual(previous.Value(), next.Value()) {
				change.Overridden = true
			}
		}
	}
}

// MarkRequestPluginHeaderOverrides marks the attempt's header changes to the
// lowercase names the channel's header override replaced.
func (info *RelayInfo) MarkRequestPluginHeaderOverrides(names []string) {
	for _, entry := range info.attemptRequestPluginRecord() {
		if entry.Headers == nil {
			continue
		}
		for _, name := range names {
			if (slices.Contains(entry.Headers.Set, name) || slices.Contains(entry.Headers.Remove, name)) && !slices.Contains(entry.Headers.Overridden, name) {
				entry.Headers.Overridden = append(entry.Headers.Overridden, name)
			}
		}
		slices.Sort(entry.Headers.Overridden)
	}
}
