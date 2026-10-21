package authz

const ResourcePartnerOAuthClient = "partner_oauth_client"

var (
	PartnerOAuthClientRead           = Permission{Resource: ResourcePartnerOAuthClient, Action: ActionRead}
	PartnerOAuthClientOperate        = Permission{Resource: ResourcePartnerOAuthClient, Action: ActionOperate}
	PartnerOAuthClientSensitiveWrite = Permission{Resource: ResourcePartnerOAuthClient, Action: ActionSensitiveWrite}
)

func init() {
	RegisterResource(ResourceDefinition{
		Resource: ResourcePartnerOAuthClient,
		LabelKey: "Partner OAuth Clients",
		Actions: []ActionDefinition{
			{
				Action:         ActionRead,
				LabelKey:       "Read partner OAuth clients",
				DescriptionKey: "View registered partner OAuth clients without secrets.",
				DefaultRoles:   []string{BuiltInRoleAdmin},
			},
			{
				Action:         ActionOperate,
				LabelKey:       "Operate partner OAuth clients",
				DescriptionKey: "Enable or disable partner OAuth clients.",
				DefaultRoles:   []string{BuiltInRoleAdmin},
			},
			{
				Action:         ActionSensitiveWrite,
				LabelKey:       "Edit partner OAuth clients",
				DescriptionKey: "Create, update, rotate secrets, or delete partner OAuth clients.",
			},
		},
	})
}
