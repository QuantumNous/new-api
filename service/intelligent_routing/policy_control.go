package intelligent_routing

import (
	"context"
	"errors"
	"strings"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	routingsetting "github.com/QuantumNous/new-api/setting/intelligent_routing_setting"
)

type PolicyRepository interface {
	CreateDraft(policy model.IntelligentRoutingPolicy) (model.IntelligentRoutingPolicy, error)
	UpdateDraft(id int64, updatedAt time.Time, config, checksum string) (model.IntelligentRoutingPolicy, error)
	GetPolicy(id int64) (model.IntelligentRoutingPolicy, error)
	GetPolicyByVersion(version int) (model.IntelligentRoutingPolicy, error)
	Publish(id int64, administratorID int, note string) (model.IntelligentRoutingPolicy, error)
	Rollback(version int, administratorID int, note string) (model.IntelligentRoutingPolicy, error)
	GetRollout() (model.IntelligentRoutingRollout, error)
	UpdateRollout(revision int64, rollout model.IntelligentRoutingRollout) (model.IntelligentRoutingRollout, error)
}

type DatabasePolicyRepository struct{}

func (DatabasePolicyRepository) CreateDraft(policy model.IntelligentRoutingPolicy) (model.IntelligentRoutingPolicy, error) {
	return model.CreateIntelligentRoutingDraft(policy)
}

func (DatabasePolicyRepository) UpdateDraft(id int64, updatedAt time.Time, config, checksum string) (model.IntelligentRoutingPolicy, error) {
	return model.UpdateIntelligentRoutingDraft(id, updatedAt, config, checksum)
}

func (DatabasePolicyRepository) GetPolicy(id int64) (model.IntelligentRoutingPolicy, error) {
	return model.GetIntelligentRoutingPolicy(id)
}

func (DatabasePolicyRepository) GetPolicyByVersion(version int) (model.IntelligentRoutingPolicy, error) {
	return model.GetIntelligentRoutingPolicyByVersion(version)
}

func (DatabasePolicyRepository) Publish(id int64, administratorID int, note string) (model.IntelligentRoutingPolicy, error) {
	return model.PublishIntelligentRoutingPolicy(id, administratorID, note)
}

func (DatabasePolicyRepository) Rollback(version int, administratorID int, note string) (model.IntelligentRoutingPolicy, error) {
	return model.RollbackIntelligentRoutingPolicy(version, administratorID, note)
}

func (DatabasePolicyRepository) GetRollout() (model.IntelligentRoutingRollout, error) {
	return model.GetIntelligentRoutingRollout()
}

func (DatabasePolicyRepository) UpdateRollout(revision int64, rollout model.IntelligentRoutingRollout) (model.IntelligentRoutingRollout, error) {
	return model.UpdateIntelligentRoutingRollout(revision, rollout)
}

type RuntimeRollout struct {
	Exists         bool
	Revision       int64
	PolicyVersion  int
	Enabled        bool
	Mode           string
	TrafficPercent int
	UserGroups     []string
	TokenGroups    []string
}

type RuntimePolicySnapshot struct {
	DeploymentSalt string
	PolicyID       int64
	Checksum       string
	Config         routingsetting.Config
	Rollout        RuntimeRollout
}

type PolicyControl struct {
	repository PolicyRepository
	salt       string
	snapshot   atomic.Pointer[RuntimePolicySnapshot]
}

var DefaultPolicyControl = NewPolicyControl(
	DatabasePolicyRepository{},
	common.GetEnvOrDefaultString("INTELLIGENT_ROUTING_DEPLOYMENT_SALT", "intelligent-routing"),
)

func NewPolicyControl(repository PolicyRepository, deploymentSalt string) *PolicyControl {
	control := &PolicyControl{repository: repository, salt: deploymentSalt}
	control.snapshot.Store(&RuntimePolicySnapshot{DeploymentSalt: deploymentSalt})
	return control
}

func (control *PolicyControl) CreateDraft(_ context.Context, raw string, administratorID int) (model.IntelligentRoutingPolicy, []ValidationIssue, error) {
	validated, issues := ValidatePolicyDocument(raw)
	if len(issues) > 0 {
		return model.IntelligentRoutingPolicy{}, issues, nil
	}
	policy, err := control.repository.CreateDraft(model.IntelligentRoutingPolicy{
		Config: validated.JSON, Checksum: validated.Checksum, CreatedBy: administratorID,
	})
	return policy, nil, err
}

func (control *PolicyControl) UpdateDraft(_ context.Context, id int64, updatedAt time.Time, raw string) (model.IntelligentRoutingPolicy, []ValidationIssue, error) {
	validated, issues := ValidatePolicyDocument(raw)
	if len(issues) > 0 {
		return model.IntelligentRoutingPolicy{}, issues, nil
	}
	policy, err := control.repository.UpdateDraft(id, updatedAt, validated.JSON, validated.Checksum)
	return policy, nil, err
}

func (control *PolicyControl) Publish(ctx context.Context, id int64, administratorID int, changeNote string) (model.IntelligentRoutingPolicy, []ValidationIssue, error) {
	if strings.TrimSpace(changeNote) == "" {
		return model.IntelligentRoutingPolicy{}, []ValidationIssue{{Code: "change_note.required", Field: "change_note", Message: "Change note is required"}}, nil
	}
	policy, err := control.repository.GetPolicy(id)
	if err != nil {
		return model.IntelligentRoutingPolicy{}, nil, err
	}
	validated, issues := ValidatePolicyDocument(policy.Config)
	if len(issues) > 0 {
		return model.IntelligentRoutingPolicy{}, issues, nil
	}
	if validated.Checksum != policy.Checksum {
		return model.IntelligentRoutingPolicy{}, []ValidationIssue{{Code: "policy.checksum_mismatch", Field: "policy", Message: "Policy checksum does not match its content"}}, nil
	}
	published, err := control.repository.Publish(id, administratorID, strings.TrimSpace(changeNote))
	if err != nil {
		return model.IntelligentRoutingPolicy{}, nil, err
	}
	if refreshErr := control.RefreshSnapshot(ctx); refreshErr != nil && !errors.Is(refreshErr, model.ErrIntelligentRoutingRolloutNotFound) {
		return published, nil, refreshErr
	}
	return published, nil, nil
}

func (control *PolicyControl) Rollback(ctx context.Context, version, administratorID int, changeNote string) (model.IntelligentRoutingPolicy, []ValidationIssue, error) {
	if strings.TrimSpace(changeNote) == "" {
		return model.IntelligentRoutingPolicy{}, []ValidationIssue{{Code: "change_note.required", Field: "change_note", Message: "Change note is required"}}, nil
	}
	rolledBack, err := control.repository.Rollback(version, administratorID, strings.TrimSpace(changeNote))
	if err != nil {
		return model.IntelligentRoutingPolicy{}, nil, err
	}
	if refreshErr := control.RefreshSnapshot(ctx); refreshErr != nil && !errors.Is(refreshErr, model.ErrIntelligentRoutingRolloutNotFound) {
		return rolledBack, nil, refreshErr
	}
	return rolledBack, nil, nil
}

func (control *PolicyControl) UpdateRollout(ctx context.Context, revision int64, rollout model.IntelligentRoutingRollout) (model.IntelligentRoutingRollout, []ValidationIssue, error) {
	issues := validateRollout(rollout)
	if len(issues) > 0 {
		return model.IntelligentRoutingRollout{}, issues, nil
	}
	if rollout.PolicyVersion > 0 {
		policy, err := control.repository.GetPolicyByVersion(rollout.PolicyVersion)
		if err != nil {
			return model.IntelligentRoutingRollout{}, nil, err
		}
		if policy.Status != model.IntelligentRoutingPolicyActive && rollout.Enabled {
			return model.IntelligentRoutingRollout{}, []ValidationIssue{{Code: "policy_version.not_active", Field: "policy_version", Message: "Enabled rollout requires the active policy"}}, nil
		}
	}
	updated, err := control.repository.UpdateRollout(revision, rollout)
	if err != nil {
		return model.IntelligentRoutingRollout{}, nil, err
	}
	if err := control.RefreshSnapshot(ctx); err != nil {
		return updated, nil, err
	}
	return updated, nil, nil
}

func validateRollout(rollout model.IntelligentRoutingRollout) []ValidationIssue {
	if rollout.Mode != model.IntelligentRoutingModeShadow && rollout.Mode != model.IntelligentRoutingModeLive {
		return []ValidationIssue{{Code: "mode.invalid", Field: "mode", Message: "Rollout mode must be shadow or live"}}
	}
	if rollout.TrafficPercent < 0 || rollout.TrafficPercent > 100 {
		return []ValidationIssue{{Code: "traffic_percent.out_of_range", Field: "traffic_percent", Message: "Traffic percentage must be between 0 and 100"}}
	}
	if rollout.Enabled && rollout.PolicyVersion < 1 {
		return []ValidationIssue{{Code: "policy_version.required", Field: "policy_version", Message: "Enabled rollout requires a policy version"}}
	}
	return nil
}

func (control *PolicyControl) RefreshSnapshot(_ context.Context) error {
	rollout, err := control.repository.GetRollout()
	if errors.Is(err, model.ErrIntelligentRoutingRolloutNotFound) {
		control.snapshot.Store(&RuntimePolicySnapshot{DeploymentSalt: control.salt})
		return nil
	}
	if err != nil {
		return err
	}
	snapshot := RuntimePolicySnapshot{DeploymentSalt: control.salt, Rollout: RuntimeRollout{
		Exists: true, Revision: rollout.Revision, PolicyVersion: rollout.PolicyVersion, Enabled: rollout.Enabled,
		Mode: rollout.Mode, TrafficPercent: rollout.TrafficPercent,
	}}
	if err := common.UnmarshalJsonStr(rollout.UserGroups, &snapshot.Rollout.UserGroups); err != nil && strings.TrimSpace(rollout.UserGroups) != "" {
		return err
	}
	if err := common.UnmarshalJsonStr(rollout.TokenGroups, &snapshot.Rollout.TokenGroups); err != nil && strings.TrimSpace(rollout.TokenGroups) != "" {
		return err
	}
	if rollout.PolicyVersion > 0 {
		policy, err := control.repository.GetPolicyByVersion(rollout.PolicyVersion)
		if err != nil {
			return err
		}
		validated, issues := ValidatePolicyDocument(policy.Config)
		if len(issues) > 0 || validated.Checksum != policy.Checksum {
			return errors.New("stored intelligent routing policy failed validation")
		}
		snapshot.PolicyID = policy.Id
		snapshot.Checksum = policy.Checksum
		snapshot.Config = validated.Config
	}
	control.snapshot.Store(&snapshot)
	return nil
}

func (control *PolicyControl) Snapshot() RuntimePolicySnapshot {
	current := control.snapshot.Load()
	if current == nil {
		return RuntimePolicySnapshot{DeploymentSalt: control.salt}
	}
	copy := *current
	copy.Rollout.UserGroups = append([]string(nil), current.Rollout.UserGroups...)
	copy.Rollout.TokenGroups = append([]string(nil), current.Rollout.TokenGroups...)
	copy.Config = cloneRoutingConfig(current.Config)
	return copy
}

func cloneRoutingConfig(input routingsetting.Config) routingsetting.Config {
	input.Models = append([]routingsetting.ModelPolicy(nil), input.Models...)
	for index := range input.Models {
		input.Models[index].Capabilities = append([]string(nil), input.Models[index].Capabilities...)
	}
	thresholds := make(map[routingsetting.TaskType]float64, len(input.QualityThresholds))
	for task, value := range input.QualityThresholds {
		thresholds[task] = value
	}
	input.QualityThresholds = thresholds
	return input
}
