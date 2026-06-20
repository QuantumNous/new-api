// Package packaging builds the downloadable versioned Skill zip (DR-79, R2/D-09).
//
// The package is the unit of distribution: a customer downloads it, runs it in
// their own environment, and the "do the work" step MUST call DeepRouter's public
// routing API under the runner's own key. The moat is the runtime dependency, not
// prompt secrecy — so the published instruction_template ships readable inside the
// zip.
//
// What the package contains (and ONLY this):
//   - manifest.json          — skill/version identity, declared tiers, schemas, sha256
//   - SKILL.md               — human-readable description + the published template
//   - instruction_template.txt — the published template (readable; D-09 drops secrecy)
//   - run.py                 — a thin routing client (stdlib only)
//
// What it must NEVER contain (asserted by the build-time guard, FR-A20):
//   - provider credentials
//   - server-side routing/model-selection logic (the tier→model resolution map)
//   - draft/unpublished templates
package packaging

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	"github.com/QuantumNous/new-api/internal/skill/tiers"
)

// RoutingAPIPath is the public routing/execution endpoint the bundled client
// targets. Authenticated with the runner's own DeepRouter key at runtime.
const RoutingAPIPath = "/api/v1/skills/run"

// Manifest is the machine-readable package descriptor (manifest.json).
// It declares TIERS (not concrete models) and pins execution to a server-side
// skill_version_id; package-supplied hints are not trusted by the server.
type Manifest struct {
	SchemaVersion             string          `json:"schema_version"`
	SkillID                   string          `json:"skill_id"`
	SkillVersionID            string          `json:"skill_version_id"`
	Slug                      string          `json:"slug"`
	Name                      string          `json:"name"`
	Category                  string          `json:"category"`
	VersionNumber             int             `json:"version_number"`
	ModelWhitelist            []string        `json:"model_whitelist"`
	InstructionTemplateSHA256 string          `json:"instruction_template_sha256"`
	InputSchema               json.RawMessage `json:"input_schema"`
	OutputSchema              json.RawMessage `json:"output_schema"`
	MaxInputTokens            *int            `json:"max_input_tokens,omitempty"`
	RequiresDeepRouterKey     bool            `json:"requires_deeprouter_key"`
	Routing                   RoutingInfo     `json:"routing"`
}

// RoutingInfo tells the client where to send the work step. It carries NO
// credentials and NO tier→model resolution — the server resolves the tier.
type RoutingInfo struct {
	APIPath    string `json:"api_path"`
	AuthScheme string `json:"auth_scheme"`
	AuthEnvVar string `json:"auth_env_var"`
	Note       string `json:"note"`
}

// Filename returns the canonical download filename for a packaged version.
func Filename(skill skillmodel.Skill, version skillmodel.SkillVersion) string {
	return fmt.Sprintf("%s-v%d.zip", skill.Slug, version.VersionNumber)
}

// BuildPackage assembles the downloadable zip for a published Skill version.
// It runs the build-time guard before returning; a guard failure is a hard error
// (the package is never emitted with credentials or routing logic inside it).
func BuildPackage(skill skillmodel.Skill, version skillmodel.SkillVersion) ([]byte, error) {
	if skill.ActiveVersionID == nil || *skill.ActiveVersionID != version.ID {
		return nil, fmt.Errorf("packaging: version %s is not the active version of skill %s", version.ID, skill.Slug)
	}

	whitelist, err := decodeStringList(version.ModelWhitelistSnapshot)
	if err != nil {
		return nil, fmt.Errorf("packaging: decode model_whitelist_snapshot: %w", err)
	}

	manifest := Manifest{
		SchemaVersion:             "1",
		SkillID:                   skill.ID,
		SkillVersionID:            version.ID,
		Slug:                      skill.Slug,
		Name:                      skill.Name,
		Category:                  skill.Category,
		VersionNumber:             version.VersionNumber,
		ModelWhitelist:            whitelist,
		InstructionTemplateSHA256: version.InstructionTemplateSHA256,
		InputSchema:               rawOrEmptyObject(skill.InputHints),
		OutputSchema:              rawOrEmptyObject(version.OutputSchema),
		MaxInputTokens:            version.MaxInputTokensSnapshot,
		RequiresDeepRouterKey:     true,
		Routing: RoutingInfo{
			APIPath:    RoutingAPIPath,
			AuthScheme: "Bearer",
			AuthEnvVar: runnerKeyEnvVar,
			Note:       "Authenticates with the runner's own DeepRouter key. The server resolves the tier to a concrete model; this package contains no provider credentials and no routing logic.",
		},
	}

	manifestJSON, err := common.Marshal(manifest)
	if err != nil {
		return nil, fmt.Errorf("packaging: marshal manifest: %w", err)
	}

	files := map[string][]byte{
		"manifest.json":            manifestJSON,
		"instruction_template.txt": []byte(version.InstructionTemplate),
		"SKILL.md":                 []byte(renderSkillMarkdown(skill, version, whitelist)),
		"run.py":                   []byte(renderRunClient(skill)),
	}

	if err := guardPackageContents(files); err != nil {
		return nil, err
	}

	return zipFiles(files)
}

// rawOrEmptyObject returns valid JSON for a SkillJSONB column, defaulting to
// an empty object when the column is empty/invalid.
func rawOrEmptyObject(value skillmodel.SkillJSONB) json.RawMessage {
	if len(value) == 0 || !json.Valid(value) {
		return json.RawMessage("{}")
	}
	return json.RawMessage(value)
}

func decodeStringList(value skillmodel.SkillJSONB) ([]string, error) {
	if len(value) == 0 {
		return []string{}, nil
	}
	var out []string
	if err := common.Unmarshal(value, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func zipFiles(files map[string][]byte) ([]byte, error) {
	// Stable filename order so repeated builds of the same version are byte-stable
	// modulo timestamps (helps caching and test determinism).
	names := make([]string, 0, len(files))
	for name := range files {
		names = append(names, name)
	}
	sortStrings(names)

	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for _, name := range names {
		w, err := zw.Create(name)
		if err != nil {
			return nil, fmt.Errorf("packaging: zip create %s: %w", name, err)
		}
		if _, err := w.Write(files[name]); err != nil {
			return nil, fmt.Errorf("packaging: zip write %s: %w", name, err)
		}
	}
	if err := zw.Close(); err != nil {
		return nil, fmt.Errorf("packaging: zip close: %w", err)
	}
	return buf.Bytes(), nil
}

func sortStrings(s []string) {
	for i := 1; i < len(s); i++ {
		for j := i; j > 0 && s[j-1] > s[j]; j-- {
			s[j-1], s[j] = s[j], s[j-1]
		}
	}
}

func renderSkillMarkdown(skill skillmodel.Skill, version skillmodel.SkillVersion, whitelist []string) string {
	var b strings.Builder
	fmt.Fprintf(&b, "# %s\n\n", skill.Name)
	fmt.Fprintf(&b, "%s\n\n", skill.ShortDescription)
	fmt.Fprintf(&b, "- **Skill ID:** `%s`\n", skill.ID)
	fmt.Fprintf(&b, "- **Version:** `%s` (v%d)\n", version.ID, version.VersionNumber)
	fmt.Fprintf(&b, "- **Category:** %s\n", skill.Category)
	fmt.Fprintf(&b, "- **Routing tiers:** %s\n", strings.Join(whitelist, ", "))
	fmt.Fprintf(&b, "- **Template SHA-256:** `%s`\n\n", version.InstructionTemplateSHA256)
	b.WriteString("## How it runs\n\n")
	b.WriteString("This Skill does its work by calling DeepRouter's public routing API. ")
	b.WriteString("Set your own DeepRouter key in the `" + runnerKeyEnvVar + "` environment variable and run `python run.py`. ")
	b.WriteString("DeepRouter selects the best model for the declared tier by your input, runs it, and bills your key. ")
	b.WriteString("Without a key the run fails with `AUTH_REQUIRED`.\n\n")
	b.WriteString("> The model-selection/routing logic stays on the DeepRouter server — it is not in this package. ")
	b.WriteString("Remove the API call and the Skill loses its routing power.\n\n")
	b.WriteString("## Instruction template (published, read-only)\n\n")
	b.WriteString("The server uses its own authoritative copy of this template at execution time; ")
	b.WriteString("the copy below is for transparency only and is not trusted as input.\n\n")
	b.WriteString("```\n")
	b.WriteString(version.InstructionTemplate)
	b.WriteString("\n```\n")
	return b.String()
}

// guardPackageContents enforces FR-A20: the assembled package must not contain
// provider credentials, server-side routing/model-selection logic, or any
// concrete provider model id (whose presence would mean the tier→model
// resolution map leaked out of the server).
func guardPackageContents(files map[string][]byte) error {
	forbidden := []string{
		"sk-ant-", "sk-proj-", "sk-or-", "AKIA",
		"-----BEGIN", "aws_secret_access_key", "private_key",
	}
	// Concrete resolved model ids must never ship — only tier aliases may.
	forbidden = append(forbidden, tiers.ResolvedModels()...)

	for name, content := range files {
		lower := strings.ToLower(string(content))
		for _, marker := range forbidden {
			if strings.Contains(lower, strings.ToLower(marker)) {
				return fmt.Errorf("packaging guard: forbidden content %q found in %s (no credentials or routing logic may ship in a package)", marker, name)
			}
		}
	}
	return nil
}
