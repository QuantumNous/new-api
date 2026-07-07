// canvas-prompts-sync 画布提示词库离线同步脚本。
//
// 在有外网的开发/CI/运营环境运行,并发抓取 6 个 GitHub 仓库的 raw 文件,
// 解析出提示词条目并输出稳定 JSON seed(默认写入 controller/canvas_prompts_seed.json)。
// 生产请求链路不执行本脚本;解析规则移植自上游 infinite-canvas 的
// src/app/api/prompts/route.ts。
//
// 用法:
//
//	go run ./cmd/canvas-prompts-sync                       # 输出到 controller/canvas_prompts_seed.json
//	go run ./cmd/canvas-prompts-sync -o /path/seed.json    # 指定输出路径
//
// 封面图本地化(可选):脚本只输出 GitHub raw 图片 URL(cover_url);
// 运营侧将图片预同步到腾讯云对象存储/EdgeOne 后,可在 DB 中回填 cover_asset_url。
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"
)

type seedItem struct {
	Source        string   `json:"source"`
	SourceId      string   `json:"source_id"`
	Title         string   `json:"title"`
	Prompt        string   `json:"prompt"`
	Category      string   `json:"category"`
	Tags          []string `json:"tags"`
	GithubUrl     string   `json:"github_url"`
	CoverUrl      string   `json:"cover_url"`
	CoverAssetUrl string   `json:"cover_asset_url"`
	Preview       string   `json:"preview"`
	CreatedAt     string   `json:"created_at"`
	UpdatedAt     string   `json:"updated_at"`
}

const (
	gptImage2RawBase            = "https://raw.githubusercontent.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/main"
	awesomeGptImageRawBase      = "https://raw.githubusercontent.com/ZeroLu/awesome-gpt-image/main"
	awesomeGpt4oImagePromptsRaw = "https://raw.githubusercontent.com/ImgEdify/Awesome-GPT4o-Image-Prompts/main"
	youMindGptImage2RawBase     = "https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main"
	youMindNanoBananaProRawBase = "https://raw.githubusercontent.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts/main"
	davidWuGptImage2RawBase     = "https://raw.githubusercontent.com/davidwuw0811-boop/awesome-gpt-image2-prompts/main"
)

var gptImage2CaseFiles = []string{"README.md", "cases/ad-creative.md", "cases/character.md", "cases/comparison.md", "cases/ecommerce.md", "cases/portrait.md", "cases/poster.md", "cases/ui.md"}

var httpClient = &http.Client{Timeout: 60 * time.Second}

type category struct {
	name      string
	githubUrl string
	build     func() ([]seedItem, error)
}

func main() {
	output := flag.String("o", "controller/canvas_prompts_seed.json", "seed JSON 输出路径")
	flag.Parse()

	categories := []category{
		{"gpt-image-2-prompts", "https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts", buildGptImage2Prompts},
		{"awesome-gpt-image", "https://github.com/ZeroLu/awesome-gpt-image", buildAwesomeGptImagePrompts},
		{"awesome-gpt4o-image-prompts", "https://github.com/ImgEdify/Awesome-GPT4o-Image-Prompts", buildAwesomeGpt4oImagePrompts},
		{"youmind-gpt-image-2", "https://github.com/YouMind-OpenLab/awesome-gpt-image-2", func() ([]seedItem, error) {
			return buildYouMindPrompts(youMindGptImage2RawBase, "youmind-gpt-image-2", "gpt-image-2")
		}},
		{"youmind-nano-banana-pro", "https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts", func() ([]seedItem, error) {
			return buildYouMindPrompts(youMindNanoBananaProRawBase, "youmind-nano-banana-pro", "nano-banana-pro")
		}},
		{"davidwu-gpt-image2-prompts", "https://github.com/davidwuw0811-boop/awesome-gpt-image2-prompts", buildDavidWuGptImage2Prompts},
	}

	var wg sync.WaitGroup
	results := make([][]seedItem, len(categories))
	for i, cat := range categories {
		wg.Add(1)
		go func(i int, cat category) {
			defer wg.Done()
			items, err := cat.build()
			if err != nil {
				fmt.Fprintf(os.Stderr, "[warn] %s 抓取失败: %v\n", cat.name, err)
				return
			}
			for j := range items {
				items[j].Category = cat.name
				items[j].GithubUrl = cat.githubUrl
			}
			results[i] = items
			fmt.Printf("[ok] %s: %d 条\n", cat.name, len(items))
		}(i, cat)
	}
	wg.Wait()

	var all []seedItem
	for _, items := range results {
		all = append(all, items...)
	}
	if len(all) == 0 {
		fmt.Fprintln(os.Stderr, "没有抓到任何提示词,保留原有 seed 不覆盖")
		os.Exit(1)
	}
	data, err := json.MarshalIndent(all, "", "  ")
	if err != nil {
		fmt.Fprintln(os.Stderr, "序列化失败:", err)
		os.Exit(1)
	}
	if err := os.WriteFile(*output, append(data, '\n'), 0o644); err != nil {
		fmt.Fprintln(os.Stderr, "写入失败:", err)
		os.Exit(1)
	}
	fmt.Printf("共 %d 条提示词写入 %s\n", len(all), *output)
}

func fetchText(baseUrl, file string) (string, error) {
	resp, err := httpClient.Get(baseUrl + "/" + file)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("%s 拉取失败: %d", file, resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

func fetchJson(baseUrl, file string, v any) error {
	text, err := fetchText(baseUrl, file)
	if err != nil {
		return err
	}
	return json.Unmarshal([]byte(text), v)
}

var gptImage2CaseRe = regexp.MustCompile(`(?s)### Case \d+: \[[^\]]+]\(([^)]+)\).*?\*\*Prompt:\*\*\s*\r?\n\s*` + "```" + `[\w-]*\r?\n(.*?)\r?\n` + "```")

func buildGptImage2Prompts() ([]seedItem, error) {
	var payload struct {
		Records []struct {
			Title    string `json:"title"`
			TweetUrl string `json:"tweet_url"`
			ImageDir string `json:"image_dir"`
			Category string `json:"category"`
			AddedAt  string `json:"added_at"`
		} `json:"records"`
	}
	if err := fetchJson(gptImage2RawBase, "data/ingested_tweets.json", &payload); err != nil {
		return nil, err
	}
	cases := map[string]string{}
	for _, file := range gptImage2CaseFiles {
		markdown, err := fetchText(gptImage2RawBase, file)
		if err != nil {
			continue
		}
		for _, match := range gptImage2CaseRe.FindAllStringSubmatch(markdown, -1) {
			cases[match[1]] = strings.TrimSpace(match[2])
		}
	}
	var items []seedItem
	for _, record := range payload.Records {
		prompt := cases[record.TweetUrl]
		if record.Title == "" || prompt == "" || record.ImageDir == "" {
			continue
		}
		image := fmt.Sprintf("%s/%s/output.jpg", gptImage2RawBase, record.ImageDir)
		items = append(items, seedItem{
			Source:    "gpt-image-2-prompts",
			SourceId:  leftPad(len(items) + 1),
			Title:     record.Title,
			Prompt:    prompt,
			Tags:      tagsFromCategory(record.Category),
			CoverUrl:  image,
			Preview:   markdownPreview([]string{image}),
			CreatedAt: record.AddedAt,
			UpdatedAt: record.AddedAt,
		})
	}
	return items, nil
}

var (
	h2Re            = regexp.MustCompile(`(?m)^##\s+(.+)$`)
	h3Re            = regexp.MustCompile(`(?m)^###\s+(.+)$`)
	mdLinkRe        = regexp.MustCompile(`\[([^\]]+)]\([^)]+\)`)
	zhPromptRe      = regexp.MustCompile(`(?s)\*\*提示词:\*\*\s*\r?\n\s*` + "```" + `[\w-]*\r?\n(.*?)\r?\n` + "```")
	gpt4oPromptRe   = regexp.MustCompile("(?s)- \\*\\*提示词文本：\\*\\*\\s*`(.*?)`")
	youMindTitleRe  = regexp.MustCompile(`(?m)^###\s+No\.\s*\d+:\s*(.+)$`)
	youMindPromptRe = regexp.MustCompile(`(?s)#### .*?提示词\s*\r?\n\s*` + "```" + `[\w-]*\r?\n(.*?)\r?\n` + "```")
	mdImageRe       = regexp.MustCompile(`!\[[^\]]*]\(([^)]+)\)`)
	headingCleanRe  = regexp.MustCompile(`[^\p{L}\p{N}/&、与 ]`)
	youMindPrefixRe = regexp.MustCompile(`^(.+?) - `)
)

func buildAwesomeGptImagePrompts() ([]seedItem, error) {
	markdown, err := fetchText(awesomeGptImageRawBase, "README.zh-CN.md")
	if err != nil {
		return nil, err
	}
	var items []seedItem
	for _, section := range splitBeforeHeading(markdown, "## ") {
		tags := tagsFromHeading(firstMatch(h2Re, section))
		for _, block := range splitBeforeHeading(section, "### ") {
			title := strings.TrimSpace(mdLinkRe.ReplaceAllString(firstMatch(h3Re, block), "$1"))
			prompt := strings.TrimSpace(firstMatch(zhPromptRe, block))
			if title == "" || prompt == "" {
				continue
			}
			images := extractMarkdownImages(awesomeGptImageRawBase, block)
			items = append(items, seedItem{
				Source:   "awesome-gpt-image",
				SourceId: leftPad(len(items) + 1),
				Title:    title,
				Prompt:   prompt,
				Tags:     tags,
				CoverUrl: firstString(images),
				Preview:  markdownPreview(images),
			})
		}
	}
	return items, nil
}

func buildAwesomeGpt4oImagePrompts() ([]seedItem, error) {
	markdown, err := fetchText(awesomeGpt4oImagePromptsRaw, "README.zh-CN.md")
	if err != nil {
		return nil, err
	}
	var items []seedItem
	for _, block := range splitBeforeHeading(markdown, "### ") {
		title := strings.TrimSpace(firstMatch(h3Re, block))
		prompt := strings.TrimSpace(firstMatch(gpt4oPromptRe, block))
		if title == "" || prompt == "" {
			continue
		}
		images := extractMarkdownImages(awesomeGpt4oImagePromptsRaw, block)
		items = append(items, seedItem{
			Source:   "awesome-gpt4o-image-prompts",
			SourceId: leftPad(len(items) + 1),
			Title:    title,
			Prompt:   prompt,
			Tags:     []string{"gpt4o"},
			CoverUrl: firstString(images),
			Preview:  markdownPreview(images),
		})
	}
	return items, nil
}

func buildYouMindPrompts(baseUrl, idPrefix, modelTag string) ([]seedItem, error) {
	markdown, err := fetchText(baseUrl, "README_zh.md")
	if err != nil {
		return nil, err
	}
	var items []seedItem
	for _, block := range splitBeforeHeading(markdown, "### ") {
		title := strings.TrimSpace(firstMatch(youMindTitleRe, block))
		prompt := strings.TrimSpace(firstMatch(youMindPromptRe, block))
		if title == "" || prompt == "" {
			continue
		}
		images := extractMarkdownImages(baseUrl, block)
		items = append(items, seedItem{
			Source:   idPrefix,
			SourceId: leftPad(len(items) + 1),
			Title:    title,
			Prompt:   prompt,
			Tags:     youMindTags(title, modelTag),
			CoverUrl: firstString(images),
			Preview:  markdownPreview(images),
		})
	}
	return items, nil
}

func buildDavidWuGptImage2Prompts() ([]seedItem, error) {
	var payload []struct {
		Id         int    `json:"id"`
		TitleEn    string `json:"title_en"`
		TitleCn    string `json:"title_cn"`
		Category   string `json:"category"`
		CategoryCn string `json:"category_cn"`
		Prompt     string `json:"prompt"`
		Note       string `json:"note"`
		Author     string `json:"author"`
		Source     string `json:"source"`
		NeedsRef   bool   `json:"needs_ref"`
		Image      string `json:"image"`
	}
	if err := fetchJson(davidWuGptImage2RawBase, "prompts.json", &payload); err != nil {
		return nil, err
	}
	var items []seedItem
	for index, record := range payload {
		title := strings.TrimSpace(record.TitleCn)
		if title == "" {
			title = strings.TrimSpace(record.TitleEn)
		}
		prompt := strings.TrimSpace(record.Prompt)
		if title == "" || prompt == "" {
			continue
		}
		image := absoluteImage(davidWuGptImage2RawBase, record.Image)
		var previewParts []string
		for _, part := range []string{record.TitleEn, record.Note} {
			if part != "" {
				previewParts = append(previewParts, part)
			}
		}
		if image != "" {
			previewParts = append(previewParts, fmt.Sprintf("![](%s)", image))
		}
		id := record.Id
		if id == 0 {
			id = index + 1
		}
		tags := splitTags(strings.Join(compactStrings([]string{record.CategoryCn, record.Category, record.Author, record.Source}), "/"), regexp.MustCompile(`/`))
		if record.NeedsRef {
			tags = append(tags, "需要参考图")
		}
		items = append(items, seedItem{
			Source:   "davidwu-gpt-image2-prompts",
			SourceId: leftPad(id),
			Title:    title,
			Prompt:   prompt,
			Tags:     tags,
			CoverUrl: image,
			Preview:  strings.Join(previewParts, "\n\n"),
		})
	}
	return items, nil
}

func splitBeforeHeading(markdown, prefix string) []string {
	var blocks []string
	var current []string
	for _, line := range strings.Split(markdown, "\n") {
		if strings.HasPrefix(line, prefix) && len(current) > 0 {
			blocks = append(blocks, strings.Join(current, "\n"))
			current = nil
		}
		current = append(current, line)
	}
	blocks = append(blocks, strings.Join(current, "\n"))
	return blocks
}

func firstMatch(re *regexp.Regexp, value string) string {
	match := re.FindStringSubmatch(value)
	if len(match) > 1 {
		return match[1]
	}
	return ""
}

func extractMarkdownImages(baseUrl, markdown string) []string {
	var images []string
	for _, match := range mdImageRe.FindAllStringSubmatch(markdown, -1) {
		if image := absoluteImage(baseUrl, match[1]); image != "" {
			images = append(images, image)
		}
	}
	return images
}

func absoluteImage(baseUrl, image string) string {
	if image == "" {
		return ""
	}
	lower := strings.ToLower(image)
	if strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://") {
		return image
	}
	return baseUrl + "/" + strings.TrimPrefix(strings.TrimPrefix(image, "./"), "/")
}

var categoryTagSplitRe = regexp.MustCompile(`\s*(?:&|and)\s*`)
var headingTagSplitRe = regexp.MustCompile(`\s*(?:/|&|、|与)\s*`)
var casesSuffixRe = regexp.MustCompile(`(?i)\s+Cases$`)

func tagsFromCategory(category string) []string {
	return splitTags(casesSuffixRe.ReplaceAllString(category, ""), categoryTagSplitRe)
}

func tagsFromHeading(heading string) []string {
	return splitTags(headingCleanRe.ReplaceAllString(heading, ""), headingTagSplitRe)
}

func youMindTags(title, modelTag string) []string {
	prefix := firstMatch(youMindPrefixRe, title)
	return append([]string{modelTag}, tagsFromHeading(prefix)...)
}

func splitTags(value string, re *regexp.Regexp) []string {
	var tags []string
	for _, tag := range re.Split(value, -1) {
		tag = strings.ToLower(strings.TrimSpace(tag))
		if tag != "" {
			tags = append(tags, tag)
		}
	}
	if tags == nil {
		tags = []string{}
	}
	return tags
}

func markdownPreview(images []string) string {
	var parts []string
	for _, image := range images {
		if image != "" {
			parts = append(parts, fmt.Sprintf("![](%s)", image))
		}
	}
	return strings.Join(parts, "\n\n")
}

func compactStrings(values []string) []string {
	var result []string
	for _, value := range values {
		if value != "" {
			result = append(result, value)
		}
	}
	return result
}

func firstString(values []string) string {
	if len(values) > 0 {
		return values[0]
	}
	return ""
}

func leftPad(value int) string {
	return fmt.Sprintf("%04d", value)
}
