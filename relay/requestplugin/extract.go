package requestplugin

import (
	"archive/zip"
	"bufio"
	"bytes"
	"encoding/xml"
	"errors"
	"io"
	"strings"
	"time"
	"unicode/utf16"
	"unicode/utf8"
)

// Bounds of reading a DOCX file: the decompressed document.xml read and the
// element nesting, past which the file is unreadable.
const (
	maxDOCXXMLBytes = 32 << 20
	maxDOCXDepth    = 256
)

// textSink collects extracted text up to max UTF-16 code units.
type textSink struct {
	text      strings.Builder
	chars     int
	max       int
	truncated bool
}

// write adds s and reports whether the sink takes more.
func (s *textSink) write(text string) bool {
	if s.truncated {
		return false
	}
	for _, char := range text {
		if !s.writeRune(char) {
			return false
		}
	}
	return true
}

func (s *textSink) writeRune(char rune) bool {
	width := 1
	if char > 0xFFFF {
		width = 2
	}
	if s.chars+width > s.max {
		s.truncated = true
		return false
	}
	s.text.WriteRune(char)
	s.chars += width
	return true
}

// newline ends the current line unless the text is empty or ends one.
func (s *textSink) newline() {
	if text := s.text.String(); text != "" && !strings.HasSuffix(text, "\n") {
		s.writeRune('\n')
	}
}

// readText reads a text file: UTF-8, or UTF-16 with a byte order mark. It
// stops at maxChars UTF-16 code units. A NUL character makes the file
// unreadable: it is binary.
func readText(source io.Reader, maxChars int) extractedText {
	reader := bufio.NewReaderSize(source, 32<<10)
	sink := textSink{max: maxChars}
	head, _ := reader.Peek(3)
	var order []byte
	switch {
	case bytes.HasPrefix(head, []byte{0xEF, 0xBB, 0xBF}):
		_, _ = reader.Discard(3)
	case bytes.HasPrefix(head, []byte{0xFF, 0xFE}):
		// Little endian: the high byte comes second.
		_, _ = reader.Discard(2)
		order = []byte{1, 0}
	case bytes.HasPrefix(head, []byte{0xFE, 0xFF}):
		_, _ = reader.Discard(2)
		order = []byte{0, 1}
	}
	var unit [2]byte
	pending := rune(-1)
	for {
		var char rune
		if order == nil {
			read, _, err := reader.ReadRune()
			if errors.Is(err, io.EOF) {
				break
			}
			if err != nil {
				return extractedText{unchecked: uncheckedUnreadable}
			}
			char = read
		} else {
			if _, err := io.ReadFull(reader, unit[:]); errors.Is(err, io.EOF) {
				break
			} else if err != nil {
				return extractedText{unchecked: uncheckedUnreadable}
			}
			code := rune(unit[order[0]])<<8 | rune(unit[order[1]])
			if pending >= 0 {
				char, pending = utf16.DecodeRune(pending, code), -1
			} else if utf16.IsSurrogate(code) {
				pending = code
				continue
			} else {
				char = code
			}
		}
		if char == 0 {
			return extractedText{unchecked: uncheckedUnreadable}
		}
		if !sink.writeRune(char) {
			break
		}
	}
	return extractedText{text: sink.text.String(), truncated: sink.truncated}
}

// docxText reads the text of a DOCX file's word/document.xml: the runs of
// each paragraph, a line per paragraph, tabs and breaks as they are.
func docxText(data []byte, maxChars int, deadline time.Time) extractedText {
	archive, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return extractedText{unchecked: uncheckedUnreadable}
	}
	var document *zip.File
	for _, file := range archive.File {
		if file.Name == "word/document.xml" {
			document = file
			break
		}
	}
	if document == nil {
		return extractedText{unchecked: uncheckedUnreadable}
	}
	content, err := document.Open()
	if err != nil {
		return extractedText{unchecked: uncheckedUnreadable}
	}
	defer content.Close()
	limited := &io.LimitedReader{R: content, N: maxDOCXXMLBytes}
	decoder := xml.NewDecoder(limited)
	sink := textSink{max: maxChars}
	depth, inText := 0, false
	for tokens := 0; ; tokens++ {
		if tokens%1024 == 0 && time.Now().After(deadline) {
			return extractedText{unchecked: uncheckedTooLarge}
		}
		token, err := decoder.RawToken()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			if limited.N <= 0 {
				// The text read so far stands; the rest is past the cap.
				sink.truncated = true
				break
			}
			return extractedText{unchecked: uncheckedUnreadable}
		}
		switch element := token.(type) {
		case xml.StartElement:
			if depth++; depth > maxDOCXDepth {
				return extractedText{unchecked: uncheckedUnreadable}
			}
			switch element.Name.Local {
			case "t":
				inText = true
			case "tab":
				sink.writeRune('\t')
			case "br", "cr":
				sink.writeRune('\n')
			}
		case xml.EndElement:
			depth--
			switch element.Name.Local {
			case "t":
				inText = false
			case "p":
				sink.writeRune('\n')
			}
		case xml.CharData:
			if inText && utf8.Valid(element) {
				sink.write(string(element))
			}
		}
		if sink.truncated {
			break
		}
	}
	return extractedText{text: strings.TrimRight(sink.text.String(), "\n"), truncated: sink.truncated}
}
