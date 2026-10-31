package model

import (
	"errors"
	"os"
	"reflect"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// All reference-bearing ORM writes take the same database lock, including
// writes inside explicit subscription/task transactions. The lock survives to
// the outer commit; validating only in a controller would leave a race.
func installGroupMigrationWriteBarrier(db *gorm.DB) error {
	if db.Callback().Create().Get("new-api:group-migration") == nil {
		if err := db.Callback().Create().After("gorm:begin_transaction").Before("gorm:before_create").Register("new-api:group-migration", guardGroupReferenceWrite); err != nil {
			return err
		}
	}
	if db.Callback().Update().Get("new-api:group-migration") == nil {
		if err := db.Callback().Update().After("gorm:begin_transaction").Before("gorm:before_update").Register("new-api:group-migration", guardGroupReferenceWrite); err != nil {
			return err
		}
	}
	return nil
}

// Take the migration lock before reading lifecycle inputs, in the same order
// as migration. A paused transition is retried with fresh plans and snapshots.
// Zero ids acquire the lock before an order lookup; its ids are checked next.
func guardSubscriptionGroupTransition(tx *gorm.DB, userID, planID, subscriptionID int) error {
	if tx.Callback().Create().Get("new-api:group-migration") == nil {
		return nil // Partial model fixtures have no migration coordinator.
	}
	if _, ok := tx.Statement.ConnPool.(gorm.TxCommitter); !ok {
		return errors.New("subscription group transitions require a transaction")
	}
	var control GroupMigrationControl
	if err := control.lock(tx); err != nil {
		return err
	}
	if control.OperationID == "" {
		return nil
	}
	var op GroupMigrationOperation
	if err := tx.First(&op, "id = ?", control.OperationID).Error; err != nil {
		return err
	}
	if subscriptionID > 0 {
		var sub UserSubscription
		if err := tx.Select("user_id").First(&sub, subscriptionID).Error; err != nil {
			return err
		}
		userID = sub.UserId
	}
	groups := []string{op.Source, op.Target}
	var count int64
	if userID > 0 {
		if err := tx.Unscoped().Model(&User{}).Where("id = ? AND "+commonGroupCol+" IN ?", userID, groups).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return ErrGroupMigrationPaused
		}
		if err := tx.Model(&UserSubscription{}).Where("user_id = ? AND (upgrade_group IN ? OR downgrade_group IN ? OR prev_user_group IN ?)", userID, groups, groups, groups).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return ErrGroupMigrationPaused
		}
	}
	if planID > 0 {
		if err := tx.Model(&SubscriptionPlan{}).Where("id = ? AND (upgrade_group IN ? OR downgrade_group IN ?)", planID, groups, groups).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return ErrGroupMigrationPaused
		}
	}
	return nil
}

func guardGroupReferenceWrite(tx *gorm.DB) {
	if tx.Error != nil || tx.Statement.Schema == nil {
		return
	}
	var columns []string
	switch tx.Statement.Table {
	case "users", "channels", "abilities":
		columns = []string{"group"}
	case "tasks":
		columns = []string{"group", "user_id"}
	case "midjourneys":
		columns = []string{"user_id"}
	case "tokens":
		columns = []string{"group", "auto_groups"}
	case "subscription_plans":
		columns = []string{"upgrade_group", "downgrade_group"}
	case "user_subscriptions":
		columns = []string{"upgrade_group", "downgrade_group", "prev_user_group"}
	default:
		return
	}
	destination := reflect.ValueOf(tx.Statement.Dest)
	for destination.IsValid() && (destination.Kind() == reflect.Pointer || destination.Kind() == reflect.Interface) {
		if destination.IsNil() {
			return
		}
		destination = destination.Elem()
	}
	if destination.IsValid() && destination.Kind() == reflect.Map {
		assigned := false
		for _, column := range columns {
			if destination.MapIndex(reflect.ValueOf(column)).IsValid() {
				assigned = true
				break
			}
		}
		if !assigned {
			return
		}
	}
	if _, ok := tx.Statement.ConnPool.(gorm.TxCommitter); !ok {
		tx.AddError(errors.New("group reference writes require a transaction"))
		return
	}
	query := tx.Session(&gorm.Session{NewDB: true})
	var control GroupMigrationControl
	if err := control.lock(query); err != nil {
		tx.AddError(err)
		return
	}
	if writer, ok := tx.Statement.Context.Value(groupMigrationWriterKey{}).(groupMigrationWriter); ok && writer.operation == control.OperationID && writer.owner == control.Owner && writer.operation != "" {
		return
	}
	if os.Getenv("GROUP_MIGRATION_NODES") != "" && groupMigrationNodeRevision.Load() != control.Revision {
		tx.AddError(ErrGroupMigrationPaused)
		return
	}
	if os.Getenv("GROUP_MIGRATION_NODES") != "" {
		if err := verifyGroupMigrationGeneration(query); err != nil {
			tx.AddError(err)
			return
		}
	}
	var op GroupMigrationOperation
	if control.OperationID != "" {
		if err := query.First(&op, "id = ?", control.OperationID).Error; err != nil {
			tx.AddError(err)
			return
		}
	}
	// Inspect only assigned group columns, never credentials or unrelated text.
	// Map updates and struct/batch creates use different GORM destination shapes.
	if err := validateGroupWriteValue(tx, reflect.ValueOf(tx.Statement.Dest), columns, &op); err != nil {
		tx.AddError(err)
	}
}

func validateGroupWriteValue(tx *gorm.DB, value reflect.Value, columns []string, op *GroupMigrationOperation) error {
	for value.IsValid() && (value.Kind() == reflect.Pointer || value.Kind() == reflect.Interface) {
		if value.IsNil() {
			return nil
		}
		value = value.Elem()
	}
	if !value.IsValid() {
		return nil
	}
	if value.Kind() == reflect.Slice || value.Kind() == reflect.Array {
		for i := range value.Len() {
			if err := validateGroupWriteValue(tx, value.Index(i), columns, op); err != nil {
				return err
			}
		}
		return nil
	}
	selected, restricted := tx.Statement.SelectAndOmitColumns(false, false)
	for _, column := range columns {
		var raw any
		switch value.Kind() {
		case reflect.Map:
			field := value.MapIndex(reflect.ValueOf(column))
			if !field.IsValid() {
				continue
			}
			raw = field.Interface()
		case reflect.Struct:
			field := tx.Statement.Schema.LookUpField(column)
			if field == nil || selected[column] == false && restricted {
				continue
			}
			raw, _ = field.ValueOf(tx.Statement.Context, value)
		default:
			continue
		}
		if raw == nil {
			continue
		}
		if column == "user_id" {
			id, ok := raw.(int)
			if !ok {
				return errors.New("task user references must be literal ids")
			}
			if id == 0 || op.ID == "" {
				continue
			}
			var user User
			if err := tx.Session(&gorm.Session{NewDB: true}).Select("id", "group").Unscoped().First(&user, id).Error; err != nil {
				return err
			}
			if user.Group == op.Source || user.Group == op.Target {
				return ErrGroupMigrationPaused
			}
			continue
		}
		group, ok := raw.(string)
		if !ok {
			if ptr, isPointer := raw.(*string); isPointer && ptr != nil {
				group, ok = *ptr, true
			}
		}
		if !ok {
			return errors.New("group references must be literal names")
		}
		groups := []string{group}
		if column == "auto_groups" && strings.TrimSpace(group) != "" {
			if err := common.UnmarshalJsonStr(group, &groups); err != nil {
				return err
			}
		} else if tx.Statement.Table == "channels" {
			groups = strings.Split(group, ",")
		}
		for _, name := range groups {
			if op.ID != "" && (name == op.Source || name == op.Target) {
				return ErrGroupMigrationPaused
			}
			if err := ValidateGroupReference(name, true, tx.Statement.Table == "tokens" && column == "group"); err != nil {
				return err
			}
		}
	}
	return nil
}
