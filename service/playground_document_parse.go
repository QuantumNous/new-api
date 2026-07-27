package service

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/storage"
	"github.com/google/uuid"
)

const (
	// MySQL TEXT holds 64KB; leave headroom for multi-byte truncation.
	PlaygroundParseMaxTextBytes = 60000
	// OCR page budget per document (product decision, billed to the user).
	PlaygroundParseMaxOCRPages = 50
	playgroundParseOCRRenderDPI = 150
	// Native text under this density means the PDF is a scan (or nearly so)
	// and the text layer alone would silently drop the real content.
	playgroundParseMinTextRunes        = 200
	playgroundParseMinTextRunesPerPage = 15
	// A processing row older than this belongs to a crashed request and may be
	// taken over by the next caller.
	playgroundParseStaleAfter = 5 * time.Minute
)

// PlaygroundParseOCRPrompt is the fixed transcription instruction the client
// sends together with the rendered page images through the normal /pg relay.
const PlaygroundParseOCRPrompt = "Transcribe every piece of text in these document page images, in reading order. Preserve headings, paragraphs, lists and table structure as Markdown. Output only the transcription, no commentary. If a page contains no text, output nothing for it."

// RunPlaygroundDocumentParse resolves (or creates) the cached parse for a
// document asset. Native extraction happens synchronously; scanned PDFs come
// back as needs_ocr with a client execution contract.
func RunPlaygroundDocumentParse(ctx context.Context, asset *model.PlaygroundAsset, abilityGroups []string) (*model.PlaygroundDocumentParse, error) {
	if asset.Kind != "document" {
		return nil, fmt.Errorf("asset is not a document")
	}
	if asset.ContentHash == "" {
		return nil, fmt.Errorf("document was uploaded before parsing support; please re-attach the file")
	}

	if parse, err := model.GetPlaygroundDocumentParseByHash(asset.ContentHash); err == nil {
		if parse.Status != model.PlaygroundParseStatusProcessing {
			return parse, nil
		}
		if parse.UpdatedAt > time.Now().Add(-playgroundParseStaleAfter).Unix() {
			return parse, nil
		}
		// Stale processing row: take it over and re-run extraction.
		if err := model.UpdatePlaygroundDocumentParseCAS(parse.Id, model.PlaygroundParseStatusProcessing, map[string]any{"status": model.PlaygroundParseStatusProcessing}); err != nil {
			return model.GetPlaygroundDocumentParseByHash(asset.ContentHash)
		}
		return executePlaygroundDocumentParse(ctx, parse, asset, abilityGroups)
	}

	parse := &model.PlaygroundDocumentParse{ContentHash: asset.ContentHash, Status: model.PlaygroundParseStatusProcessing}
	if err := model.CreatePlaygroundDocumentParse(parse); err != nil {
		// Unique conflict: another request won the race.
		if existing, e := model.GetPlaygroundDocumentParseByHash(asset.ContentHash); e == nil {
			return existing, nil
		}
		return nil, err
	}
	return executePlaygroundDocumentParse(ctx, parse, asset, abilityGroups)
}

func executePlaygroundDocumentParse(ctx context.Context, parse *model.PlaygroundDocumentParse, asset *model.PlaygroundAsset, abilityGroups []string) (*model.PlaygroundDocumentParse, error) {
	content, err := readPlaygroundAssetContent(ctx, asset)
	if err != nil {
		return failPlaygroundParse(parse, "could not read stored document: "+err.Error())
	}

	switch NormalizePlaygroundMime(asset.Mime) {
	case MimeDocx, MimeXlsx, MimePptx:
		text, extractErr := ExtractOfficeText(NormalizePlaygroundMime(asset.Mime), content)
		if extractErr != nil {
			return failPlaygroundParse(parse, extractErr.Error())
		}
		return finishPlaygroundParse(parse, "office", text, 0)
	case "application/pdf":
		return parsePlaygroundPDF(ctx, parse, content, abilityGroups)
	default:
		return failPlaygroundParse(parse, fmt.Sprintf("unsupported document type %s", asset.Mime))
	}
}

func readPlaygroundAssetContent(ctx context.Context, asset *model.PlaygroundAsset) ([]byte, error) {
	rc, err := OpenPlaygroundAssetContentDirect(ctx, asset.Backend, asset.StorageKey)
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	return io.ReadAll(io.LimitReader(rc, PlaygroundAssetMaxDocumentBytes+1))
}

func failPlaygroundParse(parse *model.PlaygroundDocumentParse, message string) (*model.PlaygroundDocumentParse, error) {
	_ = model.UpdatePlaygroundDocumentParseCAS(parse.Id, model.PlaygroundParseStatusProcessing, map[string]any{
		"status":        model.PlaygroundParseStatusFailed,
		"error_message": message,
	})
	return model.GetPlaygroundDocumentParseByHash(parse.ContentHash)
}

func finishPlaygroundParse(parse *model.PlaygroundDocumentParse, parser, text string, pageCount int) (*model.PlaygroundDocumentParse, error) {
	text = strings.TrimSpace(text)
	if text == "" {
		return failPlaygroundParse(parse, "the document contains no extractable text")
	}
	_ = model.UpdatePlaygroundDocumentParseCAS(parse.Id, model.PlaygroundParseStatusProcessing, map[string]any{
		"status":     model.PlaygroundParseStatusDone,
		"parser":     parser,
		"text":       TruncateUTF8(text, PlaygroundParseMaxTextBytes),
		"page_count": pageCount,
	})
	return model.GetPlaygroundDocumentParseByHash(parse.ContentHash)
}

// --- PDF -------------------------------------------------------------------

func parsePlaygroundPDF(ctx context.Context, parse *model.PlaygroundDocumentParse, content []byte, abilityGroups []string) (*model.PlaygroundDocumentParse, error) {
	if _, err := exec.LookPath("pdftotext"); err != nil {
		return failPlaygroundParse(parse, "document parsing is not available on this server (poppler missing)")
	}

	tmp, err := os.CreateTemp("", "pgdoc-*.pdf")
	if err != nil {
		return failPlaygroundParse(parse, "temp file: "+err.Error())
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)
	if _, err := tmp.Write(content); err != nil {
		tmp.Close()
		return failPlaygroundParse(parse, "temp file: "+err.Error())
	}
	tmp.Close()

	pageCount := pdfPageCount(ctx, tmpPath)
	text := pdfNativeText(ctx, tmpPath)

	minRunes := playgroundParseMinTextRunes
	if perPage := playgroundParseMinTextRunesPerPage * pageCount; perPage > minRunes {
		minRunes = perPage
	}
	if utf8.RuneCountInString(text) >= minRunes {
		return finishPlaygroundParse(parse, "text-layer", text, pageCount)
	}

	if pageCount <= 0 {
		return failPlaygroundParse(parse, "could not determine the PDF page count")
	}
	ocrModel := SelectPlaygroundOCRModel(abilityGroups)
	if ocrModel == "" {
		return failPlaygroundParse(parse, "no vision-capable model is available to read this scanned document")
	}
	// Page rendering can outlive the HTTP request budget on large scans, so it
	// runs detached; the row stays processing and the client polls.
	go preparePlaygroundPDFOCR(parse, content, pageCount, ocrModel)
	return model.GetPlaygroundDocumentParseByHash(parse.ContentHash)
}

func pdfPageCount(ctx context.Context, pdfPath string) int {
	cctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	out, err := exec.CommandContext(cctx, "pdfinfo", pdfPath).Output()
	if err != nil {
		return 0
	}
	m := regexp.MustCompile(`(?m)^Pages:\s+(\d+)`).FindSubmatch(out)
	if m == nil {
		return 0
	}
	n, _ := strconv.Atoi(string(m[1]))
	return n
}

func pdfNativeText(ctx context.Context, pdfPath string) string {
	cctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	var stdout bytes.Buffer
	cmd := exec.CommandContext(cctx, "pdftotext", "-layout", "-enc", "UTF-8", pdfPath, "-")
	cmd.Stdout = &stdout
	if err := cmd.Run(); err != nil {
		return ""
	}
	return strings.TrimSpace(stdout.String())
}

// preparePlaygroundPDFOCR renders the pages and arms the client OCR contract.
// Runs detached from the request; failures settle the row as failed so the
// polling client stops waiting.
func preparePlaygroundPDFOCR(parse *model.PlaygroundDocumentParse, content []byte, pageCount int, ocrModel string) {
	ctx := context.Background()
	fail := func(message string) {
		_, _ = failPlaygroundParse(parse, message)
	}

	tmp, err := os.CreateTemp("", "pgdoc-ocr-*.pdf")
	if err != nil {
		fail("temp file: " + err.Error())
		return
	}
	pdfPath := tmp.Name()
	defer os.Remove(pdfPath)
	if _, err := tmp.Write(content); err != nil {
		tmp.Close()
		fail("temp file: " + err.Error())
		return
	}
	tmp.Close()

	ocrPages := pageCount
	if ocrPages > PlaygroundParseMaxOCRPages {
		ocrPages = PlaygroundParseMaxOCRPages
	}

	renderDir, err := os.MkdirTemp("", "pgdoc-pages-")
	if err != nil {
		fail("temp dir: " + err.Error())
		return
	}
	defer os.RemoveAll(renderDir)

	cctx, cancel := context.WithTimeout(ctx, 180*time.Second)
	defer cancel()
	cmd := exec.CommandContext(cctx, "pdftoppm", "-jpeg", "-r", strconv.Itoa(playgroundParseOCRRenderDPI),
		"-f", "1", "-l", strconv.Itoa(ocrPages), pdfPath, path.Join(renderDir, "page"))
	if out, err := cmd.CombinedOutput(); err != nil {
		common.SysError("playground parse: pdftoppm failed: " + err.Error() + " " + string(out))
		fail("could not render the PDF pages for OCR")
		return
	}

	rendered, err := os.ReadDir(renderDir)
	if err != nil {
		fail("could not render the PDF pages for OCR")
		return
	}
	names := make([]string, 0, len(rendered))
	for _, entry := range rendered {
		if strings.HasSuffix(entry.Name(), ".jpg") {
			names = append(names, entry.Name())
		}
	}
	sort.Strings(names)
	if len(names) == 0 {
		fail("could not render the PDF pages for OCR")
		return
	}

	store := storage.Default()
	prefix := path.Join("parse", parse.ContentHash)
	for i, name := range names {
		data, readErr := os.ReadFile(path.Join(renderDir, name))
		if readErr != nil {
			fail("could not read a rendered page")
			return
		}
		key := playgroundParsePageKey(prefix, i+1)
		if err := store.Put(ctx, key, bytes.NewReader(data), int64(len(data)), "image/jpeg"); err != nil {
			fail("could not store a rendered page")
			return
		}
	}

	_ = model.UpdatePlaygroundDocumentParseCAS(parse.Id, model.PlaygroundParseStatusProcessing, map[string]any{
		"status":          model.PlaygroundParseStatusNeedsOCR,
		"parser":          "vlm-ocr",
		"page_count":      pageCount,
		"ocr_page_count":  len(names),
		"ocr_model":       ocrModel,
		"execution_token": uuid.NewString(),
		"pages_backend":   store.Backend(),
		"pages_prefix":    prefix,
	})
}

func playgroundParsePageKey(prefix string, page int) string {
	return path.Join(prefix, fmt.Sprintf("page-%03d.jpg", page))
}

// OpenPlaygroundParsePage streams one rendered OCR page.
func OpenPlaygroundParsePage(ctx context.Context, parse *model.PlaygroundDocumentParse, page int) (io.ReadCloser, error) {
	if parse.Status != model.PlaygroundParseStatusNeedsOCR || page < 1 || page > parse.OcrPageCount {
		return nil, fmt.Errorf("page not available")
	}
	store, err := storage.ForBackend(parse.PagesBackend)
	if err != nil {
		return nil, err
	}
	return store.Open(ctx, playgroundParsePageKey(parse.PagesPrefix, page))
}

// CompletePlaygroundDocumentParse imports the client-side OCR transcription
// (or failure) and releases the rendered pages.
func CompletePlaygroundDocumentParse(parse *model.PlaygroundDocumentParse, text, errorMessage string) (*model.PlaygroundDocumentParse, error) {
	updates := map[string]any{"execution_token": ""}
	text = strings.TrimSpace(text)
	if errorMessage != "" || text == "" {
		if errorMessage == "" {
			errorMessage = "OCR produced no text"
		}
		updates["status"] = model.PlaygroundParseStatusFailed
		updates["error_message"] = TruncateUTF8(errorMessage, 2000)
	} else {
		updates["status"] = model.PlaygroundParseStatusDone
		updates["text"] = TruncateUTF8(text, PlaygroundParseMaxTextBytes)
	}
	if err := model.UpdatePlaygroundDocumentParseCAS(parse.Id, model.PlaygroundParseStatusNeedsOCR, updates); err != nil {
		return nil, err
	}
	cleanupPlaygroundParsePages(parse)
	return model.GetPlaygroundDocumentParseByHash(parse.ContentHash)
}

func cleanupPlaygroundParsePages(parse *model.PlaygroundDocumentParse) {
	if parse.PagesBackend == "" || parse.PagesPrefix == "" {
		return
	}
	store, err := storage.ForBackend(parse.PagesBackend)
	if err != nil {
		return
	}
	for page := 1; page <= parse.OcrPageCount; page++ {
		_ = store.Delete(context.Background(), playgroundParsePageKey(parse.PagesPrefix, page))
	}
}

// SelectPlaygroundOCRModel picks a vision-capable chat model from the user's
// enabled models, preferring the cheap tier. Metadata is the only signal; no
// name guessing beyond excluding generation-model families.
func SelectPlaygroundOCRModel(abilityGroups []string) string {
	seen := map[string]struct{}{}
	names := make([]string, 0, 32)
	for _, group := range abilityGroups {
		for _, name := range model.GetGroupEnabledModels(group) {
			if _, ok := seen[name]; !ok {
				seen[name] = struct{}{}
				names = append(names, name)
			}
		}
	}
	if len(names) == 0 {
		return ""
	}
	visionSet := model.GetImageInputModelSet(names)

	type candidate struct {
		name string
		rank int
	}
	var candidates []candidate
	for _, name := range names {
		if !visionSet[name] {
			continue
		}
		lower := strings.ToLower(name)
		if strings.Contains(lower, "image") || strings.Contains(lower, "imagine") ||
			strings.Contains(lower, "video") || strings.Contains(lower, "audio") ||
			strings.Contains(lower, "tts") || strings.Contains(lower, "embed") ||
			strings.Contains(lower, "sora") || strings.Contains(lower, "dall") {
			continue
		}
		rank := 1
		if strings.Contains(lower, "mini") || strings.Contains(lower, "flash") || strings.Contains(lower, "lite") {
			rank = 0
		}
		candidates = append(candidates, candidate{name: name, rank: rank})
	}
	if len(candidates) == 0 {
		return ""
	}
	sort.Slice(candidates, func(i, j int) bool {
		if candidates[i].rank != candidates[j].rank {
			return candidates[i].rank < candidates[j].rank
		}
		return strings.ToLower(candidates[i].name) < strings.ToLower(candidates[j].name)
	})
	return candidates[0].name
}

// TruncateUTF8 cuts s to at most maxBytes without splitting a rune.
func TruncateUTF8(s string, maxBytes int) string {
	if len(s) <= maxBytes {
		return s
	}
	cut := s[:maxBytes]
	for len(cut) > 0 && !utf8.ValidString(cut) {
		cut = cut[:len(cut)-1]
	}
	return cut
}

// --- Office (OOXML) --------------------------------------------------------

// ExtractOfficeText pulls the plain text out of a docx/xlsx/pptx container.
func ExtractOfficeText(mimeType string, content []byte) (string, error) {
	zr, err := zip.NewReader(bytes.NewReader(content), int64(len(content)))
	if err != nil {
		return "", fmt.Errorf("the file is not a valid office document")
	}
	switch mimeType {
	case MimeDocx:
		return extractDocxText(zr)
	case MimePptx:
		return extractPptxText(zr)
	case MimeXlsx:
		return extractXlsxText(zr)
	}
	return "", fmt.Errorf("unsupported office type %s", mimeType)
}

func openZipEntry(zr *zip.Reader, name string) ([]byte, error) {
	for _, f := range zr.File {
		if f.Name == name {
			rc, err := f.Open()
			if err != nil {
				return nil, err
			}
			defer rc.Close()
			return io.ReadAll(io.LimitReader(rc, 32*1024*1024))
		}
	}
	return nil, os.ErrNotExist
}

// collectXMLRunText walks OOXML markup collecting the character data of every
// <textElem> element, inserting newlines when a paragraph-like element closes.
func collectXMLRunText(data []byte, textElem string, paragraphElems map[string]bool, sb *strings.Builder) {
	decoder := xml.NewDecoder(bytes.NewReader(data))
	inText := false
	for {
		token, err := decoder.Token()
		if err != nil {
			return
		}
		switch t := token.(type) {
		case xml.StartElement:
			if t.Name.Local == textElem {
				inText = true
			}
		case xml.EndElement:
			if t.Name.Local == textElem {
				inText = false
			} else if paragraphElems[t.Name.Local] {
				sb.WriteByte('\n')
			}
		case xml.CharData:
			if inText {
				sb.Write(t)
			}
		}
	}
}

func extractDocxText(zr *zip.Reader) (string, error) {
	data, err := openZipEntry(zr, "word/document.xml")
	if err != nil {
		return "", fmt.Errorf("the docx file has no readable document body")
	}
	var sb strings.Builder
	collectXMLRunText(data, "t", map[string]bool{"p": true, "br": true, "tr": true}, &sb)
	return sb.String(), nil
}

func extractPptxText(zr *zip.Reader) (string, error) {
	slideRe := regexp.MustCompile(`^ppt/slides/slide(\d+)\.xml$`)
	type slide struct {
		num  int
		name string
	}
	var slides []slide
	for _, f := range zr.File {
		if m := slideRe.FindStringSubmatch(f.Name); m != nil {
			n, _ := strconv.Atoi(m[1])
			slides = append(slides, slide{num: n, name: f.Name})
		}
	}
	if len(slides) == 0 {
		return "", fmt.Errorf("the pptx file has no readable slides")
	}
	sort.Slice(slides, func(i, j int) bool { return slides[i].num < slides[j].num })
	var sb strings.Builder
	for _, s := range slides {
		data, err := openZipEntry(zr, s.name)
		if err != nil {
			continue
		}
		fmt.Fprintf(&sb, "## Slide %d\n", s.num)
		collectXMLRunText(data, "t", map[string]bool{"p": true}, &sb)
		sb.WriteByte('\n')
	}
	return sb.String(), nil
}

func extractXlsxText(zr *zip.Reader) (string, error) {
	shared := parseXlsxSharedStrings(zr)
	sheetRe := regexp.MustCompile(`^xl/worksheets/sheet(\d+)\.xml$`)
	type sheet struct {
		num  int
		name string
	}
	var sheets []sheet
	for _, f := range zr.File {
		if m := sheetRe.FindStringSubmatch(f.Name); m != nil {
			n, _ := strconv.Atoi(m[1])
			sheets = append(sheets, sheet{num: n, name: f.Name})
		}
	}
	if len(sheets) == 0 {
		return "", fmt.Errorf("the xlsx file has no readable sheets")
	}
	sort.Slice(sheets, func(i, j int) bool { return sheets[i].num < sheets[j].num })
	var sb strings.Builder
	for _, s := range sheets {
		data, err := openZipEntry(zr, s.name)
		if err != nil {
			continue
		}
		fmt.Fprintf(&sb, "## Sheet %d\n", s.num)
		writeXlsxSheetText(data, shared, &sb)
		sb.WriteByte('\n')
	}
	return sb.String(), nil
}

func parseXlsxSharedStrings(zr *zip.Reader) []string {
	data, err := openZipEntry(zr, "xl/sharedStrings.xml")
	if err != nil {
		return nil
	}
	var shared []string
	decoder := xml.NewDecoder(bytes.NewReader(data))
	depth := 0
	inText := false
	var current strings.Builder
	for {
		token, err := decoder.Token()
		if err != nil {
			return shared
		}
		switch t := token.(type) {
		case xml.StartElement:
			switch t.Name.Local {
			case "si":
				depth = 1
				current.Reset()
			case "t":
				inText = true
			}
		case xml.EndElement:
			switch t.Name.Local {
			case "si":
				if depth == 1 {
					shared = append(shared, current.String())
					depth = 0
				}
			case "t":
				inText = false
			}
		case xml.CharData:
			if inText && depth == 1 {
				current.Write(t)
			}
		}
	}
}

func writeXlsxSheetText(data []byte, shared []string, sb *strings.Builder) {
	decoder := xml.NewDecoder(bytes.NewReader(data))
	var cellType string
	inValue := false
	inInline := false
	rowHasCells := false
	var value strings.Builder
	flushCell := func() {
		text := value.String()
		if cellType == "s" {
			if idx, err := strconv.Atoi(strings.TrimSpace(text)); err == nil && idx >= 0 && idx < len(shared) {
				text = shared[idx]
			}
		}
		if rowHasCells {
			sb.WriteByte('\t')
		}
		sb.WriteString(text)
		rowHasCells = true
		value.Reset()
	}
	for {
		token, err := decoder.Token()
		if err != nil {
			return
		}
		switch t := token.(type) {
		case xml.StartElement:
			switch t.Name.Local {
			case "row":
				rowHasCells = false
			case "c":
				cellType = ""
				value.Reset()
				for _, attr := range t.Attr {
					if attr.Name.Local == "t" {
						cellType = attr.Value
					}
				}
			case "v":
				inValue = true
			case "is":
				inInline = true
			case "t":
				if inInline {
					inValue = true
				}
			}
		case xml.EndElement:
			switch t.Name.Local {
			case "row":
				sb.WriteByte('\n')
			case "c":
				flushCell()
			case "v":
				inValue = false
			case "is":
				inInline = false
			case "t":
				if inInline {
					inValue = false
				}
			}
		case xml.CharData:
			if inValue {
				value.Write(t)
			}
		}
	}
}
