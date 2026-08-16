package authz

const (
	ResourceSystem   = "system"
	ActionSettings   = "settings"
)

var (
	SystemSettings = Permission{Resource: ResourceSystem, Action: ActionSettings}
)

func init() {
	RegisterResource(ResourceDefinition{
		Resource: ResourceSystem,
		LabelKey: "System Settings",
		Actions: []ActionDefinition{
			{
				Action:         ActionSettings,
				LabelKey:       "Access system settings",
				DescriptionKey: "Allow access to system settings pages and APIs.",
			},
		},
	})
}