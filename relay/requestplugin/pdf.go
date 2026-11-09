package requestplugin

import (
	"bytes"
	"compress/zlib"
	"errors"
	"io"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf16"
	"unicode/utf8"

	"github.com/ledongthuc/pdf"
)

// Bounds of reading a PDF. checkPDF holds a file to them before the pdf
// library reads it, since the library sizes tables and buffers from numbers
// in the file: object numbers, xref field widths and predictor columns. Past
// a bound the file is unchecked; past the page and content bounds its text is
// truncated.
const (
	maxPDFPages        = 100
	maxPDFObjects      = 200_000
	maxPDFObjectValues = 100_000
	maxPDFDepth        = 64
	maxPDFXrefSections = 64
	maxPDFColumns      = 4096
	// Object streams are decompressed whole each time the library reads an
	// object in them.
	maxPDFObjStmBytes = 2 << 20
	maxPDFObjStmTotal = 16 << 20
	// Content streams, decompressed: per page and in all.
	maxPDFContentBytes = 4 << 20
	maxPDFContentTotal = 32 << 20
	maxPDFCMapBytes    = 256 << 10
	maxPDFCMapCodes    = 1 << 16
	maxPDFDifferences  = 1024
	maxPDFFormDepth    = 4
	maxPDFOperands     = 16
	maxPDFArrayItems   = 8192
)

var (
	errPDFLimit  = errors.New("the PDF is past a reading limit")
	errPDFSyntax = errors.New("the PDF is malformed")
	errPDFTime   = errors.New("reading the PDF ran out of time")
)

// pdfText reads the text of a PDF: its first maxPDFPages pages, at most
// maxChars UTF-16 code units, until deadline. Encrypted files are unreadable.
func pdfText(data []byte, maxChars int, deadline time.Time) (result extractedText) {
	if reason := checkPDF(data, deadline); reason != "" {
		return extractedText{unchecked: reason}
	}
	source := &pdfSource{data: data, deadline: deadline}
	extractor := &pdfExtractor{source: source, sink: textSink{max: maxChars}, contentLeft: maxPDFContentTotal}
	defer func() {
		if recover() != nil {
			extractor.failed = true
			result = extractor.result()
		}
	}()
	reader, err := pdf.NewReader(source, int64(len(data)))
	if err != nil {
		extractor.failed = true
		return extractor.result()
	}
	pages := reader.NumPage()
	if pages > maxPDFPages {
		extractor.cut = true
	}
	for number := 1; number <= min(pages, maxPDFPages) && !extractor.done(); number++ {
		page := reader.Page(number)
		if page.V.IsNull() {
			continue
		}
		extractor.sink.newline()
		extractor.readContent(page.V.Key("Contents"), page.Resources(), 0)
	}
	return extractor.result()
}

// pdfSource is the file as the library reads it: every read past the
// deadline fails, which ends the library's work.
type pdfSource struct {
	data     []byte
	deadline time.Time
	expired  bool
}

func (s *pdfSource) ReadAt(p []byte, offset int64) (int, error) {
	if s.expired || time.Now().After(s.deadline) {
		s.expired = true
		return 0, errPDFTime
	}
	if offset < 0 || offset >= int64(len(s.data)) {
		return 0, io.EOF
	}
	n := copy(p, s.data[offset:])
	if n < len(p) {
		return n, io.EOF
	}
	return n, nil
}

type pdfExtractor struct {
	source *pdfSource
	sink   textSink
	// contentLeft is what the content bound leaves; cut marks text left out
	// by a bound, failed a file the library stopped reading.
	contentLeft int
	cut         bool
	failed      bool
}

func (e *pdfExtractor) done() bool {
	return e.sink.truncated || e.source.expired || e.contentLeft <= 0
}

// result is the text read, truncated when a bound, the deadline or a failure
// left some out. A file with no text is unchecked: it ran out of time,
// failed, or has no text layer, as a scan has none.
func (e *pdfExtractor) result() extractedText {
	text := strings.TrimSpace(e.sink.text.String())
	switch {
	case text != "":
		return extractedText{text: text, truncated: e.sink.truncated || e.cut || e.source.expired || e.failed || e.contentLeft <= 0}
	case e.source.expired:
		return extractedText{unchecked: uncheckedTooLarge}
	case e.failed:
		return extractedText{unchecked: uncheckedUnreadable}
	}
	return extractedText{unchecked: uncheckedNoText}
}

// readContent reads the text of contents, a content stream or an array of
// them, with the fonts and forms of resources.
func (e *pdfExtractor) readContent(contents, resources pdf.Value, depth int) {
	parts := []pdf.Value{contents}
	if contents.Kind() == pdf.Array {
		parts = parts[:0]
		for index := 0; index < contents.Len(); index++ {
			parts = append(parts, contents.Index(index))
		}
	}
	limit := min(maxPDFContentBytes, e.contentLeft)
	var data []byte
	for _, part := range parts {
		if part.Kind() != pdf.Stream || len(data) > limit {
			continue
		}
		read, ok := readPDFStream(part, limit+1-len(data))
		if !ok {
			continue
		}
		data = append(append(data, read...), '\n')
	}
	if len(data) > limit {
		data, e.cut = data[:limit], true
	}
	e.contentLeft -= len(data)
	e.interpret(data, resources, depth)
}

// readPDFStream reads at most limit decompressed bytes of a stream; false
// when the library cannot decode it.
func readPDFStream(stream pdf.Value, limit int) (data []byte, ok bool) {
	defer func() {
		if recover() != nil {
			data, ok = nil, false
		}
	}()
	reader := stream.Reader()
	defer reader.Close()
	data, err := io.ReadAll(io.LimitReader(reader, int64(limit)))
	return data, err == nil || len(data) > 0
}

// interpret reads the text operators of a content stream.
func (e *pdfExtractor) interpret(data []byte, resources pdf.Value, depth int) {
	lexer := pdfLexer{data: data}
	fonts := map[string]func(string) string{}
	decode := latin1Text
	var operands []pdfToken
	for count := 0; !e.done(); count++ {
		if count%4096 == 0 && time.Now().After(e.source.deadline) {
			e.source.expired = true
			return
		}
		token := lexer.next()
		switch token.kind {
		case 0:
			return
		case '[':
			token = lexer.array()
		case '{':
			lexer.skipDict()
			token = pdfToken{kind: '{'}
		case 'k':
			operator := string(token.text)
			last := pdfToken{}
			if len(operands) > 0 {
				last = operands[len(operands)-1]
			}
			switch operator {
			case "BT", "T*":
				e.sink.newline()
			case "Td", "TD":
				if len(operands) >= 2 && operands[len(operands)-1].number() != 0 {
					e.sink.newline()
				}
			case "Tf":
				if len(operands) >= 2 && operands[len(operands)-2].kind == 'n' {
					name := string(operands[len(operands)-2].text)
					if fonts[name] == nil {
						fonts[name] = e.font(resources, name)
					}
					decode = fonts[name]
				}
			case "Tj":
				if last.kind == 's' {
					e.sink.write(decode(string(last.text)))
				}
			case "'", "\"":
				e.sink.newline()
				if last.kind == 's' {
					e.sink.write(decode(string(last.text)))
				}
			case "TJ":
				for _, item := range last.items {
					if item.kind == 's' {
						e.sink.write(decode(string(item.text)))
					} else if item.number() <= -250 {
						e.sink.write(" ")
					}
				}
			case "Do":
				if last.kind == 'n' && depth < maxPDFFormDepth {
					e.readForm(resources, string(last.text), depth)
				}
			case "BI":
				lexer.skipInlineImage()
			}
			operands = operands[:0]
			continue
		}
		if len(operands) == maxPDFOperands {
			operands = append(operands[:0], operands[1:]...)
		}
		operands = append(operands, token)
	}
}

func (e *pdfExtractor) readForm(resources pdf.Value, name string, depth int) {
	defer func() { _ = recover() }()
	form := resources.Key("XObject").Key(name)
	if form.Kind() != pdf.Stream || form.Key("Subtype").Name() != "Form" {
		return
	}
	formResources := form.Key("Resources")
	if formResources.Kind() != pdf.Dict {
		formResources = resources
	}
	e.readContent(form, formResources, depth+1)
}

// font returns the text decoder of a font: its ToUnicode map read here, or
// the library's encoder for a font without one. The library's own ToUnicode
// reader sizes its tables from counts in the file, so it is never used.
func (e *pdfExtractor) font(resources pdf.Value, name string) (decode func(string) string) {
	decode = latin1Text
	defer func() {
		if recover() != nil {
			decode = latin1Text
		}
	}()
	font := resources.Key("Font").Key(name)
	if font.Kind() != pdf.Dict {
		return latin1Text
	}
	if toUnicode := font.Key("ToUnicode"); toUnicode.Kind() == pdf.Stream {
		if data, ok := readPDFStream(toUnicode, maxPDFCMapBytes+1); ok && len(data) <= maxPDFCMapBytes {
			if cmap := parseToUnicode(data); cmap != nil {
				return cmap.decode
			}
		}
		return latin1Text
	}
	encoding := font.Key("Encoding")
	if encoding.Kind() == pdf.Dict && encoding.Key("Differences").Len() > maxPDFDifferences {
		return latin1Text
	}
	encoder := (&pdf.Font{V: font}).Encoder()
	if encoding.Kind() == pdf.Name && encoding.Name() == "UniGB-UCS2-H" {
		return func(raw string) string { return cleanPDFText(encoder.Decode(raw)) }
	}
	// The other encoders map one byte at a time; a table spares a walk of
	// the Differences array per byte.
	var table [256]string
	for code := range table {
		table[code] = cleanPDFText(encoder.Decode(string([]byte{byte(code)})))
	}
	return func(raw string) string {
		var text strings.Builder
		for index := 0; index < len(raw); index++ {
			text.WriteString(table[raw[index]])
		}
		return text.String()
	}
}

func latin1Text(raw string) string {
	runes := make([]rune, 0, len(raw))
	for index := 0; index < len(raw); index++ {
		runes = append(runes, rune(raw[index]))
	}
	return cleanPDFText(string(runes))
}

// cleanPDFText keeps valid, printable text and line breaks.
func cleanPDFText(text string) string {
	if !strings.ContainsFunc(text, func(char rune) bool {
		return char == utf8.RuneError || unicode.IsControl(char) && char != '\n' && char != '\t'
	}) {
		return text
	}
	return strings.Map(func(char rune) rune {
		if char == utf8.RuneError || unicode.IsControl(char) && char != '\n' && char != '\t' {
			return -1
		}
		return char
	}, strings.ToValidUTF8(text, ""))
}

// toUnicodeMap is a font's ToUnicode CMap: the byte lengths of its codes
// and the text of each code.
type toUnicodeMap struct {
	spaces [4][][2]string
	codes  map[string]string
	// fallback is the code length when no code space range matches.
	fallback int
}

// parseToUnicode reads the bfchar and bfrange entries of a ToUnicode CMap.
// Ranges are expanded up to maxPDFCMapCodes codes in all.
func parseToUnicode(data []byte) *toUnicodeMap {
	lexer := pdfLexer{data: data}
	cmap := &toUnicodeMap{codes: map[string]string{}}
	var pending []pdfToken
	section := ""
	for {
		token := lexer.next()
		switch token.kind {
		case 0:
			if len(cmap.codes) == 0 {
				return nil
			}
			for length := 1; length <= 4 && cmap.fallback == 0; length++ {
				if len(cmap.spaces[length-1]) > 0 {
					cmap.fallback = length
				}
			}
			if cmap.fallback == 0 {
				for code := range cmap.codes {
					cmap.fallback = max(cmap.fallback, len(code))
				}
			}
			return cmap
		case '[':
			token = lexer.array()
		case 'k':
			switch keyword := string(token.text); keyword {
			case "begincodespacerange", "beginbfchar", "beginbfrange":
				section, pending = keyword, pending[:0]
			case "endcodespacerange":
				for index := 0; index+1 < len(pending); index += 2 {
					low, high := string(pending[index].text), string(pending[index+1].text)
					if len(low) >= 1 && len(low) <= 4 && len(low) == len(high) {
						cmap.spaces[len(low)-1] = append(cmap.spaces[len(low)-1], [2]string{low, high})
					}
				}
				section = ""
			case "endbfchar":
				for index := 0; index+1 < len(pending); index += 2 {
					if len(cmap.codes) < maxPDFCMapCodes && pending[index].kind == 's' && pending[index+1].kind == 's' {
						cmap.codes[string(pending[index].text)] = utf16Text(pending[index+1].text)
					}
				}
				section = ""
			case "endbfrange":
				for index := 0; index+2 < len(pending); index += 3 {
					cmap.addRange(pending[index], pending[index+1], pending[index+2])
				}
				section = ""
			}
			continue
		}
		if section != "" && len(pending) < 3*maxPDFCMapCodes {
			pending = append(pending, token)
		}
	}
}

func (m *toUnicodeMap) addRange(low, high, target pdfToken) {
	if low.kind != 's' || high.kind != 's' || len(low.text) != len(high.text) || len(low.text) < 1 || len(low.text) > 4 {
		return
	}
	first, last := codeValue(low.text), codeValue(high.text)
	for offset := uint32(0); first+offset <= last && len(m.codes) < maxPDFCMapCodes; offset++ {
		code := codeBytes(first+offset, len(low.text))
		switch {
		case target.kind == 's' && len(target.text) >= 2:
			units := bytes.Clone(target.text)
			value := uint16(units[len(units)-2])<<8 | uint16(units[len(units)-1])
			value += uint16(offset)
			units[len(units)-2], units[len(units)-1] = byte(value>>8), byte(value)
			m.codes[code] = utf16Text(units)
		case target.kind == 'a' && int(offset) < len(target.items) && target.items[offset].kind == 's':
			m.codes[code] = utf16Text(target.items[offset].text)
		}
		if first+offset == last {
			break
		}
	}
}

func codeValue(code []byte) uint32 {
	value := uint32(0)
	for _, b := range code {
		value = value<<8 | uint32(b)
	}
	return value
}

func codeBytes(value uint32, length int) string {
	code := make([]byte, length)
	for index := length - 1; index >= 0; index-- {
		code[index] = byte(value)
		value >>= 8
	}
	return string(code)
}

func utf16Text(data []byte) string {
	units := make([]uint16, 0, len(data)/2)
	for index := 0; index+1 < len(data); index += 2 {
		units = append(units, uint16(data[index])<<8|uint16(data[index+1]))
	}
	return cleanPDFText(string(utf16.Decode(units)))
}

// decode maps the codes of raw to text: each code is as long as the code
// space range it falls in.
func (m *toUnicodeMap) decode(raw string) string {
	var text strings.Builder
	for len(raw) > 0 {
		length := 0
		for candidate := 1; candidate <= 4 && candidate <= len(raw) && length == 0; candidate++ {
			for _, space := range m.spaces[candidate-1] {
				if code := raw[:candidate]; space[0] <= code && code <= space[1] {
					length = candidate
					break
				}
			}
		}
		if length == 0 {
			length = min(max(m.fallback, 1), len(raw))
		}
		text.WriteString(m.codes[raw[:length]])
		raw = raw[length:]
	}
	return text.String()
}

// pdfLexer reads PDF tokens from data.
type pdfLexer struct {
	data []byte
	pos  int
}

// pdfToken is one token. kind: 0 at the end, 'i' integer, 'r' real, 'n' name,
// 's' string, 'k' keyword, '[' and ']', '{' and '}' for << and >>, 'a' an
// array read by array, '!' a byte that starts no token.
type pdfToken struct {
	kind  byte
	text  []byte
	value int64
	items []pdfToken
}

func (t pdfToken) number() float64 {
	switch t.kind {
	case 'i':
		return float64(t.value)
	case 'r':
		number, _ := strconv.ParseFloat(string(t.text), 64)
		return number
	}
	return 0
}

func isPDFSpace(char byte) bool {
	return char == 0 || char == '\t' || char == '\n' || char == '\f' || char == '\r' || char == ' '
}

func isPDFDelimiter(char byte) bool {
	return strings.IndexByte("()<>[]{}/%", char) >= 0
}

func (l *pdfLexer) next() pdfToken {
	for l.pos < len(l.data) {
		if char := l.data[l.pos]; isPDFSpace(char) {
			l.pos++
		} else if char == '%' {
			for l.pos < len(l.data) && l.data[l.pos] != '\n' && l.data[l.pos] != '\r' {
				l.pos++
			}
		} else {
			break
		}
	}
	if l.pos >= len(l.data) {
		return pdfToken{}
	}
	switch char := l.data[l.pos]; char {
	case '[', ']':
		l.pos++
		return pdfToken{kind: char}
	case '<':
		if l.pos+1 < len(l.data) && l.data[l.pos+1] == '<' {
			l.pos += 2
			return pdfToken{kind: '{'}
		}
		return l.hexString()
	case '>':
		if l.pos+1 < len(l.data) && l.data[l.pos+1] == '>' {
			l.pos += 2
			return pdfToken{kind: '}'}
		}
		l.pos++
		return pdfToken{kind: '!'}
	case '(':
		return l.literalString()
	case '/':
		return l.name()
	case ')', '{', '}':
		l.pos++
		return pdfToken{kind: '!'}
	}
	start := l.pos
	for l.pos < len(l.data) && !isPDFSpace(l.data[l.pos]) && !isPDFDelimiter(l.data[l.pos]) {
		l.pos++
	}
	word := l.data[start:l.pos]
	if value, err := strconv.ParseInt(string(word), 10, 64); err == nil {
		return pdfToken{kind: 'i', value: value}
	}
	if _, err := strconv.ParseFloat(string(word), 64); err == nil && strings.Trim(string(word), "+-.0123456789") == "" {
		return pdfToken{kind: 'r', text: word}
	}
	return pdfToken{kind: 'k', text: word}
}

func (l *pdfLexer) name() pdfToken {
	l.pos++
	var name []byte
	for l.pos < len(l.data) && !isPDFSpace(l.data[l.pos]) && !isPDFDelimiter(l.data[l.pos]) {
		char := l.data[l.pos]
		if char == '#' && l.pos+2 < len(l.data) {
			if value, err := strconv.ParseUint(string(l.data[l.pos+1:l.pos+3]), 16, 8); err == nil {
				name = append(name, byte(value))
				l.pos += 3
				continue
			}
		}
		name = append(name, char)
		l.pos++
	}
	return pdfToken{kind: 'n', text: name}
}

func (l *pdfLexer) hexString() pdfToken {
	l.pos++
	var text []byte
	half := -1
	for l.pos < len(l.data) {
		char := l.data[l.pos]
		l.pos++
		if char == '>' {
			if half >= 0 {
				text = append(text, byte(half<<4))
			}
			return pdfToken{kind: 's', text: text}
		}
		digit := -1
		switch {
		case '0' <= char && char <= '9':
			digit = int(char - '0')
		case 'a' <= char && char <= 'f':
			digit = int(char-'a') + 10
		case 'A' <= char && char <= 'F':
			digit = int(char-'A') + 10
		case isPDFSpace(char):
			continue
		default:
			return pdfToken{kind: '!'}
		}
		if half < 0 {
			half = digit
		} else {
			text = append(text, byte(half<<4|digit))
			half = -1
		}
	}
	return pdfToken{kind: '!'}
}

func (l *pdfLexer) literalString() pdfToken {
	l.pos++
	var text []byte
	depth := 1
	for l.pos < len(l.data) {
		char := l.data[l.pos]
		l.pos++
		switch char {
		case '(':
			depth++
		case ')':
			if depth--; depth == 0 {
				return pdfToken{kind: 's', text: text}
			}
		case '\\':
			if l.pos >= len(l.data) {
				return pdfToken{kind: '!'}
			}
			escaped := l.data[l.pos]
			l.pos++
			switch escaped {
			case 'n':
				char = '\n'
			case 'r':
				char = '\r'
			case 't':
				char = '\t'
			case 'b':
				char = '\b'
			case 'f':
				char = '\f'
			case '\r':
				if l.pos < len(l.data) && l.data[l.pos] == '\n' {
					l.pos++
				}
				continue
			case '\n':
				continue
			default:
				if '0' <= escaped && escaped <= '7' {
					value := int(escaped - '0')
					for digits := 1; digits < 3 && l.pos < len(l.data) && '0' <= l.data[l.pos] && l.data[l.pos] <= '7'; digits++ {
						value = value<<3 | int(l.data[l.pos]-'0')
						l.pos++
					}
					char = byte(value)
				} else {
					char = escaped
				}
			}
		}
		text = append(text, char)
	}
	return pdfToken{kind: '!'}
}

// array reads the tokens up to the matching ']' as one 'a' token: strings
// and numbers kept, at most maxPDFArrayItems, nested arrays skipped.
func (l *pdfLexer) array() pdfToken {
	array := pdfToken{kind: 'a'}
	for depth := 1; ; {
		token := l.next()
		switch token.kind {
		case 0:
			return array
		case '[':
			depth++
		case ']':
			if depth--; depth == 0 {
				return array
			}
		case 's', 'i', 'r':
			if depth == 1 && len(array.items) < maxPDFArrayItems {
				array.items = append(array.items, token)
			}
		}
	}
}

func (l *pdfLexer) skipDict() {
	for depth := 1; depth > 0; {
		switch l.next().kind {
		case 0:
			return
		case '{':
			depth++
		case '}':
			depth--
		}
	}
}

// skipInlineImage moves past an inline image: its parameters, ID, the image
// data and EI.
func (l *pdfLexer) skipInlineImage() {
	for {
		token := l.next()
		if token.kind == 0 {
			return
		}
		if token.kind == 'k' && string(token.text) == "ID" {
			break
		}
	}
	for l.pos+2 <= len(l.data) {
		if l.data[l.pos] == 'E' && l.data[l.pos+1] == 'I' && isPDFSpace(l.data[max(l.pos-1, 0)]) &&
			(l.pos+2 == len(l.data) || isPDFSpace(l.data[l.pos+2])) {
			l.pos += 2
			return
		}
		l.pos++
	}
	l.pos = len(l.data)
}

// value reads one object; values counts down the values an object may hold.
func (l *pdfLexer) value(values *int, depth int) (any, error) {
	if *values--; *values < 0 {
		return nil, errPDFLimit
	}
	if depth > maxPDFDepth {
		return nil, errPDFLimit
	}
	token := l.next()
	switch token.kind {
	case 'i':
		mark := l.pos
		if generation := l.next(); generation.kind == 'i' {
			if reference := l.next(); reference.kind == 'k' && string(reference.text) == "R" {
				return pdfRef{number: token.value, generation: generation.value}, nil
			}
		}
		l.pos = mark
		return token.value, nil
	case 'r':
		return token.number(), nil
	case 'n':
		return pdfName(token.text), nil
	case 's':
		return token.text, nil
	case '[':
		var items []any
		for {
			mark := l.pos
			if closing := l.next(); closing.kind == ']' {
				return items, nil
			} else if closing.kind == 0 {
				return nil, errPDFSyntax
			}
			l.pos = mark
			item, err := l.value(values, depth+1)
			if err != nil {
				return nil, err
			}
			items = append(items, item)
		}
	case '{':
		members := map[string]any{}
		for {
			key := l.next()
			if key.kind == '}' {
				return members, nil
			}
			if key.kind != 'n' {
				return nil, errPDFSyntax
			}
			member, err := l.value(values, depth+1)
			if err != nil {
				return nil, err
			}
			members[string(key.text)] = member
		}
	case 'k':
		switch string(token.text) {
		case "true":
			return true, nil
		case "false":
			return false, nil
		case "null":
			return nil, nil
		}
	}
	return nil, errPDFSyntax
}

type pdfName string

type pdfRef struct {
	number, generation int64
}

// pdfCheck walks a file's cross-reference sections as the library will,
// from the startxref offset along each Prev, and then reads every object
// they place in the file.
type pdfCheck struct {
	data     []byte
	deadline time.Time
	// objects are the file offsets of the objects in the file; seen holds
	// every object number a section gave first, as the library keeps it.
	objects map[int64]int64
	seen    map[int64]bool
	// objectStreams are the objects that hold other objects.
	objectStreams map[int64]bool
	objStmBytes   int
}

// checkPDF returns "" for a file the library may read, otherwise the
// unchecked reason: too_large past a bound, unreadable when the file is not
// a PDF, is encrypted or has broken cross-references.
func checkPDF(data []byte, deadline time.Time) string {
	check := &pdfCheck{data: data, deadline: deadline, objects: map[int64]int64{}, seen: map[int64]bool{}, objectStreams: map[int64]bool{}}
	err := check.run()
	switch {
	case err == nil:
		return ""
	case errors.Is(err, errPDFLimit), errors.Is(err, errPDFTime):
		return uncheckedTooLarge
	}
	return uncheckedUnreadable
}

func (c *pdfCheck) run() error {
	const tailLength = 100
	if len(c.data) < tailLength || !bytes.HasPrefix(c.data, []byte("%PDF-1.")) {
		return errPDFSyntax
	}
	tail := bytes.TrimRight(c.data[len(c.data)-tailLength:], "\r\n\t ")
	if !bytes.HasSuffix(tail, []byte("%%EOF")) {
		return errPDFSyntax
	}
	line := lastLine(tail, "startxref")
	if line < 0 {
		return errPDFSyntax
	}
	lexer := pdfLexer{data: c.data, pos: len(c.data) - tailLength + line + len("startxref")}
	start := lexer.next()
	if start.kind != 'i' {
		return errPDFSyntax
	}
	offset, visited := start.value, map[int64]bool{}
	for sections := 0; ; sections++ {
		if offset < 0 || offset >= int64(len(c.data)) || visited[offset] || sections == maxPDFXrefSections {
			return errPDFSyntax
		}
		visited[offset] = true
		trailer, err := c.section(offset)
		if err != nil {
			return err
		}
		if _, encrypted := trailer["Encrypt"]; encrypted {
			return errPDFSyntax
		}
		previous, ok := trailer["Prev"]
		if !ok {
			break
		}
		if offset, ok = previous.(int64); !ok {
			return errPDFSyntax
		}
	}
	values := 0
	for number, offset := range c.objects {
		if values++; values%256 == 0 && time.Now().After(c.deadline) {
			return errPDFTime
		}
		if err := c.object(number, offset); err != nil {
			return err
		}
	}
	return nil
}

// lastLine mirrors the library's search for the final startxref line.
func lastLine(data []byte, word string) int {
	end := len(data)
	for {
		index := bytes.LastIndex(data[:end], []byte(word))
		if index <= 0 || index+len(word) >= len(data) {
			return -1
		}
		before, after := data[index-1], data[index+len(word)]
		if (before == '\n' || before == '\r') && (after == '\n' || after == '\r') {
			return index
		}
		end = index
	}
}

// section reads the cross-reference table or stream at offset and returns
// its trailer dictionary.
func (c *pdfCheck) section(offset int64) (map[string]any, error) {
	lexer := pdfLexer{data: c.data, pos: int(offset)}
	token := lexer.next()
	if token.kind == 'k' && string(token.text) == "xref" {
		for {
			token = lexer.next()
			if token.kind == 'k' && string(token.text) == "trailer" {
				break
			}
			count := lexer.next()
			if token.kind != 'i' || count.kind != 'i' || token.value < 0 || count.value < 0 || token.value+count.value > maxPDFObjects {
				return nil, errPDFLimit
			}
			for index := int64(0); index < count.value; index++ {
				position, generation, kind := lexer.next(), lexer.next(), lexer.next()
				if position.kind != 'i' || generation.kind != 'i' || kind.kind != 'k' {
					return nil, errPDFSyntax
				}
				c.add(token.value+index, position.value, string(kind.text) == "n")
			}
		}
		values := maxPDFObjectValues
		trailer, err := lexer.value(&values, 0)
		if dictionary, ok := trailer.(map[string]any); ok && err == nil {
			return dictionary, nil
		}
		return nil, errors.Join(errPDFSyntax, err)
	}
	if token.kind != 'i' {
		return nil, errPDFSyntax
	}
	header, data, err := c.stream(&lexer)
	if err != nil {
		return nil, err
	}
	if header["Type"] != pdfName("XRef") {
		return nil, errPDFSyntax
	}
	size, ok := header["Size"].(int64)
	if !ok || size < 0 || size > maxPDFObjects {
		return nil, errPDFLimit
	}
	index := []any{int64(0), size}
	if declared, ok := header["Index"].([]any); ok {
		index = declared
	}
	widths, _ := header["W"].([]any)
	if len(widths) < 3 || len(index)%2 != 0 {
		return nil, errPDFSyntax
	}
	width := make([]int, 3)
	rowLength := 0
	for position, item := range widths {
		value, ok := item.(int64)
		if !ok || value < 0 || value > 8 {
			return nil, errPDFLimit
		}
		if position < 3 {
			width[position] = int(value)
		}
		rowLength += int(value)
	}
	entries := int64(0)
	for position := 0; position < len(index); position += 2 {
		first, firstOK := index[position].(int64)
		count, countOK := index[position+1].(int64)
		if !firstOK || !countOK || first < 0 || count < 0 || first+count > maxPDFObjects {
			return nil, errPDFLimit
		}
		entries += count
	}
	if entries > maxPDFObjects {
		return nil, errPDFLimit
	}
	rows, err := c.decode(header, data, int(entries)*(rowLength+1)+1)
	if err != nil {
		return nil, err
	}
	if predictor, _ := pdfParameter(header, "Predictor").(int64); predictor >= 10 {
		if rows, err = unpredict(rows, rowLength); err != nil {
			return nil, err
		}
	}
	for position := 0; position < len(index); position += 2 {
		first, count := index[position].(int64), index[position+1].(int64)
		for entry := int64(0); entry < count; entry++ {
			if len(rows) < rowLength {
				return header, nil
			}
			row := rows[:rowLength]
			rows = rows[rowLength:]
			kind := int64(1)
			if width[0] > 0 {
				kind = fieldValue(row[:width[0]])
			}
			second := fieldValue(row[width[0] : width[0]+width[1]])
			switch kind {
			case 1:
				c.add(first+entry, second, true)
			case 2:
				if !c.seen[first+entry] {
					c.seen[first+entry] = true
					c.objectStreams[second] = true
				}
			default:
				c.add(first+entry, 0, false)
			}
		}
	}
	return header, nil
}

func fieldValue(field []byte) int64 {
	value := int64(0)
	for _, b := range field {
		value = value<<8 | int64(b)
	}
	return value
}

// add records an object's offset unless a newer section gave its number.
func (c *pdfCheck) add(number, offset int64, inUse bool) {
	if c.seen[number] {
		return
	}
	c.seen[number] = true
	if inUse && offset > 0 && offset < int64(len(c.data)) {
		c.objects[number] = offset
	}
}

// stream reads "N G obj <<...>> stream" from lexer, past the object number,
// and returns the dictionary and the stream data, as long as its direct
// /Length says.
func (c *pdfCheck) stream(lexer *pdfLexer) (map[string]any, []byte, error) {
	if generation, keyword := lexer.next(), lexer.next(); generation.kind != 'i' || keyword.kind != 'k' || string(keyword.text) != "obj" {
		return nil, nil, errPDFSyntax
	}
	values := maxPDFObjectValues
	value, err := lexer.value(&values, 0)
	if err != nil {
		return nil, nil, err
	}
	header, ok := value.(map[string]any)
	if keyword := lexer.next(); !ok || keyword.kind != 'k' || string(keyword.text) != "stream" {
		return nil, nil, errPDFSyntax
	}
	if lexer.pos < len(c.data) && c.data[lexer.pos] == '\r' {
		lexer.pos++
	}
	if lexer.pos < len(c.data) && c.data[lexer.pos] == '\n' {
		lexer.pos++
	}
	length, ok := header["Length"].(int64)
	if reference, isReference := header["Length"].(pdfRef); isReference {
		length, ok = c.integer(reference)
	}
	if !ok || length < 0 || int64(lexer.pos)+length > int64(len(c.data)) {
		return nil, nil, errPDFSyntax
	}
	return header, c.data[lexer.pos : int64(lexer.pos)+length], nil
}

// integer reads an indirect integer object.
func (c *pdfCheck) integer(reference pdfRef) (int64, bool) {
	offset, ok := c.objects[reference.number]
	if !ok {
		return 0, false
	}
	lexer := pdfLexer{data: c.data, pos: int(offset)}
	number, generation, keyword, value := lexer.next(), lexer.next(), lexer.next(), lexer.next()
	if number.kind != 'i' || generation.kind != 'i' || keyword.kind != 'k' || string(keyword.text) != "obj" || value.kind != 'i' {
		return 0, false
	}
	return value.value, true
}

// object reads one object of the file, which the library may read later: its
// values within maxPDFObjectValues, and a stream's decode parameters within
// bounds. An object stream is decompressed to measure it.
func (c *pdfCheck) object(number, offset int64) error {
	lexer := pdfLexer{data: c.data, pos: int(offset)}
	if token := lexer.next(); token.kind != 'i' || token.value != number {
		// The library refuses an object that is not where its section says.
		return nil
	}
	mark := lexer.pos
	if generation, keyword := lexer.next(), lexer.next(); generation.kind != 'i' || keyword.kind != 'k' || string(keyword.text) != "obj" {
		return nil
	}
	values := maxPDFObjectValues
	value, err := lexer.value(&values, 0)
	if errors.Is(err, errPDFLimit) {
		return err
	}
	header, isDictionary := value.(map[string]any)
	if err != nil || !isDictionary {
		return nil
	}
	if keyword := lexer.next(); keyword.kind != 'k' || string(keyword.text) != "stream" {
		return nil
	}
	for _, parameters := range append([]any{header["DecodeParms"]}, listOf(header["DecodeParms"])...) {
		if dictionary, ok := parameters.(map[string]any); ok {
			if columns, ok := dictionary["Columns"].(int64); ok && (columns < 0 || columns > maxPDFColumns) {
				return errPDFLimit
			}
		}
	}
	if header["Type"] != pdfName("ObjStm") && !c.objectStreams[number] {
		return nil
	}
	lexer.pos = mark
	header, data, err := c.stream(&lexer)
	if err != nil {
		return nil
	}
	decoded, err := c.decode(header, data, maxPDFObjStmBytes)
	if err != nil {
		return err
	}
	if c.objStmBytes += len(decoded); c.objStmBytes > maxPDFObjStmTotal {
		return errPDFLimit
	}
	return nil
}

func listOf(value any) []any {
	items, _ := value.([]any)
	return items
}

// pdfParameter is a member of a stream's DecodeParms dictionary.
func pdfParameter(header map[string]any, name string) any {
	if dictionary, ok := header["DecodeParms"].(map[string]any); ok {
		return dictionary[name]
	}
	if items := listOf(header["DecodeParms"]); len(items) > 0 {
		if dictionary, ok := items[0].(map[string]any); ok {
			return dictionary[name]
		}
	}
	return nil
}

// decode decompresses stream data with no filter or FlateDecode, up to
// limit bytes; more is past the limit.
func (c *pdfCheck) decode(header map[string]any, data []byte, limit int) ([]byte, error) {
	filter := header["Filter"]
	if items := listOf(filter); len(items) == 1 {
		filter = items[0]
	}
	switch filter {
	case nil:
		if len(data) > limit {
			return nil, errPDFLimit
		}
		return data, nil
	case pdfName("FlateDecode"):
		reader, err := zlib.NewReader(bytes.NewReader(data))
		if err != nil {
			return nil, errPDFSyntax
		}
		decoded, err := io.ReadAll(io.LimitReader(reader, int64(limit)+1))
		if len(decoded) > limit {
			return nil, errPDFLimit
		}
		if err != nil && len(decoded) == 0 {
			return nil, errPDFSyntax
		}
		return decoded, nil
	}
	return nil, errPDFSyntax
}

// unpredict reverses the PNG predictors of rows of columns bytes, each led
// by its filter type.
func unpredict(data []byte, columns int) ([]byte, error) {
	if columns <= 0 || columns > maxPDFColumns {
		return nil, errPDFLimit
	}
	previous := make([]byte, columns)
	var out []byte
	for len(data) >= columns+1 {
		filter, row := data[0], bytes.Clone(data[1:columns+1])
		data = data[columns+1:]
		for index := range row {
			left, up, upLeft := byte(0), previous[index], byte(0)
			if index > 0 {
				left, upLeft = row[index-1], previous[index-1]
			}
			switch filter {
			case 1:
				row[index] += left
			case 2:
				row[index] += up
			case 3:
				row[index] += byte((int(left) + int(up)) / 2)
			case 4:
				row[index] += paeth(left, up, upLeft)
			}
		}
		out = append(out, row...)
		previous = row
	}
	return out, nil
}

func paeth(left, up, upLeft byte) byte {
	estimate := int(left) + int(up) - int(upLeft)
	distanceLeft, distanceUp, distanceUpLeft := abs(estimate-int(left)), abs(estimate-int(up)), abs(estimate-int(upLeft))
	switch {
	case distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft:
		return left
	case distanceUp <= distanceUpLeft:
		return up
	}
	return upLeft
}

func abs(value int) int {
	if value < 0 {
		return -value
	}
	return value
}
