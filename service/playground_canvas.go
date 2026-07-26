package service

import (
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

// The MySQL TEXT limit is 65,535 bytes. Leave room for charset/driver and
// future serialization changes instead of accepting documents at the edge.
const PlaygroundCanvasSnapshotMaxBytes = 60 * 1024
const playgroundCanvasPromptMaxRunes = 20_000

var ErrPlaygroundCanvasSnapshotTooLarge = errors.New("canvas snapshot is too large")
var ErrPlaygroundCanvasInvalidSnapshot = errors.New("canvas snapshot must contain schema_version, nodes, edges, and viewport")
var ErrPlaygroundCanvasUnsupportedSnapshot = errors.New("unsupported canvas snapshot version")

type PlaygroundCanvasConflict struct {
	CurrentRevision int
}

func (e *PlaygroundCanvasConflict) Error() string { return "canvas project revision conflict" }

type PlaygroundCanvasProjectDTO struct {
	Id                    int    `json:"id"`
	Title                 string `json:"title"`
	Snapshot              any    `json:"snapshot"`
	Revision              int    `json:"revision"`
	InspirationTemplateId int    `json:"inspiration_template_id"`
	InspirationVersionId  int    `json:"inspiration_version_id"`
	CreatedAt             int64  `json:"created_at"`
	UpdatedAt             int64  `json:"updated_at"`
}

func CreatePlaygroundCanvasProject(userId, templateId int, title, prompt string, values map[string]any) (*PlaygroundCanvasProjectDTO, error) {
	var template model.InspirationTemplate
	err := model.DB.Table("inspiration_templates t").
		Select("t.*").
		Joins("JOIN inspiration_categories c ON c.id = t.category_id").
		Where("t.id = ? AND t.status = ? AND t.published_version_id IS NOT NULL AND c.status <> ?", templateId, "published", "archived").
		Scan(&template).Error
	if err != nil {
		return nil, err
	}
	if template.Id == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	var version model.InspirationTemplateVersion
	err = model.DB.Where("id = ? AND template_id = ? AND state = ?", *template.PublishedVersionId, template.Id, "released").First(&version).Error
	if err != nil {
		return nil, err
	}

	if strings.TrimSpace(title) == "" {
		title = template.Title
	}
	if len([]rune(title)) > 255 {
		return nil, errors.New("canvas project title is too long")
	}
	prompt = strings.TrimSpace(prompt)
	if prompt == "" {
		prompt = version.PromptTemplate
	}
	if len([]rune(prompt)) > playgroundCanvasPromptMaxRunes {
		return nil, errors.New("canvas project prompt is too long")
	}
	parameters := map[string]any{}
	if version.ParametersJSON != "" {
		if err = common.UnmarshalJsonStr(version.ParametersJSON, &parameters); err != nil {
			return nil, err
		}
	}
	variables := []model.InspirationVariable{}
	if version.VariablesJSON != "" {
		if err = common.UnmarshalJsonStr(version.VariablesJSON, &variables); err != nil {
			return nil, err
		}
	}
	resolvedValues, err := resolvePlaygroundCanvasValues(variables, values)
	if err != nil {
		return nil, err
	}
	modelPolicy := model.InspirationModelPolicy{Recommended: []string{}, Compatible: []string{}}
	if version.ModelPolicyJSON != "" {
		if err = common.UnmarshalJsonStr(version.ModelPolicyJSON, &modelPolicy); err != nil {
			return nil, err
		}
	}
	nodes := []any{map[string]any{
		"id": "prompt-1", "type": "textPrompt", "position": map[string]any{"x": 0, "y": 0},
		"data": map[string]any{"text": prompt, "negative_prompt": version.NegativePrompt, "label": template.Title, "editable": true, "variables": variables, "parameters": parameters},
	}}
	edges := []any{}
	if template.Modality == "image" || template.Modality == "video" {
		nodes = append(nodes, map[string]any{
			"id": "output-1", "type": template.Modality, "position": map[string]any{"x": 420, "y": 0},
			"data": map[string]any{"label": template.Title, "content": ""},
		})
		edges = append(edges, map[string]any{"id": "prompt-output-1", "from": "prompt-1", "to": "output-1"})
	}
	snapshot := map[string]any{
		"schema_version": 1,
		"nodes":          nodes,
		"edges":          edges,
		"viewport":       map[string]any{"x": 0, "y": 0, "zoom": 1},
		"provenance":     map[string]any{"inspiration_template_id": template.Id, "inspiration_version_id": version.Id},
		"source": map[string]any{
			"variables": variables, "values": resolvedValues, "parameters": parameters,
			"model_policy": modelPolicy, "negative_prompt": version.NegativePrompt,
		},
	}
	snapshotJSON, err := common.Marshal(snapshot)
	if err != nil {
		return nil, err
	}
	if len(snapshotJSON) > PlaygroundCanvasSnapshotMaxBytes {
		return nil, ErrPlaygroundCanvasSnapshotTooLarge
	}
	project := &model.PlaygroundCanvasProject{UserId: userId, Title: title, Snapshot: string(snapshotJSON), InspirationTemplateId: template.Id, InspirationVersionId: version.Id}
	if err = model.CreatePlaygroundCanvasProject(project); err != nil {
		return nil, err
	}
	return canvasProjectDTO(project)
}

func ListPlaygroundCanvasProjects(userId int) ([]PlaygroundCanvasProjectDTO, error) {
	projects, err := model.ListPlaygroundCanvasProjects(userId)
	if err != nil {
		return nil, err
	}
	out := make([]PlaygroundCanvasProjectDTO, 0, len(projects))
	for i := range projects {
		dto, decodeErr := canvasProjectDTO(&projects[i])
		if decodeErr != nil {
			return nil, decodeErr
		}
		out = append(out, *dto)
	}
	return out, nil
}

func GetPlaygroundCanvasProject(userId, id int) (*PlaygroundCanvasProjectDTO, error) {
	project, err := model.GetPlaygroundCanvasProject(id, userId)
	if err != nil {
		return nil, err
	}
	return canvasProjectDTO(project)
}

func UpdatePlaygroundCanvasProject(userId, id, revision, snapshotVersion int, title string, snapshot any) (*PlaygroundCanvasProjectDTO, error) {
	document, ok := snapshot.(map[string]any)
	if !ok || document["schema_version"] == nil || document["nodes"] == nil || document["edges"] == nil || document["viewport"] == nil {
		return nil, ErrPlaygroundCanvasInvalidSnapshot
	}
	if snapshotVersion != 1 || !canvasSnapshotVersionIsOne(document["schema_version"]) {
		return nil, ErrPlaygroundCanvasUnsupportedSnapshot
	}
	encoded, err := common.Marshal(snapshot)
	if err != nil {
		return nil, err
	}
	if len(encoded) > PlaygroundCanvasSnapshotMaxBytes {
		return nil, ErrPlaygroundCanvasSnapshotTooLarge
	}
	if revision < 1 || strings.TrimSpace(title) == "" || len([]rune(title)) > 255 {
		return nil, errors.New("title and a positive revision are required")
	}
	current, err := model.GetPlaygroundCanvasProject(id, userId)
	if err != nil {
		return nil, err
	}
	nextRevision, updatedAt, err := model.UpdatePlaygroundCanvasProjectCAS(id, userId, revision, title, string(encoded))
	if errors.Is(err, gorm.ErrRecordNotFound) {
		latest, getErr := model.GetPlaygroundCanvasProject(id, userId)
		if getErr != nil {
			return nil, getErr
		}
		return nil, &PlaygroundCanvasConflict{CurrentRevision: latest.Revision}
	}
	if err != nil {
		return nil, err
	}
	current.Title = title
	current.Snapshot = string(encoded)
	current.Revision = nextRevision
	current.UpdatedAt = updatedAt
	return canvasProjectDTO(current)
}

func canvasSnapshotVersionIsOne(value any) bool {
	switch version := value.(type) {
	case float64:
		return version == 1
	case int:
		return version == 1
	default:
		return false
	}
}

func resolvePlaygroundCanvasValues(variables []model.InspirationVariable, input map[string]any) (map[string]any, error) {
	known := make(map[string]model.InspirationVariable, len(variables))
	for _, variable := range variables {
		known[variable.Key] = variable
	}
	for key := range input {
		if _, ok := known[key]; !ok {
			return nil, fmt.Errorf("unknown canvas template variable %q", key)
		}
	}
	resolved := make(map[string]any, len(variables))
	for _, variable := range variables {
		value, ok := input[variable.Key]
		if !ok {
			value = variable.DefaultValue
		}
		text := strings.TrimSpace(fmt.Sprint(value))
		if variable.Required && text == "" {
			return nil, fmt.Errorf("canvas template variable %q is required", variable.Key)
		}
		if variable.MaxLength != nil && len([]rune(text)) > *variable.MaxLength {
			return nil, fmt.Errorf("canvas template variable %q is too long", variable.Key)
		}
		if variable.Type == "number" && text != "" {
			number, parseErr := strconv.ParseFloat(text, 64)
			if parseErr != nil || math.IsNaN(number) || math.IsInf(number, 0) {
				return nil, fmt.Errorf("canvas template variable %q must be a number", variable.Key)
			}
			if variable.Min != nil && number < *variable.Min {
				return nil, fmt.Errorf("canvas template variable %q is below its minimum", variable.Key)
			}
			if variable.Max != nil && number > *variable.Max {
				return nil, fmt.Errorf("canvas template variable %q exceeds its maximum", variable.Key)
			}
			resolved[variable.Key] = number
			continue
		}
		resolved[variable.Key] = value
	}
	return resolved, nil
}

func canvasProjectDTO(project *model.PlaygroundCanvasProject) (*PlaygroundCanvasProjectDTO, error) {
	var snapshot any
	if err := common.UnmarshalJsonStr(project.Snapshot, &snapshot); err != nil {
		return nil, err
	}
	return &PlaygroundCanvasProjectDTO{Id: project.Id, Title: project.Title, Snapshot: snapshot, Revision: project.Revision, InspirationTemplateId: project.InspirationTemplateId, InspirationVersionId: project.InspirationVersionId, CreatedAt: project.CreatedAt, UpdatedAt: project.UpdatedAt}, nil
}
