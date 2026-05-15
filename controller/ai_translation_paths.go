package controller

var statusTranslationPaths = []string{
	"data.announcements.*.content",
	"data.announcements.*.extra",
	"data.api_info.*.description",
	"data.api_info.*.route",
	"data.chats.*.@key",
	"data.faq.*.answer",
	"data.faq.*.question",
}

var noticeTranslationPaths = []string{
	"data",
}

var uptimeTranslationPaths = []string{
	"data.*.categoryName",
	"data.*.monitors.*.group",
	"data.*.monitors.*.name",
}

var userGroupsTranslationPaths = []string{
	"data.@key",
	"data.*.desc",
}

var subscriptionPlansTranslationPaths = []string{
	"data.*.plan.subtitle",
	"data.*.plan.title",
}

var pricingTranslationPaths = []string{
	"auto_groups.*",
	"data.*.enable_groups.*",
	"data.*.description",
	"data.*.tags",
	"group_ratio.@key",
	"usable_group.@key",
	"usable_group.@value",
	"vendors.*.name",
}

var rankingsTranslationPaths = []string{
	"data.models.*.vendor",
	"data.models_history.models.*.vendor",
	"data.models_history.points.*.vendor",
	"data.top_droppers.*.vendor",
	"data.top_movers.*.vendor",
	"data.vendor_share_history.points.*.vendor",
	"data.vendor_share_history.vendors.*.name",
	"data.vendors.*.vendor",
}
