package requestplugin

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/binary"
	"fmt"
	"image"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/pkg/requestpatch"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/HugoSmits86/nativewebp"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

// attachmentPlugin lists, describes, reads, sends and rewrites attachments as
// its config says, and writes what it saw into the body as /seen, with the
// placeholders spelled "<media:N]" so the body may hold them.
const attachmentPlugin = `export const meta = {apiVersion: 1, key: "rp-attachments", name: "Attachments", version: "1.0.0", author: {name: "Test"},
  configSchema: {type: "object", properties: {url: {type: "string", format: "url", title: "URL"}, words: {type: "string", format: "keywords", title: "Words"}}}};
function run(ctx) {
  const c = ctx.config;
  const seen = {config: c};
  if (c.list) seen.attachments = utils.attachments();
  if (c.media) seen.media = c.media.map((ref) => utils.media(ref));
  if (c.read) seen.texts = c.read.map((ref) => utils.mediaText(ref, c.maxChars ? {maxChars: c.maxChars} : undefined));
  if (c.send) seen.status = utils.fetch({url: c.url, method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({input: c.send})}).status;
  const effects = (c.rewrite || []).map((item) => ({type: "media.text", media: item.media, text: item.text}));
  if (!c.quiet) effects.push({type: "json.patch", ops: [{op: "add", path: "/seen", value: JSON.stringify(seen).split("[media:").join("<media:")}]});
  return {action: "continue", effects};
}
export function ingress(ctx) { return run(ctx); }
export function outbound(ctx) { return run(ctx); }`

func registerAttachmentPlugin(t *testing.T, instances string) {
	t.Helper()
	setupPlugins(t, `[]`)
	plugin, err := jsplugin.DefaultRegistry.Register(attachmentPlugin, jsplugin.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { _ = jsplugin.DefaultRegistry.Unregister(plugin.Meta.Key) })
	setInstances(t, instances)
}

func attachmentInstance(id, config string) string {
	return `{"id":"` + id + `","name":"` + id + `","plugin":"rp-attachments","enabled":true,"global":true,"config":` + config + `}`
}

// runAttachments runs one rp-attachments instance at ingress on body.
func runAttachments(t *testing.T, config, body string) (Outcome, gjson.Result) {
	t.Helper()
	registerAttachmentPlugin(t, `[`+attachmentInstance("att", config)+`]`)
	outcome := NewPlan().Run(context.Background(), Call{Stage: StageIngress, Body: []byte(body)})
	require.Nil(t, outcome.Failed)
	return outcome, gjson.Parse(gjson.GetBytes(outcome.Body, "seen").Str)
}

func dataURI(mime string, data []byte) string {
	return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(data)
}

func chatFile(filename, url string) string {
	return `{"type":"file","file":{"filename":"` + filename + `","file_data":"` + url + `"}}`
}

func chatBody(parts ...string) string {
	return `{"model":"gpt","messages":[{"role":"user","content":[{"type":"text","text":"hi"},` + strings.Join(parts, ",") + `]}]}`
}

// testPDF is a one-page PDF that shows text in Helvetica; trailer adds
// members to its trailer.
func testPDF(text, trailer string) []byte {
	content := ""
	if text != "" {
		content = "BT /F1 12 Tf 72 712 Td (" + text + ") Tj ET"
	}
	objects := []string{
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
		fmt.Sprintf("<< /Length %d >>\nstream\n%s\nendstream", len(content), content),
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
	}
	var pdf bytes.Buffer
	pdf.WriteString("%PDF-1.4\n")
	offsets := make([]int, len(objects))
	for index, object := range objects {
		offsets[index] = pdf.Len()
		fmt.Fprintf(&pdf, "%d 0 obj\n%s\nendobj\n", index+1, object)
	}
	xref := pdf.Len()
	fmt.Fprintf(&pdf, "xref\n0 %d\n0000000000 65535 f \n", len(objects)+1)
	for _, offset := range offsets {
		fmt.Fprintf(&pdf, "%010d 00000 n \n", offset)
	}
	fmt.Fprintf(&pdf, "trailer\n<< /Size %d /Root 1 0 R %s>>\nstartxref\n%d\n%%%%EOF\n", len(objects)+1, trailer, xref)
	return pdf.Bytes()
}

// testDOCX is a DOCX file whose document holds paragraphs.
func testDOCX(t *testing.T, paragraphs ...string) []byte {
	t.Helper()
	var document strings.Builder
	document.WriteString(`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>`)
	for _, paragraph := range paragraphs {
		first, rest, _ := strings.Cut(paragraph, "\t")
		document.WriteString(`<w:p><w:r><w:t>` + first + `</w:t></w:r>`)
		if rest != "" {
			document.WriteString(`<w:r><w:tab/><w:t>` + rest + `</w:t></w:r>`)
		}
		document.WriteString(`</w:p>`)
	}
	document.WriteString(`</w:body></w:document>`)
	var archive bytes.Buffer
	writer := zip.NewWriter(&archive)
	part, err := writer.Create("word/document.xml")
	require.NoError(t, err)
	_, err = part.Write([]byte(document.String()))
	require.NoError(t, err)
	require.NoError(t, writer.Close())
	return archive.Bytes()
}

func testPNG(t *testing.T, width, height int) []byte {
	t.Helper()
	var buffer bytes.Buffer
	require.NoError(t, png.Encode(&buffer, image.NewGray(image.Rect(0, 0, width, height))))
	return buffer.Bytes()
}

// A hook lists the attachments in body order, inline ones by ref and the
// rest by id or URL, and reads the text of text, PDF and DOCX files; the
// record says what it did with each, never their names or content.
func TestAttachmentsListAndRead(t *testing.T) {
	pngData := testPNG(t, 3, 2)
	body := `{"model":"gpt","messages":[{"role":"user","content":[
		{"type":"text","text":"hi"},
		` + chatFile("notes.txt", dataURI("text/plain", []byte("plain notes"))) + `,
		{"type":"document","source":{"type":"base64","media_type":"application/pdf","data":"` + base64.StdEncoding.EncodeToString(testPDF("Hello PDF", "")) + `"}},
		` + chatFile("report.docx", dataURI(docxMime, testDOCX(t, "Hello\tDOCX", "Second"))) + `,
		{"type":"image_url","image_url":{"url":"` + dataURI("image/png", pngData) + `"}},
		{"type":"file","file":{"file_id":"file-abc","filename":"remote.pdf"}},
		{"type":"image_url","image_url":{"url":"https://example.com/cat.png"}}]}]}`
	outcome, seen := runAttachments(t, `{"list":true,"media":["[media:3]","[media:9]"],"read":["[media:0]","[media:1]","[media:2]","[media:3]"]}`, body)

	assert.JSONEq(t, `[
		{"ref":"<media:0]","kind":"document","mime":"text/plain","size":11,"filename":"notes.txt","path":"/messages/0/content/1/file/file_data","rewritable":true},
		{"ref":"<media:1]","kind":"document","mime":"application/pdf","size":`+fmt.Sprint(len(testPDF("Hello PDF", "")))+`,"path":"/messages/0/content/2/source/data"},
		{"ref":"<media:2]","kind":"document","mime":"`+docxMime+`","size":`+fmt.Sprint(len(testDOCX(t, "Hello\tDOCX", "Second")))+`,"filename":"report.docx","path":"/messages/0/content/3/file/file_data"},
		{"ref":"<media:3]","kind":"image","mime":"image/png","size":`+fmt.Sprint(len(pngData))+`,"path":"/messages/0/content/4/image_url/url"},
		{"kind":"document","mime":"","filename":"remote.pdf","path":"/messages/0/content/5/file/file_id"},
		{"kind":"image","mime":"","url":"https://example.com/cat.png","path":"/messages/0/content/6/image_url/url"}]`, seen.Get("attachments").Raw)
	assert.JSONEq(t, `[{"kind":"image","mime":"image/png","size":`+fmt.Sprint(len(pngData))+`,"width":3,"height":2},null]`, seen.Get("media").Raw)
	assert.JSONEq(t, `[{"text":"plain notes","truncated":false},{"text":"Hello PDF","truncated":false},
		{"text":"Hello\tDOCX\nSecond","truncated":false},{"unchecked":"unsupported"}]`, seen.Get("texts").Raw)

	require.Len(t, outcome.Record, 1)
	assert.Equal(t, []relaycommon.RequestPluginAttachment{
		{Kind: "document", Mime: "text/plain", Status: "checked"},
		{Kind: "document", Mime: "application/pdf", Status: "checked"},
		{Kind: "document", Mime: docxMime, Status: "checked"},
		{Kind: "image", Mime: "image/png", Status: "unchecked", Reason: "unsupported"},
		{Kind: "document", Status: "unchecked", Reason: "reference"},
		{Kind: "image", Status: "unchecked", Reason: "reference"},
	}, outcome.Record[0].Attachments)
	encoded, err := common.Marshal(outcome.Record)
	require.NoError(t, err)
	for _, secret := range []string{"notes.txt", "remote.pdf", "plain notes", "Hello", "example.com"} {
		assert.NotContains(t, string(encoded), secret)
	}
}

// Without a listing, the record holds the attachments the hook read.
func TestAttachmentRecordWithoutListing(t *testing.T) {
	body := chatBody(chatFile("a.txt", dataURI("text/plain", []byte("one"))), chatFile("b.txt", dataURI("text/plain", []byte("two"))))
	outcome, _ := runAttachments(t, `{"read":["[media:1]"],"maxChars":2}`, body)
	require.Len(t, outcome.Record, 1)
	assert.Equal(t, []relaycommon.RequestPluginAttachment{{Kind: "document", Mime: "text/plain", Status: "truncated"}}, outcome.Record[0].Attachments)
}

// Three instances that read one attachment extract it once; the request's
// text budget leaves the rest unchecked.
func TestAttachmentTextCacheAndBudget(t *testing.T) {
	pdf := chatFile("a.pdf", dataURI("application/pdf", testPDF("Shared", "")))
	read := `{"read":["[media:0]"],"quiet":true}`
	registerAttachmentPlugin(t, `[`+attachmentInstance("a", read)+`,`+attachmentInstance("b", read)+`,`+attachmentInstance("c", read)+`]`)
	before := extractions.Load()
	outcome := NewPlan().Run(context.Background(), Call{Stage: StageIngress, Body: []byte(chatBody(pdf))})
	require.Nil(t, outcome.Failed)
	assert.Equal(t, int64(1), extractions.Load()-before)
	require.Len(t, outcome.Record, 3)
	for _, entry := range outcome.Record {
		assert.Equal(t, "checked", entry.Attachments[0].Status)
	}

	// Four files of the most text a hook reads use up the budget.
	var parts []string
	var refs []string
	for index := range 5 {
		text := strings.Repeat(string(rune('a'+index)), jsplugin.MaxMediaTextChars)
		parts = append(parts, chatFile("f.txt", dataURI("text/plain", []byte(text))))
		refs = append(refs, fmt.Sprintf(`"[media:%d]"`, index))
	}
	outcome, seen := runAttachments(t, `{"read":[`+strings.Join(refs, ",")+`]}`, chatBody(parts...))
	texts := seen.Get("texts").Array()
	require.Len(t, texts, 5)
	for _, text := range texts[:4] {
		assert.Equal(t, jsplugin.MaxMediaTextChars, len(text.Get("text").Str))
		assert.False(t, text.Get("truncated").Bool())
	}
	assert.Equal(t, `{"unchecked":"limit"}`, texts[4].Raw)
	assert.Equal(t, "limit", outcome.Record[0].Attachments[4].Reason)
}

func TestAttachmentTextFormatsAndCaps(t *testing.T) {
	deadline := time.Now().Add(time.Minute)
	assert.Equal(t, extractedText{text: "Hello PDF"}, pdfText(testPDF("Hello PDF", ""), 100, deadline))
	assert.Equal(t, extractedText{text: "Hello", truncated: true}, pdfText(testPDF("Hello PDF", ""), 5, deadline))
	assert.Equal(t, extractedText{unchecked: uncheckedNoText}, pdfText(testPDF("", ""), 100, deadline))
	assert.Equal(t, extractedText{unchecked: uncheckedUnreadable}, pdfText(testPDF("Hello", "/Encrypt 6 0 R "), 100, deadline))
	assert.Equal(t, extractedText{unchecked: uncheckedUnreadable}, pdfText([]byte("%PDF-1.4\nnot a pdf"), 100, deadline))
	assert.Equal(t, extractedText{text: "A\tB\nC"}, docxText(testDOCX(t, "A\tB", "C"), 100, deadline))
	assert.Equal(t, extractedText{unchecked: uncheckedUnreadable}, docxText([]byte("not a zip"), 100, deadline))

	assert.Equal(t, extractedText{text: "héllo"}, readText(strings.NewReader("\xEF\xBB\xBFhéllo"), 100))
	assert.Equal(t, extractedText{text: "hi😀"}, readText(bytes.NewReader([]byte{0xFF, 0xFE, 'h', 0, 'i', 0, 0x3D, 0xD8, 0x00, 0xDE}), 100))
	assert.Equal(t, extractedText{text: "ab", truncated: true}, readText(strings.NewReader("abc"), 2))
	assert.Equal(t, extractedText{unchecked: uncheckedUnreadable}, readText(strings.NewReader("a\x00b"), 100))

	// Past the size cap a document is not read.
	ctx := context.Background()
	assert.Equal(t, extractedText{unchecked: uncheckedTooLarge}, readDocument(ctx, mediaItem{raw: make([]byte, maxDocumentBytes+1)}, formatPDF, 100))
	// With every document slot taken, a read that cannot wait is busy.
	for range cap(documentSlots) {
		documentSlots <- struct{}{}
	}
	short, cancel := context.WithTimeout(ctx, 10*time.Millisecond)
	defer cancel()
	assert.Equal(t, extractedText{unchecked: uncheckedBusy}, readDocument(short, mediaItem{raw: testPDF("x", "")}, formatPDF, 100))
	for range cap(documentSlots) {
		<-documentSlots
	}
}

// media.text rewrites a text file of the body. Any other file goes on as it
// is and is recorded as not rewritable; a media number that does not exist
// fails the instance.
func TestMediaTextEffect(t *testing.T) {
	text := chatFile("notes.txt", dataURI("text/plain", []byte("call 555")))
	claude := `{"type":"document","source":{"type":"base64","media_type":"text/plain","data":"` + base64.StdEncoding.EncodeToString([]byte("mail a@b.c")) + `"}}`
	pdf := chatFile("a.pdf", dataURI("application/pdf", testPDF("secret", "")))
	body := chatBody(text, claude, pdf)

	outcome, _ := runAttachments(t, `{"quiet":true,"rewrite":[{"media":0,"text":"call [phone]"},{"media":1,"text":"mail [email]"},{"media":2,"text":"[secret]"}]}`, body)
	content := gjson.GetBytes(outcome.Body, "messages.0.content")
	assert.Equal(t, dataURI("text/plain", []byte("call [phone]")), content.Get("1.file.file_data").Str)
	assert.Equal(t, "notes.txt", content.Get("1.file.filename").Str)
	assert.Equal(t, base64.StdEncoding.EncodeToString([]byte("mail [email]")), content.Get("2.source.data").Str)
	assert.Equal(t, "text/plain", content.Get("2.source.media_type").Str)
	assert.Equal(t, dataURI("application/pdf", testPDF("secret", "")), content.Get("3.file.file_data").Str)
	require.Len(t, outcome.Record, 1)
	assert.Equal(t, []relaycommon.RequestPluginAttachment{
		{Kind: "document", Mime: "text/plain", Status: "checked", Rewritten: true},
		{Kind: "document", Mime: "text/plain", Status: "checked", Rewritten: true},
		{Kind: "document", Mime: "application/pdf", Status: "unchecked", Reason: "not_rewritable"},
	}, outcome.Record[0].Attachments)

	// Text written from part of a file would drop the rest.
	outcome, _ = runAttachments(t, `{"quiet":true,"read":["[media:0]"],"maxChars":4,"rewrite":[{"media":0,"text":"call"}]}`, body)
	assert.Equal(t, body, string(outcome.Body))
	assert.Equal(t, []relaycommon.RequestPluginAttachment{{Kind: "document", Mime: "text/plain", Status: "unchecked", Reason: "not_rewritable"}}, outcome.Record[0].Attachments)

	registerAttachmentPlugin(t, `[`+attachmentInstance("att", `{"quiet":true,"rewrite":[{"media":3,"text":"x"}]}`)+`]`)
	failed := NewPlan().Run(context.Background(), Call{Stage: StageIngress, Body: []byte(body)}).Failed
	require.NotNil(t, failed)
	assert.Contains(t, failed.Detail, "effects[0].media 3 does not exist")
}

// A form's files are attachments after the body's inline media: listed by
// field name, read, and never rewritten.
func TestFormFileAttachments(t *testing.T) {
	var raw bytes.Buffer
	writer := multipart.NewWriter(&raw)
	require.NoError(t, writer.WriteField("model", "gpt-image-1"))
	require.NoError(t, writer.WriteField("prompt", "edit"))
	file, err := writer.CreateFormFile("attachment", "notes.txt")
	require.NoError(t, err)
	_, err = file.Write([]byte("form notes"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())
	registerAttachmentPlugin(t, `[`+attachmentInstance("att", `{"quiet":true,"list":true,"read":["[media:0]"],"rewrite":[{"media":0,"text":"x"}]}`)+`]`)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", bytes.NewReader(raw.Bytes()))
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	c.Set("group", "default")

	_, record, apiErr := Ingress(c, types.RelayFormatOpenAIImage)
	require.Nil(t, apiErr)
	require.Len(t, record, 1)
	assert.Equal(t, []relaycommon.RequestPluginAttachment{{Kind: "document", Mime: "text/plain", Status: "unchecked", Reason: "not_rewritable"}}, record[0].Attachments)
	assert.Equal(t, raw.Bytes(), storedBody(t, c))
}

// utils.fetch sends the data of each ref its body names, streamed from the
// request, and the URL of a listed file as it is; the record marks both sent.
func TestFetchSendsAttachments(t *testing.T) {
	server, received := newService(t)
	pngData := testPNG(t, 1, 1)
	body := chatBody(`{"type":"image_url","image_url":{"url":"`+dataURI("image/png", pngData)+`"}}`, `{"type":"image_url","image_url":{"url":"https://example.com/b.png"}}`)
	config, err := common.Marshal(map[string]any{"url": server.URL + "/moderate", "list": true, "quiet": true, "send": []string{"[media:0]", "https://example.com/b.png"}})
	require.NoError(t, err)
	outcome, _ := runAttachments(t, string(config), body)
	request := receive(t, received)
	assert.JSONEq(t, `{"input":["`+dataURI("image/png", pngData)+`","https://example.com/b.png"]}`, request.Body)
	assert.Equal(t, []relaycommon.RequestPluginAttachment{{Kind: "image", Mime: "image/png", Status: "checked"}, {Kind: "image", Status: "checked"}}, outcome.Record[0].Attachments)

	// A body may send at most maxFetchMedia refs.
	refs := make([]string, maxFetchMedia+1)
	for index := range refs {
		refs[index] = "[media:0]"
	}
	config, err = common.Marshal(map[string]any{"url": server.URL + "/moderate", "quiet": true, "send": refs})
	require.NoError(t, err)
	registerAttachmentPlugin(t, `[`+attachmentInstance("att", string(config))+`]`)
	failed := NewPlan().Run(context.Background(), Call{Stage: StageIngress, Body: []byte(body)}).Failed
	require.NotNil(t, failed)
	assert.Contains(t, failed.Detail, fmt.Sprintf("a body may send at most %d media", maxFetchMedia))
	assert.Empty(t, received)
}

// A WebP image re-encodes only when the canvas size its VP8X chunk declares
// is the size of its frame: the decoder decodes the frame whatever the
// canvas says, so a forged canvas would pass the pixel bound.
func TestReencodeWebPCanvasMatchesFrame(t *testing.T) {
	var encoded bytes.Buffer
	require.NoError(t, nativewebp.Encode(&encoded, image.NewGray(image.Rect(0, 0, 64, 64)), nil))
	require.Equal(t, "VP8L", string(encoded.Bytes()[12:16]))
	withCanvas := func(width, height int) inlineMedia {
		vp8x := []byte("VP8X\x0a\x00\x00\x00\x00\x00\x00\x00")
		vp8x = append(vp8x, byte(width-1), byte((width-1)>>8), 0, byte(height-1), byte((height-1)>>8), 0)
		chunks := append(append([]byte("WEBP"), vp8x...), encoded.Bytes()[12:]...)
		file := append(binary.LittleEndian.AppendUint32([]byte("RIFF"), uint32(len(chunks))), chunks...)
		return inlineMedia{path: "/image", mime: "image/webp", data: base64.StdEncoding.EncodeToString(file)}
	}
	effect := requestpatch.Effect{Type: requestpatch.EffectMediaReencode, Format: "png"}
	_, _, err := reencodeMedia(context.Background(), withCanvas(64, 64), effect)
	require.NoError(t, err)
	_, _, err = reencodeMedia(context.Background(), withCanvas(1, 1), effect)
	assert.EqualError(t, err, "media /image cannot be decoded")
}

// A hook that does not use attachments costs nothing for them: no file is
// extracted, decoded or listed, the record holds none, and a call's
// attachment state is one small allocation whatever the body holds.
func TestAttachmentsUnusedCostNothing(t *testing.T) {
	pdf := chatFile("a.pdf", dataURI("application/pdf", testPDF("Hello", "")))
	before := extractions.Load()
	outcome, _ := runAttachments(t, `{"quiet":true}`, chatBody(pdf, pdf, pdf))
	assert.Equal(t, before, extractions.Load())
	assert.Empty(t, outcome.Record)

	view, media := scanMedia([]byte(chatBody(pdf, pdf, pdf)))
	require.Len(t, media, 3)
	form := &formBody{files: []formFile{{name: "file", filename: "a.txt"}}}
	allocs := testing.AllocsPerRun(100, func() {
		call := newCallMedia(&requestMedia{}, view, media, form)
		if items, more := call.record(); items != nil || more != 0 || call.files != nil {
			t.Fatal("an unused call recorded or read attachments")
		}
	})
	assert.LessOrEqual(t, allocs, 1.0)
}
