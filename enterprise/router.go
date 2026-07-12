/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
package enterprise

import (
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-gonic/gin"
)

func RegisterRoutes(api *gin.RouterGroup) {
	routes := api.Group("/enterprise")
	adminRoutes := routes.Group("/")
	adminRoutes.Use(middleware.AdminAuth())
	{
		adminRoutes.POST("", createEnterprise)
		adminRoutes.GET("", listEnterprises)
		adminRoutes.PUT("/:id", updateEnterprise)
		adminRoutes.DELETE("/:id", disableEnterprise)
	}

	memberRoutes := routes.Group("/")
	memberRoutes.Use(middleware.UserAuth())
	{
		memberRoutes.POST("/join", joinEnterprise)
		memberRoutes.GET("/me", getCurrentEnterprise)
		memberRoutes.POST("/leave", leaveEnterprise)
	}

	managerRoutes := routes.Group("/me")
	managerRoutes.Use(middleware.UserAuth(), EnterpriseAdminAuth())
	{
		managerRoutes.GET("/members", listMembers)
		managerRoutes.GET("/members/:uid", getMember)
		managerRoutes.PUT("/members/:uid", updateMember)
		managerRoutes.POST("/members/:uid/remove", removeMember)
		managerRoutes.POST("/members/:uid/tags", assignTags)
		managerRoutes.DELETE("/members/:uid/tags/:tid", removeTag)
		managerRoutes.POST("/invitations", createInvitation)
		managerRoutes.GET("/invitations", listInvitations)
		managerRoutes.POST("/invitations/:id/revoke", revokeInvitation)
		managerRoutes.GET("/join-requests", listJoinRequests)
		managerRoutes.POST("/join-requests/:id/approve", approveJoinRequest)
		managerRoutes.POST("/join-requests/:id/reject", rejectJoinRequest)
		managerRoutes.POST("/tags", createTag)
		managerRoutes.GET("/tags", listTags)
		managerRoutes.DELETE("/tags/:id", deleteTag)
		managerRoutes.POST("/quota/distribute", distributeQuota)
	}
}
