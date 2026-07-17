package authz

const (
	ResourceUser = "user"
)

var (
	UserRead  = Permission{Resource: ResourceUser, Action: ActionRead}
	UserWrite = Permission{Resource: ResourceUser, Action: ActionWrite}
)

func init() {
	RegisterResource(ResourceDefinition{
		Resource: ResourceUser,
		LabelKey: "User Management",
		Actions: []ActionDefinition{
			{
				Action:         ActionRead,
				LabelKey:       "Read users",
				DescriptionKey: "View user lists, user details, and non-channel usage logs for other users.",
				DefaultRoles:   []string{BuiltInRoleAdmin},
			},
			{
				Action:         ActionWrite,
				LabelKey:       "Manage users",
				DescriptionKey: "Create, update, delete, and manage user accounts.",
				DefaultRoles:   []string{BuiltInRoleAdmin},
			},
		},
	})
}
