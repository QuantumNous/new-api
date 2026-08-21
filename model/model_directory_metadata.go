package model

import (
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var modelDirectoryMetadataChanged = struct {
	sync.RWMutex
	hook func()
}{}

// SetModelDirectoryMetadataChangedHook lets the serving layer invalidate any
// in-process read caches after a metadata import commits. The model package
// owns the write path, so the hook avoids a model -> controller dependency.
func SetModelDirectoryMetadataChangedHook(hook func()) {
	modelDirectoryMetadataChanged.Lock()
	modelDirectoryMetadataChanged.hook = hook
	modelDirectoryMetadataChanged.Unlock()
}

func notifyModelDirectoryMetadataChanged() {
	modelDirectoryMetadataChanged.RLock()
	hook := modelDirectoryMetadataChanged.hook
	modelDirectoryMetadataChanged.RUnlock()
	if hook != nil {
		hook()
	}
}

var allowedModelDirectoryModalities = map[string]struct{}{
	"text":  {},
	"image": {},
	"file":  {},
	"video": {},
	"audio": {},
}

type ModelDirectoryMetadata struct {
	ID             int64  `json:"id" gorm:"primaryKey"`
	ModelName      string `json:"model_name" gorm:"size:191;not null;uniqueIndex"`
	Author         string `json:"author" gorm:"size:128;not null"`
	ProvidersJSON  string `json:"providers_json" gorm:"column:providers_json;type:text;not null"`
	ModalitiesJSON string `json:"modalities_json" gorm:"column:modalities_json;type:text;not null"`
	CategoriesJSON string `json:"categories_json" gorm:"column:categories_json;type:text;not null"`
	ContextTokens  *int64 `json:"context_tokens"`
	Series         string `json:"series" gorm:"size:128;not null"`
	ReleasedAt     string `json:"released_at" gorm:"type:varchar(10);not null"`
	Distillable    bool   `json:"distillable" gorm:"not null"`
	PopularityRank *int   `json:"popularity_rank"`
	TopTenRank     *int   `json:"top_ten_rank"`
	Status         int    `json:"status" gorm:"not null;index"`
	CreatedTime    int64  `json:"created_time" gorm:"bigint"`
	UpdatedTime    int64  `json:"updated_time" gorm:"bigint"`
}

type ModelDirectoryMetadataView struct {
	Author         string   `json:"author"`
	Providers      []string `json:"providers"`
	Modalities     []string `json:"modalities"`
	ContextTokens  *int64   `json:"context_tokens"`
	Series         string   `json:"series"`
	Categories     []string `json:"categories"`
	ReleasedAt     string   `json:"released_at"`
	Distillable    bool     `json:"distillable"`
	PopularityRank *int     `json:"popularity_rank,omitempty"`
	TopTenRank     *int     `json:"top_ten_rank,omitempty"`
}

type ModelDirectoryMetadataImportResult struct {
	Inserts   []string `json:"inserts"`
	Updates   []string `json:"updates"`
	Unchanged []string `json:"unchanged"`
}

func (m *ModelDirectoryMetadata) BeforeCreate(tx *gorm.DB) error {
	if err := m.NormalizeAndValidate(); err != nil {
		return err
	}
	now := common.GetTimestamp()
	if m.CreatedTime == 0 {
		m.CreatedTime = now
	}
	m.UpdatedTime = now
	return nil
}

func (m *ModelDirectoryMetadata) BeforeUpdate(tx *gorm.DB) error {
	if err := m.NormalizeAndValidate(); err != nil {
		return err
	}
	m.UpdatedTime = common.GetTimestamp()
	return nil
}

func (m *ModelDirectoryMetadata) NormalizeAndValidate() error {
	if m == nil {
		return fmt.Errorf("model directory metadata is nil")
	}
	m.ModelName = strings.TrimSpace(m.ModelName)
	m.Author = strings.TrimSpace(m.Author)
	m.Series = strings.TrimSpace(m.Series)
	m.ReleasedAt = strings.TrimSpace(m.ReleasedAt)

	if m.ModelName == "" {
		return fmt.Errorf("model name is required")
	}
	if m.Author == "" {
		return fmt.Errorf("author is required")
	}
	if m.Series == "" {
		return fmt.Errorf("series is required")
	}
	if err := validateModelDirectoryDate(m.ReleasedAt); err != nil {
		return err
	}
	if m.ContextTokens != nil && *m.ContextTokens <= 0 {
		return fmt.Errorf("context tokens must be positive")
	}
	if m.PopularityRank != nil && *m.PopularityRank <= 0 {
		return fmt.Errorf("popularity rank must be positive")
	}
	if m.TopTenRank != nil && (*m.TopTenRank < 1 || *m.TopTenRank > 10) {
		return fmt.Errorf("top ten rank must be between 1 and 10")
	}
	if m.Status != 0 && m.Status != 1 {
		return fmt.Errorf("status must be 0 or 1")
	}

	var err error
	if m.ProvidersJSON, err = normalizeModelDirectoryArrayJSON(m.ProvidersJSON, "providers", nil); err != nil {
		return err
	}
	if m.ModalitiesJSON, err = normalizeModelDirectoryArrayJSON(m.ModalitiesJSON, "modalities", allowedModelDirectoryModalities); err != nil {
		return err
	}
	if m.CategoriesJSON, err = normalizeModelDirectoryArrayJSON(m.CategoriesJSON, "categories", nil); err != nil {
		return err
	}
	return nil
}

func (m ModelDirectoryMetadata) ToView() (ModelDirectoryMetadataView, error) {
	if err := m.NormalizeAndValidate(); err != nil {
		return ModelDirectoryMetadataView{}, err
	}
	providers, err := parseModelDirectoryStringArray(m.ProvidersJSON, "providers")
	if err != nil {
		return ModelDirectoryMetadataView{}, err
	}
	modalities, err := parseModelDirectoryStringArray(m.ModalitiesJSON, "modalities")
	if err != nil {
		return ModelDirectoryMetadataView{}, err
	}
	categories, err := parseModelDirectoryStringArray(m.CategoriesJSON, "categories")
	if err != nil {
		return ModelDirectoryMetadataView{}, err
	}
	return ModelDirectoryMetadataView{
		Author:         m.Author,
		Providers:      providers,
		Modalities:     modalities,
		ContextTokens:  m.ContextTokens,
		Series:         m.Series,
		Categories:     categories,
		ReleasedAt:     m.ReleasedAt,
		Distillable:    m.Distillable,
		PopularityRank: m.PopularityRank,
		TopTenRank:     m.TopTenRank,
	}, nil
}

func GetEnabledModelDirectoryMetadataMap(modelNames []string) (map[string]ModelDirectoryMetadataView, error) {
	result := make(map[string]ModelDirectoryMetadataView)
	modelNames = normalizeLookupValues(modelNames)
	if len(modelNames) == 0 {
		return result, nil
	}
	if DB == nil {
		return nil, fmt.Errorf("database is not initialized")
	}

	var rows []ModelDirectoryMetadata
	if err := DB.Where("model_name IN ? AND status = ?", modelNames, 1).Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		view, err := row.ToView()
		if err != nil {
			return nil, err
		}
		result[row.ModelName] = view
	}
	return result, nil
}

func PlanModelDirectoryMetadataImport(db *gorm.DB, rows []ModelDirectoryMetadata) (ModelDirectoryMetadataImportResult, error) {
	normalized, err := normalizeModelDirectoryMetadataImportRows(rows)
	if err != nil {
		return ModelDirectoryMetadataImportResult{}, err
	}
	if db == nil {
		return ModelDirectoryMetadataImportResult{}, fmt.Errorf("database is not initialized")
	}
	return planNormalizedModelDirectoryMetadataImport(db, normalized)
}

func ApplyModelDirectoryMetadataImport(db *gorm.DB, rows []ModelDirectoryMetadata) (ModelDirectoryMetadataImportResult, error) {
	normalized, err := normalizeModelDirectoryMetadataImportRows(rows)
	if err != nil {
		return ModelDirectoryMetadataImportResult{}, err
	}
	if db == nil {
		return ModelDirectoryMetadataImportResult{}, fmt.Errorf("database is not initialized")
	}

	var result ModelDirectoryMetadataImportResult
	err = db.Transaction(func(tx *gorm.DB) error {
		var err error
		result, err = planNormalizedModelDirectoryMetadataImport(tx, normalized)
		if err != nil {
			return err
		}
		changed := make(map[string]struct{}, len(result.Inserts)+len(result.Updates))
		for _, modelName := range result.Inserts {
			changed[modelName] = struct{}{}
		}
		for _, modelName := range result.Updates {
			changed[modelName] = struct{}{}
		}
		for index := range normalized {
			if _, ok := changed[normalized[index].ModelName]; !ok {
				continue
			}
			row := normalized[index]
			row.ID = 0
			if err := tx.Clauses(clause.OnConflict{
				Columns: []clause.Column{{Name: "model_name"}},
				DoUpdates: clause.AssignmentColumns([]string{
					"author", "providers_json", "modalities_json", "context_tokens", "series",
					"categories_json", "released_at", "distillable", "popularity_rank",
					"top_ten_rank", "status", "updated_time",
				}),
			}).Create(&row).Error; err != nil {
				return fmt.Errorf("upsert model directory metadata %q: %w", row.ModelName, err)
			}
		}
		return nil
	})
	if err != nil {
		return ModelDirectoryMetadataImportResult{}, err
	}
	if len(result.Inserts)+len(result.Updates) > 0 {
		notifyModelDirectoryMetadataChanged()
	}
	return result, nil
}

func normalizeModelDirectoryMetadataImportRows(rows []ModelDirectoryMetadata) ([]ModelDirectoryMetadata, error) {
	normalized := make([]ModelDirectoryMetadata, len(rows))
	seen := make(map[string]struct{}, len(rows))
	for index := range rows {
		normalized[index] = rows[index]
		if err := normalized[index].NormalizeAndValidate(); err != nil {
			return nil, fmt.Errorf("row %d (%q): %w", index+1, rows[index].ModelName, err)
		}
		modelName := normalized[index].ModelName
		if _, ok := seen[modelName]; ok {
			return nil, fmt.Errorf("duplicate model name %q", modelName)
		}
		seen[modelName] = struct{}{}
	}
	return normalized, nil
}

func planNormalizedModelDirectoryMetadataImport(db *gorm.DB, rows []ModelDirectoryMetadata) (ModelDirectoryMetadataImportResult, error) {
	result := ModelDirectoryMetadataImportResult{
		Inserts:   []string{},
		Updates:   []string{},
		Unchanged: []string{},
	}
	if len(rows) == 0 {
		return result, nil
	}
	modelNames := make([]string, 0, len(rows))
	for _, row := range rows {
		modelNames = append(modelNames, row.ModelName)
	}
	var existingRows []ModelDirectoryMetadata
	if err := db.Where("model_name IN ?", modelNames).Find(&existingRows).Error; err != nil {
		return ModelDirectoryMetadataImportResult{}, err
	}
	existingByName := make(map[string]ModelDirectoryMetadata, len(existingRows))
	for _, row := range existingRows {
		existingByName[row.ModelName] = row
	}
	for _, row := range rows {
		existing, ok := existingByName[row.ModelName]
		switch {
		case !ok:
			result.Inserts = append(result.Inserts, row.ModelName)
		case modelDirectoryMetadataImportEqual(existing, row):
			result.Unchanged = append(result.Unchanged, row.ModelName)
		default:
			result.Updates = append(result.Updates, row.ModelName)
		}
	}
	sort.Strings(result.Inserts)
	sort.Strings(result.Updates)
	sort.Strings(result.Unchanged)
	return result, nil
}

func modelDirectoryMetadataImportEqual(left ModelDirectoryMetadata, right ModelDirectoryMetadata) bool {
	return left.ModelName == right.ModelName &&
		left.Author == right.Author &&
		left.ProvidersJSON == right.ProvidersJSON &&
		left.ModalitiesJSON == right.ModalitiesJSON &&
		equalOptionalInt64(left.ContextTokens, right.ContextTokens) &&
		left.Series == right.Series &&
		left.CategoriesJSON == right.CategoriesJSON &&
		left.ReleasedAt == right.ReleasedAt &&
		left.Distillable == right.Distillable &&
		equalOptionalInt(left.PopularityRank, right.PopularityRank) &&
		equalOptionalInt(left.TopTenRank, right.TopTenRank) &&
		left.Status == right.Status
}

func equalOptionalInt64(left *int64, right *int64) bool {
	return left == nil && right == nil || left != nil && right != nil && *left == *right
}

func equalOptionalInt(left *int, right *int) bool {
	return left == nil && right == nil || left != nil && right != nil && *left == *right
}

func normalizeModelDirectoryArrayJSON(raw string, field string, allowed map[string]struct{}) (string, error) {
	values, err := parseModelDirectoryStringArray(raw, field)
	if err != nil {
		return "", err
	}
	values = normalizeModelDirectoryStringArray(values)
	if len(values) == 0 {
		return "", fmt.Errorf("%s must not be empty", field)
	}
	if allowed != nil {
		for _, value := range values {
			if _, ok := allowed[value]; !ok {
				return "", fmt.Errorf("%s contains unsupported value %q", field, value)
			}
		}
	}
	normalized, err := common.Marshal(values)
	if err != nil {
		return "", err
	}
	return string(normalized), nil
}

func parseModelDirectoryStringArray(raw string, field string) ([]string, error) {
	var values []string
	if err := common.Unmarshal([]byte(raw), &values); err != nil {
		return nil, fmt.Errorf("%s must be a JSON string array: %w", field, err)
	}
	return values, nil
}

func normalizeModelDirectoryStringArray(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	normalized := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		normalized = append(normalized, value)
	}
	return normalized
}

func validateModelDirectoryDate(value string) error {
	if len(value) != len("2006-01-02") {
		return fmt.Errorf("released_at must use YYYY-MM-DD")
	}
	parsed, err := time.Parse("2006-01-02", value)
	if err != nil || parsed.Format("2006-01-02") != value {
		return fmt.Errorf("released_at must be a valid YYYY-MM-DD date")
	}
	return nil
}
