package cost_report

import (
	"context"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

type TemplateSaveInput struct {
	Id          int                      `json:"id,omitempty"`
	Key         string                   `json:"key"`
	Name        string                   `json:"name"`
	Description string                   `json:"description"`
	Status      int                      `json:"status"`
	Config      CostReportTemplateConfig `json:"config"`
	ActorID     int                      `json:"-"`
}

type TemplateDetail struct {
	Template       model.CostReportTemplate         `json:"template"`
	CurrentVersion *model.CostReportTemplateVersion `json:"current_version,omitempty"`
	Config         *CostReportTemplateConfig        `json:"config,omitempty"`
}

func (s *Service) EnsureDefaultTemplate(ctx context.Context, actorID int) (*TemplateDetail, error) {
	if s == nil || s.db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	template, err := EnsureDefaultClaudeCostTemplate(s.db.WithContext(ctx), actorID)
	if err != nil {
		return nil, err
	}
	return s.GetTemplate(ctx, template.Id)
}

func (s *Service) ListTemplates(ctx context.Context, offset, limit int) ([]TemplateDetail, int64, error) {
	if s == nil || s.db == nil {
		return nil, 0, fmt.Errorf("db is nil")
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	var total int64
	if err := s.db.WithContext(ctx).Model(&model.CostReportTemplate{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var templates []model.CostReportTemplate
	if err := s.db.WithContext(ctx).Order("id desc").Offset(offset).Limit(limit).Find(&templates).Error; err != nil {
		return nil, 0, err
	}
	details := make([]TemplateDetail, 0, len(templates))
	for i := range templates {
		detail := TemplateDetail{Template: templates[i]}
		if templates[i].CurrentVersionId != nil {
			version, cfg, err := s.loadTemplateVersionConfig(ctx, *templates[i].CurrentVersionId)
			if err != nil {
				return nil, 0, err
			}
			detail.CurrentVersion = version
			detail.Config = cfg
		}
		details = append(details, detail)
	}
	return details, total, nil
}

func (s *Service) GetTemplate(ctx context.Context, id int) (*TemplateDetail, error) {
	if s == nil || s.db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	if id <= 0 {
		return nil, fmt.Errorf("template id is required")
	}
	var template model.CostReportTemplate
	if err := s.db.WithContext(ctx).First(&template, id).Error; err != nil {
		return nil, err
	}
	detail := &TemplateDetail{Template: template}
	if template.CurrentVersionId != nil {
		version, cfg, err := s.loadTemplateVersionConfig(ctx, *template.CurrentVersionId)
		if err != nil {
			return nil, err
		}
		detail.CurrentVersion = version
		detail.Config = cfg
	}
	return detail, nil
}

func (s *Service) ListTemplateVersions(ctx context.Context, templateID int) ([]model.CostReportTemplateVersion, error) {
	if s == nil || s.db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	if templateID <= 0 {
		return nil, fmt.Errorf("template_id is required")
	}
	var versions []model.CostReportTemplateVersion
	if err := s.db.WithContext(ctx).Where("template_id = ?", templateID).Order("version desc").Find(&versions).Error; err != nil {
		return nil, err
	}
	return versions, nil
}

func (s *Service) SaveTemplate(ctx context.Context, input TemplateSaveInput) (*TemplateDetail, error) {
	if s == nil || s.db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	input.Key = strings.TrimSpace(input.Key)
	input.Name = strings.TrimSpace(input.Name)
	if input.Key == "" || input.Name == "" {
		return nil, fmt.Errorf("key and name are required")
	}
	if !identifierRE.MatchString(input.Key) {
		return nil, fmt.Errorf("invalid template key")
	}
	status := input.Status
	if status == 0 {
		status = model.CostReportTemplateStatusEnabled
	}
	if status != model.CostReportTemplateStatusEnabled && status != model.CostReportTemplateStatusArchived {
		return nil, fmt.Errorf("invalid template status")
	}
	configJSON, configHash, err := ConfigJSONAndHash(input.Config)
	if err != nil {
		return nil, err
	}

	var savedID int
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var template model.CostReportTemplate
		if input.Id > 0 {
			if err := tx.First(&template, input.Id).Error; err != nil {
				return err
			}
			var dup model.CostReportTemplate
			err := tx.Where("key = ? AND id <> ?", input.Key, input.Id).First(&dup).Error
			if err == nil {
				return fmt.Errorf("template key already exists")
			}
			if err != gorm.ErrRecordNotFound {
				return err
			}
			template.Key = input.Key
			template.Name = input.Name
			template.Description = input.Description
			template.Status = status
			template.UpdatedBy = input.ActorID
			if err := tx.Save(&template).Error; err != nil {
				return err
			}
		} else {
			template = model.CostReportTemplate{
				Key:         input.Key,
				Name:        input.Name,
				Description: input.Description,
				Status:      status,
				CreatedBy:   input.ActorID,
				UpdatedBy:   input.ActorID,
			}
			if err := tx.Create(&template).Error; err != nil {
				return err
			}
		}

		var maxVersion int
		if err := tx.Model(&model.CostReportTemplateVersion{}).Where("template_id = ?", template.Id).Select("COALESCE(MAX(version), 0)").Scan(&maxVersion).Error; err != nil {
			return err
		}
		version := model.CostReportTemplateVersion{
			TemplateId: template.Id,
			Version:    maxVersion + 1,
			Status:     model.CostReportTemplateVersionStatusActive,
			ConfigJson: configJSON,
			ConfigHash: configHash,
			CreatedBy:  input.ActorID,
		}
		if err := tx.Create(&version).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.CostReportTemplateVersion{}).Where("template_id = ? AND id <> ?", template.Id, version.Id).Update("status", model.CostReportTemplateVersionStatusArchived).Error; err != nil {
			return err
		}
		template.CurrentVersionId = &version.Id
		template.UpdatedBy = input.ActorID
		if err := tx.Save(&template).Error; err != nil {
			return err
		}
		savedID = template.Id
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.GetTemplate(ctx, savedID)
}

func (s *Service) loadTemplateVersionConfig(ctx context.Context, versionID int) (*model.CostReportTemplateVersion, *CostReportTemplateConfig, error) {
	var version model.CostReportTemplateVersion
	if err := s.db.WithContext(ctx).First(&version, versionID).Error; err != nil {
		return nil, nil, err
	}
	var config CostReportTemplateConfig
	if err := common.UnmarshalJsonStr(version.ConfigJson, &config); err != nil {
		return nil, nil, err
	}
	return &version, &config, nil
}
