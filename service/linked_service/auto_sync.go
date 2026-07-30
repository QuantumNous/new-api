package linked_service

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// TriggerPasswordSyncAsync is called after a root user's password is successfully
// updated in the database. It spawns a goroutine to sync the new password to all
// registered linked services. Failures are logged but do not block the caller.
//
// Only root users (role >= 20) trigger linked-service syncs; ordinary admin or
// user password changes do not propagate to external tools.
func TriggerPasswordSyncAsync(userID int, userRole int, newPassword string) {
	if userRole < common.RoleRootUser {
		// Only root users' passwords sync to linked services
		return
	}

	go func() {
		services, err := model.ListLinkedServices()
		if err != nil {
			common.SysLog("linked_service: failed to list services for auto-sync: " + err.Error())
			return
		}
		if len(services) == 0 {
			return
		}

		common.SysLog("linked_service: triggering auto-sync for all services after root password change")

		for _, svc := range services {
			syncErr := SyncPassword(svc, newPassword)
			if syncErr != nil {
				_ = model.MarkLinkedServiceFailed(svc.ID, syncErr.Error())
				common.SysLog("linked_service: auto-sync failed for " + svc.Name + ": " + syncErr.Error())
			} else {
				_ = model.MarkLinkedServiceSynced(svc.ID, svc.Revision+1)
				common.SysLog("linked_service: auto-sync succeeded for " + svc.Name)
			}
		}
	}()
}
