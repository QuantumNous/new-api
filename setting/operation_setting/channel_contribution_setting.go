package operation_setting

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting/config"
)

const ChannelContributionSettingPrefix = "channel_contribution_setting."

const DefaultChannelContributionAgreementContent = `# 渠道贡献协议

版本：2026-08-16

## 一、适用范围与接受

本协议适用于您通过本平台提交、测试、维护或撤回第三方 API 渠道（以下简称“贡献渠道”）的行为。您勾选“我已阅读并同意《渠道贡献协议》”并提交渠道，即表示您已阅读、理解并接受本协议全部内容。未勾选同意或所确认的协议版本已失效时，平台不会受理提交。

## 二、贡献资格与授权保证

1. 您确认对所提交的 API 端点、API Key 及相关账户拥有合法、完整且持续有效的使用权和授权，并有权允许平台按本协议约定进行测试、审核、接入和调用。
2. 您不得提交盗用、泄露、共享越权、来源不明、通过欺骗取得，或受第三方条款限制而无权贡献的凭据。
3. 因授权范围、凭据来源、账户归属或第三方权利产生争议时，您应及时配合核验；平台可暂停测试、拒绝审核、停用或删除相关渠道。
4. 若您位于中国大陆地区，或贡献行为、上游账户、API 调用链路涉及中国大陆地区，您确认自己具备实施该贡献所需的民事行为能力、主体资格、网络与数据处理权限，并遵守适用的网络安全、数据安全、个人信息保护、跨境数据及生成式人工智能服务管理要求。
5. 您不得通过贡献渠道提供依法需要但尚未取得许可、备案、批准或授权的服务，不得以个人贡献方式规避上游服务的地区限制、实名要求、网络接入规则或其他强制性要求。
6. 平台可基于地区、主体身份、上游条款或合规要求，请求您补充资格、授权或用途说明；在核验完成前，平台可暂停受理或使用相关渠道。

## 三、API Key 的处理与使用

1. 为完成模型获取、连通性测试、审核、渠道创建、请求转发、健康巡检和故障排查，平台需要接收、存储并调用您提交的 API Key。
2. 平台仅将 API Key 用于贡献渠道的管理与服务运行。平台的必要服务组件及经授权的管理员可能在审核、运维和故障排查过程中处理该凭据。
3. 您应确保 API Key 具有适当的权限范围、额度和有效期，并及时处理上游账户中的余额不足、限额、封禁、过期或权限变化。
4. 请勿提交与渠道调用无关的账户密码、支付凭据、个人身份资料或其他敏感信息。

## 四、模型获取、测试与持续巡检

1. 平台可使用您填写的 API 端点和 API Key 自动获取模型列表；自动获取结果仅供配置参考，您仍需核对模型名称、可用性和模型映射。
2. 提交前，贡献渠道中的每个模型均须通过平台根据其端点能力要求的测试：聊天、Responses、Claude、Gemini 等支持流式传输的端点须同时通过非流式与流式测试；Embedding、Rerank 等不适用流式传输的端点仅测试适用的非流式模式。修改 API 端点、API Key、模型列表、模型映射、分组或其他影响调用的配置后，原测试结果失效，需重新测试。
3. 平台可在审核后持续对渠道进行自动健康巡检，并根据检测结果将渠道标记为可用或不可用。测试通过仅代表测试时点满足条件，不构成持续可用承诺。

## 五、价格与提交条件

只有在贡献渠道的全部模型均已由管理员配置有效价格，且全部必需测试通过后，渠道才可提交审核。模型价格由管理员维护，您不得通过模型命名、映射或其他方式规避计费配置。

## 六、贡献性质与奖励

1. 渠道贡献为自愿行为。平台可按管理员当前配置的奖励比例，将通过贡献渠道成功完成并最终结算的实际计费额度乘以奖励比例，记入贡献者的独立“渠道贡献奖励余额”。奖励比例默认值为 0，平台可调整后仅对相应请求生效，不承诺固定比例、固定收益或最低调用量。
2. 奖励以请求最终成功结算的实际额度为基数；失败请求、免费请求、测试请求、未产生正数结算额度的请求，以及贡献者本人使用自己贡献渠道产生的请求，不计入奖励。重复结算不会重复记账。
3. 渠道贡献奖励余额与用户普通额度分开记录。贡献者可按平台提供的手动划转功能，将可用奖励余额划转为本人平台额度；完成划转后不可撤销。奖励余额及划转所得平台额度不属于现金、存款或可提现资产，不支持提现、转账给他人或兑换法定货币。
4. 提交贡献不代表渠道必然通过审核，也不代表平台必须持续使用该渠道或维持特定调用量。渠道被停用、删除、撤回或变为不可用后，不再对后续请求产生奖励，但不影响此前已正确入账的奖励记录。
5. 您保留 API Key 及相关账户中依法属于您的权利；本协议不转移 API Key 或上游账户的所有权。

## 七、审核与渠道配置

1. 管理员可根据连通性、模型能力、价格完整性、来源可信度、服务稳定性及平台运营需要，对贡献进行通过、拒绝、停用、恢复或删除处理。
2. 渠道通过审核后，平台将按管理员配置写入渠道标签、可用分组、优先级和权重。上述配置可由管理员根据运行情况调整，不以贡献者提交时的展示值为准。
3. 管理员可要求您补充说明或重新测试。未在合理期限内完成核验的，平台可拒绝或关闭该贡献。

## 八、不可用与自动删除

1. 当健康巡检失败或上游返回持续异常时，贡献渠道可被标记为“不可用”并停止参与请求分发；恢复检测通过后，平台可将其恢复为“已通过”。
2. 渠道连续不可用达到管理员配置的时长后，平台可自动删除对应渠道，贡献历史将显示为“已删除”。当前展示的默认时长为 48 小时，实际以管理员实时配置为准。
3. 自动删除后，如需再次贡献，应重新创建、测试并提交审核；原审核结果不会自动恢复。

## 九、撤回贡献

1. 您可在贡献记录处撤回任何状态的贡献。撤回确认后，平台立即取消待审核修订、停止该贡献渠道承接新流量，并删除对应正式渠道及其路由能力。
2. 撤回时，平台将清除贡献修订中保存的 API Key；贡献历史、测试结果、审核记录、奖励流水及必要审计记录可继续保留，但不再包含可用于调用上游的有效凭据。
3. 撤回不影响撤回生效前已经发生的调用、计费、奖励和审计记录，也不撤销已经完成的奖励余额划转。

## 十、上游服务与贡献者责任

1. 上游服务的接口、模型、价格、额度、地区限制、内容规则和服务条款可能随时变化。您应确保贡献渠道的持续授权和可用性，并在发现变化后及时更新或撤回。
2. 因上游余额不足、限流、服务中断、账户封禁、接口变更、模型下线或第三方限制导致的不可用，由对应上游服务及账户状态决定；平台可据此停用或删除渠道。
3. 您不得利用贡献功能干扰平台运行、绕过访问控制、提交恶意端点，或诱导平台访问与模型服务无关的系统和数据。

## 十一、记录与通知

平台可记录贡献配置、测试结果、审核结果、健康状态、协议版本和同意时间，用于渠道管理、故障排查、计费核对和审计。与贡献相关的状态变化及补充要求，可通过站内页面、系统通知或平台已提供的联系方式告知您。

## 十二、协议更新

1. 平台可根据功能、运营规则或上游要求更新本协议，并发布新的协议版本。
2. 已提交的贡献保留其提交时确认的协议版本记录；新建、重新提交或发生需要重新确认的重大配置变更时，您须阅读并接受当时有效的最新版本。
3. 若您不同意更新后的协议，请勿继续提交新的贡献，并可按本协议第九条申请撤回已有渠道。

## 十三、联系与解释

如对贡献渠道、审核结果、状态变化或本协议有疑问，请通过平台提供的支持渠道联系管理员。具体功能名称、状态展示和配置数值以平台实际页面及管理员配置为准。`

type ChannelContributionSetting struct {
	Tag                        string   `json:"tag"`
	AllowedGroups              []string `json:"allowed_groups"`
	AllowedChannelTypes        []int    `json:"allowed_channel_types"`
	Priority                   int64    `json:"priority"`
	Weight                     uint     `json:"weight"`
	UnavailableDeleteHours     int      `json:"unavailable_delete_hours"`
	HealthCheckIntervalMinutes int      `json:"health_check_interval_minutes"`
	RewardBps                  int      `json:"reward_bps"`
	AgreementVersion           string   `json:"agreement_version"`
	AgreementContent           string   `json:"agreement_content"`
}

var supportedChannelContributionTypeList = []int{
	constant.ChannelTypeOpenAI,
	constant.ChannelTypeOllama,
	constant.ChannelTypeAnthropic,
	constant.ChannelTypeAli,
	constant.ChannelTypeOpenRouter,
	constant.ChannelTypeTencent,
	constant.ChannelTypeGemini,
	constant.ChannelTypeMoonshot,
	constant.ChannelTypeZhipu_v4,
	constant.ChannelTypePerplexity,
	constant.ChannelTypeLingYiWanWu,
	constant.ChannelTypeCohere,
	constant.ChannelTypeMiniMax,
	constant.ChannelTypeSiliconFlow,
	constant.ChannelTypeMistral,
	constant.ChannelTypeDeepSeek,
	constant.ChannelTypeXinference,
	constant.ChannelTypeXai,
	constant.ChannelTypeSub2API,
	constant.ChannelTypeNewAPI,
}

var channelContributionSetting = ChannelContributionSetting{
	Tag:                        "donate",
	AllowedGroups:              []string{"default"},
	AllowedChannelTypes:        append([]int(nil), supportedChannelContributionTypeList...),
	Priority:                   100,
	Weight:                     0,
	UnavailableDeleteHours:     48,
	HealthCheckIntervalMinutes: 10,
	RewardBps:                  0,
	AgreementVersion:           "2026-08-16",
	AgreementContent:           DefaultChannelContributionAgreementContent,
}

var supportedChannelContributionTypes = func() map[int]struct{} {
	types := make(map[int]struct{}, len(supportedChannelContributionTypeList))
	for _, channelType := range supportedChannelContributionTypeList {
		types[channelType] = struct{}{}
	}
	return types
}()

func init() {
	config.GlobalConfig.Register("channel_contribution_setting", &channelContributionSetting)
}

func GetChannelContributionSetting() *ChannelContributionSetting {
	setting := ChannelContributionSetting{}
	if err := config.GlobalConfig.Snapshot("channel_contribution_setting", &setting); err != nil {
		common.SysError("failed to snapshot channel contribution setting: " + err.Error())
	}
	if strings.TrimSpace(setting.Tag) == "" {
		setting.Tag = "donate"
	}
	if setting.UnavailableDeleteHours <= 0 {
		setting.UnavailableDeleteHours = 48
	}
	if setting.HealthCheckIntervalMinutes <= 0 {
		setting.HealthCheckIntervalMinutes = 10
	}
	if strings.TrimSpace(setting.AgreementVersion) == "" {
		setting.AgreementVersion = "2026-08-16"
	}
	if strings.TrimSpace(setting.AgreementContent) == "" {
		setting.AgreementContent = DefaultChannelContributionAgreementContent
	}
	return &setting
}

func (setting *ChannelContributionSetting) IsGroupAllowed(group string) bool {
	group = strings.TrimSpace(group)
	for _, allowed := range setting.AllowedGroups {
		if strings.TrimSpace(allowed) == group {
			return true
		}
	}
	return false
}

func (setting *ChannelContributionSetting) IsChannelTypeAllowed(channelType int) bool {
	if !IsChannelContributionTypeSupported(channelType) {
		return false
	}
	for _, allowed := range setting.AllowedChannelTypes {
		if allowed == channelType {
			return true
		}
	}
	return false
}

func IsChannelContributionTypeSupported(channelType int) bool {
	_, ok := supportedChannelContributionTypes[channelType]
	return ok
}

func GetSupportedChannelContributionTypes() []int {
	return append([]int(nil), supportedChannelContributionTypeList...)
}

func ValidateChannelContributionOption(key string, value string) error {
	if !strings.HasPrefix(key, ChannelContributionSettingPrefix) {
		return nil
	}

	field := strings.TrimPrefix(key, ChannelContributionSettingPrefix)
	switch field {
	case "allowed_groups":
		var groups []string
		if err := common.UnmarshalJsonStr(value, &groups); err != nil {
			return fmt.Errorf("allowed_groups must be a JSON string array: %w", err)
		}
		seen := make(map[string]struct{}, len(groups))
		for _, group := range groups {
			group = strings.TrimSpace(group)
			if group == "" || len(group) > 64 {
				return fmt.Errorf("allowed_groups contains an invalid group")
			}
			if _, exists := seen[group]; exists {
				return fmt.Errorf("allowed_groups contains duplicate group %q", group)
			}
			seen[group] = struct{}{}
		}
	case "allowed_channel_types":
		var channelTypes []int
		if err := common.UnmarshalJsonStr(value, &channelTypes); err != nil {
			return fmt.Errorf("allowed_channel_types must be a JSON integer array: %w", err)
		}
		seen := make(map[int]struct{}, len(channelTypes))
		for _, channelType := range channelTypes {
			if !IsChannelContributionTypeSupported(channelType) {
				return fmt.Errorf("unsupported channel type %d", channelType)
			}
			if _, exists := seen[channelType]; exists {
				return fmt.Errorf("allowed_channel_types contains duplicate type %d", channelType)
			}
			seen[channelType] = struct{}{}
		}
	case "tag":
		if strings.TrimSpace(value) == "" || len(strings.TrimSpace(value)) > 64 {
			return fmt.Errorf("tag must contain 1 to 64 characters")
		}
	case "agreement_version":
		if strings.TrimSpace(value) == "" || len(strings.TrimSpace(value)) > 64 {
			return fmt.Errorf("agreement_version must contain 1 to 64 characters")
		}
	case "agreement_content":
		if strings.TrimSpace(value) == "" || len(value) > 100_000 {
			return fmt.Errorf("agreement_content must contain 1 to 100000 characters")
		}
	case "unavailable_delete_hours", "health_check_interval_minutes":
		parsed, err := strconv.Atoi(strings.TrimSpace(value))
		if err != nil || parsed <= 0 {
			return fmt.Errorf("%s must be a positive integer", field)
		}
	case "reward_bps":
		parsed, err := strconv.Atoi(strings.TrimSpace(value))
		if err != nil || parsed < 0 || parsed > 10_000 {
			return fmt.Errorf("reward_bps must be an integer from 0 to 10000")
		}
	case "priority", "weight":
		parsed, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
		if err != nil || parsed < 0 {
			return fmt.Errorf("%s must be a non-negative integer", field)
		}
	}
	return nil
}
