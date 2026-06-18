package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/model"

	"gorm.io/gorm"
)

func ListChannelMonitorRequestTemplates(ctx context.Context, params ChannelMonitorRequestTemplateListParams) ([]*model.ChannelMonitorRequestTemplate, error) {
	if provider := strings.TrimSpace(params.Provider); provider != "" {
		if err := validateMonitorProvider(provider); err != nil {
			return nil, ErrChannelMonitorTemplateInvalidProvider
		}
	}
	if apiMode := strings.TrimSpace(params.APIMode); apiMode != "" {
		provider := strings.TrimSpace(params.Provider)
		if provider == "" {
			provider = MonitorProviderOpenAI
		}
		if err := validateMonitorAPIMode(provider, apiMode); err != nil {
			return nil, ErrChannelMonitorTemplateInvalidAPIMode
		}
	}
	items, err := model.ListChannelMonitorRequestTemplates(model.ChannelMonitorRequestTemplateListParams{
		Provider: strings.TrimSpace(params.Provider),
		APIMode:  defaultMonitorAPIMode(params.APIMode),
	})
	if strings.TrimSpace(params.APIMode) == "" {
		items, err = model.ListChannelMonitorRequestTemplates(model.ChannelMonitorRequestTemplateListParams{
			Provider: strings.TrimSpace(params.Provider),
		})
	}
	if err != nil {
		return nil, fmt.Errorf("list channel monitor request templates: %w", err)
	}
	_ = ctx
	return items, nil
}

func GetChannelMonitorRequestTemplate(ctx context.Context, id int64) (*model.ChannelMonitorRequestTemplate, error) {
	template, err := model.GetChannelMonitorRequestTemplateByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrChannelMonitorTemplateNotFound
		}
		return nil, err
	}
	_ = ctx
	return template, nil
}

func CreateChannelMonitorRequestTemplate(ctx context.Context, p ChannelMonitorRequestTemplateCreateParams) (*model.ChannelMonitorRequestTemplate, error) {
	if err := validateChannelMonitorTemplateCreate(p); err != nil {
		return nil, err
	}
	template := &model.ChannelMonitorRequestTemplate{
		Name:             strings.TrimSpace(p.Name),
		Provider:         strings.TrimSpace(p.Provider),
		APIMode:          normalizeMonitorAPIModeForProvider(p.Provider, p.APIMode),
		Description:      strings.TrimSpace(p.Description),
		BodyOverrideMode: defaultBodyMode(p.BodyOverrideMode),
	}
	if err := template.SetExtraHeaders(emptyMonitorHeadersIfNil(p.ExtraHeaders)); err != nil {
		return nil, err
	}
	if err := template.SetBodyOverride(p.BodyOverride); err != nil {
		return nil, err
	}
	if err := model.CreateChannelMonitorRequestTemplate(template); err != nil {
		return nil, fmt.Errorf("create channel monitor request template: %w", err)
	}
	_ = ctx
	return template, nil
}

func UpdateChannelMonitorRequestTemplate(ctx context.Context, id int64, p ChannelMonitorRequestTemplateUpdateParams) (*model.ChannelMonitorRequestTemplate, error) {
	template, err := GetChannelMonitorRequestTemplate(ctx, id)
	if err != nil {
		return nil, err
	}
	if err := applyChannelMonitorTemplateUpdate(template, p); err != nil {
		return nil, err
	}
	if err := model.UpdateChannelMonitorRequestTemplate(template); err != nil {
		return nil, fmt.Errorf("update channel monitor request template: %w", err)
	}
	return template, nil
}

func DeleteChannelMonitorRequestTemplate(ctx context.Context, id int64) error {
	if _, err := GetChannelMonitorRequestTemplate(ctx, id); err != nil {
		return err
	}
	if err := model.DeleteChannelMonitorRequestTemplate(id); err != nil {
		return fmt.Errorf("delete channel monitor request template: %w", err)
	}
	return nil
}

func CountChannelMonitorTemplateAssociatedMonitors(ctx context.Context, id int64) (int64, error) {
	count, err := model.CountChannelMonitorsByTemplateID(id)
	if err != nil {
		return 0, err
	}
	_ = ctx
	return count, nil
}

func ListChannelMonitorTemplateAssociatedMonitors(ctx context.Context, id int64) ([]*AssociatedMonitorBrief, error) {
	if _, err := GetChannelMonitorRequestTemplate(ctx, id); err != nil {
		return nil, err
	}
	items, err := model.ListChannelMonitorsByTemplateID(id)
	if err != nil {
		return nil, fmt.Errorf("list associated channel monitors: %w", err)
	}
	out := make([]*AssociatedMonitorBrief, 0, len(items))
	for _, item := range items {
		out = append(out, &AssociatedMonitorBrief{
			ID:       item.Id,
			Name:     item.Name,
			Provider: item.Provider,
			APIMode:  defaultMonitorAPIMode(item.APIMode),
			Enabled:  item.Enabled,
		})
	}
	_ = ctx
	return out, nil
}

func ApplyChannelMonitorRequestTemplateToMonitors(ctx context.Context, id int64, monitorIDs []int64) (int64, error) {
	template, err := GetChannelMonitorRequestTemplate(ctx, id)
	if err != nil {
		return 0, err
	}
	if len(monitorIDs) == 0 {
		return 0, ErrChannelMonitorTemplateApplyEmpty
	}
	affected, err := model.ApplyChannelMonitorRequestTemplateToMonitors(template, monitorIDs)
	if err != nil {
		return 0, fmt.Errorf("apply channel monitor request template: %w", err)
	}
	_ = ctx
	return affected, nil
}

func validateChannelMonitorTemplateCreate(p ChannelMonitorRequestTemplateCreateParams) error {
	if strings.TrimSpace(p.Name) == "" {
		return ErrChannelMonitorTemplateMissingName
	}
	if err := validateMonitorProvider(strings.TrimSpace(p.Provider)); err != nil {
		return ErrChannelMonitorTemplateInvalidProvider
	}
	if err := validateMonitorAPIMode(strings.TrimSpace(p.Provider), p.APIMode); err != nil {
		return ErrChannelMonitorTemplateInvalidAPIMode
	}
	if err := validateBodyModeForProtocol(p.Provider, p.APIMode, p.BodyOverrideMode, p.BodyOverride); err != nil {
		return err
	}
	if err := validateExtraHeaders(p.ExtraHeaders); err != nil {
		return err
	}
	return nil
}

func applyChannelMonitorTemplateUpdate(template *model.ChannelMonitorRequestTemplate, p ChannelMonitorRequestTemplateUpdateParams) error {
	if p.Name != nil {
		name := strings.TrimSpace(*p.Name)
		if name == "" {
			return ErrChannelMonitorTemplateMissingName
		}
		template.Name = name
	}
	if p.Description != nil {
		template.Description = strings.TrimSpace(*p.Description)
	}
	newAPIMode := defaultMonitorAPIMode(template.APIMode)
	if p.APIMode != nil {
		newAPIMode = defaultMonitorAPIMode(*p.APIMode)
	}
	if err := validateMonitorAPIMode(template.Provider, newAPIMode); err != nil {
		return ErrChannelMonitorTemplateInvalidAPIMode
	}
	if p.ExtraHeaders != nil {
		if err := validateExtraHeaders(*p.ExtraHeaders); err != nil {
			return err
		}
		if err := template.SetExtraHeaders(emptyMonitorHeadersIfNil(*p.ExtraHeaders)); err != nil {
			return err
		}
	}
	newMode := template.BodyOverrideMode
	newBody := template.GetBodyOverride()
	if p.BodyOverrideMode != nil {
		newMode = *p.BodyOverrideMode
	}
	if p.BodyOverride != nil {
		newBody = *p.BodyOverride
	}
	if err := validateBodyModeForProtocol(template.Provider, newAPIMode, newMode, newBody); err != nil {
		return err
	}
	template.APIMode = newAPIMode
	template.BodyOverrideMode = defaultBodyMode(newMode)
	return template.SetBodyOverride(newBody)
}
