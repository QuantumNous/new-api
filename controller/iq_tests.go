package controller

import (
	"errors"
	"net/http"
	"sort"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
)

type iqCatalogGroup struct {
	Group  string   `json:"group"`
	Models []string `json:"models"`
}

// Query concrete enabled abilities directly: the default group's user-facing
// catalog intentionally hides default-only entries, but the admin selector must not.
func iqTargetCatalog() ([]iqCatalogGroup, error) {
	var abilities []model.Ability
	if err := model.DB.Table("abilities").Select("abilities.*").Joins("JOIN channels ON channels.id = abilities.channel_id").Where("abilities.enabled = ? AND channels.status = ?", true, common.ChannelStatusEnabled).Find(&abilities).Error; err != nil {
		return nil, err
	}
	channels := map[int]*model.Channel{}
	type eligibility struct {
		group, name string
		priority    int64
		compatible  bool
	}
	pairs := map[string]eligibility{}
	groups := map[string]map[string]bool{}
	for _, a := range abilities {
		if a.Group == "auto" || !ratio_setting.ContainsGroupRatio(a.Group) {
			continue
		}
		ch, ok := channels[a.ChannelId]
		if !ok {
			var err error
			ch, err = model.GetChannelById(a.ChannelId, true)
			if err != nil {
				return nil, err
			}
			channels[a.ChannelId] = ch
		}
		priority := int64(0)
		if a.Priority != nil {
			priority = *a.Priority
		}
		id := model.IQPairID(a.Group, a.Model)
		existing, seen := pairs[id]
		if seen && priority < existing.priority {
			continue
		}
		compatible := iqEndpoint(ch, a.Model) != ""
		if seen && priority == existing.priority {
			compatible = compatible && existing.compatible
		}
		pairs[id] = eligibility{group: a.Group, name: a.Model, priority: priority, compatible: compatible}
	}
	// retry=0 can choose any channel at the highest enabled priority. Every
	// possible choice must support this request; don't advertise a lower-priority
	// compatible route that IQ would reach only via forbidden failover.
	for _, pair := range pairs {
		if !pair.compatible {
			continue
		}
		if groups[pair.group] == nil {
			groups[pair.group] = map[string]bool{}
		}
		groups[pair.group][pair.name] = true
	}
	out := []iqCatalogGroup{}
	for group, names := range groups {
		models := []string{}
		for name := range names {
			models = append(models, name)
		}
		sort.Strings(models)
		out = append(out, iqCatalogGroup{group, models})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Group < out[j].Group })
	return out, nil
}
func validateIQTargets(c *model.IQConfig) error {
	if err := model.NormalizeIQConfig(c); err != nil {
		return err
	}
	catalog, err := iqTargetCatalog()
	if err != nil {
		return err
	}
	valid := map[string]bool{}
	for _, g := range catalog {
		for _, name := range g.Models {
			valid[model.IQPairID(g.Group, name)] = true
		}
	}
	for _, g := range c.Targets {
		for _, name := range g.Models {
			if !valid[model.IQPairID(g.Group, name)] {
				return errors.New("target is not an enabled compatible text-model/group pair")
			}
		}
	}
	return nil
}
func iqOK(c *gin.Context, data any) {
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": data})
}
func iqError(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"success": false, "message": message, "data": nil})
}
func GetIQConfig(c *gin.Context) {
	cfg, err := model.GetIQConfig()
	if err != nil {
		iqError(c, 500, "Unable to load IQ configuration")
		return
	}
	iqOK(c, cfg)
}
func PutIQConfig(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 128<<10)
	var cfg model.IQConfig
	if err := c.ShouldBindJSON(&cfg); err != nil {
		iqError(c, 400, "Invalid IQ configuration JSON")
		return
	}
	if _, err := model.GetIQConfig(); err != nil {
		iqError(c, 500, "Unable to load IQ configuration")
		return
	}
	if err := validateIQTargets(&cfg); err != nil {
		iqError(c, 400, err.Error())
		return
	}
	saved, err := model.SaveIQConfig(cfg, c.GetInt("id"), time.Now())
	if errors.Is(err, model.ErrIQConflict) {
		iqError(c, 409, err.Error())
		return
	}
	if err != nil {
		iqError(c, 500, "Unable to save IQ configuration")
		return
	}
	iqOK(c, saved)
}
func GetIQTargets(c *gin.Context) {
	targets, err := iqTargetCatalog()
	if err != nil {
		iqError(c, 500, "Unable to load IQ targets")
		return
	}
	iqOK(c, targets)
}
func RunIQTests(c *gin.Context) {
	active, err := model.GetActiveSystemTask(model.SystemTaskTypeIQTest)
	if err != nil {
		iqError(c, 500, "Unable to load IQ progress")
		return
	}
	if active != nil {
		iqOK(c, gin.H{"task_id": active.TaskID, "status": active.Status, "created": false})
		return
	}
	cfg, err := model.GetIQConfig()
	if err != nil {
		iqError(c, 500, "Unable to load IQ configuration")
		return
	}
	if err := validateIQTargets(cfg); err != nil {
		iqError(c, 400, "Configured targets are no longer available; update the configuration")
		return
	}
	task, created, err := model.EnqueueIQBatch(false, time.Now())
	if err != nil {
		iqError(c, 409, "Unable to enqueue IQ run; select targets or reload configuration")
		return
	}
	iqOK(c, gin.H{"task_id": task.TaskID, "status": task.Status, "created": created})
}
func iqVisibleGroups(c *gin.Context) (map[string]bool, error) {
	cfg, err := model.GetIQConfig()
	if err != nil {
		return nil, err
	}
	visible := map[string]bool{}
	admin := c.GetInt("role") >= common.RoleAdminUser
	userGroup := ""
	if !admin {
		userGroup, err = model.GetUserGroup(c.GetInt("id"), false)
		if err != nil {
			return nil, err
		}
	}
	for _, target := range cfg.Targets {
		if admin || service.IsUserSelectableGroup(userGroup, target.Group) {
			visible[target.Group] = true
		}
	}
	return visible, nil
}

type iqModelCard struct {
	Model    string           `json:"model"`
	Latest   *model.IQResult  `json:"latest"`
	Progress *model.IQAttempt `json:"progress"`
}
type iqGroupCards struct {
	Group  string        `json:"group"`
	Models []iqModelCard `json:"models"`
}
type iqActiveRun struct {
	TaskID        string                 `json:"task_id"`
	Status        model.SystemTaskStatus `json:"status"`
	ConfigVersion int64                  `json:"config_version"`
	CreatedAt     int64                  `json:"created_at"`
	Total         int                    `json:"total"`
	Completed     int                    `json:"completed"`
	Running       int                    `json:"running"`
	Pending       int                    `json:"pending"`
}

func GetIQResults(c *gin.Context) {
	cfg, err := model.GetIQConfig()
	if err != nil {
		iqError(c, 500, "Unable to load IQ results")
		return
	}
	visible, err := iqVisibleGroups(c)
	if err != nil {
		iqError(c, 500, "Unable to resolve group access")
		return
	}
	rows, err := model.ListIQLatest()
	if err != nil {
		iqError(c, 500, "Unable to load IQ results")
		return
	}
	latest := map[string]*model.IQResult{}
	for i := range rows {
		latest[rows[i].ID] = &rows[i]
	}
	activeTask, err := model.GetActiveSystemTask(model.SystemTaskTypeIQTest)
	if err != nil {
		iqError(c, 500, "Unable to load IQ progress")
		return
	}
	var active *iqActiveRun
	progress := map[string]*model.IQAttempt{}
	current := map[string]bool{}
	for _, t := range cfg.Targets {
		for _, name := range t.Models {
			current[model.IQPairID(t.Group, name)] = true
		}
	}
	if activeTask != nil {
		attempts, err := model.GetIQAttempts(activeTask.TaskID)
		if err != nil {
			iqError(c, 500, "Unable to load IQ progress")
			return
		}
		snapshot, err := model.GetIQBatch(activeTask.TaskID)
		if err != nil {
			iqError(c, 500, "Unable to load IQ progress")
			return
		}
		active = &iqActiveRun{TaskID: activeTask.TaskID, Status: activeTask.Status, ConfigVersion: snapshot.Version, CreatedAt: activeTask.CreatedAt}
		for i := range attempts {
			a := &attempts[i]
			if !visible[a.Group] || !current[a.PairID] {
				continue
			}
			progress[a.PairID] = a
			active.Total++
			switch a.Status {
			case "pending":
				active.Pending++
			case "running":
				active.Running++
			default:
				active.Completed++
			}
		}
		if active.Total == 0 {
			active = nil
		}
	}
	groups := []iqGroupCards{}
	for _, t := range cfg.Targets {
		if !visible[t.Group] {
			continue
		}
		g := iqGroupCards{Group: t.Group, Models: []iqModelCard{}}
		for _, name := range t.Models {
			id := model.IQPairID(t.Group, name)
			g.Models = append(g.Models, iqModelCard{Model: name, Latest: latest[id], Progress: progress[id]})
		}
		groups = append(groups, g)
	}
	iqOK(c, gin.H{"groups": groups, "active_run": active, "next_run_at": cfg.NextRunAt, "schedule_enabled": cfg.Enabled, "timezone": cfg.Timezone})
}
func GetIQArtifact(c *gin.Context) {
	visible, err := iqVisibleGroups(c)
	if err != nil {
		iqError(c, 500, "Unable to resolve group access")
		return
	}
	// Authorization and current target membership are checked before reading a body.
	rows, err := model.ListIQLatest()
	if err != nil {
		iqError(c, 500, "Unable to load IQ artifact")
		return
	}
	var metadata *model.IQResult
	for i := range rows {
		if rows[i].ID == c.Param("id") {
			metadata = &rows[i]
			break
		}
	}
	if metadata == nil || !visible[metadata.Group] || metadata.Status != "success" {
		iqError(c, 404, "IQ artifact not found")
		return
	}
	r, err := model.GetIQResult(metadata.ID)
	if err != nil || r.Status != "success" {
		iqError(c, 404, "IQ artifact not found")
		return
	}
	// Read authorization again after body retrieval to fail closed on target edits.
	cfg, err := model.GetIQConfig()
	if err != nil {
		iqError(c, 500, "Unable to load IQ artifact")
		return
	}
	selected := false
	for _, t := range cfg.Targets {
		for _, name := range t.Models {
			if model.IQPairID(t.Group, name) == r.ID {
				selected = true
			}
		}
	}
	if !selected {
		iqError(c, 404, "IQ artifact not found")
		return
	}
	iqOK(c, gin.H{"id": r.ID, "group": r.Group, "model": r.Model, "task_id": r.TaskID, "config_version": r.ConfigVersion, "completed_at": r.CompletedAt, "artifact_kind": r.ArtifactKind, "artifact": string(r.Artifact)})
}
