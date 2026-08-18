// Command sync-models-dev refreshes the embedded model Lab catalog.
//
// It always fetches the canonical models.json. Provider aliases are optional:
// pass -provider-root with a checkout of anomalyco/models.dev to parse
// providers/**/models/**/*.toml files containing base_model.
package main

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/BurntSushi/toml"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/modellab"
)

type catalogModel struct {
	Name string `json:"name"`
}

type providerModel struct {
	BaseModel string `toml:"base_model"`
}

func main() {
	output := flag.String("output", "pkg/modellab/catalog.json", "catalog output path")
	modelsURL := flag.String("models-url", "https://models.dev/models.json", "models.dev canonical model URL")
	providerRoot := flag.String("provider-root", "", "local models.dev checkout root")
	providerArchiveURL := flag.String("provider-archive-url", "https://github.com/sst/models.dev/archive/refs/heads/dev.tar.gz", "models.dev GitHub Provider TOML archive URL")
	flag.Parse()

	body, err := fetch(*modelsURL)
	if err != nil {
		fail(err)
	}
	models := map[string]catalogModel{}
	if err := common.Unmarshal(body, &models); err != nil {
		fail(fmt.Errorf("parse models.dev models.json: %w", err))
	}

	catalog := struct {
		Version string            `json:"version"`
		Labs    []modellab.Lab    `json:"labs"`
		Models  map[string]string `json:"models"`
		Aliases map[string]string `json:"aliases,omitempty"`
	}{
		Version: time.Now().UTC().Format("2006-01-02"),
		Labs:    syncLabs(models),
		Models:  make(map[string]string, len(models)),
		Aliases: map[string]string{},
	}
	for modelID := range models {
		slug := strings.SplitN(strings.ToLower(strings.TrimSpace(modelID)), "/", 2)[0]
		if slug != "" {
			catalog.Models[strings.ToLower(modelID)] = slug
		}
	}
	if *providerRoot != "" {
		if err := collectProviderAliases(*providerRoot, catalog.Aliases); err != nil {
			fail(err)
		}
	} else {
		archive, err := fetch(*providerArchiveURL)
		if err != nil {
			fail(fmt.Errorf("fetch models.dev Provider TOML archive: %w", err))
		}
		if err := collectProviderAliasesFromArchive(archive, catalog.Aliases); err != nil {
			fail(err)
		}
	}

	data, err := common.Marshal(catalog)
	if err != nil {
		fail(fmt.Errorf("encode catalog: %w", err))
	}
	if err := os.MkdirAll(filepath.Dir(*output), 0o755); err != nil {
		fail(err)
	}
	tmp := *output + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		fail(err)
	}
	if err := os.Rename(tmp, *output); err != nil {
		fail(err)
	}
}

func fetch(endpoint string) ([]byte, error) {
	client := &http.Client{Timeout: 30 * time.Second}
	response, err := client.Get(endpoint)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("models.dev returned HTTP %d", response.StatusCode)
	}
	return io.ReadAll(response.Body)
}

func collectProviderAliases(root string, aliases map[string]string) error {
	providerModelsRoot := filepath.Join(root, "providers")
	return filepath.WalkDir(providerModelsRoot, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() || !strings.HasSuffix(strings.ToLower(entry.Name()), ".toml") {
			return nil
		}
		relative, err := filepath.Rel(filepath.Join(root, "providers"), path)
		if err != nil {
			return err
		}
		relative = strings.TrimSuffix(filepath.ToSlash(relative), ".toml")
		relative, err = url.PathUnescape(relative)
		if err != nil {
			return err
		}
		contents, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		return addProviderAlias(relative, contents, aliases)
	})
}

func collectProviderAliasesFromArchive(data []byte, aliases map[string]string) error {
	reader, err := gzip.NewReader(bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("open models.dev Provider archive: %w", err)
	}
	defer reader.Close()
	tarReader := tar.NewReader(reader)
	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return fmt.Errorf("read models.dev Provider archive: %w", err)
		}
		if header.Typeflag != tar.TypeReg || !strings.HasSuffix(strings.ToLower(header.Name), ".toml") {
			continue
		}
		relative := ""
		if strings.HasPrefix(header.Name, "providers/") {
			relative = strings.TrimPrefix(header.Name, "providers/")
		} else if index := strings.Index(header.Name, "/providers/"); index >= 0 {
			relative = header.Name[index+len("/providers/"):]
		} else {
			continue
		}
		contents, err := io.ReadAll(tarReader)
		if err != nil {
			return err
		}
		if err := addProviderAlias(relative, contents, aliases); err != nil {
			return err
		}
	}
}

func addProviderAlias(relative string, contents []byte, aliases map[string]string) error {
	var model providerModel
	if _, err := toml.Decode(string(contents), &model); err != nil {
		return fmt.Errorf("parse provider model %s: %w", relative, err)
	}
	if strings.TrimSpace(model.BaseModel) == "" {
		return nil
	}
	relative = strings.TrimSuffix(filepath.ToSlash(relative), ".toml")
	relative, err := url.PathUnescape(relative)
	if err != nil {
		return err
	}
	segments := strings.Split(relative, "/")
	for index, segment := range segments {
		if segment != "models" || index == 0 || index == len(segments)-1 {
			continue
		}
		// models.dev stores provider IDs as providers/<provider>/models/<id>.
		// The catalog key omits this storage-only directory.
		segments = append(segments[:index], segments[index+1:]...)
		break
	}
	alias := strings.ToLower(strings.Join(segments, "/"))
	baseModel := strings.ToLower(strings.TrimSpace(model.BaseModel))
	if alias != "" && baseModel != "" {
		aliases[alias] = baseModel
	}
	return nil
}

func syncLabs(models map[string]catalogModel) []modellab.Lab {
	displayNames := map[string]string{
		"aisingapore": "Aisingapore", "alibaba": "Alibaba", "anthropic": "Anthropic",
		"arcee-ai": "Arcee Ai", "bytedance-seed": "Bytedance Seed", "cohere": "Cohere",
		"deepreinforce": "Deepreinforce", "deepseek": "DeepSeek", "google": "Google",
		"ibm": "Ibm", "meituan": "Meituan", "meta": "Meta", "microsoft": "Microsoft",
		"minimax": "MiniMax", "mistral": "Mistral", "moonshotai": "Moonshot AI",
		"nvidia": "Nvidia", "openai": "OpenAI", "perplexity": "Perplexity",
		"poolside": "Poolside", "sakana": "Sakana AI", "sarvam": "Sarvam AI",
		"sdaia": "Sdaia", "stepfun": "StepFun", "swiss-ai": "Swiss Ai",
		"tencent": "Tencent", "thinkingmachines": "Thinking Machines", "trendyol": "Trendyol",
		"upstage": "Upstage", "xai": "xAI", "xiaomi": "Xiaomi", "zhipuai": "Zhipu AI",
	}
	slugs := make(map[string]struct{})
	for modelID := range models {
		if slug := strings.SplitN(strings.ToLower(strings.TrimSpace(modelID)), "/", 2)[0]; slug != "" {
			slugs[slug] = struct{}{}
		}
	}
	labs := make([]modellab.Lab, 0, len(slugs))
	for slug := range slugs {
		name := displayNames[slug]
		if name == "" {
			name = humanizeSlug(slug)
		}
		labs = append(labs, modellab.Lab{Slug: slug, Name: name})
	}
	sort.Slice(labs, func(i, j int) bool { return labs[i].Slug < labs[j].Slug })
	return labs
}

func humanizeSlug(slug string) string {
	parts := strings.FieldsFunc(slug, func(r rune) bool { return r == '-' || r == '_' })
	for index, part := range parts {
		if part == "" {
			continue
		}
		parts[index] = strings.ToUpper(part[:1]) + part[1:]
	}
	return strings.Join(parts, " ")
}

func fail(err error) {
	_, _ = fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
