package service

import (
	"bytes"
	"errors"
	"io"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/model"
	"github.com/tidwall/gjson"
	"golang.org/x/net/html"
)

var iqRootStart = regexp.MustCompile(`(?i)<(html|svg)(?:\s|>|/)`)

// ExtractIQArtifact recognizes complete documents without fetching anything.
// This normalization is NOT a script sanitizer: the dedicated opaque-origin
// frontend sandbox/CSP remains mandatory even for normalized artifacts.
func ExtractIQArtifact(text string) (string, string, error) {
	if len(text) > model.IQMaxResponseBytes || !utf8.ValidString(text) {
		return "", "", errors.New("invalid or oversized output")
	}
	matches := iqRootStart.FindAllStringSubmatchIndex(text, -1)
	// Prefer the whole HTML scene to its nested SVG.
	for _, kind := range []string{"html", "svg"} {
		for _, m := range matches {
			if !strings.EqualFold(text[m[2]:m[3]], kind) {
				continue
			}
			candidate := text[m[0]:]
			z := html.NewTokenizer(strings.NewReader(candidate))
			depth := 0
			end := 0
			found := false
			for {
				tt := z.Next()
				if tt == html.ErrorToken {
					break
				}
				end += len(z.Raw())
				token := z.Token()
				if strings.EqualFold(token.Data, kind) {
					switch tt {
					case html.StartTagToken:
						depth++
					case html.SelfClosingTagToken:
						if depth == 0 {
							found = true
						}
					case html.EndTagToken:
						depth--
						if depth == 0 {
							found = true
						}
					}
				}
				if found {
					break
				}
			}
			if !found {
				continue
			}
			candidate = candidate[:end]
			if len(candidate) > model.IQMaxArtifactBytes {
				return "", "", errors.New("artifact exceeds 1 MiB")
			}
			doc, err := html.Parse(strings.NewReader(candidate))
			if err != nil {
				return "", "", errors.New("invalid markup")
			}
			var root *html.Node
			var find func(*html.Node)
			find = func(n *html.Node) {
				if root != nil {
					return
				}
				if n.Type == html.ElementNode && n.Data == kind {
					root = n
					return
				}
				for c := n.FirstChild; c != nil; c = c.NextSibling {
					find(c)
				}
			}
			find(doc)
			if root == nil {
				continue
			}
			normalizeIQMarkup(root)
			var out bytes.Buffer
			if err := html.Render(&out, root); err != nil {
				return "", "", err
			}
			if out.Len() > model.IQMaxArtifactBytes {
				return "", "", errors.New("normalized artifact exceeds 1 MiB")
			}
			return kind, out.String(), nil
		}
		if kind == "html" {
			for _, m := range matches {
				if strings.EqualFold(text[m[2]:m[3]], "html") {
					return "", "", errors.New("incomplete HTML document")
				}
			}
		}
	}
	return "", "", errors.New("no complete HTML or SVG document")
}
func normalizeIQMarkup(n *html.Node) {
	for c := n.FirstChild; c != nil; {
		next := c.NextSibling
		remove := false
		if c.Type == html.ElementNode {
			switch c.Data {
			case "base", "meta", "iframe", "frame", "frameset", "object", "embed", "form", "link":
				remove = true
			}
			attrs := c.Attr[:0]
			for _, a := range c.Attr {
				key := strings.ToLower(a.Key)
				value := strings.TrimSpace(a.Val)
				switch key {
				case "src", "href", "action", "formaction", "poster", "data":
					safe := strings.HasPrefix(value, "#") || strings.HasPrefix(value, "data:") || strings.HasPrefix(value, "blob:")
					if c.Data == "script" && key == "src" {
						remove = true
					}
					if !safe {
						continue
					}
				case "srcset", "srcdoc", "target", "ping":
					continue
				}
				attrs = append(attrs, a)
			}
			c.Attr = attrs
		}
		if remove {
			n.RemoveChild(c)
		} else {
			normalizeIQMarkup(c)
		}
		c = next
	}
}

// IQVisibleText consumes normalized native/chat responses. Only final assistant
// text is eligible; reasoning, tool arguments, attachments and URLs aren't.
// Streaming snapshots supersede deltas to avoid duplicating Responses output.
func IQVisibleText(body []byte, stream bool) (string, error) {
	if len(body) > model.IQMaxResponseBytes {
		return "", errors.New("response exceeds 2 MiB")
	}
	if !stream {
		if !gjson.ValidBytes(body) {
			return "", errors.New("invalid response JSON")
		}
		return iqJSONText(gjson.ParseBytes(body))
	}
	var deltas strings.Builder
	final := ""
	finalSeen := false
	complete := false
	bad := false
	for _, line := range bytes.Split(body, []byte("\n")) {
		line = bytes.TrimSpace(line)
		if !bytes.HasPrefix(line, []byte("data:")) {
			continue
		}
		data := bytes.TrimSpace(bytes.TrimPrefix(line, []byte("data:")))
		if bytes.Equal(data, []byte("[DONE]")) {
			complete = true
			continue
		}
		if !gjson.ValidBytes(data) {
			continue
		}
		v := gjson.ParseBytes(data)
		typ := v.Get("type").String()
		switch typ {
		case "response.completed":
			finalSeen = true
			t, e := iqJSONText(v.Get("response"))
			if e != nil {
				bad = true
			} else {
				final = t
			}
			complete = true
		case "response.failed", "response.incomplete", "error":
			bad = true
		case "response.output_text.delta":
			deltas.WriteString(v.Get("delta").String())
		case "content_block_start":
			if v.Get("content_block.type").String() == "text" {
				deltas.WriteString(v.Get("content_block.text").String())
			}
		case "content_block_delta":
			if v.Get("delta.type").String() == "text_delta" {
				deltas.WriteString(v.Get("delta.text").String())
			}
		case "message_stop":
			complete = true
		case "message_delta":
			reason := v.Get("delta.stop_reason").String()
			if reason == "max_tokens" {
				bad = true
			}
		default:
			if choices := v.Get("choices"); choices.IsArray() {
				for _, c := range choices.Array() {
					if c.Get("index").Int() != 0 {
						continue
					}
					reason := c.Get("finish_reason").String()
					if reason != "" {
						complete = true
						if reason != "stop" {
							bad = true
						}
					}
					d := c.Get("delta.content")
					if d.Type == gjson.String {
						deltas.WriteString(d.String())
					}
				}
			}
			if v.Get("candidates").Exists() {
				t, e := iqJSONText(v)
				if e != nil {
					bad = true
				} else {
					deltas.WriteString(t)
				}
				if v.Get("candidates.0.finishReason").String() == "STOP" {
					complete = true
				}
			}
		}
	}
	if bad || !complete {
		return "", errors.New("incomplete model output")
	}
	if finalSeen {
		return final, nil
	}
	return deltas.String(), nil
}
func iqJSONText(v gjson.Result) (string, error) {
	if v.Get("error").Exists() || (v.Get("status").Exists() && v.Get("status").String() != "completed") {
		return "", errors.New("incomplete model output")
	}
	var text strings.Builder
	if choices := v.Get("choices"); choices.IsArray() {
		for _, c := range choices.Array() {
			if c.Get("index").Int() != 0 {
				continue
			}
			if role := c.Get("message.role").String(); role != "" && role != "assistant" {
				continue
			}
			reason := c.Get("finish_reason").String()
			if reason != "stop" && reason != "" {
				return "", errors.New("incomplete model output")
			}
			content := c.Get("message.content")
			if content.Type == gjson.String {
				text.WriteString(content.String())
			} else {
				iqTextBlocks(&text, content)
			}
		}
	}
	if v.Get("output").IsArray() {
		for _, o := range v.Get("output").Array() {
			if o.Get("type").String() == "message" && o.Get("role").String() == "assistant" {
				iqTextBlocks(&text, o.Get("content"))
			}
		}
	}
	if v.Get("content").IsArray() {
		if reason := v.Get("stop_reason").String(); reason != "" && reason != "end_turn" && reason != "stop_sequence" {
			return "", errors.New("incomplete model output")
		}
		iqTextBlocks(&text, v.Get("content"))
	}
	if v.Get("candidates").IsArray() {
		for i, c := range v.Get("candidates").Array() {
			if i > 0 {
				break
			}
			reason := c.Get("finishReason").String()
			if reason != "" && reason != "STOP" {
				return "", errors.New("incomplete model output")
			}
			for _, p := range c.Get("content.parts").Array() {
				if !p.Get("thought").Bool() {
					text.WriteString(p.Get("text").String())
				}
			}
		}
	}
	return text.String(), nil
}
func iqTextBlocks(out io.StringWriter, blocks gjson.Result) {
	for _, b := range blocks.Array() {
		if t := b.Get("type").String(); t == "text" || t == "output_text" {
			_, _ = out.WriteString(b.Get("text").String())
		}
	}
}
