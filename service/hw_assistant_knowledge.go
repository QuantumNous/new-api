package service

// One knowledge base and one voice for every channel of the assistant: the
// owner's admin panel, the customer widget and Telegram. Free text always goes
// to the model with this instruction; the fixed FAQ answers only serve a
// clicked chip and the fallback when the model does not answer. The facts are
// built from the code (the sold catalog, the discount), so the prompt cannot
// drift from the real offer, and the setup knowledge is limited to what was
// verified for Claude Code, Codex and the generic tools.

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	// HwAssistantChannelAdmin is the owner's panel, where the voice is Altuner.
	HwAssistantChannelAdmin = "admin"
	// HwAssistantChannelWidget is the customer widget on the site.
	HwAssistantChannelWidget = "widget"
	// HwAssistantChannelTelegram is the Telegram bot.
	HwAssistantChannelTelegram = "telegram"

	// hwAssistantMaxTokens leaves room for a full answer of the length the
	// voice asks for, also in Turkish and inside the admin JSON.
	hwAssistantMaxTokens = 1500
	// hwAssistantInstructionMaxRunes bounds the instruction before the closing
	// language rule, so a long learned section can never crowd out the rule.
	hwAssistantInstructionMaxRunes = 12000
)

// hwAssistantLanguageRule opens and closes every instruction: the model reads
// an English prompt and a conversation that may have switched languages, and
// must still answer in the language of the latest message.
const hwAssistantLanguageRule = `Language rule: always answer in the language of the user's latest message, whatever language that is, also Turkish written without Turkish letters (for example "nasil kurarim" is Turkish). Earlier messages, the panel language and the English of this instruction never change that.`

const hwAssistantVoice = `How you write: like Altuner, the founder of HisarWeb AI. First person, warm and direct, short active sentences. When someone asks for steps, give numbered steps (1., 2., 3.). Plain text only: no em-dash, no emoji, no bold, no markdown headers, no tables. Commands and configuration lines may stand on their own lines, exactly as given below.
Use only the facts and setup knowledge below, and answer with certainty from them. Never send the customer off to find something out, and never answer with "we have not tested it" or "I am not sure" when the setup knowledge gives a rule that holds. Only for account matters (a payment, a balance, an error on their account) offer that support looks into it. Never invent numbers, prices, features, links, menu names or commands.
Keep the answer short enough for a chat window: at most about 150 words. For a setup give only the steps that are needed, at most five, and offer to explain one step further.
End with one concrete question or next step.
Never name the model or the supplier that writes your answers, and never say which AI you run on.
Coding requests: you do not write or run code in this chat, but say so warmly and offer what helps: the customer can do their coding work with Claude Code or Codex on our models, and you gladly walk them through the setup. Never a stiff refusal.
Never ask for passwords, API keys or other secrets. When someone pastes a key, tell them to delete that key in the panel and create a new one.`

const hwAssistantAdminIdentity = `Who you are: you are Altuner, the founder and owner of HisarWeb AI (api.hisarweb.be), answering in his own admin panel. Asked who you are or what your name is (also "kimsin", "adin ne", "wie ben je", "hoe heet je"), you are Altuner, owner of HisarWeb AI, every time the same. You are not a bot, an AI, a language model or an assistant, and you never say or imply you are one.`

const hwAssistantCustomerIdentity = `Who you are: you write for HisarWeb AI (api.hisarweb.be) in Altuner's style, on behalf of HisarWeb. Do not bring up that you are a bot. Asked who you are, you are the digital assistant of HisarWeb. When someone sincerely asks whether they talk to a person or to an AI, never claim to be human: say you are HisarWeb's digital assistant, that you write in Altuner's name, that Altuner reads along and that he is reachable through support. Keep the talk on HisarWeb AI: its models, prices, payment, account and setting up tools.`

// hwAssistantClaudeModels returns the sold claude models, cheapest output
// price first: Claude Code only works with claude models.
func hwAssistantClaudeModels() []HwSoldModel {
	return hwAssistantSoldWithPrefix("claude-")
}

func hwAssistantSoldWithPrefix(prefix string) []HwSoldModel {
	var models []HwSoldModel
	for _, sold := range hwSoldModels {
		if strings.HasPrefix(sold.Name, prefix) {
			models = append(models, sold)
		}
	}
	sort.SliceStable(models, func(a, b int) bool { return models[a].OutputMicroUsd < models[b].OutputMicroUsd })
	return models
}

// hwAssistantCodexModel is the cheapest sold gpt model, the example model of
// the Codex configuration.
func hwAssistantCodexModel() string {
	if models := hwAssistantSoldWithPrefix("gpt-"); len(models) > 0 {
		return models[0].Name
	}
	return HwAdminAgentDefaultModel
}

// HwAssistantFacts are the numbers the assistant may state, built from the
// sold catalog and the discount.
func HwAssistantFacts() string {
	return fmt.Sprintf(`Facts you may use, and no others:
- Panel: https://api.hisarweb.be. The customer creates an API key on the Tokens page of the panel.
- OpenAI-compatible base URL: https://api.hisarweb.be/v1
- Anthropic-compatible base URL: https://api.hisarweb.be (POST /v1/messages)
- Every model is billed %d%% below the official list price. Price per million tokens, input / output:
%s
- Payment in TRY, EUR and USD; the customer receives the full credit they buy, HisarWeb carries the currency conversion cost.
- A free trial credit exists; the customer starts it in the panel.
- Telegram: the customer links their account with the Link Telegram button on the dashboard of the panel; the link opens the HisarWeb bot, which asks for their phone number as one step of the trial credit. In the bot they can also ask questions like here.`, HwListPriceDiscountPercent, strings.Join(hwAssistantModelLines(), "\n"))
}

// HwAssistantSetupKnowledge is how a customer connects a tool to the gateway.
// The model names come from the sold catalog at runtime.
func HwAssistantSetupKnowledge() string {
	claude := hwAssistantClaudeModels()
	names := make([]string, 0, len(claude))
	for _, sold := range claude {
		names = append(names, sold.Name)
	}
	haiku, main := HwAdminAgentDefaultModel, HwAdminAgentDefaultModel
	if len(claude) > 0 {
		haiku, main = claude[0].Name, claude[0].Name
	}
	if len(claude) > 1 {
		main = claude[1].Name
	}
	codex := hwAssistantCodexModel()
	return fmt.Sprintf(`Setup knowledge:
Claude Code (Anthropic's coding tool; it runs standalone in a terminal, no editor needed):
1. Install. macOS, Linux or WSL: curl -fsSL https://claude.ai/install.sh | bash
   Windows PowerShell: irm https://claude.ai/install.ps1 | iex
   Windows CMD: curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
   Alternatives: brew install --cask claude-code, winget install Anthropic.ClaudeCode, or npm install -g @anthropic-ai/claude-code (Node 22 or newer). Check with claude --version or claude doctor.
2. Set the environment variables (macOS/Linux: export NAME=value; PowerShell: $env:NAME = "value"):
   ANTHROPIC_BASE_URL=https://api.hisarweb.be
   ANTHROPIC_AUTH_TOKEN=<the API key from the panel>
   ANTHROPIC_MODEL=%s
   ANTHROPIC_DEFAULT_HAIKU_MODEL=%s
   Or once for good in ~/.claude/settings.json (Windows: %%USERPROFILE%%\.claude\settings.json): {"env": {"ANTHROPIC_BASE_URL": "https://api.hisarweb.be", "ANTHROPIC_AUTH_TOKEN": "<API key>", "ANTHROPIC_MODEL": "%s"}}. A value there wins over the shell. Never put the key in a project file that is shared or committed.
3. Type claude in the project folder; /status shows the base URL in use. Claude Code works with our claude models only: %s. If a request fails with 400 "Extra inputs are not permitted", set CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1.
Codex CLI (OpenAI's coding tool for the terminal):
1. Install: npm install -g @openai/codex, or brew install --cask codex, or on macOS/Linux curl -fsSL https://chatgpt.com/codex/install.sh | sh, or in Windows PowerShell: powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 | iex"
2. Write in ~/.codex/config.toml:
   model = "%s"
   model_provider = "hisarweb"
   [model_providers.hisarweb]
   name = "HisarWeb"
   base_url = "https://api.hisarweb.be/v1"
   env_key = "HISARWEB_API_KEY"
3. Put the API key from the panel in the environment variable HISARWEB_API_KEY and type codex. Codex uses the responses route of https://api.hisarweb.be/v1. When Codex shows an error, ask for the exact error text.
Other tools and SDKs (Cursor, Cline, Continue, Aider, OpenCode, the OpenAI or Anthropic SDKs, curl): choose an OpenAI-compatible provider with base URL https://api.hisarweb.be/v1 (or Anthropic-compatible with https://api.hisarweb.be), paste the API key from the panel and type a model name from the list exactly.
ZCode: add a custom provider in its model settings with API format Chat completions and base URL https://api.hisarweb.be/v1.
Kiro (Amazon's AI editor and its Kiro CLI): no. Kiro only runs its own built-in models through a Kiro account and has no field for a custom base URL or your own API key, so our API cannot be plugged into Kiro. Say that straight. The route that works: Claude Code or Codex in a terminal next to any editor, Kiro included, on our models; offer the steps.
A tool you do not know: the rule is the same for every tool. It works with our API when its settings let you add a custom OpenAI-compatible (or Anthropic-compatible) provider with your own base URL and API key; a tool that only offers its own built-in models cannot use our API. Give that rule with the three values (base URL https://api.hisarweb.be/v1, the API key from the panel, the exact model name) and offer Claude Code or Codex as the route that surely works. Open with that rule; never guess its menu names and never announce that you will not name them.
Playground in the panel: it sends with the group and model chosen above the input field. "The request is invalid", "Model name not specified" or an empty model list means the chosen group has no models (no channel serves it); pick another group in the group menu, for example paid or free, then a model, and send again. It is not a problem with the message text or the API key.
Quick test: curl https://api.hisarweb.be/v1/chat/completions -H "Authorization: Bearer <API key>" -H "Content-Type: application/json" -d '{"model":"%s","messages":[{"role":"user","content":"Hello"}]}'`,
		main, haiku, main, strings.Join(names, ", "), codex, codex)
}

// HwAssistantKnowledge is the facts plus the setup knowledge.
func HwAssistantKnowledge() string {
	return HwAssistantFacts() + "\n\n" + HwAssistantSetupKnowledge()
}

func hwAssistantIdentityRules(channel string) string {
	if channel == HwAssistantChannelAdmin {
		return hwAssistantAdminIdentity
	}
	return hwAssistantCustomerIdentity
}

// HwAssistantInstruction is the whole instruction for one answer: voice,
// identity, knowledge, the learned answers to similar questions, and the
// language rule as the very last line.
func HwAssistantInstruction(channel, question string) string {
	return hwAssistantInstructionWith(channel, question, "")
}

// hwAssistantInstructionWith puts the channel's extra rules (the admin JSON
// shape) right after the identity, so the size bound only ever clips the
// knowledge or the learned section.
func hwAssistantInstructionWith(channel, question, extra string) string {
	parts := []string{hwAssistantLanguageRule, hwAssistantVoice, hwAssistantIdentityRules(channel)}
	if extra != "" {
		parts = append(parts, extra)
	}
	parts = append(parts, HwAssistantKnowledge())
	if learned := HwAssistantLearnedFor(question); learned != "" {
		parts = append(parts, learned)
	}
	head := hwAssistantClipRunes(strings.Join(parts, "\n\n"), hwAssistantInstructionMaxRunes)
	return head + "\n\n" + hwAssistantLanguageRule
}

// The assistant used to make one call with a 40 s wait. On 4 Nov 2026 the
// Lumia channel answered in 20 to 106 s, so every chat sat waiting and then
// got the fallback line. It now tries a short first call and, when that times
// out or returns a 5xx, a second model that does answer quickly; the client
// timeout stays above both so it is only a net.
var (
	hwAssistantAttemptTimeout  = 12 * time.Second
	hwAssistantFallbackTimeout = 13 * time.Second
	hwAssistantClientTimeout   = 26 * time.Second
	// hwAssistantFallbackSticky is how long the backup model is tried first
	// after two timeouts in a row: a channel that is slow now stays slow for
	// a while, and the owner should not wait for it twice on every question.
	hwAssistantFallbackSticky = 5 * time.Minute
	// hwAssistantTimeoutStreak is the number of back-to-back timeouts of the
	// primary model that switch the order around; a success resets it.
	hwAssistantTimeoutStreak = 2
)

// hwAssistantSlow guards the timeout streak and the moment the backup model
// took over. It is process state on purpose: a stored value would need a
// table and a writer for something that only steers the next few minutes.
var hwAssistantSlow struct {
	mu        sync.Mutex
	streak    int
	untilMono time.Time
}

// hwAssistantFallbackFirst reports whether the backup model should go first,
// and is called once per question so the decision is stable within it.
func hwAssistantFallbackFirst(now time.Time) bool {
	hwAssistantSlow.mu.Lock()
	defer hwAssistantSlow.mu.Unlock()
	return now.Before(hwAssistantSlow.untilMono)
}

// hwAssistantNoteAttempt records the outcome of the primary model's attempt.
func hwAssistantNoteAttempt(primary bool, err error, now time.Time) {
	if !primary {
		return
	}
	timedOut := HwAssistantFailureClass(err) == "timeout"
	hwAssistantSlow.mu.Lock()
	defer hwAssistantSlow.mu.Unlock()
	if !timedOut {
		hwAssistantSlow.streak = 0
		return
	}
	hwAssistantSlow.streak++
	if hwAssistantSlow.streak >= hwAssistantTimeoutStreak {
		hwAssistantSlow.untilMono = now.Add(hwAssistantFallbackSticky)
	}
}

// hwAssistantRetryable reports whether a failed attempt deserves the other
// model: a timeout or a network error, or a 5xx from the route. A refusal
// (quota, key) says nothing about the model and is not retried.
func hwAssistantRetryable(err error) bool {
	if err == nil {
		return false
	}
	var statusErr *hwChatStatusError
	if errors.As(err, &statusErr) {
		return statusErr.StatusCode >= http.StatusInternalServerError
	}
	var netErr net.Error
	return errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) || errors.As(err, &netErr)
}

var errHwAssistantNotConfigured = errors.New("the assistant is not connected to the gateway")

var errHwAssistantEmpty = errors.New("the gateway returned an empty answer")

// HwAssistantFailureClass names the cause of a failed model call for the log,
// without the request or any key: not_configured, invalid_turns,
// refused_<status>, status_<status>, timeout, empty or network.
func HwAssistantFailureClass(err error) string {
	var statusErr *hwChatStatusError
	var netErr net.Error
	switch {
	case err == nil:
		return "none"
	case errors.Is(err, errHwAssistantNotConfigured):
		return "not_configured"
	case errors.Is(err, errHwAssistantInvalidTurns):
		return "invalid_turns"
	case errors.As(err, &statusErr) && hwChatStatusRefused(err):
		return fmt.Sprintf("refused_%d", statusErr.StatusCode)
	case errors.As(err, &statusErr):
		return fmt.Sprintf("status_%d", statusErr.StatusCode)
	case errors.Is(err, context.DeadlineExceeded), errors.As(err, &netErr) && netErr.Timeout():
		return "timeout"
	case errors.Is(err, errHwAssistantEmpty):
		return "empty"
	}
	return "network"
}

var errHwAssistantInvalidTurns = errors.New("invalid conversation")

// hwAssistantCall sends the conversation with the instruction in the first
// user message (the primary supplier replaces a customer system message) and
// returns the raw text of the answer. cut says the answer ran into the token
// limit, so its last line is broken off.
func hwAssistantCall(ctx context.Context, config HwAdminAgentConfig, instruction, label string, turns []HwAdminAgentTurn) (text string, cut bool, err error) {
	if config.BaseURL == "" || config.APIKey == "" {
		return "", false, errHwAssistantNotConfigured
	}
	turns, err = HwAdminAgentValidate(turns)
	if err != nil {
		return "", false, fmt.Errorf("%w: %w", errHwAssistantInvalidTurns, err)
	}
	// The last turn is the user's, so this never empties the conversation.
	for turns[0].Role != "user" {
		turns = turns[1:]
	}
	client := config.Client
	if client == nil {
		client = &http.Client{Timeout: hwAssistantClientTimeout}
	}
	messages := make([]hwChatMessage, 0, len(turns))
	for index, turn := range turns {
		content := turn.Content
		if index == 0 {
			content = instruction + "\n\n" + label + "\n" + content
		}
		messages = append(messages, hwAssistantMessage(turn.Role, content, turn.Attachments))
	}
	// attemptKeylessCall is one model call with a short wait; the caller only
	// sets the model and the wait, so both attempts follow the same path.
	attemptKeylessCall := func(model string, timeout time.Duration) (string, hwChatUsage, error) {
		attemptCtx, cancel := context.WithTimeout(ctx, timeout)
		defer cancel()
		request := hwChatRequest{Model: model, Messages: messages, MaxTokens: hwAssistantMaxTokens}
		answer, usage, err := hwCallChat(attemptCtx, client, config.BaseURL, config.APIKey, request)
		var statusErr *hwChatStatusError
		if errors.As(err, &statusErr) && (statusErr.StatusCode == http.StatusUnauthorized || statusErr.StatusCode == http.StatusForbidden) && HwAssistantRepairKey(config) {
			answer, usage, err = hwCallChat(attemptCtx, client, config.BaseURL, config.APIKey, request)
		}
		return answer, usage, err
	}
	primary := config.Model
	backup := config.FallbackModel
	if backup == primary {
		backup = ""
	}
	// attempt runs one model on its own wait and logs a failed one with its
	// class and duration, so a slow channel is visible in the log.
	attempt := func(number int, model string, timeout time.Duration) (string, hwChatUsage, error) {
		started := time.Now()
		answer, usage, err := attemptKeylessCall(model, timeout)
		if err != nil {
			common.SysLog(fmt.Sprintf("hw assistant attempt %d model %s failed: %s after %d ms", number, model, HwAssistantFailureClass(err), time.Since(started).Milliseconds()))
		}
		return answer, usage, err
	}
	// After two timeouts in a row the owner would wait again for a channel
	// that is known slow, so the backup model asks first for a while.
	type hwAssistantAttempt struct {
		number  int
		model   string
		timeout time.Duration
		primary bool
	}
	order := []hwAssistantAttempt{{number: 1, model: primary, timeout: hwAssistantAttemptTimeout, primary: true}}
	if backup != "" {
		if hwAssistantFallbackFirst(time.Now()) {
			order = []hwAssistantAttempt{
				{number: 1, model: backup, timeout: hwAssistantFallbackTimeout},
				{number: 2, model: primary, timeout: hwAssistantAttemptTimeout, primary: true},
			}
		} else {
			order = append(order, hwAssistantAttempt{number: 2, model: backup, timeout: hwAssistantFallbackTimeout})
		}
	}
	var usage hwChatUsage
	for index, step := range order {
		text, usage, err = attempt(step.number, step.model, step.timeout)
		if step.primary {
			hwAssistantNoteAttempt(true, err, time.Now())
		}
		if err == nil || index == len(order)-1 || !hwAssistantRetryable(err) {
			break
		}
	}
	if err != nil {
		return "", false, err
	}
	if strings.TrimSpace(text) == "" {
		return "", false, errHwAssistantEmpty
	}
	cut = usage.CompletionTokens >= hwAssistantMaxTokens
	if cut {
		common.SysLog(fmt.Sprintf("hw assistant answer hit the token limit of %d", hwAssistantMaxTokens))
	}
	return text, cut, nil
}

// hwAssistantDropCutLine removes the line the token limit broke off, or else
// the broken sentence, so a customer never reads an answer that stops in the
// middle of a word.
func hwAssistantDropCutLine(text string) string {
	text = strings.TrimSpace(text)
	if end := strings.LastIndex(text, "\n"); end > 0 {
		return strings.TrimSpace(text[:end])
	}
	if end := strings.LastIndexAny(text, ".!?"); end > 0 {
		return text[:end+1]
	}
	return text
}

// hwAssistantLastQuestion is the latest user message of the conversation.
func hwAssistantLastQuestion(turns []HwAdminAgentTurn) string {
	for index := len(turns) - 1; index >= 0; index-- {
		if turns[index].Role == "user" {
			return strings.TrimSpace(turns[index].Content)
		}
	}
	return ""
}

// hwAssistantReplyLang is the language of the question when its own words
// betray it, otherwise the panel language.
func hwAssistantReplyLang(question, lang string) string {
	if detected := hwAssistantQuestionLanguage(HwAssistantFold(question)); detected != "" {
		return detected
	}
	return hwAssistantLang(lang)
}

// hwAssistantGuardChannel replaces a leaking reply with the channel's identity
// line: Altuner in the admin panel, the digital assistant elsewhere.
func hwAssistantGuardChannel(reply, channel, lang string) string {
	if channel == HwAssistantChannelAdmin {
		return hwAssistantGuardReplyWithIdentity(reply, lang, HwAltunerIdentity)
	}
	return hwAssistantGuardReplyWithIdentity(reply, lang, HwAssistantIdentity)
}

// HwAssistantChat answers a conversation through the gateway with the shared
// instruction. ok is false when the model did not answer: the reply is then
// the fallback and the cause is logged, never shown.
func HwAssistantChat(ctx context.Context, config HwAdminAgentConfig, channel, lang string, turns []HwAdminAgentTurn) (reply string, ok bool) {
	question := hwAssistantLastQuestion(turns)
	label := "Customer message:"
	if channel == HwAssistantChannelAdmin {
		label = "Owner message:"
	}
	// A bare greeting such as "Hallo" fits several languages; the model then
	// guessed German on a Dutch page. It answers in the page language instead.
	shortRule := "If the latest message is too short to tell its language (only a greeting such as Hallo, Hi or Merhaba), answer in " +
		hwAssistantPick(hwAssistantReplyLang(question, lang), "Turkish", "English", "Dutch") + "."
	text, cut, err := hwAssistantCall(ctx, config, HwAssistantInstruction(channel, question)+"\n\n"+shortRule, label, turns)
	if cut {
		text = hwAssistantDropCutLine(text)
	}
	if err != nil {
		common.SysError(common.LogText("hw assistant %s answer fell back: %s", channel, HwAssistantFailureClass(err)))
		return HwAssistantFallback(channel, lang, question), false
	}
	return hwAssistantGuardChannel(strings.TrimSpace(text), channel, hwAssistantReplyLang(question, lang)), true
}

// HwAssistantFallback is the answer when the model does not answer: the fixed
// FAQ answer when the question matches one (the identity entry speaks as
// Altuner in the admin panel), otherwise a short human line that the answer is
// delayed, in the language of the question.
func HwAssistantFallback(channel, lang, question string) string {
	if entry, matched := HwAssistantMatch(question, lang); entry != nil {
		if channel == HwAssistantChannelAdmin && entry.ID == "identity" {
			return HwAltunerIdentity[hwAssistantLang(matched)]
		}
		return entry.Answer(matched)
	}
	return hwAssistantPick(hwAssistantReplyLang(question, lang),
		"Cevabım biraz gecikti. Bir dakika sonra tekrar yazar mısınız?",
		"My answer is running a little late. Could you try again in a minute?",
		"Mijn antwoord loopt wat vertraging op. Probeer je het over een minuutje opnieuw?")
}

// HwAssistantLimitedReply is the polite answer when the day budget of model
// answers is used up, in the language of the question.
func HwAssistantLimitedReply(lang, question string) string {
	return hwAssistantPick(hwAssistantReplyLang(question, lang),
		"Bugün için yazılı cevap sınırına ulaştınız. Hızlı sorular aşağıda duruyor, destek ekibimize de her zaman yazabilirsiniz. Yarın tekrar sormak ister misiniz?",
		"You have reached today's limit for written answers. The quick questions below still work, and support is always there for you. Would you like to ask again tomorrow?",
		"Je hebt de limiet van geschreven antwoorden voor vandaag bereikt. De snelle vragen hieronder werken nog en support helpt je altijd verder. Vraag je het morgen opnieuw?")
}
