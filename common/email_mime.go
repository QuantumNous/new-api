package common

import (
	"fmt"
	"strings"

	"golang.org/x/net/html"
)

// EmailOptions carries the deliverability headers that bulk senders must supply.
// Transactional mail leaves it zero-valued and keeps the historical single-part
// text/html shape.
type EmailOptions struct {
	// ListUnsubscribeURL is the HTTPS endpoint Gmail and Outlook call for
	// RFC 8058 one-click unsubscribe. Setting it also emits
	// List-Unsubscribe-Post, which mailbox providers require alongside it.
	ListUnsubscribeURL string
	// ListUnsubscribeMailto is an optional mailto: fallback for clients that
	// do not implement one-click unsubscribe.
	ListUnsubscribeMailto string
	// ReplyTo overrides the address recipients answer to.
	ReplyTo string
	// TextBody is the text/plain alternative. When empty and the caller asked
	// for multipart, it is derived from the HTML body.
	TextBody string
	// Multipart emits multipart/alternative with both a text/plain and a
	// text/html part instead of a bare text/html body.
	Multipart bool
}

// listUnsubscribeHeaderValue renders the header per RFC 2369: one or more
// angle-bracketed URIs separated by commas, HTTPS first so one-click clients
// pick it up. Entries that are not usable in a header are dropped rather than
// failing the send, so a misconfigured origin degrades the score instead of
// blocking delivery entirely.
func (o EmailOptions) listUnsubscribeHeaderValue() (string, bool) {
	entries := make([]string, 0, 2)
	if url := strings.TrimSpace(o.ListUnsubscribeURL); validListUnsubscribeURI(url, "http") {
		entries = append(entries, "<"+url+">")
	}
	if mailto := strings.TrimSpace(o.ListUnsubscribeMailto); validListUnsubscribeURI(mailto, "mailto:") {
		entries = append(entries, "<"+mailto+">")
	}
	if len(entries) == 0 {
		return "", false
	}
	// One-click requires an HTTP(S) endpoint; a mailto-only list cannot accept
	// the POST that List-Unsubscribe-Post advertises.
	oneClick := validListUnsubscribeURI(strings.TrimSpace(o.ListUnsubscribeURL), "http")
	return strings.Join(entries, ", "), oneClick
}

func validListUnsubscribeURI(value string, requiredPrefix string) bool {
	if value == "" || len(value) == len(requiredPrefix) {
		return false
	}
	if containsEmailHeaderBreak(value) || strings.ContainsAny(value, "<>,") {
		return false
	}
	return strings.HasPrefix(value, requiredPrefix)
}

// quotedPrintableEncode encodes a body per RFC 2045 so 8-bit UTF-8 content is
// declared rather than sent raw. Lines are soft-wrapped at 76 characters.
func quotedPrintableEncode(input string) string {
	const maxLineLength = 76
	var out strings.Builder
	lineLength := 0

	writeRaw := func(chunk string) {
		// A soft line break keeps the encoded line under the RFC limit while
		// preserving the decoded bytes exactly.
		if lineLength+len(chunk) > maxLineLength-1 {
			out.WriteString("=\r\n")
			lineLength = 0
		}
		out.WriteString(chunk)
		lineLength += len(chunk)
	}

	normalized := strings.ReplaceAll(input, "\r\n", "\n")
	normalized = strings.ReplaceAll(normalized, "\r", "\n")
	for i := 0; i < len(normalized); i++ {
		char := normalized[i]
		if char == '\n' {
			out.WriteString("\r\n")
			lineLength = 0
			continue
		}
		// Trailing whitespace before a line break must be encoded, otherwise
		// transport agents may strip it and break the signature.
		if (char == ' ' || char == '\t') && (i+1 >= len(normalized) || normalized[i+1] == '\n') {
			writeRaw(fmt.Sprintf("=%02X", char))
			continue
		}
		if char >= 33 && char <= 126 && char != '=' {
			writeRaw(string(char))
			continue
		}
		if char == ' ' || char == '\t' {
			writeRaw(string(char))
			continue
		}
		writeRaw(fmt.Sprintf("=%02X", char))
	}
	return out.String()
}

// htmlToPlainText derives a readable text/plain alternative from an HTML body.
// Anchor targets are appended in parentheses so the offer and unsubscribe links
// survive in the plain-text part.
func htmlToPlainText(htmlBody string) string {
	root, err := html.Parse(strings.NewReader(htmlBody))
	if err != nil {
		return strings.TrimSpace(htmlBody)
	}
	var builder strings.Builder
	collectPlainText(root, &builder)
	lines := strings.Split(builder.String(), "\n")
	cleaned := make([]string, 0, len(lines))
	for _, line := range lines {
		line = strings.Join(strings.Fields(line), " ")
		if line == "" {
			// Collapse runs of blank lines so the plain part stays compact.
			if len(cleaned) > 0 && cleaned[len(cleaned)-1] == "" {
				continue
			}
		}
		cleaned = append(cleaned, line)
	}
	return strings.TrimSpace(strings.Join(cleaned, "\n"))
}

var plainTextBlockElements = map[string]struct{}{
	"p": {}, "div": {}, "br": {}, "tr": {}, "li": {}, "table": {},
	"h1": {}, "h2": {}, "h3": {}, "h4": {}, "h5": {}, "h6": {},
	"section": {}, "article": {}, "header": {}, "footer": {}, "hr": {},
}

func collectPlainText(node *html.Node, builder *strings.Builder) {
	switch node.Type {
	case html.TextNode:
		builder.WriteString(node.Data)
		return
	case html.ElementNode:
		if node.Data == "style" || node.Data == "script" || node.Data == "head" {
			return
		}
		if _, isBlock := plainTextBlockElements[node.Data]; isBlock {
			builder.WriteString("\n")
		}
	}
	for child := node.FirstChild; child != nil; child = child.NextSibling {
		collectPlainText(child, builder)
	}
	if node.Type != html.ElementNode {
		return
	}
	if node.Data == "a" {
		if href := strings.TrimSpace(elementAttribute(node, "href")); href != "" && !strings.HasPrefix(href, "#") {
			builder.WriteString(" (" + href + ")")
		}
	}
	if _, isBlock := plainTextBlockElements[node.Data]; isBlock {
		builder.WriteString("\n")
	}
}

func elementAttribute(node *html.Node, name string) string {
	for _, attribute := range node.Attr {
		if strings.EqualFold(attribute.Key, name) {
			return attribute.Val
		}
	}
	return ""
}

// mimeBoundary derives a boundary from the Message-ID so the same message
// always renders byte-identical. Retries after an uncertain send must not
// produce a different body for the same Message-ID.
func mimeBoundary(messageID string) string {
	trimmed := strings.Trim(messageID, "<>")
	sanitized := make([]rune, 0, len(trimmed))
	for _, char := range trimmed {
		if (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9') {
			sanitized = append(sanitized, char)
			continue
		}
		sanitized = append(sanitized, '-')
	}
	boundary := "----=_NewAPI_" + string(sanitized)
	if len(boundary) > 68 {
		boundary = boundary[:68]
	}
	return boundary
}
