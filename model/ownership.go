package model

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
)

type OwnershipSnapshot struct {
	TenantId              int
	OrganizationId        int
	DepartmentId          int
	DistributionChannelId int
}

func NormalizeOwnership(snapshot OwnershipSnapshot) OwnershipSnapshot {
	if snapshot.TenantId == 0 {
		snapshot.TenantId = 1
	}
	return snapshot
}

func OwnershipFromContext(c *gin.Context) OwnershipSnapshot {
	if c == nil {
		return NormalizeOwnership(OwnershipSnapshot{})
	}
	return NormalizeOwnership(OwnershipSnapshot{
		TenantId:              common.GetContextKeyInt(c, constant.ContextKeyTenantId),
		OrganizationId:        common.GetContextKeyInt(c, constant.ContextKeyOrganizationId),
		DepartmentId:          common.GetContextKeyInt(c, constant.ContextKeyDepartmentId),
		DistributionChannelId: common.GetContextKeyInt(c, constant.ContextKeyDistributionChannelId),
	})
}

func OwnershipByUserId(userId int) OwnershipSnapshot {
	if userId <= 0 {
		return NormalizeOwnership(OwnershipSnapshot{})
	}
	userCache, err := GetUserCache(userId)
	if err != nil || userCache == nil {
		return NormalizeOwnership(OwnershipSnapshot{})
	}
	return NormalizeOwnership(OwnershipSnapshot{
		TenantId:              userCache.TenantId,
		OrganizationId:        userCache.OrganizationId,
		DepartmentId:          userCache.DepartmentId,
		DistributionChannelId: userCache.DistributionChannelId,
	})
}

func ownershipFromSubscriptionOrder(order *SubscriptionOrder) OwnershipSnapshot {
	if order == nil {
		return NormalizeOwnership(OwnershipSnapshot{})
	}
	return NormalizeOwnership(OwnershipSnapshot{
		TenantId:              order.TenantId,
		OrganizationId:        order.OrganizationId,
		DepartmentId:          order.DepartmentId,
		DistributionChannelId: order.DistributionChannelId,
	})
}

func ownershipFromUserSubscription(subscription *UserSubscription) OwnershipSnapshot {
	if subscription == nil {
		return NormalizeOwnership(OwnershipSnapshot{})
	}
	return NormalizeOwnership(OwnershipSnapshot{
		TenantId:              subscription.TenantId,
		OrganizationId:        subscription.OrganizationId,
		DepartmentId:          subscription.DepartmentId,
		DistributionChannelId: subscription.DistributionChannelId,
	})
}

func ApplyOwnershipFromContext(c *gin.Context, target any) {
	OwnershipFromContext(c).ApplyTo(target)
}

func ApplyOwnershipFromUser(userId int, target any) {
	OwnershipByUserId(userId).ApplyTo(target)
}

func (snapshot OwnershipSnapshot) ApplyTo(target any) {
	snapshot = NormalizeOwnership(snapshot)
	switch v := target.(type) {
	case *Log:
		v.TenantId = snapshot.TenantId
		v.OrganizationId = snapshot.OrganizationId
		v.DepartmentId = snapshot.DepartmentId
		v.DistributionChannelId = snapshot.DistributionChannelId
	case *TopUp:
		v.TenantId = snapshot.TenantId
		v.OrganizationId = snapshot.OrganizationId
		v.DepartmentId = snapshot.DepartmentId
		v.DistributionChannelId = snapshot.DistributionChannelId
	case *Redemption:
		v.TenantId = snapshot.TenantId
		v.OrganizationId = snapshot.OrganizationId
		v.DepartmentId = snapshot.DepartmentId
		v.DistributionChannelId = snapshot.DistributionChannelId
	case *SubscriptionOrder:
		v.TenantId = snapshot.TenantId
		v.OrganizationId = snapshot.OrganizationId
		v.DepartmentId = snapshot.DepartmentId
		v.DistributionChannelId = snapshot.DistributionChannelId
	case *UserSubscription:
		v.TenantId = snapshot.TenantId
		v.OrganizationId = snapshot.OrganizationId
		v.DepartmentId = snapshot.DepartmentId
		v.DistributionChannelId = snapshot.DistributionChannelId
	case *SubscriptionPreConsumeRecord:
		v.TenantId = snapshot.TenantId
		v.OrganizationId = snapshot.OrganizationId
		v.DepartmentId = snapshot.DepartmentId
		v.DistributionChannelId = snapshot.DistributionChannelId
	}
}
