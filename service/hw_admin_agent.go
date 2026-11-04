package service

// The admin agent: a chat in the admin panel where the owner reports an error
// or a hard word. It runs through the gateway's own customer route (so it
// uses, and is metered like, our own product) with the best model for the
// best price: claude-haiku-5-5, 0.05/0.25 dollar per million tokens, the
// cheapest of
// the sold models in the 24-hour measurements. The agent answers in a fixed
// JSON shape: a reply, an optional text fix that an admin applies with one
// click, and an optional escalation card for the bureau.

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

const (
	HwAdminAgentBaseURLEnv = "HW_ADMIN_AGENT_BASE_URL"
	HwAdminAgentAPIKeyEnv  = "HW_ADMIN_AGENT_API_KEY"
	HwAdminAgentModelEnv   = "HW_ADMIN_AGENT_MODEL"
	// HwAdminAgentDefaultModel is the cheapest model that answers the owner in
	// Dutch and Turkish, follows the JSON instruction and replies fastest:
	// the cheapest sold model that answers the owner in Dutch and Turkish and
	// follows the JSON instruction: claude-haiku-5-5, the lowest price tier of
	// the catalog (no gpt name is sold since HIS-5417, 28 Oct 2026).
	HwAdminAgentDefaultModel = "claude-haiku-5-5"

	HwAdminAgentMaxTurns        = 12
	HwAdminAgentMaxMessageRunes = 2000

	// HwAssistantFallbackModelEnv names the model the assistant falls back to
	// when the primary one does not answer in time.
	HwAssistantFallbackModelEnv = "HW_ASSISTANT_FALLBACK_MODEL"
	// HwAssistantDefaultFallbackModel is the fastest sold model measured on
	// 4 Nov 2026, after gpt-6-luna: the primary model answers in 20 to 106 s
	// on a slow Lumia channel, and a chat that waits that long is lost.
	HwAssistantDefaultFallbackModel = "grok-4-fast"
)

// HwAdminAgentConfig is where the agent calls the gateway.
type HwAdminAgentConfig struct {
	BaseURL string
	APIKey  string
	Model   string
	// FallbackModel answers when Model times out or returns a 5xx; empty
	// means there is no second model.
	FallbackModel string
	Client        *http.Client
}

// HwAdminAgentConfigFromEnv reads the configuration. The measurement runner's
// gateway address and key are the fallback: it is the same gateway.
func HwAdminAgentConfigFromEnv() HwAdminAgentConfig {
	pick := func(names ...string) string {
		for _, name := range names {
			if value := strings.TrimSpace(os.Getenv(name)); value != "" {
				return value
			}
		}
		return ""
	}
	model := HwAdminAgentResolveModel(pick(HwAdminAgentModelEnv))
	return HwAdminAgentConfig{
		BaseURL:       pick(HwAdminAgentBaseURLEnv, HwQualityBaseURLEnv),
		APIKey:        pick(HwAdminAgentAPIKeyEnv, HwQualityAPIKeyEnv),
		Model:         model,
		FallbackModel: HwAdminAgentResolveFallbackModel(pick(HwAssistantFallbackModelEnv)),
	}
}

// HwAdminAgentResolveFallbackModel reads the backup model for the assistant.
// An unknown name is refused and leaves no second model: a fallback that the
// gateway does not sell would only turn a slow answer into a failed one.
func HwAdminAgentResolveFallbackModel(configured string) string {
	name := strings.TrimSpace(configured)
	if name == "" {
		name = HwAssistantDefaultFallbackModel
	}
	for _, sold := range hwSoldModels {
		if sold.Name == name {
			return name
		}
	}
	return ""
}

// HwAssistantRepairKey keeps the assistant's own key on this server able to
// call the assistant model, and reports whether it changed the key. On 29 Oct
// 2026 the default model had moved to claude-haiku-5-5 while the key was still
// limited to the retired gpt-6 names, and every channel (admin panel, widget,
// Telegram) answered with the delay line. The key belongs to the assistant, so
// the model it needs joins its limit and a spent balance is lifted; a key that
// an admin disabled or that expired stays as it is and is logged. A key of
// another gateway is not in this database and is left alone. It runs at
// startup and after a refused call, never in a loop.
func HwAssistantRepairKey(config HwAdminAgentConfig) bool {
	key := strings.TrimPrefix(strings.TrimSpace(config.APIKey), "sk-")
	if key == "" || config.Model == "" || model.DB == nil {
		return false
	}
	token, err := model.GetTokenByKey(key, true)
	if err != nil {
		return false
	}
	if token.Status == common.TokenStatusDisabled || token.Status == common.TokenStatusExpired {
		common.SysError(common.LogText("hw assistant key %d is disabled or expired: every channel answers with the fallback", token.Id))
		return false
	}
	changed := false
	if limits := token.GetModelLimits(); token.ModelLimitsEnabled && !slices.Contains(limits, config.Model) {
		token.ModelLimits = strings.Join(append(limits, config.Model), ",")
		changed = true
	}
	if token.Status == common.TokenStatusExhausted || (!token.UnlimitedQuota && token.RemainQuota <= 0) {
		token.Status = common.TokenStatusEnabled
		token.UnlimitedQuota = true
		changed = true
	}
	if !changed {
		return false
	}
	if err := token.Update(); err != nil {
		common.SysError(common.LogText("hw assistant key %d could not be repaired: %s", token.Id, err.Error()))
		return false
	}
	common.SysLog(common.LogText("hw assistant key %d repaired for model %s", token.Id, config.Model))
	return true
}

// HwAdminAgentResolveModel makes sure the agent never runs on a retired or
// unknown model: only a model of the sold catalog is accepted, anything else
// (an empty value, a retired name such as claude-haiku-4-5, a typo) falls back
// to the default. A stale environment value can therefore not bring an old,
// dearer model back.
func HwAdminAgentResolveModel(configured string) string {
	name := strings.TrimSpace(configured)
	for _, sold := range hwSoldModels {
		if sold.Name == name {
			return name
		}
	}
	return HwAdminAgentDefaultModel
}

// HwAdminAgentAttachment is a pasted screenshot (an image data URL) or a small
// text file that travels with a message.
type HwAdminAgentAttachment struct {
	Name string `json:"name"`
	Mime string `json:"mime"`
	// Data is a data URL for an image, or the plain text of a text file.
	Data string `json:"data"`
}

const (
	HwAssistantMaxAttachments    = 3
	HwAssistantMaxImageDataBytes = 3 << 20
	HwAssistantMaxTextRunes      = 12000
)

var hwAssistantImageMimes = map[string]bool{"image/png": true, "image/jpeg": true, "image/webp": true, "image/gif": true}

// HwAdminAgentTurn is one chat message of the conversation.
type HwAdminAgentTurn struct {
	Role        string                   `json:"role"`
	Content     string                   `json:"content"`
	Attachments []HwAdminAgentAttachment `json:"attachments,omitempty"`
}

// hwAssistantCleanAttachments checks the attachments of one turn: images must be
// a base64 data URL of a known image type and small, text must be short.
func hwAssistantCleanAttachments(items []HwAdminAgentAttachment) ([]HwAdminAgentAttachment, error) {
	if len(items) > HwAssistantMaxAttachments {
		return nil, errors.New("too many attachments")
	}
	clean := make([]HwAdminAgentAttachment, 0, len(items))
	for _, item := range items {
		item.Name = strings.TrimSpace(item.Name)
		if utf8.RuneCountInString(item.Name) > 120 {
			item.Name = string([]rune(item.Name)[:120])
		}
		if hwAssistantImageMimes[item.Mime] {
			prefix := "data:" + item.Mime + ";base64,"
			if !strings.HasPrefix(item.Data, prefix) || len(item.Data) > HwAssistantMaxImageDataBytes {
				return nil, errors.New("invalid or too large image")
			}
		} else if strings.HasPrefix(item.Mime, "text/") {
			if strings.TrimSpace(item.Data) == "" || utf8.RuneCountInString(item.Data) > HwAssistantMaxTextRunes {
				return nil, errors.New("text attachment is empty or too long")
			}
		} else {
			return nil, errors.New("unsupported attachment type")
		}
		clean = append(clean, item)
	}
	return clean, nil
}

// hwAssistantMessage turns one clean turn into a chat message; images become
// content parts, text files are appended to the text.
func hwAssistantMessage(role, content string, attachments []HwAdminAgentAttachment) hwChatMessage {
	var parts []hwChatPart
	for _, item := range attachments {
		if hwAssistantImageMimes[item.Mime] {
			parts = append(parts, hwChatPart{Type: "image_url", ImageURL: &hwChatImageURL{URL: item.Data}})
		} else {
			content += "\n\nAttached file " + item.Name + ":\n" + item.Data
		}
	}
	if len(parts) == 0 {
		return hwChatMessage{Role: role, Content: content}
	}
	return hwChatMessage{Role: role, Content: content, Parts: append([]hwChatPart{{Type: "text", Text: content}}, parts...)}
}

// HwAdminAgentTextFix asks the admin to replace a displayed text. Shown is
// the text exactly as the admin sees it; the panel finds the i18n key.
type HwAdminAgentTextFix struct {
	Lang     string `json:"lang"`
	Shown    string `json:"shown"`
	Proposed string `json:"proposed"`
}

// HwAdminAgentEscalation is a larger problem that goes to the bureau.
type HwAdminAgentEscalation struct {
	Title   string `json:"title"`
	Summary string `json:"summary"`
}

// HwAdminAgentAnswer is what the panel receives.
type HwAdminAgentAnswer struct {
	Reply    string                  `json:"reply"`
	TextFix  *HwAdminAgentTextFix    `json:"text_fix,omitempty"`
	Escalate *HwAdminAgentEscalation `json:"escalate,omitempty"`
}

// HwAltunerIdentity is the line a leaking reply is replaced with in the
// owner's panel: the voice never presents itself as a bot, an AI or a model,
// it is Altuner himself answering.
var HwAltunerIdentity = map[string]string{
	"tr": "Ben Altuner. HisarWeb AI'yi ben işletiyorum, sorunu beraber çözelim. Hangi sayfada tam olarak ne oldu?",
	"en": "I am Altuner. I run HisarWeb AI myself, let us solve this together. What exactly happened on which page?",
	"nl": "Ik ben Altuner. Ik draai HisarWeb AI zelf, lossen we het samen op. Wat gebeurde er precies op welke pagina?",
}

// hwAdminAgentRules are the admin panel's own rules on top of the shared voice
// and knowledge: the JSON answer shape, the text fix and the escalation.
const hwAdminAgentRules = `The panel belongs to the owner, who reports an error or a hard word on the admin panel or the customer pages, or asks anything about HisarWeb AI. Customers are Turkish; the customer interface language is Turkish.

Answer with one JSON object and nothing else:
{"reply": "<your answer>", "text_fix": null, "escalate": null}

Fill text_fix only when the owner points at a text that should read better: {"lang": "tr", "shown": "<the text exactly as the owner sees it>", "proposed": "<the better text in the same language>"}. Keep every {{placeholder}} of the original unchanged, add no HTML, and keep it short and everyday: no jargon, no machine-translated phrasing.
Fill escalate only for a real malfunction that a text change does not solve (a wrong number, a broken page, a failed payment): {"title": "<one line>", "summary": "<what happens, where, what was expected>"}.
You cannot change settings, money or accounts yourself.`

// HwAdminAgentValidate trims and bounds a conversation before it is sent.
func HwAdminAgentValidate(turns []HwAdminAgentTurn) ([]HwAdminAgentTurn, error) {
	if len(turns) == 0 {
		return nil, errors.New("no message")
	}
	if len(turns) > HwAdminAgentMaxTurns {
		turns = turns[len(turns)-HwAdminAgentMaxTurns:]
	}
	clean := make([]HwAdminAgentTurn, 0, len(turns))
	for _, turn := range turns {
		if turn.Role != "user" && turn.Role != "assistant" {
			return nil, errors.New("invalid role")
		}
		content := strings.TrimSpace(turn.Content)
		attachments, err := hwAssistantCleanAttachments(turn.Attachments)
		if err != nil {
			return nil, err
		}
		if (content == "" && len(attachments) == 0) || utf8.RuneCountInString(content) > HwAdminAgentMaxMessageRunes {
			return nil, errors.New("message is empty or too long")
		}
		if content == "" {
			content = "(see attachment)"
		}
		clean = append(clean, HwAdminAgentTurn{Role: turn.Role, Content: content, Attachments: attachments})
	}
	if clean[len(clean)-1].Role != "user" {
		return nil, errors.New("the last message must come from the user")
	}
	return clean, nil
}

// HwAdminAgentAsk sends the conversation to the gateway with the shared voice
// and knowledge plus the admin JSON rules, and decodes the answer. The caller
// answers a failure with HwAssistantFallback, never with the error text.
func HwAdminAgentAsk(ctx context.Context, config HwAdminAgentConfig, turns []HwAdminAgentTurn) (HwAdminAgentAnswer, error) {
	question := hwAssistantLastQuestion(turns)
	instruction := hwAssistantInstructionWith(HwAssistantChannelAdmin, question, hwAdminAgentRules)
	text, cut, err := hwAssistantCall(ctx, config, instruction, "Owner message:", turns)
	if err != nil {
		return HwAdminAgentAnswer{}, fmt.Errorf("admin agent call failed: %w", err)
	}
	answer := HwAdminAgentParse(text)
	if cut {
		answer.Reply = hwAssistantDropCutLine(answer.Reply)
	}
	answer.Reply = hwAssistantGuardChannel(answer.Reply, HwAssistantChannelAdmin, hwAssistantReplyLang(question, "nl"))
	return answer, nil
}

// HwAdminAgentParse reads the model's answer. A model that ignores the JSON
// instruction still gets its reply shown, just without any action buttons.
func HwAdminAgentParse(text string) HwAdminAgentAnswer {
	trimmed := strings.TrimSpace(text)
	if start, end := strings.Index(trimmed, "{"), strings.LastIndex(trimmed, "}"); start >= 0 && end > start {
		var answer HwAdminAgentAnswer
		if err := common.UnmarshalJsonStr(trimmed[start:end+1], &answer); err == nil && strings.TrimSpace(answer.Reply) != "" {
			answer.Reply = strings.TrimSpace(answer.Reply)
			if answer.TextFix != nil && (strings.TrimSpace(answer.TextFix.Shown) == "" || strings.TrimSpace(answer.TextFix.Proposed) == "") {
				answer.TextFix = nil
			}
			if answer.Escalate != nil && strings.TrimSpace(answer.Escalate.Title) == "" {
				answer.Escalate = nil
			}
			return answer
		}
	}
	if reply := hwAdminAgentCutReply(trimmed); reply != "" {
		return HwAdminAgentAnswer{Reply: reply}
	}
	return HwAdminAgentAnswer{Reply: trimmed}
}

// hwAdminAgentCutReply reads the reply of a JSON answer that the token limit
// broke off: it has no closing quote or brace, and without this the panel
// showed the raw {"reply": ...} with a literal \n (30 Oct).
func hwAdminAgentCutReply(text string) string {
	key := strings.Index(text, `"reply"`)
	if key < 0 {
		return ""
	}
	rest := strings.TrimLeft(text[key+len(`"reply"`):], " \t\r\n")
	if !strings.HasPrefix(rest, ":") {
		return ""
	}
	rest = strings.TrimLeft(rest[1:], " \t\r\n")
	if !strings.HasPrefix(rest, `"`) {
		return ""
	}
	raw := rest[1:]
	escaped := false
	for index, char := range raw {
		if escaped {
			escaped = false
		} else if char == '\\' {
			escaped = true
		} else if char == '"' {
			raw = raw[:index]
			break
		}
	}
	// An escape the limit cut in half (a lone \ or \u00) is dropped byte by byte.
	for try := 0; try < 6 && raw != ""; try++ {
		var reply string
		if common.UnmarshalJsonStr(`"`+raw+`"`, &reply) == nil {
			return strings.TrimSpace(reply)
		}
		raw = raw[:len(raw)-1]
	}
	return ""
}
