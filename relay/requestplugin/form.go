package requestplugin

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/requestpatch"
	"github.com/tidwall/gjson"
)

// formBody is a multipart/form-data client body whose text fields the stage
// hooks read as a JSON object.
type formBody struct {
	boundary string
	raw      []byte
	fields   []formField
	// files are the file parts, which hooks reach through utils.attachments.
	files []formFile
	// parts counts every part of the body, files included.
	parts int
}

// formFile is a file part with a field name and no transfer encoding; part is
// its position among the body's parts.
type formFile struct {
	part     int
	name     string
	filename string
	mime     string
}

// formField is a text field: a part with a field name, no file name and
// UTF-8 content. part is its position among the body's parts.
type formField struct {
	part  int
	name  string
	value string
}

var errFormLayout = errors.New("the form body is not complete")

// formBoundary is the boundary of a multipart/form-data content type; "" for
// any other content type.
func formBoundary(contentType string) string {
	mediaType, params, err := mime.ParseMediaType(contentType)
	if err != nil || !strings.EqualFold(mediaType, "multipart/form-data") {
		return ""
	}
	return params["boundary"]
}

// readForm reads the text fields of a multipart/form-data body and the JSON
// object the stage hooks read for them: field name to value, an array of
// values for a repeated field, in the order the fields first appear. File
// parts and encoded parts are not read.
func readForm(boundary string, raw []byte) (*formBody, []byte, error) {
	// The reader ends a body cut off after a delimiter as if it were whole.
	if !bytes.Contains(raw, []byte("--"+boundary+"--")) {
		return nil, nil, errFormLayout
	}
	form := &formBody{boundary: boundary, raw: raw}
	reader := multipart.NewReader(bytes.NewReader(raw), boundary)
	for ; ; form.parts++ {
		part, err := reader.NextRawPart()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, nil, err
		}
		switch strings.ToLower(part.Header.Get("Content-Transfer-Encoding")) {
		case "", "7bit", "8bit", "binary":
		default:
			_ = part.Close()
			continue
		}
		if part.FormName() != "" && part.FileName() != "" {
			mediaType, _, _ := mime.ParseMediaType(part.Header.Get("Content-Type"))
			form.files = append(form.files, formFile{part: form.parts, name: part.FormName(), filename: part.FileName(), mime: strings.ToLower(mediaType)})
		}
		if part.FormName() == "" || part.FileName() != "" {
			_ = part.Close()
			continue
		}
		value, err := io.ReadAll(part)
		_ = part.Close()
		if err != nil {
			return nil, nil, err
		}
		if utf8.Valid(value) {
			form.fields = append(form.fields, formField{part: form.parts, name: part.FormName(), value: string(value)})
		}
	}
	var names []string
	values := map[string][]string{}
	for _, field := range form.fields {
		if _, seen := values[field.name]; !seen {
			names = append(names, field.name)
		}
		values[field.name] = append(values[field.name], field.value)
	}
	var view bytes.Buffer
	view.WriteByte('{')
	for index, name := range names {
		if index > 0 {
			view.WriteByte(',')
		}
		key, err := common.Marshal(name)
		if err != nil {
			return nil, nil, err
		}
		var value []byte
		if len(values[name]) == 1 {
			value, err = common.Marshal(values[name][0])
		} else {
			value, err = common.Marshal(values[name])
		}
		if err != nil {
			return nil, nil, err
		}
		view.Write(key)
		view.WriteByte(':')
		view.Write(value)
	}
	view.WriteByte('}')
	return form, view.Bytes(), nil
}

// checkFormEffects refuses the effects a form body cannot take: anything
// other than json.patch replace operations with a string value.
func checkFormEffects(effects []requestpatch.Effect) error {
	for index, effect := range effects {
		if effect.Type == requestpatch.EffectMediaText {
			// A form file takes no new text; the host records it as not
			// rewritten.
			continue
		}
		if effect.Type != requestpatch.EffectJSONPatch {
			return fmt.Errorf("effects[%d]: a form body takes json.patch effects only", index)
		}
		for _, op := range effect.Ops {
			if op.Op != "replace" || gjson.ParseBytes(op.Value).Type != gjson.String {
				return fmt.Errorf("effects[%d]: a form body takes replace operations with a string value only", index)
			}
		}
	}
	return nil
}

// check refuses a patched view whose fields are not those of before, each
// a string or an array of as many strings, or whose values hold the form
// boundary: a form body takes new values for its text fields only.
func (f *formBody) check(before, after []byte) error {
	previous, next := gjson.ParseBytes(before), gjson.ParseBytes(after)
	same := next.IsObject() && len(previous.Map()) == len(next.Map())
	previous.ForEach(func(name, value gjson.Result) bool {
		patched := next.Get(gjson.Escape(name.Str))
		switch {
		case value.Type == gjson.String:
			same = same && patched.Type == gjson.String
		case !patched.IsArray() || len(patched.Array()) != len(value.Array()):
			same = false
		default:
			same = same && !slices.ContainsFunc(patched.Array(), func(item gjson.Result) bool { return item.Type != gjson.String })
		}
		return same
	})
	if !same {
		return errors.New("a form body takes new values for its text fields only")
	}
	if strings.Contains(string(after), f.boundary) {
		return errors.New("a form field value must not contain the form boundary")
	}
	return nil
}

// rebuild writes the form body again with the text field values of view, a
// view check accepted: the parts whose value did not change, files
// included, stay byte for byte, in their order and with the same boundary.
func (f *formBody) rebuild(view []byte) ([]byte, error) {
	patched := gjson.ParseBytes(view)
	values := map[int]string{}
	seen := map[string]int{}
	for _, field := range f.fields {
		value := patched.Get(gjson.Escape(field.name))
		if value.IsArray() {
			value = value.Array()[seen[field.name]]
		}
		seen[field.name]++
		if value.Str != field.value {
			values[field.part] = value.Str
		}
	}
	if len(values) == 0 {
		return f.raw, nil
	}
	first, newline, segments, err := f.segments()
	if err != nil {
		return nil, err
	}
	delimiter := append(slices.Clone(newline), "--"+f.boundary...)
	for index, value := range values {
		segment := segments[index+1]
		start, err := contentStart(segment, newline)
		if err != nil {
			return nil, err
		}
		segments[index+1] = append(segment[:start:start], value...)
	}
	rebuilt := bytes.Join(segments, delimiter)
	return append(slices.Clone(f.raw[:first]), rebuilt[len(newline):]...), nil
}

// fileContent is the content of a file part, a slice of the raw body.
func (f *formBody) fileContent(file formFile) ([]byte, error) {
	_, newline, segments, err := f.segments()
	if err != nil {
		return nil, err
	}
	segment := segments[file.part+1]
	start, err := contentStart(segment, newline)
	if err != nil {
		return nil, err
	}
	return segment[start:], nil
}

// segments splits the raw body at its delimiters: first is the offset of the
// first delimiter and newline the body's line break. Segment i+1 is part i,
// from the end of its delimiter to the line break before the next one.
func (f *formBody) segments() (int, []byte, [][]byte, error) {
	// The first delimiter starts a line; its line break is the body's.
	dashBoundary := []byte("--" + f.boundary)
	first := -1
	for offset := 0; first < 0; {
		index := bytes.Index(f.raw[offset:], dashBoundary)
		if index < 0 {
			return 0, nil, nil, errFormLayout
		}
		if index += offset; index == 0 || f.raw[index-1] == '\n' {
			first = index
		}
		offset = index + 1
	}
	lineEnd := bytes.IndexByte(f.raw[first:], '\n')
	if lineEnd < 0 {
		return 0, nil, nil, errFormLayout
	}
	newline := []byte("\r\n")
	if lineEnd == 0 || f.raw[first+lineEnd-1] != '\r' {
		newline = []byte("\n")
	}
	// A part runs from the end of one delimiter to the start of the next:
	// the rest of the delimiter line, the headers, a blank line, the content.
	// Segment 0 is empty, before the first delimiter. The segments are
	// slices of the raw body, not a copy.
	delimiter := append(slices.Clone(newline), dashBoundary...)
	segments := append([][]byte{nil}, bytes.Split(f.raw[first:], delimiter)...)
	segments[1] = segments[1][len(dashBoundary):]
	if len(segments) != f.parts+2 || !bytes.HasPrefix(segments[len(segments)-1], []byte("--")) {
		return 0, nil, nil, errFormLayout
	}
	return first, newline, segments, nil
}

// contentStart is the offset of a part's content in its segment: past the
// rest of the delimiter line, the headers and the blank line after them.
func contentStart(segment, newline []byte) (int, error) {
	start := bytes.Index(segment, newline)
	if start < 0 {
		return 0, errFormLayout
	}
	if bytes.HasPrefix(segment[start+len(newline):], newline) {
		return start + 2*len(newline), nil
	}
	blankLine := append(slices.Clone(newline), newline...)
	if headersEnd := bytes.Index(segment[start:], blankLine); headersEnd >= 0 {
		return start + headersEnd + len(blankLine), nil
	}
	return 0, errFormLayout
}
