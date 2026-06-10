package deepseek

import (
	"strings"

	"github.com/QuantumNous/new-api/dto"
)

func normalizeClaudeSystemMessagesForNonNativeUpstream(request *dto.ClaudeRequest) {
	if request == nil || len(request.Messages) == 0 {
		return
	}

	normalizedMessages := make([]dto.ClaudeMessage, 0, len(request.Messages))
	var pendingSystems []string

	for _, message := range request.Messages {
		if message.Role != "system" {
			if message.Role == "user" && len(pendingSystems) > 0 {
				mergeSystemTextIntoUserMessage(&message, strings.Join(pendingSystems, "\n\n"), true)
				pendingSystems = nil
			}
			normalizedMessages = append(normalizedMessages, message)
			continue
		}

		systemText := claudeSystemMessageText(message)
		if systemText == "" {
			continue
		}
		if len(normalizedMessages) > 0 && normalizedMessages[len(normalizedMessages)-1].Role == "user" {
			mergeSystemTextIntoUserMessage(&normalizedMessages[len(normalizedMessages)-1], systemText, false)
			continue
		}
		pendingSystems = append(pendingSystems, systemText)
	}

	if len(pendingSystems) > 0 {
		mergePendingSystemTextIntoLastUser(normalizedMessages, strings.Join(pendingSystems, "\n\n"))
	}
	request.Messages = normalizedMessages
}

func mergePendingSystemTextIntoLastUser(messages []dto.ClaudeMessage, systemText string) {
	for i := len(messages) - 1; i >= 0; i-- {
		if messages[i].Role == "user" {
			mergeSystemTextIntoUserMessage(&messages[i], systemText, false)
			return
		}
	}
}

func claudeSystemMessageText(message dto.ClaudeMessage) string {
	if message.IsStringContent() {
		return strings.TrimSpace(message.GetStringContent())
	}
	contents, err := message.ParseContent()
	if err != nil {
		return strings.TrimSpace(message.GetStringContent())
	}
	var builder strings.Builder
	for _, content := range contents {
		if content.Type == dto.ContentTypeText {
			builder.WriteString(content.GetText())
		}
	}
	return strings.TrimSpace(builder.String())
}

func mergeSystemTextIntoUserMessage(message *dto.ClaudeMessage, systemText string, prepend bool) {
	if systemText == "" {
		return
	}
	if message.IsStringContent() {
		userText := message.GetStringContent()
		if prepend {
			message.SetStringContent(joinClaudeText(systemText, userText))
		} else {
			message.SetStringContent(joinClaudeText(userText, systemText))
		}
		return
	}

	systemTextBlock := dto.ClaudeMediaMessage{Type: dto.ContentTypeText}
	systemTextBlock.SetText(systemText)
	contents, err := message.ParseContent()
	if err != nil || len(contents) == 0 {
		if prepend {
			message.SetStringContent(joinClaudeText(systemText, message.GetStringContent()))
		} else {
			message.SetStringContent(joinClaudeText(message.GetStringContent(), systemText))
		}
		return
	}
	if prepend {
		message.SetContent(append([]dto.ClaudeMediaMessage{systemTextBlock}, contents...))
	} else {
		message.SetContent(append(contents, systemTextBlock))
	}
}

func joinClaudeText(first string, second string) string {
	first = strings.TrimSpace(first)
	second = strings.TrimSpace(second)
	if first == "" {
		return second
	}
	if second == "" {
		return first
	}
	return first + "\n\n" + second
}
