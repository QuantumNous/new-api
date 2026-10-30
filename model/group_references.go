package model

import (
	"cmp"
	"context"
	"crypto/sha256"
	"fmt"
	"reflect"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"gorm.io/gorm"
)

// GroupReference identifies one complete name occurrence. Paths preserve array
// positions and both nested map keys; descriptions and substrings are not names.
// This inventory is internal management data, never a public response DTO.
type GroupReference struct {
	Category string
	Record   string
	Path     []string
	Group    string
}

type GroupReferenceInventory struct {
	References     []GroupReference
	DefinedGroups  []string
	InvalidRecords int
	channelGroups  map[string]string
	configuration  map[string]string
}

type GroupReferenceCount struct {
	Records    int `json:"records"`
	References int `json:"references"`
}

type GroupMigrationPreview struct {
	Source            string                         `json:"source"`
	Target            string                         `json:"target"`
	Version           string                         `json:"version"`
	Counts            map[string]GroupReferenceCount `json:"counts"`
	UnfinishedTasks   int                            `json:"unfinished_tasks"`
	Blockers          []string                       `json:"blockers"`
	Warnings          []string                       `json:"warnings"`
	ExecutionBlockers []string                       `json:"execution_blockers"`
	Confirmation      string                         `json:"confirmation"`
	ExpiresAt         int64                          `json:"expires_at"`
}

func (inventory *GroupReferenceInventory) add(category, record, group string, path ...string) {
	if group != "" {
		inventory.References = append(inventory.References, GroupReference{category, record, path, group})
	}
}

// ReadGroupReferenceInventory reads projected, credential-free columns only.
// Disabled resources and restorable soft deletes remain effective references.
// No transaction, row locks, cache publication or business writes are performed.
func ReadGroupReferenceInventory(ctx context.Context) (*GroupReferenceInventory, error) {
	return readGroupReferenceInventory(DB.WithContext(ctx))
}

func readGroupReferenceInventory(db *gorm.DB) (*GroupReferenceInventory, error) {
	inventory := &GroupReferenceInventory{channelGroups: map[string]string{}, configuration: map[string]string{}}
	var users []User
	if err := db.Unscoped().Select("id", "group").Find(&users).Error; err != nil {
		return nil, err
	}
	userGroups := make(map[int]string, len(users))
	for _, user := range users {
		userGroups[user.Id] = user.Group
		inventory.add("users", strconv.Itoa(user.Id), user.Group, "group")
	}
	var tokens []Token
	if err := db.Unscoped().Select("id", "group", "auto_groups").Find(&tokens).Error; err != nil {
		return nil, err
	}
	for _, token := range tokens {
		id := strconv.Itoa(token.Id)
		inventory.add("tokens", id, token.Group, "group")
		if strings.TrimSpace(token.AutoGroups) == "" {
			continue
		}
		var groups []string
		if err := common.UnmarshalJsonStr(token.AutoGroups, &groups); err != nil {
			inventory.InvalidRecords++
			continue
		}
		for i, group := range groups {
			inventory.add("tokens", id, group, "auto_groups", strconv.Itoa(i))
		}
	}
	var channels []Channel
	if err := db.Select("id", "group").Find(&channels).Error; err != nil {
		return nil, err
	}
	for _, channel := range channels {
		id := strconv.Itoa(channel.Id)
		inventory.channelGroups[id] = channel.Group
		for i, group := range strings.Split(channel.Group, ",") {
			inventory.add("channels", id, strings.TrimSpace(group), "group", strconv.Itoa(i))
		}
	}
	var abilities []Ability
	if err := db.Select("group", "model", "channel_id").Find(&abilities).Error; err != nil {
		return nil, err
	}
	for _, ability := range abilities {
		key, err := common.Marshal([]any{ability.ChannelId, ability.Model, ability.Group})
		if err != nil {
			return nil, err
		}
		inventory.add("abilities", string(key), ability.Group, "group")
	}
	var plans []SubscriptionPlan
	if err := db.Select("id", "upgrade_group", "downgrade_group").Find(&plans).Error; err != nil {
		return nil, err
	}
	for _, plan := range plans {
		id := strconv.Itoa(plan.Id)
		inventory.add("subscription_plans", id, plan.UpgradeGroup, "upgrade_group")
		inventory.add("subscription_plans", id, plan.DowngradeGroup, "downgrade_group")
	}
	// Admin invalidation/deletion can downgrade even expired/cancelled records.
	// They are not historical snapshots while those lifecycle paths remain valid.
	var subscriptions []UserSubscription
	if err := db.Select("id", "upgrade_group", "prev_user_group", "downgrade_group").Find(&subscriptions).Error; err != nil {
		return nil, err
	}
	for _, sub := range subscriptions {
		id := strconv.Itoa(sub.Id)
		inventory.add("subscriptions", id, sub.UpgradeGroup, "upgrade_group")
		inventory.add("subscriptions", id, sub.PrevUserGroup, "prev_user_group")
		inventory.add("subscriptions", id, sub.DowngradeGroup, "downgrade_group")
	}
	var tasks []Task
	if err := db.Select("id", "user_id", "group").Where("status NOT IN ?", []TaskStatus{TaskStatusSuccess, TaskStatusFailure}).Find(&tasks).Error; err != nil {
		return nil, err
	}
	for _, task := range tasks {
		id := strconv.FormatInt(task.ID, 10)
		inventory.add("unfinished_tasks", id, task.Group, "group")
		inventory.add("unfinished_tasks", id, userGroups[task.UserId], "user_group")
	}
	var mjTasks []Midjourney
	if err := db.Select("id", "user_id").Where("progress != ?", "100%").Find(&mjTasks).Error; err != nil {
		return nil, err
	}
	for _, task := range mjTasks {
		inventory.add("unfinished_tasks", "mj:"+strconv.Itoa(task.Id), userGroups[task.UserId], "user_group")
	}

	settings := ratio_setting.GetGroupRatioSetting()
	effective := map[string]string{
		"GroupRatio":                 ratio_setting.GroupRatio2JSONString(),
		"GroupGroupRatio":            ratio_setting.GroupGroupRatio2JSONString(),
		"GroupSpecialUsableGroup":    settings.GroupSpecialUsableGroup.MarshalJSONString(),
		"UserUsableGroups":           setting.UserUsableGroups2JSONString(),
		"AutoGroups":                 setting.AutoGroups2JsonString(),
		"TopupGroupRatio":            common.TopupGroupRatio2JSONString(),
		"ModelRequestRateLimitGroup": setting.ModelRequestRateLimitGroup2JSONString(),
	}
	keys := make([]string, 0, len(effective)+3)
	for key, value := range effective {
		keys = append(keys, key)
		inventory.readConfiguration("configuration", key, key, value)
	}
	for key := range groupOptionAliases {
		keys = append(keys, key)
	}
	var options []Option
	if err := db.Where(map[string]any{"key": keys}).Find(&options).Error; err != nil {
		return nil, err
	}
	for _, option := range options {
		kind := option.Key
		if canonical, ok := groupOptionAliases[kind]; ok {
			kind = canonical
		}
		// Persisted aliases can be reloaded later: inventory them independently,
		// rather than assuming the running node's effective map is the only source.
		inventory.readConfiguration("saved_configuration", option.Key, kind, option.Value)
	}
	for group := range ratio_setting.GetGroupRatioCopy() {
		inventory.DefinedGroups = append(inventory.DefinedGroups, group)
	}
	slices.Sort(inventory.DefinedGroups)
	return inventory, nil
}

func (inventory *GroupReferenceInventory) readConfiguration(category, key, kind, value string) {
	inventory.configuration[category+":"+key] = value
	if kind == "AutoGroups" {
		var groups []string
		if common.UnmarshalJsonStr(value, &groups) != nil {
			inventory.InvalidRecords++
			return
		}
		for i, group := range groups {
			if group == "" {
				inventory.InvalidRecords++
				continue
			}
			inventory.add(category, key, group, strconv.Itoa(i))
		}
		return
	}
	var object map[string]any
	if common.UnmarshalJsonStr(value, &object) != nil || object == nil {
		inventory.InvalidRecords++
		return
	}
	for outer, raw := range object {
		if outer == "" {
			inventory.InvalidRecords++
			continue
		}
		inventory.add(category, key, outer, outer, "key")
		switch kind {
		case "GroupGroupRatio", "GroupSpecialUsableGroup":
			nested, ok := raw.(map[string]any)
			if !ok {
				inventory.InvalidRecords++
				continue
			}
			for inner := range nested {
				group := inner
				if kind == "GroupSpecialUsableGroup" {
					if stripped, ok := strings.CutPrefix(group, "+:"); ok {
						group = stripped
					} else {
						group = strings.TrimPrefix(group, "-:")
					}
				}
				if group == "" {
					inventory.InvalidRecords++
					continue
				}
				inventory.add(category, key, group, outer, inner, "key")
			}
		}
	}
}

// PreviewGroupMigration reports an observation, not execution authorization.
// Future execution must re-read this inventory behind its write barrier.
func PreviewGroupMigration(ctx context.Context, source, target string) (*GroupMigrationPreview, error) {
	return previewGroupMigration(DB.WithContext(ctx), source, target)
}

func previewGroupMigration(db *gorm.DB, source, target string) (*GroupMigrationPreview, error) {
	inventory, err := readGroupReferenceInventory(db)
	if err != nil {
		return nil, err
	}
	preview := &GroupMigrationPreview{Source: source, Target: target, Counts: map[string]GroupReferenceCount{}, Blockers: []string{}, Warnings: []string{
		"External scripts must use the new group name after migration.",
		"Migration will briefly pause related requests. This preview does not pause service.",
	}}
	for _, category := range []string{"users", "tokens", "channels", "abilities", "subscription_plans", "subscriptions", "configuration", "saved_configuration"} {
		preview.Counts[category] = GroupReferenceCount{}
	}
	for _, name := range []string{source, target} {
		if name == "default" || name == "auto" {
			preview.Blockers = append(preview.Blockers, "Built-in groups cannot participate in migration.")
			break
		}
	}
	if !validMigrationGroupName(source) || !validMigrationGroupName(target) {
		preview.Blockers = append(preview.Blockers, "Group names must contain 1 to 50 characters without commas, whitespace, control characters or rule prefixes.")
	}
	if source == target {
		preview.Blockers = append(preview.Blockers, "Source and target groups must differ.")
	}
	if !slices.Contains(inventory.DefinedGroups, source) {
		preview.Blockers = append(preview.Blockers, "Source group does not exist.")
	}
	if inventory.InvalidRecords > 0 {
		preview.Blockers = append(preview.Blockers, "Invalid group reference data must be repaired before migration.")
	}
	occupied := slices.Contains(inventory.DefinedGroups, target)
	records := map[string]map[string]bool{}
	for _, ref := range inventory.References {
		if ref.Group == target {
			occupied = true
		}
		if ref.Group != source {
			continue
		}
		if records[ref.Category] == nil {
			records[ref.Category] = map[string]bool{}
		}
		records[ref.Category][ref.Record] = true
		count := preview.Counts[ref.Category]
		count.References++
		preview.Counts[ref.Category] = count
	}
	for category, ids := range records {
		if category == "unfinished_tasks" {
			preview.UnfinishedTasks = len(ids)
			delete(preview.Counts, category)
			continue
		}
		count := preview.Counts[category]
		count.Records = len(ids)
		preview.Counts[category] = count
	}
	if occupied {
		preview.Blockers = append(preview.Blockers, "Target group is already referenced or configured.")
	}
	if preview.UnfinishedTasks > 0 {
		preview.Blockers = append(preview.Blockers, "Related unfinished tasks must finish before migration.")
	}
	for _, groups := range inventory.channelGroups {
		elements := strings.Split(groups, ",")
		affected := false
		for i, group := range elements {
			if strings.TrimSpace(group) == source {
				elements[i] = target
				affected = true
			}
		}
		if affected && utf8.RuneCountInString(strings.Join(elements, ",")) > 64 {
			preview.Blockers = append(preview.Blockers, "The migrated channel group list would exceed 64 characters.")
			break
		}
	}
	// Canonical ordering gives stable versions despite map/query iteration order.
	slices.SortFunc(inventory.References, func(a, b GroupReference) int {
		return cmp.Or(strings.Compare(a.Category, b.Category), strings.Compare(a.Record, b.Record), slices.Compare(a.Path, b.Path), strings.Compare(a.Group, b.Group))
	})
	versionData, err := common.Marshal([]any{source, target, inventory.References, inventory.configuration, inventory.channelGroups, inventory.InvalidRecords, inventory.DefinedGroups})
	if err != nil {
		return nil, err
	}
	preview.Version = fmt.Sprintf("%x", sha256.Sum256(versionData))
	preview.ExecutionBlockers = []string{}
	for _, key := range []string{"GroupRatio", "group_ratio_setting.group_ratio", "UserUsableGroups", "TopupGroupRatio"} {
		saved, exists := inventory.configuration["saved_configuration:"+key]
		if !exists {
			continue
		}
		kind := canonicalGroupOption(key)
		var persisted, effective map[string]any
		if common.UnmarshalJsonStr(saved, &persisted) != nil || common.UnmarshalJsonStr(inventory.configuration["configuration:"+kind], &effective) != nil || !reflect.DeepEqual(persisted, effective) {
			preview.ExecutionBlockers = append(preview.ExecutionBlockers, "Saved and effective group configuration differ. Reload and repair configuration before migration.")
			break
		}
	}
	if err := groupMigrationQualification(db); err != nil {
		preview.ExecutionBlockers = append(preview.ExecutionBlockers, err.Error())
	}
	for _, ref := range inventory.References {
		if ref.Group != source {
			continue
		}
		if (ref.Category == "configuration" || ref.Category == "saved_configuration") && slices.Contains([]string{"GroupRatio", "group_ratio_setting.group_ratio", "UserUsableGroups", "TopupGroupRatio"}, ref.Record) {
			continue
		}
		preview.ExecutionBlockers = append(preview.ExecutionBlockers, "Only unused groups with a base ratio, description and top-up ratio can be migrated in single-node mode.")
		break
	}
	preview.ExpiresAt = time.Now().Add(5 * time.Minute).Unix()
	preview.Confirmation = groupMigrationConfirmation(preview)
	return preview, nil
}

func validMigrationGroupName(name string) bool {
	if !utf8.ValidString(name) || utf8.RuneCountInString(name) == 0 || utf8.RuneCountInString(name) > 50 || strings.Contains(name, ",") || strings.HasPrefix(name, "+:") || strings.HasPrefix(name, "-:") {
		return false
	}
	return !strings.ContainsFunc(name, func(r rune) bool { return unicode.IsSpace(r) || unicode.IsControl(r) })
}
