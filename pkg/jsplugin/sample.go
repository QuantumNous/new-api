package jsplugin

import (
	"encoding/json"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/MoeForge/moego/regexp"
	"github.com/QuantumNous/new-api/common"
	"github.com/tidwall/gjson"
)

// Limits of meta.samples, part of the published plugin contract
// (docs/plugin-api/v1.md).
const (
	maxSamples           = 8
	maxSamplesPerLang    = 3
	maxSampleNameRunes   = 64
	maxSampleBodyBytes   = 16 << 10
	maxSampleReplyBytes  = 4 << 10
	minSampleBase64Runes = 100
)

// sampleImage stands for one whole image part when it is an element of a
// content or parts array of a sample body; the console puts its own image
// there.
const sampleImage = "[sample-image]"

// sampleFormats are the request formats a sample may use.
var sampleFormats = []string{"openai", "openai_responses", "claude", "gemini"}

var (
	sampleLangPattern   = regexp.MustCompile(`^[a-z]{2,3}$`)
	sampleURLPattern    = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9+.-]*://\S*$`)
	sampleBase64Pattern = regexp.MustCompile(`^[A-Za-z0-9+/=_-]+$`)
	sampleMediaPattern  = regexp.MustCompile(`\[media:\d+\]`)
)

// Sample is one entry of meta.samples: a request the request plugin editor
// offers to try the plugin with. Body is the request body as the plugin wrote
// it, members in their order. Samples carry text only; the console supplies
// images.
type Sample struct {
	Name LocalizedText `json:"name"`
	// Lang is the base language of the sample text, "" for any language.
	Lang   string          `json:"lang,omitempty"`
	Format string          `json:"format"`
	Body   json.RawMessage `json:"body"`
	// Reply is a sample assistant answer for a plugin's reply check.
	Reply string `json:"reply,omitempty"`
}

// decodeSamples reads meta.samples from the JSON text the plugin wrote and
// checks that it carries text only.
func decodeSamples(text []byte) ([]Sample, error) {
	value := gjson.ParseBytes(text)
	if !value.IsArray() {
		return nil, fmt.Errorf("plugin meta samples must be an array")
	}
	items := value.Array()
	if len(items) > maxSamples {
		return nil, fmt.Errorf("plugin meta samples must not exceed %d entries", maxSamples)
	}
	samples := make([]Sample, 0, len(items))
	perLang := map[string]int{}
	for index, item := range items {
		subject := fmt.Sprintf("plugin meta samples[%d]", index)
		if !item.IsObject() {
			return nil, fmt.Errorf("%s must be an object", subject)
		}
		var object map[string]any
		if err := common.UnmarshalJsonStr(item.Raw, &object); err != nil {
			return nil, fmt.Errorf("%s must be an object", subject)
		}
		for member := range object {
			if !slices.Contains([]string{"name", "lang", "format", "body", "reply"}, member) {
				return nil, fmt.Errorf("%s has unknown member %q", subject, member)
			}
		}
		var sample Sample
		name, err := decodeLocalizedText(object["name"], subject+".name", maxSampleNameRunes)
		if err != nil {
			return nil, err
		}
		sample.Name = name
		if lang, present := object["lang"]; present {
			if sample.Lang, _ = lang.(string); !sampleLangPattern.MatchString(sample.Lang) {
				return nil, fmt.Errorf(`%s.lang must be a base language code such as "en" or "zh"`, subject)
			}
		}
		perLang[sample.Lang]++
		if perLang[sample.Lang] > maxSamplesPerLang {
			return nil, fmt.Errorf("%s: at most %d samples may share a lang", subject, maxSamplesPerLang)
		}
		if sample.Format, _ = object["format"].(string); !slices.Contains(sampleFormats, sample.Format) {
			return nil, fmt.Errorf("%s.format must be one of %s", subject, strings.Join(sampleFormats, ", "))
		}
		body := item.Get("body")
		if !body.IsObject() {
			return nil, fmt.Errorf("%s.body must be an object", subject)
		}
		if len(body.Raw) > maxSampleBodyBytes {
			return nil, fmt.Errorf("%s.body must not exceed %d bytes", subject, maxSampleBodyBytes)
		}
		if err := checkSampleValue(body, subject+".body", false); err != nil {
			return nil, err
		}
		sample.Body = json.RawMessage(body.Raw)
		if reply, present := object["reply"]; present {
			text, isString := reply.(string)
			if !isString || text == "" || len(text) > maxSampleReplyBytes {
				return nil, fmt.Errorf("%s.reply must be a non-empty string of at most %d bytes", subject, maxSampleReplyBytes)
			}
			if err := checkSampleString(text, subject+".reply", false); err != nil {
				return nil, err
			}
			sample.Reply = text
		}
		samples = append(samples, sample)
	}
	return samples, nil
}

// checkSampleValue refuses media and links anywhere in a sample body. path is
// the JSON path of value; element tells an array element, the only place the
// image placeholder may stand.
func checkSampleValue(value gjson.Result, path string, element bool) error {
	switch {
	case value.Type == gjson.String:
		return checkSampleString(value.Str, path, element)
	case value.IsArray():
		index := 0
		var err error
		value.ForEach(func(_, item gjson.Result) bool {
			err = checkSampleValue(item, path+"["+strconv.Itoa(index)+"]", true)
			index++
			return err == nil
		})
		return err
	case value.IsObject():
		members := map[string]gjson.Result{}
		var err error
		value.ForEach(func(key, member gjson.Result) bool {
			members[key.Str] = member
			switch key.Str {
			case "inlineData", "inline_data", "fileData", "file_data":
				err = fmt.Errorf("%s.%s: samples must not carry media", path, key.Str)
			default:
				err = checkSampleValue(member, path+"."+key.Str, false)
			}
			return err == nil
		})
		if err != nil {
			return err
		}
		if _, present := members["data"]; present {
			for _, name := range []string{"media_type", "mimeType", "mime_type"} {
				if _, typed := members[name]; typed {
					return fmt.Errorf("%s.data: samples must not carry media", path)
				}
			}
		}
		if kind := members["type"]; kind.Type == gjson.String && kind.Str == "base64" {
			return fmt.Errorf("%s.type: samples must not carry base64 media", path)
		}
	}
	return nil
}

// checkSampleString refuses a string that is or looks like media or a link.
func checkSampleString(text, path string, element bool) error {
	trimmed := strings.TrimSpace(text)
	switch {
	case strings.HasPrefix(strings.ToLower(trimmed), "data:"):
		return fmt.Errorf("%s: samples must not carry data: URLs", path)
	case utf8.RuneCountInString(trimmed) >= minSampleBase64Runes && sampleBase64Pattern.MatchString(trimmed):
		return fmt.Errorf("%s: samples must not carry base64 data", path)
	case sampleURLPattern.MatchString(trimmed):
		return fmt.Errorf("%s: samples must not be links", path)
	case sampleMediaPattern.MatchString(text):
		return fmt.Errorf("%s: samples must not carry media placeholders", path)
	case strings.Contains(text, sampleImage) && (!element || text != sampleImage):
		return fmt.Errorf("%s: %s must be a whole element of a content or parts array", path, sampleImage)
	}
	return nil
}
