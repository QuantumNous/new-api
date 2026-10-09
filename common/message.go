package common

import (
	"fmt"
	"strings"

	"github.com/gin-gonic/gin"
)

// Message is text shown in the web console. Key is the English source text and
// also its key in web/src/i18n/locales; Params fill its {{name}} placeholders.
// The web console translates Key with Params, so the backend only renders the
// English text, for API callers and log fallbacks. Params carry display-ready
// values: format quota with logger.FormatQuota before passing it.
type Message struct {
	Key    string         `json:"key"`
	Params map[string]any `json:"params,omitempty"`
}

func NewMessage(key string, params ...map[string]any) *Message {
	message := &Message{Key: key}
	if len(params) > 0 && len(params[0]) > 0 {
		message.Params = params[0]
	}
	return message
}

// Error renders the English text, so a Message can be returned as an error and
// reach the web console through ApiError.
func (m *Message) Error() string {
	if len(m.Params) == 0 {
		return m.Key
	}
	// One pass over the key, so a value that contains "{{name}}" stays as is.
	pairs := make([]string, 0, len(m.Params)*2)
	for name, value := range m.Params {
		pairs = append(pairs, "{{"+name+"}}", fmt.Sprint(value))
	}
	return strings.NewReplacer(pairs...).Replace(m.Key)
}

// Fields returns the response fields the web console translates. Callers put
// the English text in the field their response shape already uses.
func (m *Message) Fields() gin.H {
	fields := gin.H{"message_key": m.Key}
	if len(m.Params) > 0 {
		fields["message_params"] = m.Params
	}
	return fields
}

// JoinMessages renders messages as one English line, the fallback stored next
// to structured log content.
func JoinMessages(messages []*Message) string {
	texts := make([]string, 0, len(messages))
	for _, message := range messages {
		texts = append(texts, message.Error())
	}
	return strings.Join(texts, ", ")
}
