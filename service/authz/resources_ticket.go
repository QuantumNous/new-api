package authz

const (
	ResourceTicket = "ticket"

	ActionReply  = "reply"
	ActionManage = "manage"
)

var (
	TicketRead   = Permission{Resource: ResourceTicket, Action: ActionRead}
	TicketReply  = Permission{Resource: ResourceTicket, Action: ActionReply}
	TicketManage = Permission{Resource: ResourceTicket, Action: ActionManage}
)

func init() {
	RegisterResource(ResourceDefinition{
		Resource: ResourceTicket,
		LabelKey: "Ticket management",
		Actions: []ActionDefinition{
			{
				Action:         ActionRead,
				LabelKey:       "Read tickets",
				DescriptionKey: "View ticket queues, details, users, and attachments.",
				DefaultRoles:   []string{BuiltInRoleAdmin},
			},
			{
				Action:         ActionReply,
				LabelKey:       "Reply to tickets",
				DescriptionKey: "Send public support replies and automatically claim unassigned tickets.",
				DefaultRoles:   []string{BuiltInRoleAdmin},
			},
			{
				Action:         ActionManage,
				LabelKey:       "Manage tickets",
				DescriptionKey: "Assign, transfer, close, and reopen tickets.",
				DefaultRoles:   []string{BuiltInRoleAdmin},
			},
		},
	})
}
