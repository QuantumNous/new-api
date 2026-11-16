package requestplugin

import (
	"bytes"
	"cmp"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"hash/maphash"
	"image"
	"io"
	"path"
	"slices"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/pkg/requestpatch"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/tidwall/gjson"
)

// Caps of reading attachment text with utils.mediaText. A file past a cap is
// unchecked; text past a cap is truncated.
const (
	// maxDocumentBytes bounds the decoded size of a PDF or DOCX file.
	maxDocumentBytes = 10 << 20
	// maxRequestTextChars bounds the attachment text read for one request,
	// in UTF-16 code units: four attachments read whole.
	maxRequestTextChars = 512 << 10
	// documentTimeout bounds reading one PDF or DOCX file.
	documentTimeout = 3 * time.Second
	// documentWait bounds the wait for a document slot.
	documentWait = 5 * time.Second
	// maxRecordedAttachments bounds the attachments of one record entry.
	maxRecordedAttachments = 16
	// maxFetchMedia and maxFetchMediaBytes bound the media one utils.fetch
	// body sends: refs and decoded bytes.
	maxFetchMedia      = 8
	maxFetchMediaBytes = 32 << 20
)

// documentSlots bounds the PDF and DOCX files read at once in the process.
var documentSlots = make(chan struct{}, 2)

// The reasons an attachment is unchecked.
const (
	uncheckedUnsupported = "unsupported"
	uncheckedReference   = "reference"
	uncheckedTooLarge    = "too_large"
	uncheckedUnreadable  = "unreadable"
	uncheckedLimit       = "limit"
	uncheckedBusy        = "busy"
	// uncheckedNoText is a file that holds no text, such as a scanned PDF.
	uncheckedNoText = "no_text"
	// uncheckedNotRewritable is a file a media.text effect could not
	// rewrite, so it went on as it was.
	uncheckedNotRewritable = "not_rewritable"
)

// The status of an attachment in the record.
const (
	attachmentChecked   = "checked"
	attachmentTruncated = "truncated"
	attachmentUnchecked = "unchecked"
)

// Formats the host reads text from.
const (
	formatText = "text"
	formatDOCX = "docx"
	formatPDF  = "pdf"
)

const docxMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

// textExtensions are the file extensions of text files, for a file whose
// mime type does not say.
var textExtensions = map[string]bool{
	".txt": true, ".text": true, ".md": true, ".markdown": true, ".csv": true, ".tsv": true, ".json": true, ".jsonl": true,
	".ndjson": true, ".xml": true, ".yaml": true, ".yml": true, ".toml": true, ".ini": true, ".cfg": true, ".conf": true,
	".log": true, ".html": true, ".htm": true, ".css": true, ".js": true, ".mjs": true, ".cjs": true, ".ts": true,
	".tsx": true, ".jsx": true, ".vue": true, ".svelte": true, ".py": true, ".go": true, ".java": true, ".kt": true,
	".kts": true, ".scala": true, ".c": true, ".h": true, ".cc": true, ".cpp": true, ".hpp": true, ".cs": true,
	".rb": true, ".php": true, ".rs": true, ".swift": true, ".m": true, ".sh": true, ".bash": true, ".zsh": true,
	".ps1": true, ".sql": true, ".r": true, ".lua": true, ".pl": true, ".dart": true, ".tex": true, ".rst": true,
	".srt": true, ".vtt": true, ".properties": true, ".proto": true, ".graphql": true, ".diff": true, ".patch": true,
}

// documentExtensions are the extensions of documents the host cannot read.
var documentExtensions = map[string]bool{
	".doc": true, ".xls": true, ".xlsx": true, ".ppt": true, ".pptx": true, ".odt": true, ".ods": true, ".odp": true,
	".rtf": true, ".epub": true, ".pages": true, ".numbers": true, ".key": true,
}

// textFormat is the format the host reads text from for a file of mime and
// filename: text, docx or pdf; "" for any other file.
func textFormat(mime, filename string) string {
	mime = strings.ToLower(mime)
	extension := strings.ToLower(path.Ext(filename))
	switch {
	case strings.HasPrefix(mime, "image/") || strings.HasPrefix(mime, "audio/") || strings.HasPrefix(mime, "video/"):
		return ""
	case mime == "application/pdf" || extension == ".pdf":
		return formatPDF
	case mime == docxMime || extension == ".docx":
		return formatDOCX
	case textMime(mime) || textExtensions[extension]:
		return formatText
	}
	return ""
}

func textMime(mime string) bool {
	if strings.HasPrefix(mime, "text/") || strings.HasSuffix(mime, "+json") || strings.HasSuffix(mime, "+xml") {
		return true
	}
	switch mime {
	case "application/json", "application/xml", "application/yaml", "application/x-yaml", "application/toml",
		"application/x-toml", "application/javascript", "application/x-javascript", "application/ecmascript",
		"application/x-sh", "application/x-shellscript", "application/sql", "application/x-sql", "application/csv",
		"application/x-ndjson", "application/jsonl", "application/graphql", "application/x-tex", "application/x-latex",
		"application/x-python", "application/x-httpd-php":
		return true
	}
	return false
}

// mediaKind is the kind utils.media and the record give a file.
func mediaKind(mime, filename string) string {
	mime = strings.ToLower(mime)
	switch {
	case strings.HasPrefix(mime, "image/"):
		return "image"
	case strings.HasPrefix(mime, "audio/"):
		return "audio"
	case strings.HasPrefix(mime, "video/"):
		return "video"
	case textFormat(mime, filename) != "" || documentExtensions[strings.ToLower(path.Ext(filename))] ||
		mime == "application/msword" || mime == "application/rtf" || mime == "application/epub+zip" ||
		strings.HasPrefix(mime, "application/vnd.openxmlformats-officedocument.") || strings.HasPrefix(mime, "application/vnd.ms-") ||
		strings.HasPrefix(mime, "application/vnd.oasis.opendocument."):
		return "document"
	}
	return "other"
}

// requestMedia is what the hook calls of one request share about its
// attachments: the text read from each, so instances that read one
// attachment read it once, and the request's text budget.
type requestMedia struct {
	mu    sync.Mutex
	texts map[mediaKey]extractedText
	chars int
}

type mediaKey struct {
	hash   uint64
	size   int
	format string
}

// extractedText is the text read from one attachment, or the reason it was
// not read.
type extractedText struct {
	text      string
	truncated bool
	unchecked string
}

var mediaSeed = maphash.MakeSeed()

// extractions counts the attachments read, for tests.
var extractions atomic.Int64

// mediaItem is one "[media:N]" of a hook call: an inline media string of the
// body, or the content of a multipart file.
type mediaItem struct {
	mime     string
	filename string
	inline   *inlineMedia
	raw      []byte
}

func (m mediaItem) size() int {
	if m.inline != nil {
		return m.inline.size()
	}
	return len(m.raw)
}

func (m mediaItem) reader() io.Reader {
	if m.inline != nil {
		return base64.NewDecoder(base64.StdEncoding, strings.NewReader(m.inline.data))
	}
	return bytes.NewReader(m.raw)
}

func (m mediaItem) hash() uint64 {
	if m.inline != nil {
		return maphash.String(mediaSeed, m.inline.data)
	}
	return maphash.Bytes(mediaSeed, m.raw)
}

// text reads the text of item once per request, under the request's budget.
func (r *requestMedia) text(ctx context.Context, item mediaItem, format string) extractedText {
	key := mediaKey{hash: item.hash(), size: item.size(), format: format}
	r.mu.Lock()
	if cached, ok := r.texts[key]; ok {
		r.mu.Unlock()
		return cached
	}
	budget := maxRequestTextChars - r.chars
	r.mu.Unlock()
	if budget <= 0 {
		return extractedText{unchecked: uncheckedLimit}
	}
	maxChars := min(jsplugin.MaxMediaTextChars, budget)
	var result extractedText
	if format == formatText {
		result = readText(item.reader(), maxChars)
	} else {
		result = readDocument(ctx, item, format, maxChars)
	}
	extractions.Add(1)
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.texts == nil {
		r.texts = map[mediaKey]extractedText{}
	}
	r.texts[key] = result
	r.chars += jsplugin.UTF16Len(result.text)
	return result
}

// readDocument reads a PDF or DOCX file: at most two at once in the process,
// each for at most documentTimeout.
func readDocument(ctx context.Context, item mediaItem, format string, maxChars int) extractedText {
	if item.size() > maxDocumentBytes {
		return extractedText{unchecked: uncheckedTooLarge}
	}
	wait, cancel := context.WithTimeout(ctx, documentWait)
	defer cancel()
	select {
	case documentSlots <- struct{}{}:
	case <-wait.Done():
		return extractedText{unchecked: uncheckedBusy}
	}
	defer func() { <-documentSlots }()
	data := item.raw
	if item.inline != nil {
		decoded, err := io.ReadAll(io.LimitReader(item.reader(), maxDocumentBytes+1))
		if err != nil {
			return extractedText{unchecked: uncheckedUnreadable}
		}
		data = decoded
	}
	deadline := time.Now().Add(documentTimeout)
	if format == formatDOCX {
		return docxText(data, maxChars, deadline)
	}
	return pdfText(data, maxChars, deadline)
}

// callMedia is the MediaSource of one hook call: the media of the body it
// reads and the multipart files of a form body, and what the call did with
// them, for its record entry.
type callMedia struct {
	request *requestMedia
	view    []byte
	media   []inlineMedia
	form    *formBody
	// files are the contents of the form's files, read on first use.
	files    [][]byte
	filesErr error
	// listed is set when the hook listed the attachments.
	listed      bool
	attachments []jsplugin.Attachment
	marks       map[string]*relaycommon.RequestPluginAttachment
	// order is the order the call first marked attachments in.
	order []string
}

func newCallMedia(request *requestMedia, view []byte, media []inlineMedia, form *formBody) *callMedia {
	return &callMedia{request: request, view: view, media: media, form: form}
}

func mediaRef(index int) string {
	return "[media:" + strconv.Itoa(index) + "]"
}

// parseMediaRef returns N of "[media:N]".
func parseMediaRef(ref string) (int, bool) {
	digits, found := strings.CutPrefix(ref, "[media:")
	if digits, found = strings.CutSuffix(digits, "]"); !found || digits == "" || len(digits) > 6 {
		return 0, false
	}
	index, err := strconv.Atoi(digits)
	return index, err == nil && index >= 0 && strconv.Itoa(index) == digits
}

func (m *callMedia) readFiles() {
	if m.files != nil || m.filesErr != nil || m.form == nil || len(m.form.files) == 0 {
		return
	}
	files := make([][]byte, len(m.form.files))
	for index, file := range m.form.files {
		content, err := m.form.fileContent(file)
		if err != nil {
			m.filesErr = err
			return
		}
		files[index] = content
	}
	m.files = files
}

// item returns the media ref names.
func (m *callMedia) item(ref string) (mediaItem, bool) {
	index, ok := parseMediaRef(ref)
	if !ok {
		return mediaItem{}, false
	}
	if index < len(m.media) {
		item := &m.media[index]
		return mediaItem{mime: item.mime, filename: item.filename, inline: item}, true
	}
	index -= len(m.media)
	if m.form == nil || index >= len(m.form.files) {
		return mediaItem{}, false
	}
	if m.readFiles(); m.files == nil {
		return mediaItem{}, false
	}
	file := m.form.files[index]
	mime := file.mime
	if mime == "" || mime == "application/octet-stream" {
		mime = typeByExtension(file.filename)
	}
	return mediaItem{mime: mime, filename: file.filename, raw: m.files[index]}, true
}

func typeByExtension(filename string) string {
	switch strings.ToLower(path.Ext(filename)) {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".mp3":
		return "audio/mpeg"
	case ".wav":
		return "audio/wav"
	case ".m4a":
		return "audio/mp4"
	case ".mp4":
		return "video/mp4"
	case ".pdf":
		return "application/pdf"
	case ".docx":
		return docxMime
	}
	if textExtensions[strings.ToLower(path.Ext(filename))] {
		return "text/plain"
	}
	return "application/octet-stream"
}

// Attachments lists the inline media and the files the body names by id or
// URL in body order, then the multipart files.
func (m *callMedia) Attachments() []jsplugin.Attachment {
	if m.listed {
		return m.attachments
	}
	m.listed = true
	if bytes.Contains(m.view, []byte("[media:")) || bytes.Contains(m.view, []byte("file")) || bytes.Contains(m.view, []byte("image")) || bytes.Contains(m.view, []byte("source")) {
		m.walkAttachments(gjson.ParseBytes(m.view), "", "", "")
	}
	if m.form != nil {
		for index, file := range m.form.files {
			if item, ok := m.item(mediaRef(len(m.media) + index)); ok {
				m.attachments = append(m.attachments, jsplugin.Attachment{Ref: mediaRef(len(m.media) + index), Kind: mediaKind(item.mime, item.filename),
					Mime: item.mime, Size: item.size(), Filename: file.filename, Path: file.name})
			}
		}
	}
	return m.attachments
}

// walkAttachments adds the attachments in value, at pointer: the "[media:N]"
// strings of the view and the shapes that name a file by id or URL. key is
// the member value is, parentType the type member of the object around it.
func (m *callMedia) walkAttachments(value gjson.Result, pointer, key, parentType string) {
	switch {
	case value.IsObject():
		blockType := value.Get("type").Str
		switch {
		case key == "file" && value.Get("file_id").Type == gjson.String:
			// A chat file part: {type: "file", file: {file_id, filename}}.
			m.addReference("document", "", "", value.Get("filename").Str, pointer+"/file_id")
		case (blockType == "input_file" || blockType == "input_image") && value.Get("file_id").Type == gjson.String:
			kind := "document"
			if blockType == "input_image" {
				kind = "image"
			}
			m.addReference(kind, "", "", value.Get("filename").Str, pointer+"/file_id")
		case blockType == "input_file" && value.Get("file_url").Type == gjson.String:
			m.addReference("document", "", value.Get("file_url").Str, value.Get("filename").Str, pointer+"/file_url")
		case key == "source" && (blockType == "url" || blockType == "file"):
			// A Claude image or document source by URL or file id.
			kind := "document"
			if parentType == "image" {
				kind = "image"
			}
			if blockType == "url" {
				m.addReference(kind, "", value.Get("url").Str, "", pointer+"/url")
			} else {
				m.addReference(kind, "", "", "", pointer+"/file_id")
			}
		case key == "fileData" || (key == "file_data" && value.Get("file_uri").Type == gjson.String):
			// A Gemini file part.
			mime := value.Get("mimeType").Str
			if mime == "" {
				mime = value.Get("mime_type").Str
			}
			uri := value.Get("fileUri").Str
			if uri == "" {
				uri = value.Get("file_uri").Str
			}
			m.addReference(mediaKind(mime, ""), mime, uri, "", pointer)
		case key == "image_url" && value.Get("url").Type == gjson.String:
			m.remoteImage(value.Get("url").Str, pointer+"/url")
		}
		value.ForEach(func(name, member gjson.Result) bool {
			m.walkAttachments(member, pointer+"/"+escapePointer(name.String()), name.String(), blockType)
			return true
		})
	case value.IsArray():
		index := 0
		value.ForEach(func(_, item gjson.Result) bool {
			m.walkAttachments(item, pointer+"/"+strconv.Itoa(index), "", parentType)
			index++
			return true
		})
	case value.Type == gjson.String:
		if index, ok := parseMediaRef(value.Str); ok && index < len(m.media) {
			item := m.media[index]
			m.attachments = append(m.attachments, jsplugin.Attachment{Ref: value.Str, Kind: mediaKind(item.mime, item.filename), Mime: item.mime,
				Size: item.size(), Filename: item.filename, Path: pointer, Rewritable: rewritable(item)})
		} else if key == "image_url" {
			// A Responses input_image: {type: "input_image", image_url}.
			m.remoteImage(value.Str, pointer)
		}
	}
}

func (m *callMedia) remoteImage(url, pointer string) {
	if strings.HasPrefix(url, "https://") || strings.HasPrefix(url, "http://") {
		m.addReference("image", "", url, "", pointer)
	}
}

func (m *callMedia) addReference(kind, mime, url, filename, pointer string) {
	m.attachments = append(m.attachments, jsplugin.Attachment{Kind: kind, Mime: mime, URL: url, Filename: filename, Path: pointer})
}

// Media describes the media ref names.
func (m *callMedia) Media(ref string) (jsplugin.MediaInfo, bool) {
	item, ok := m.item(ref)
	if !ok {
		return jsplugin.MediaInfo{}, false
	}
	info := jsplugin.MediaInfo{Kind: mediaKind(item.mime, item.filename), Mime: item.mime, Size: item.size(), Filename: item.filename}
	if item.inline != nil {
		info.Rewritable = rewritable(*item.inline)
	}
	if info.Kind == "image" {
		if config, _, err := image.DecodeConfig(item.reader()); err == nil {
			info.Width, info.Height = config.Width, config.Height
		}
	}
	return info, true
}

// MediaText reads the text of the media ref names: once per request, at
// most maxChars UTF-16 code units of it.
func (m *callMedia) MediaText(ctx context.Context, ref string, maxChars int) (jsplugin.MediaText, bool) {
	item, ok := m.item(ref)
	if !ok {
		return jsplugin.MediaText{}, false
	}
	result := extractedText{unchecked: uncheckedUnsupported}
	if format := textFormat(item.mime, item.filename); format != "" && (item.inline == nil || !item.inline.audio) {
		result = m.request.text(ctx, item, format)
	}
	if result.unchecked != "" {
		m.mark(ref, attachmentUnchecked, result.unchecked)
		return jsplugin.MediaText{Unchecked: result.unchecked}, true
	}
	text, truncated := result.text, result.truncated
	if jsplugin.UTF16Len(text) > maxChars {
		text, truncated = cutUTF16(text, maxChars), true
	}
	if truncated {
		m.mark(ref, attachmentTruncated, "")
	} else {
		m.mark(ref, attachmentChecked, "")
	}
	return jsplugin.MediaText{Text: text, Truncated: truncated}, true
}

// cutUTF16 is the longest prefix of text at most limit UTF-16 code units long.
func cutUTF16(text string, limit int) string {
	units := 0
	for index, char := range text {
		width := 1
		if char > 0xFFFF {
			width = 2
		}
		if units+width > limit {
			return text[:index]
		}
		units += width
	}
	return text
}

// mark records what the call did with an attachment: ref, or "url:" and
// the pointer of a file named by URL. A better status stays: checked over
// truncated over unchecked.
func (m *callMedia) mark(key, status, reason string) {
	rank := map[string]int{attachmentUnchecked: 1, attachmentTruncated: 2, attachmentChecked: 3}
	if m.marks == nil {
		m.marks = map[string]*relaycommon.RequestPluginAttachment{}
	}
	current := m.marks[key]
	if current == nil {
		current = &relaycommon.RequestPluginAttachment{}
		m.marks[key] = current
		m.order = append(m.order, key)
	}
	if rank[status] > rank[current.Status] {
		current.Status, current.Reason = status, reason
	}
}

func (m *callMedia) markRewritten(ref string) {
	m.mark(ref, attachmentChecked, "")
	m.marks[ref].Rewritten = true
}

// markNotRewritable records a file a media.text effect asked to rewrite and
// the host left as it was. It replaces what the call read: the text the hook
// wanted gone is still in the file.
func (m *callMedia) markNotRewritable(ref string) {
	m.mark(ref, attachmentUnchecked, "")
	mark := m.marks[ref]
	mark.Status, mark.Reason, mark.Rewritten = attachmentUnchecked, uncheckedNotRewritable, false
}

// exists reports whether index names inline media or a form file of the call.
func (m *callMedia) exists(index int) bool {
	return index >= 0 && (index < len(m.media) || m.form != nil && index-len(m.media) < len(m.form.files))
}

// readInPart reports whether the call read only part of the text of ref.
func (m *callMedia) readInPart(ref string) bool {
	mark := m.marks[ref]
	return mark != nil && mark.Status == attachmentTruncated
}

// record is the attachments part of the call's record entry: every
// attachment when the call listed them, otherwise those it read, sent or
// rewrote.
func (m *callMedia) record() ([]relaycommon.RequestPluginAttachment, int) {
	var items []relaycommon.RequestPluginAttachment
	add := func(kind, mime, key string, reference bool) {
		item := relaycommon.RequestPluginAttachment{Kind: kind, Mime: mime, Status: attachmentUnchecked}
		if reference {
			item.Reason = uncheckedReference
		}
		if mark := m.marks[key]; mark != nil {
			item.Status, item.Reason, item.Rewritten = mark.Status, mark.Reason, mark.Rewritten
		}
		items = append(items, item)
	}
	if m.listed {
		for _, attachment := range m.attachments {
			key := attachment.Ref
			if key == "" {
				key = "url:" + attachment.Path
			}
			add(attachment.Kind, attachment.Mime, key, attachment.Ref == "")
		}
	} else {
		// Refs number the attachments in request order.
		order := slices.Clone(m.order)
		slices.SortFunc(order, func(a, b string) int {
			first, _ := parseMediaRef(a)
			second, _ := parseMediaRef(b)
			return cmp.Compare(first, second)
		})
		for _, ref := range order {
			if item, ok := m.item(ref); ok {
				add(mediaKind(item.mime, item.filename), item.mime, ref, false)
			}
		}
	}
	if len(items) > maxRecordedAttachments {
		return items[:maxRecordedAttachments], len(items) - maxRecordedAttachments
	}
	return items, 0
}

// FetchBody returns body with each JSON string value that equals a ref of
// the call replaced by its data URL, streamed from the request. A string
// that equals the URL of a listed file marks that file as sent.
func (m *callMedia) FetchBody(body string) (io.Reader, int64, error) {
	hasRefs := strings.Contains(body, `"[media:`)
	urls := map[string]string{}
	if m.listed {
		for _, attachment := range m.attachments {
			if attachment.Ref == "" && attachment.URL != "" {
				urls[attachment.URL] = "url:" + attachment.Path
			}
		}
	}
	if !hasRefs && len(urls) == 0 {
		return nil, 0, nil
	}
	type replacement struct {
		start, end int
		item       mediaItem
	}
	var replacements []replacement
	total := 0
	var failure error
	forEachJSONString(body, func(start, end int, isKey bool) {
		if isKey || failure != nil {
			return
		}
		raw := body[start+1 : end-1]
		if key, ok := urls[raw]; ok {
			m.mark(key, attachmentChecked, "")
			return
		}
		item, ok := m.item(raw)
		if !ok {
			return
		}
		if len(replacements) == maxFetchMedia {
			failure = fmt.Errorf("a body may send at most %d media", maxFetchMedia)
			return
		}
		if total += item.size(); total > maxFetchMediaBytes {
			failure = fmt.Errorf("the media of a body must not exceed %d bytes", maxFetchMediaBytes)
			return
		}
		replacements = append(replacements, replacement{start: start, end: end, item: item})
		m.mark(raw, attachmentChecked, "")
	})
	if failure != nil {
		return nil, 0, failure
	}
	if len(replacements) == 0 {
		return nil, 0, nil
	}
	readers := make([]io.Reader, 0, 2*len(replacements)+1)
	size := int64(0)
	offset := 0
	for _, part := range replacements {
		readers = append(readers, strings.NewReader(body[offset:part.start]))
		size += int64(part.start - offset)
		url, length, err := dataURL(part.item)
		if err != nil {
			return nil, 0, err
		}
		readers = append(readers, url)
		size += length
		offset = part.end
	}
	readers = append(readers, strings.NewReader(body[offset:]))
	size += int64(len(body) - offset)
	return io.MultiReader(readers...), size, nil
}

// dataURL streams item as a JSON string holding its data URL.
func dataURL(item mediaItem) (io.Reader, int64, error) {
	header := `"data:` + safeMime(item.mime) + `;base64,`
	if item.inline != nil {
		data := item.inline.data
		length := 0
		for index := 0; index < len(data); index++ {
			switch char := data[index]; {
			case char == ' ' || char == '\t' || char == '\r' || char == '\n':
			case 'A' <= char && char <= 'Z' || 'a' <= char && char <= 'z' || '0' <= char && char <= '9' || char == '+' || char == '/' || char == '=':
				length++
			default:
				return nil, 0, errors.New("a media payload is not base64")
			}
		}
		payload := io.Reader(strings.NewReader(data))
		if length != len(data) {
			payload = &spaceSkipper{data: data}
		}
		return io.MultiReader(strings.NewReader(header), payload, strings.NewReader(`"`)), int64(len(header) + length + 1), nil
	}
	encoded := base64.StdEncoding.EncodedLen(len(item.raw))
	return io.MultiReader(strings.NewReader(header), &base64Reader{raw: item.raw}, strings.NewReader(`"`)), int64(len(header) + encoded + 1), nil
}

// safeMime is mime when it is a plain type/subtype, otherwise
// application/octet-stream: it is written into a JSON string unescaped.
func safeMime(mime string) string {
	if !strings.Contains(mime, "/") {
		return "application/octet-stream"
	}
	for index := 0; index < len(mime); index++ {
		if char := mime[index]; !('a' <= char && char <= 'z' || 'A' <= char && char <= 'Z' || '0' <= char && char <= '9' || strings.IndexByte("/.+-_", char) >= 0) {
			return "application/octet-stream"
		}
	}
	return mime
}

// spaceSkipper reads data without its whitespace.
type spaceSkipper struct {
	data string
}

func (s *spaceSkipper) Read(p []byte) (int, error) {
	n := 0
	for n < len(p) && len(s.data) > 0 {
		if char := s.data[0]; char != ' ' && char != '\t' && char != '\r' && char != '\n' {
			p[n] = char
			n++
		}
		s.data = s.data[1:]
	}
	if n == 0 && len(s.data) == 0 {
		return 0, io.EOF
	}
	return n, nil
}

// base64Reader reads raw as standard base64.
type base64Reader struct {
	raw     []byte
	pending []byte
}

func (b *base64Reader) Read(p []byte) (int, error) {
	if len(b.pending) == 0 {
		if len(b.raw) == 0 {
			return 0, io.EOF
		}
		chunk := b.raw[:min(len(b.raw), 3<<10)]
		b.raw = b.raw[len(chunk):]
		b.pending = base64.StdEncoding.AppendEncode(b.pending[:0], chunk)
	}
	n := copy(p, b.pending)
	b.pending = b.pending[n:]
	return n, nil
}

// forEachJSONString calls fn with the offsets of each string token of the
// JSON text body, quotes included, and whether it is an object key.
func forEachJSONString(body string, fn func(start, end int, isKey bool)) {
	for index := 0; index < len(body); index++ {
		if body[index] != '"' {
			continue
		}
		end := index + 1
		for end < len(body) && body[end] != '"' {
			if body[end] == '\\' {
				end++
			}
			end++
		}
		if end >= len(body) {
			return
		}
		end++
		next := end
		for next < len(body) && (body[next] == ' ' || body[next] == '\t' || body[next] == '\r' || body[next] == '\n') {
			next++
		}
		fn(index, end, next < len(body) && body[next] == ':')
		index = end - 1
	}
}

// rewritable reports inline media a media.text effect may rewrite: a text
// file. A PDF, a DOCX file or an image would have to be written anew, and a
// multipart file is not part of the JSON body.
func rewritable(item inlineMedia) bool {
	return !item.audio && textFormat(item.mime, item.filename) == formatText
}

// mediaTextOps are the json.patch operations of a media.text effect: the
// media string replaced by text in base64, with the same mime type and
// filename.
func mediaTextOps(item inlineMedia, text string) ([]requestpatch.Operation, error) {
	payload := base64.StdEncoding.EncodeToString([]byte(text))
	if item.mimePath == "" {
		payload = "data:" + item.mime + ";base64," + payload
	}
	value, err := common.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return []requestpatch.Operation{{Op: "replace", Path: item.path, Value: value}}, nil
}
