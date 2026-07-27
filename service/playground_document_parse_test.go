package service

import (
	"archive/zip"
	"bytes"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func buildTestZip(t *testing.T, entries map[string]string) []byte {
	t.Helper()
	var buf bytes.Buffer
	w := zip.NewWriter(&buf)
	for name, content := range entries {
		f, err := w.Create(name)
		require.NoError(t, err)
		_, err = f.Write([]byte(content))
		require.NoError(t, err)
	}
	require.NoError(t, w.Close())
	return buf.Bytes()
}

func TestExtractOfficeTextDocx(t *testing.T) {
	data := buildTestZip(t, map[string]string{
		"word/document.xml": `<?xml version="1.0"?><w:document xmlns:w="ns"><w:body>` +
			`<w:p><w:r><w:t>Hello</w:t></w:r><w:r><w:t> world</w:t></w:r></w:p>` +
			`<w:p><w:r><w:t>第二段</w:t></w:r></w:p></w:body></w:document>`,
	})
	text, err := ExtractOfficeText(MimeDocx, data)
	require.NoError(t, err)
	assert.Equal(t, "Hello world\n第二段", strings.TrimSpace(text))
}

func TestExtractOfficeTextXlsxSharedStrings(t *testing.T) {
	data := buildTestZip(t, map[string]string{
		"xl/sharedStrings.xml": `<?xml version="1.0"?><sst><si><t>Name</t></si><si><r><t>Sp</t></r><r><t>lit</t></r></si></sst>`,
		"xl/worksheets/sheet1.xml": `<?xml version="1.0"?><worksheet><sheetData>` +
			`<row><c t="s"><v>0</v></c><c t="s"><v>1</v></c></row>` +
			`<row><c><v>42</v></c><c t="inlineStr"><is><t>inline</t></is></c></row>` +
			`</sheetData></worksheet>`,
	})
	text, err := ExtractOfficeText(MimeXlsx, data)
	require.NoError(t, err)
	assert.Contains(t, text, "Name\tSplit")
	assert.Contains(t, text, "42\tinline")
}

func TestExtractOfficeTextPptxSlideOrder(t *testing.T) {
	data := buildTestZip(t, map[string]string{
		"ppt/slides/slide2.xml": `<p:sld xmlns:a="ns"><a:p><a:r><a:t>Second</a:t></a:r></a:p></p:sld>`,
		"ppt/slides/slide1.xml": `<p:sld xmlns:a="ns"><a:p><a:r><a:t>First</a:t></a:r></a:p></p:sld>`,
	})
	text, err := ExtractOfficeText(MimePptx, data)
	require.NoError(t, err)
	assert.Less(t, strings.Index(text, "First"), strings.Index(text, "Second"))
}

func TestExtractOfficeTextRejectsNonZip(t *testing.T) {
	_, err := ExtractOfficeText(MimeDocx, []byte("not a zip"))
	assert.Error(t, err)
}

func TestSniffPlaygroundMimeOfficeZip(t *testing.T) {
	header := []byte{'P', 'K', 0x03, 0x04, 0x14, 0x00, 0x00, 0x00}
	mimeType, kind, err := SniffPlaygroundMime(header, MimeDocx)
	require.NoError(t, err)
	assert.Equal(t, MimeDocx, mimeType)
	assert.Equal(t, "document", kind)

	// A bare ZIP with no office declaration stays rejected.
	_, _, err = SniffPlaygroundMime(header, "application/zip")
	assert.Error(t, err)
}

func TestNormalizeDeclaredDocumentMimeFromExtension(t *testing.T) {
	assert.Equal(t, MimeXlsx, normalizeDeclaredDocumentMime("report.XLSX", "application/octet-stream"))
	assert.Equal(t, "application/pdf", normalizeDeclaredDocumentMime("scan.pdf", ""))
	assert.Equal(t, MimeDocx, normalizeDeclaredDocumentMime("notes.txt", MimeDocx))
	assert.Equal(t, "text/plain", normalizeDeclaredDocumentMime("notes.txt", "text/plain"))
}

func TestTruncateUTF8KeepsRuneBoundary(t *testing.T) {
	s := strings.Repeat("汉", 10)
	out := TruncateUTF8(s, 10)
	assert.LessOrEqual(t, len(out), 10)
	assert.Equal(t, strings.Repeat("汉", 3), out)
	assert.Equal(t, "abc", TruncateUTF8("abc", 10))
}
