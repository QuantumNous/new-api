/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { LegalDocumentKind } from './default-documents'

type LocalizedLegalLocale = 'zh' | 'fr' | 'ja' | 'ru' | 'vi'

type LocalizedLegalDocumentSet = Record<LegalDocumentKind, string>

export const LOCALIZED_DEFAULT_LEGAL_DOCUMENTS: Record<
  LocalizedLegalLocale,
  LocalizedLegalDocumentSet
> = {
  zh: {
    terms: `# flatkey.ai 用户协议

最后更新时间：2026 年 6 月 4 日

本用户协议（“协议”）适用于 VOC AI INC（“VOC AI”、“我们”或“我们的”）通过 flatkey.ai、仪表板、API、结帐页面、文档和支持渠道（“服务”）提供的 flatkey.ai 服务。通过注册帐户、创建组织、添加预付帐户余额、生成或使用 API 密钥、调用模型 API、访问仪表板或以其他方式使用服务，即表示您同意本协议、我们的隐私政策、退款政策、文档、定价页面以及任何适用的补充规则。

运营实体：VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, United States。联系方式：support@flatkey.ai。

## 一、服务概述

flatkey.ai 是一种 AI API 访问、模型路由、使用计量、仪表板和预付费帐户余额服务。用户可以通过统一的API和仪表板访问不同的AI模型功能，管理API密钥、团队权限、模型选择、请求记录、余额、信用、计费和支持事务。

flatkey.ai 并不是模型本身。我们不保证任何特定模型、API、价格、上下文窗口、速率限制、区域可用性、输出行为、数据处理规则或第三方政策将保持可用或不变。我们可能会根据产品需求、成本变化、安全要求、合规义务、模型提供商要求或第三方服务的变更来添加、删除、限制或修改模型、功能、价格和使用规则。

## 2. 资格、账户和组织

您必须年满 13 岁。如果您未满 18 岁，您必须获得父母或法定监护人的许可。如果您代表公司、组织或其他实体使用服务，则您声明您有权代表该实体接受本协议。

您必须提供真实、准确、完整的往来账户、业务、账单、税务和联系信息。您对您帐户下的管理员、成员、应用程序、API 密钥、访问凭证、请求、集成、支付方式和余额使用情况负责。

组织管理员可以邀请团队成员并配置权限、预算、模型、日志、密钥和安全设置。管理员配置可能会影响应用程序的组织成员和最终用户。您必须确保您的团队成员和最终用户遵守本协议、我们的文档和适用的模型提供商条款。

如果您认为您的账户、API 密钥、访问凭证、支付方式或仪表板访问权限在未经授权的情况下被使用，您必须立即联系我们并采取适当措施撤销、轮换、禁用或限制访问权限。

## 3. 预付余额、费用和数字交付

服务可能会要求您在调用 API 或使用某些功能之前购买预付费帐户余额或服务积分。购买前，您将有机会查看适用页面上显示的订单金额、货币、税费、费用、付款方式和定价规则。

账户余额和服务积分只能用于符合条件的 flatkey.ai 服务。它们不是现金、存款、电子货币、礼品卡、支付工具、可提款账户或金融产品。除非我们明确书面同意或适用法律另有要求，否则账户余额和服务积分不得提取、兑换为现金、转让、用作抵押品、投资或在服务之外使用。

成功付款或订单批准后，购买的余额或积分通常会以电子方式发送到您的帐户，并可立即用于 API 请求、模型调用或其他付费功能。当您提出请求时，系统会根据当时的模型价格、输入使用情况、输出使用情况、缓存命中、请求、文件、图像、税费、费用、货币换算以及相关页面或结帐流程上显示的任何其他计费规则扣除余额。

余额或积分的有效期由购买页面、订单描述、仪表板显示或我们的书面确认决定。我们可以根据退款政策限制、冻结、取消或处理与长期不活动账户、暂停账户、关闭账户、欺诈活动或违反政策相关的任何余额或积分。

## 4. 付款、税款和发票

您授权 VOC AI 和我们的支付服务提供商向您选择的付款方式收取订单金额、税费、费用和其他适用费用。付款可能由 Paddle、Stripe、银行、卡网络、钱包、本地支付方式提供商、反欺诈提供商、税务提供商、发票提供商或其他必要的服务提供商处理。

根据结账方式的不同，负责收款、开具发票、税款计算、退款执行和争议处理的一方可能会有所不同。如果 Paddle 作为记录商户或卖家处理订单，则 Paddle 可能负责收款、税款、发票、收据、退款和付款争议工作流程。如果 Stripe 或其他提供商仅充当支付处理方，VOC AI 可能仍然是卖方，并且处理方可以代表我们处理与支付相关的活动。

您必须提供准确的帐单地址、公司名称、税号、增值税/商品及服务税信息、电子邮件地址和发票信息。您应对税款、发票问题、收据问题、付款失败、退款延迟、合规审查或因不准确、不完整或过时的信息而导致的额外费用负责。

## 5. 模型提供商条款和限制

服务可能允许您、您的团队成员、您的应用程序或您的最终用户访问第三方模型提供商或技术服务提供商提供的模型、API、工具或功能。您理解并同意，使用任何模型或第三方服务也可能受到该模型或第三方服务的条款、政策、区域限制、安全规则、数据处理规则和使用限制的约束。

在使用特定模型之前，您有责任确认该模型及其规则适合您的用例，包括商业用途、面向客户的用途、敏感数据、受监管行业、高风险决策、区域访问、未成年人、内容安全和输出发布。您还必须确保您的团队成员和最终用户根据本协议、我们的文档和适用的第三方规则使用相关模型。

某些模型或功能可能不允许某些地区、行业、实体、目的或请求类型访问。您不得使用 VPN、代理、多个帐户、虚假信息、技术解决方法或其他方法来绕过模型、区域、身份、安全或合规性限制。如果我们收到第三方请求、检测到风险或有理由认为存在违反规则的情况，我们可能会暂停、限制、关闭或删除您对相关模型、账户、API 密钥、余额或功能的访问权限。

我们不会修改、放弃或替换第三方模型提供商条款。模型提供商可能随时更改其条款、定价、功能、可用性、数据处理方法或访问限制。您继续使用模型意味着您接受当时适用的规则。

## 6.配置职责

您负责选择模型、配置帐户、设置团队权限、管理 API 密钥、配置预算和速率限制、控制请求源、审查输入和输出以及确定服务是否适合您的业务场景。

如果您将 flatkey.ai 集成到您自己的产品或服务中，您必须保留对您的应用程序、最终用户访问、帐户权限、API 密钥、余额、信用、请求源、日志、滥用处理和客户支持的控制。您不得允许最终用户直接获取、控制、转售、分割、批量使用或绕过您的应用程序来使用 flatkey.ai 帐户、API 密钥、余额或积分。

您负责您的团队成员、应用程序、集成、最终用户、自动化脚本、权限设置和密钥管理。由于您的配置、密钥泄露、最终用户行为、权限设置、脚本错误或内部管理问题而导致的使用、费用、争议或损失均由您负责，除非直接由我们可验证的系统错误造成。

## 7. 用户内容和AI输出

您提交给服务的提示、文本、文件、图像、代码、数据、配置、请求和其他内容都是“输入”。模型响应、生成的内容或服务返回的其他结果都是“输出”。输入和输出统称为“用户内容”。

您保留对您的输入合法拥有的权利。为了提供、路由、计量、故障排除、支持、安全、审核、审查退款和改进服务，您授予我们非排他性、全球性、免版税的许可，以根据需要处理、传输、存储、复制、显示和使用用户内容和相关元数据。

您声明您拥有提交、处理和传输输入所需的所有权利、许可和同意。您不得提交违反知识产权、隐私权、保密义务、合同义务或适用法律的内容。

人工智能输出可能不准确、不完整、过时、重复、有偏见、不安全、不适合特定目的或与第三方内容相似。您必须独立审查和验证输出，然后再依赖它们、发布它们、在商业上使用它们、在生产中部署它们，或将它们用于法律、医疗、财务、就业、信贷、安全、合规性或其他重要决策。我们不保证任何输出的准确性、唯一性、适用性、可用性或不侵权。

除非仪表板、文档或订单描述明确提供相关功能，否则我们不承诺存储完整的输入或输出历史记录。出于故障排除、安全、计量、退款、争议或合规目的，我们可能会保留请求元数据、错误记录、使用记录和必要的日志。

## 8. 禁止转售、中继或竞争性使用

flatkey.ai 帐户、API 密钥、帐户余额、服务积分、模型访问功能和仪表板功能可供您和您的授权团队在您自己的业务或应用程序中使用。除非我们签订单独的书面协议，否则您不得将 flatkey.ai 作为独立 API、余额、信用、子账户、充值服务、中继服务、更名服务、聚合服务或类似服务提供给第三方，无论是通过销售、转让、分销、租赁、共享或其他间接安排。

您不得出于转售 API 访问权限、构建竞争服务、绕过第三方模型规则、隐藏真正的最终用户、规避价格或限制、绕过区域限制、绕过安全审查或绕过付款审查的目的访问或使用服务。

未经授权转售、转发、账户共享、隐藏真实用户、批量开户、异常集中调用、规避限额、规避风控等行为属于重大违规行为。我们可能暂停或终止相关账户、API 密钥、余额、信用和订单，并可能拒绝或限制相关退款、余额恢复或信用调整。

## 9. 禁止行为

你不可以：

- 使用服务进行非法、欺诈、侵权、骚扰、垃圾邮件、恶意软件、网络钓鱼、系统攻击、逃避监管、侵犯隐私、抓取敏感数据、逃避制裁、违反出口管制或其他有害活动；
- 创建虚假身份、冒充他人、歪曲关系或使用多个账户来逃避限制、风险控制、定价、退款或合规审查；
- 绕过或干扰账户限制、区域限制、计费规则、信用限额、费率限制、安全机制、反滥用规则、第三方服务限制或付款审查流程；
- 对服务、API、系统、数据或其他用户帐户进行逆向工程、扫描、攻击、压力测试、破坏、爬行、复制、抓取或未经授权访问；
- 未经我们书面批准，进行对抗性测试、提示注入、越狱测试、安全旁路测试、压力测试或其他可能损害模型、服务、第三方规则或用户利益的测试；
- 提交或分发侵权、非法、恶意、欺诈、误导、骚扰、性、暴力、仇恨、侵犯隐私、受限或违反第三方政策的内容；
- 协助、鼓励或允许任何第三方进行上述任何行为。

## 10. 计量、交付和审核记录

我们维护订单、付款、发货、余额、信用、请求、扣款、错误、退款、退款、争议和安全记录，以验证发货是否完成、是否发生使用、余额是否正确扣除、退款请求是否有效以及帐户是否显示异常使用。

我们尽合理努力保持计量和计费记录准确，但复杂的系统可能会出现延迟、错误、重复记录或显示差异。如果发生可验证的系统错误，我们可能会通过余额恢复、信用更正、账单调整或退款来解决该问题。用户截图、第三方记录或本地日志可能被视为支持材料，但最终审核将考虑我们的系统记录、支付服务提供商记录以及必要的第三方服务记录。

为了保护服务稳定性和其他用户的利益，我们可能会监控异常请求、异常扣费、异常登录、异常支付、批量调用、密钥泄露、恶意请求、滥用退款以及违反本协议的使用模式，并在调查过程中暂时限制相关功能。

我们可能会对高风险订单、充值金额大、充值频率异常、账单信息不一致、登录区域异常、请求来源异常、短时高并发、支付服务商提醒等进行人工或自动审核。在审核期间，交付、余额使用、退款、发票或帐户功能可能会延迟或受到限制。审核后，我们将根据适用记录恢复或处理相关事项。

## 11. 退款

退款、余额恢复、信用更正和支持调整均根据我们的 flatkey.ai 退款政策进行处理。一般来说，已交付和使用的积分、消耗的余额、已完成的请求以及成功提供的数字服务均不可退款。

重复收费、未交付、可验证的系统错误、未使用的余额、税务或发票错误、付款纠纷、强制性消费者权利或支付服务提供商要求将根据订单记录、交付记录、使用记录、付款状态和适用规则进行审核。

## 12. 第三方服务

服务可能依赖于第三方模型、API、平台、云服务、支付服务、税务服务、发票服务、托管、数据库、电子邮件、分析、安全和支持工具。第三方根据自己的条款、政策和技术规则提供服务和处理数据。

第三方服务可能会被暂停、限速、拒绝、终止、重新定价、修改、受地区限制或数据处理方法发生变化。我们将尽合理努力维护服务，但我们不保证任何第三方服务的持续可用性，并且对于本协议之外的第三方故障、政策变更、网络问题、区域限制、模型行为、输出质量或第三方成本变化不承担任何责任。

## 13. 暂停、终止和服务变更

如果我们认为您违反本协议或第三方政策、非法使用服务、从事欺诈、造成制裁风险、造成付款风险、滥用退款、造成安全风险、未经授权向他人提供服务、产生异常使用或损害我们或第三方，我们可以暂停或终止账户、订单、API密钥、余额、积分、团队权限或服务访问。

在适用法律允许的最大范围内，与欺诈、滥用、政策违规、制裁风险、非法使用、滥用退款、未经授权向他人提供或严重安全事件相关的余额或积分可能会受到限制、冻结、取消、拒绝交付或不予退款。

您可以停止使用服务。帐户关闭不会影响付款义务、使用责任、争议处理、合规审查、赔偿义务或本协议中按其性质应继续适用的条款。

我们可能会修改、暂停或终止部分或全部服务、模型、功能、价格、文档或访问方法。除非适用法律或退款政策另有要求，否则我们不对因第三方型号变更、功能停止、价格变更、区域限制、费率限制或服务变更而导致的退款、损坏或赔偿负责。

## 14. 知识产权、反馈和保密

网站、仪表板、软件、API、文档、品牌、商标、设计、订单系统、计费系统、风险控制系统和相关技术归VOC AI或其许可方所有。除本协议项下使用服务的有限权利外，我们不向您转让任何知识产权。

如果您向我们提供建议、反馈、问题报告或改进想法，则您授予我们使用、复制、修改、发布和商业化该反馈的权利，而无需向您付费。

如果任何一方披露标记为机密的信息或根据其性质应合理理解为机密的信息，接收方必须合理谨慎地保护该信息，并仅在履行本协议或提供服务所必需的情况下使用该信息。允许法律、监管机构、法院、支付服务提供商、税务机关或争议处理机构要求的披露。

## 15. 免责声明和责任限制

服务按“原样”和“可用”提供。在适用法律允许的最大范围内，我们不保证服务不会中断、无错误、无漏洞、无损失或适合您的业务需求，也不保证任何模型、API、价格、信用、输出、延迟、速率限制、区域可用性、支付方式或第三方服务将保持可用。

在适用法律允许的最大范围内，VOC AI 不对间接、偶然、特殊、后果性、惩戒性或惩罚性损害、利润损失、收入损失、商誉损失、数据丢失、业务中断、替代采购成本、AI 输出、第三方服务行为、第三方支付行为或第三方平台行为承担责任。

在适用法律允许的最大范围内，VOC AI 因服务、订单、余额、交付、使用、退款或本协议而产生的总责任不会超过您在提出索赔前 3 个月内为相关服务实际支付且未退款的金额或 100 美元（以较高者为准）。此限制不适用于法律无法限制的责任。

## 16. 赔偿

在适用法律允许的最大范围内，您将赔偿 VOC AI 及其附属公司、服务提供商和第三方服务提供商，使其免受因您的账户活动、用户内容、API 密钥使用、集成、非法使用、违反本协议、违反第三方政策、未经授权向他人提供、侵权、侵犯隐私、税务信息错误、付款纠纷、退款或团队成员行为而产生的索赔、损失、责任、处罚、成本和费用。

## 17. 适用法律和争议解决

在不限制任何不可放弃的消费者保护、数据保护或强制性当地法律权利的情况下，本协议受美国加利福尼亚州法律管辖，不考虑法律冲突规则。

对于与本协议或服务相关的任何争议，双方将首先通过联系 support@flatkey.ai 善意地尝试解决争议。如果争议未能解决，除小额索赔事项或法律禁止仲裁的事项外，双方同意将争议提交加利福尼亚州，由有资格的仲裁机构根据其规则进行仲裁。您和 VOC AI 均放弃通过集体诉讼、代表诉讼或陪审团审判解决争议的权利，除非适用法律不允许此类放弃。

## 18. 本协议的变更

我们可能会不时更新本协议。重大变更可以通过网站、仪表板、电子邮件或其他合理方式通知。更新后的协议一般适用于新订单、新使用以及更新后继续使用服务。如果您不同意更新，您应停止使用服务，并按照适用政策处理未使用余额或账户关闭等事宜。

## 19. 联系方式

有关本协议、订单、账单、退款、合规性、通知或服务问题的问题，请联系 support@flatkey.ai 或写信至 VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, United States。


以上内容均以英文版本为准。`,
    privacy: `# flatkey.ai 隐私政策

最后更新时间：2026 年 6 月 4 日

本隐私政策解释了当您访问或使用 flatkey.ai、flatkey.ai 服务、相关网站、仪表板、API、结账页面、文档和支持渠道时，VOC AI INC（“VOC AI”、“我们”、“我们”或“我们的”）如何收集、使用、共享、保留和保护信息。

运营实体：VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, United States。联系方式：support@flatkey.ai。

## 1.范围

本政策适用于我们提供的账户注册、组织管理、购买、充值、交付、API 访问、模型路由、使用记录、计费、退款、支持、安全审查以及相关数字服务。第三方模型服务、支付服务提供商、钱包、银行、卡网络、云服务、分析工具或其他网站根据自己的隐私政策和条款处理信息。本政策不取代第三方政策。

## 2. 我们收集的信息

我们可能会收集您直接提供的信息，包括姓名、电子邮件地址、密码或身份验证信息、公司名称、角色、团队成员、帐单地址、业务信息、税号、增值税/商品及服务税信息、发票信息、订单信息、支持消息、退款请求、合规材料、仪表板设置以及与我们的通信。

当您使用服务时，我们可能会处理与服务交付和使用相关的信息，包括订单号、付款 ID、交付状态、余额、信用记录、API 密钥名称、请求 ID、时间戳、服务选择、模型选择、输入、输出、文件、图像、代码、提示、使用情况、扣除金额、价格、延迟、错误日志、路由信息和安全事件。

我们还可能自动收集技术信息，包括 IP 地址、设备标识符、浏览器类型、操作系统、网络推断位置、访问的页面、引用 URL、会话事件、登录记录、点击和操作、诊断日志、崩溃日志、性能数据、反欺诈信号和类似信息。

我们可能会从支付服务提供商、身份验证提供商、反欺诈提供商、支持工具、分析工具、企业客户、团队管理员或第三方服务提供商处收到与您的帐户、订单、付款、权限、使用、安全或支持事宜相关的信息。

## 3. 输入、输出和模型处理

您提交的输入和您收到的输出可能会根据需要通过我们的系统以提供服务，并可能会发送到相关模型服务或技术服务以完成请求。不同的模型和第三方服务可能有不同的数据处理、日志记录、培训、保留和安全规则。您应在使用特定模型之前查看适用的规则，并避免提交无权提交的信息或不必要的敏感信息。

除非仪表板、文档或订单描述明确提供相关功能，否则我们不承诺存储完整的输入或输出历史记录。出于故障排除、安全、计量、退款、争议或合规目的，我们可能会保留请求元数据、错误记录、使用记录、必要的日志以及您在支持通信中自愿提供的材料。

我们可能会使用聚合、匿名或去识别化的信息进行统计分析、容量规划、成本管理、模型和服务质量分析、产品改进、风险建模和业务运营。此类信息不会合理地识别特定个人。

## 4. Cookie 和类似技术

我们使用 Cookie、本地存储、像素、日志和类似技术来让您保持登录状态、保护会话、记住偏好、完成结帐、检测欺诈和滥用、衡量访问、监控性能、解决问题并改进服务。您可以通过浏览器设置控制某些 Cookie，但禁用 Cookie 可能会影响登录、仪表板、结账、安全、使用统计或支持功能。

## 5. 付款及订单信息

付款可能由 Paddle、Stripe、银行、卡网络、钱包、本地支付方式提供商、反欺诈提供商、税务提供商、发票提供商或其他必要的服务提供商处理。我们可能接收或存储付款 ID、结账 ID、订单号、付款状态、授权状态、结算状态、产品、金额、货币、税额、税率、税务管辖区、发票号码、收据号码、退款状态、退款或争议状态、帐单地址、国家/地区、企业名称、税号、帐单电子邮件以及支持处理所需的信息。

我们不会故意在我们自己的系统中存储完整的卡号、卡验证码、银行账户凭据或钱包凭据。支付方式数据由相关支付服务提供商根据其安全、隐私和支付网络合规性规则进行处理。我们可能会保留有限的支付元数据，例如支付提供商名称、支付方式类型、提供商提供的银行卡后四位数字、支付 ID、收据 URL、发票 URL、退款 ID 以及用于计费、税务、会计、支持、退款和争议处理的争议 ID。

## 6. 我们如何使用信息

我们使用信息来创建和验证帐户、处理订单和付款、提供服务积分、维护余额和使用记录、提供 API 访问、处理请求、计算使用量和费用、处理发票、收据、退款和争议、发送服务通知、响应支持请求、解决问题、检测和防止欺诈、滥用、安全事件和政策违规、执行用户协议和第三方规则、遵守税务、会计、审计、法律和合规义务，并保护 VOC AI、用户、用户的权利和安全。第三方服务提供商、支付服务提供商和公众。

如果您选择接收营销、产品更新或活动通知，我们可能会使用您的联系信息来发送这些通信。您可以使用电子邮件中的取消订阅方法或联系我们选择退出。服务通知、安全通知、计费通知和法律通知不受营销选择退出的影响。

## 7. 谨慎处理信息

我们根据业务需求和人员职责限制内部访问，并使用权限管理、日志记录、合理加密、监控、备份和审计流程来保护帐户、订单、付款、使用和支持信息。对于退款、退款、异常呼叫、安全事件或合规审查，我们可能会保留更详细的记录并进行额外的审查。

我们不会在支持通信中要求您提供完整的支付凭据、密码、明文 API 密钥或其他不必要的敏感凭据。如果故障排除需要屏幕截图或日志，您应该编辑不相关的敏感信息。如果材料包含不必要的敏感信息，我们可能会要求您提交经过编辑的版本。

我们尽合理努力将信息共享限制在与提供服务、处理付款、完成请求、解决问题、计算账单、处理退款、回应争议、满足法律要求或保护服务安全相关的内容。

## 8. 我们如何共享信息

我们可能与帮助我们运营服务的服务提供商共享信息，包括托管、数据库、缓存、网络、日志记录、监控、安全、身份验证、电子邮件、客户支持、分析、付款、税务、发票、收据、反欺诈、合规、审计和专业咨询提供商。

为了完成服务交付、API 请求、模型调用或技术处理，我们可能会向模型服务、API 平台、云提供商、网关提供商或其他第三方平台发送必要的用户内容、请求信息、帐户标识符、使用信息和元数据。第三方根据自己的条款、隐私政策、数据处理规则和使用政策处理相关信息。

我们还可能根据适用法律、传票、法院命令、政府要求、税务机关、支付网络规则、审计要求或监管要求的要求披露信息，或者为了调查欺诈、退款、支付纠纷、滥用、安全事件、政策违规、侵权、制裁风险，或者为了保护权利、财产、安全和服务完整性。

如果我们参与合并、收购、融资、重组、资产出售、破产或类似交易，信息可能会作为该交易的一部分被披露或转让。接收者应继续根据适用法律和本政策中体现的保护原则处理信息。

## 9. 保留

我们会根据需要保留信息，以提供服务、维护帐户和订单记录、提供服务积分、计算使用量和计费、处理退款和争议、遵守税务和会计义务、防止欺诈和滥用、支持安全、满足审计和合规要求以及保护权利。

帐户信息通常会在帐户关闭后保留一段合理的时间。根据法律或支付网络规则的要求，订单、税务、发票、会计和争议记录可能会保留更长时间。根据操作、安全和故障排除的需要保留安全日志、诊断日志和技术记录。

API 请求、错误和使用记录可能具有不同的保留期限，具体取决于功能、日志类型、安全需求和合规性要求。我们在提供服务、解决问题、计算账单、处理退款、回应争议、防止滥用和满足法律要求所需的范围内保留此类记录。

当不再需要信息时，我们会根据适用的法律和业务流程进行删除、匿名化或限制进一步处理。

## 10. 国际转账

VOC AI 位于美国。我们、我们的服务提供商、支付服务提供商和第三方服务提供商可能会在美国、欧洲、亚洲或其他国家和地区处理信息。这些地区的数据保护法可能与您所在地区的法律有所不同。我们将根据适用法律的要求采取适当的跨境传输保障措施。

## 11. 安全

我们使用访问控制、权限管理、日志、合理加密、监控、备份、审计和内部流程等管理、技术和组织措施来保护信息。任何系统都不能保证绝对安全。您还有责任保护您的帐户、密码、电子邮件、设备、API 密钥、访问凭证、支付帐户和相关服务凭证。

如果您认为您的帐户、API 密钥、支付方式或数据在未经授权的情况下被访问或使用，请立即联系我们。

## 12. 您的选择和权利

您可以在仪表板中更新一些帐户、账单和团队信息。根据您所在的位置和适用的法律，您可能有权请求访问、更正、删除、可移植、限制、反对、撤回同意、选择退出某些数据共享，或向监管机构投诉。

在处理请求之前，我们可能需要验证您的身份。在适用法律允许或要求的情况下，我们还可能保留某些信息，例如税务、会计、安全、风险控制、付款、争议、审计、合规或法律记录。

我们不会故意出售个人信息以获取金钱。如果适用法律将某些广告、分析或数据共享视为“销售”或“共享”，您可以联系我们以行使任何适用的选择退出权利。

## 13. 儿童隐私

服务不针对 13 岁以下的儿童，我们不会故意收集 13 岁以下儿童的个人信息。如果您认为儿童向我们提供了信息，请联系我们，以便我们进行审查并在适当的情况下删除该信息。

## 14. 政策更新

我们可能会不时更新本隐私政策。重大变更可以通过网站、仪表板、电子邮件或其他合理方式通知。更新后的政策适用于更新后的信息处理活动。

## 15. 联系方式

对于隐私问题、数据请求、安全报告或数据保护查询，请联系 support@flatkey.ai 或写信至 VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, United States。


以上内容均以英文版本为准。`,
    refund: `# flatkey.ai 退款政策

最后更新时间：2026 年 6 月 4 日

本退款政策适用于 VOC AI INC（“VOC AI”、“我们”或“我们的”）通过 flatkey.ai、结账页面、仪表板和支持渠道提供的 flatkey.ai 服务，包括账户充值、预付账户余额、服务积分、API 使用、数字服务交付和相关支持事宜。

运营实体：VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, United States。联系方式：support@flatkey.ai。

## 一、基本原则

flatkey.ai 提供数字服务。账户余额、服务积分和相关数字服务通常在成功付款或订单批准后立即以电子方式交付，并且可以立即用于 API 请求、模型调用、文件处理、图像处理、请求处理或其他付费功能。一旦交付和使用，可能会产生第三方模型、云服务、支付、税收、网络和基础设施成本。

我们的退款原则是：不发货、重复收费、可验证的系统错误、强制性法律要求优先审核；已交付和使用的积分、消耗的余额、已完成的请求以及成功提供的数字服务通常不可退款。

本政策不限制适用法律规定的任何不可放弃的消费者退款、取消、撤销、数字内容、数字服务或支付争议权利。

## 2. 未使用余额的退款窗口

未使用的帐户余额或服务积分可以在购买完成后 24 小时内提交以进行退款审核。24 小时后，未使用的余额通常不符合现金退款的条件，除非适用法律另有要求、支付服务提供商规则另有要求，或者我们确认重复收费、未送达、可验证的系统错误或税务或发票错误。

如果购买页面、订单描述、企业协议或适用法律规定了更长的退款期限，则将适用更具体的规则。促销、奖励、试用、优惠券、赠品、免费余额或免费积分通常不符合现金退款条件。

## 3. 我们可能审查的退款或调整

在以下情况下，您可以要求退款、恢复余额、信用纠正或账户调整：

- 同一个订单被多次扣款；
- 付款成功，但账户余额、服务积分或数字服务未交付；
- 付款失败、被撤销或被取消，但付款方式仍显示收费；
- 我们的可验证系统错误导致重复扣除、错误扣除、错误计量或错误信用交付；
- 您在购买后 24 小时内提出请求，并且相关余额或积分未被使用、转移、滥用或与可疑活动相关；
- 税费、发票、收据、货币、订单金额或付款方式处理需要更正；
- 适用法律、支付服务提供商规则、数字服务规则、​​税务规则或支付网络规则要求退款；
- VOC AI、Paddle、Stripe或其他原始订单支付服务提供商经审核后确定退款或调整是适当的。

审批和处理方式取决于订单状态、交付记录、使用记录、付款状态、税务和发票要求、风险审查结果、支付服务提供商规则和适用法律。

## 4. 审核流程

我们使用订单记录、支付服务提供商记录、交付记录、余额记录、使用日志、请求 ID、错误记录、支持通信、税务记录和发票记录来审核退款或调整请求。对于使用争议，我们重点关注请求是否实际发生、余额是否被扣除、是否重复扣除、系统是否出现错误，以及相关请求是否来自您的账户、API key、团队成员、应用程序或集成。

在审核过程中，我们可能会要求您提供帐户电子邮件、订单号、付款 ID、收据、发票、请求 ID、时间戳、屏幕截图、错误消息或其他合理必要的信息。无法验证订单、帐户所有权、交付状态、使用状态或付款状态的请求可能不会被批准。

如果我们发现相关订单或使用行为涉及未经授权的转售、转发、账户共享、隐藏真实用户、批量创建账户、异常集中调用、欺诈、滥用、制裁风险、滥用退款或限制规避等行为，我们可能会根据《用户协议》暂停审核、拒绝退款、限制余额恢复或采取账户限制措施。

如果同一订单进入退款、付款争议、付款逆转或支付服务提供商调查流程，我们一般会通过相关支付服务提供商或卡网络流程进行处理，不会同时单独发放独立现金退款，以避免重复退款或会计冲突。争议处理结束后，如果账户余额或账单仍需更正，我们将根据最终结果和系统记录进行处理。

## 5. 一般情况下不可退款的商品

除非适用法律另有规定，否则以下费用通常不予退款：

- 用于 API 请求、模型调用、文件处理、图像处理、缓存使用、请求处理或其他付费功能的余额或服务积分；
- 已成功交付并启动的数字服务；
- 由帐户、团队成员、API 密钥、自动化脚本、集成、泄露密钥、权限设置、内部人员或授权用户产生的费用；
- 第三方模型成本、​​云服务成本、最低收费、超额使用、税费、货币兑换差异、银行费用、卡网络费用、网络费用、支付服务提供商费用或第三方平台费用；
- 促销、奖励、试用、优惠券、赠品、免费余额或免费积分；
- 与欺诈、滥用、制裁风险、非法使用、违反政策、账户共享、未经授权转售、转发、向他人提供、退款滥用或限制规避相关的订单、余额或服务积分；
- 基于对 AI 输出质量、模型行为、服务可用性、延迟、速率限制、价格变化、区域限制或第三方政策变化（其中服务按描述交付或使用相关积分）不满意的请求；
- 由于您提供的帐户、电子邮件、账单、税务、业务、发票或付款信息不准确而导致的问题，除非适用法律或付款服务提供商规则要求更正或退款。

## 6. 数字内容和消费者权利

对于立即交付并可用的数字内容或数字服务，在适用法律允许的范围内，一旦帐户余额、服务积分或相关服务交付或一旦您开始使用相关服务，您可能会失去法定取消或撤回权利。

如果您的所在地提供不可放弃的消费者保护、退款、撤销、取消或争议权利，我们将根据适用法律处理请求，即使本政策的其他部分另有规定。

## 7. 如何申请退款

联系 support@flatkey.ai 并提供尽可能多的以下信息：

- 帐户电子邮件；
- 订单号、付款 ID、Paddle 收据号、Stripe 收据号、付款参考号或发票号；
- 购买日期、金额、货币和付款方式类型；
- 退款或调整请求的原因；
- 相关屏幕截图、错误消息、交付状态、余额记录或仪表板记录；
- 对于使用问题、API 密钥名称、请求 ID、时间戳、模型或服务名称。

重复收费、未发货、扣除错误、发票错误、税务问题或付款异常情况应尽快提交。我们可能会要求提供其他信息来验证帐户所有权、购买记录、交付状态、使用状态、付款状态、税务信息和退款资格。

## 八、退款方式及处理时间

批准的现金退款通常会返回到原来的付款方式。处理时间取决于 Paddle、Stripe、银行、卡网络、钱包、本地支付方式提供商和其他相关服务提供商。我们无法保证第三方何时完成发布。

在某些情况下，我们可能会通过余额恢复、信用更正、帐户调整、贷项通知单、发票更正或收据更新来解决问题，特别是当问题涉及交货失败、计量不正确、重复扣除或帐户记录错误时。

税费、发票、贷方票据、收据、货币兑换和支付方式限制可由原始订单支付服务提供商处理。如果订单进入退款、争议、风险控制、税务审查或支付服务提供商限制状态，退款可能需要更长时间或必须遵循相关流程。

## 9. Paddle、Stripe 和其他支付服务提供商

如果订单由 Paddle 作为记录商户或卖家处理，Paddle 可以根据其流程确定或执行退款、税款、发票、贷方票据、收据和付款争议事宜。

如果订单由 Stripe 或其他支付处理商处理，VOC AI 可能会审核退款请求，并在可行的情况下指示处理商将批准的退款退回到原始支付方式。处理规则和时间可能因支付服务提供商、国家/地区、货币、支付方式和银行而异。

## 10. 退款和付款争议

如果您发起退款、付款争议、付款撤销或类似流程，我们可能会在调查期间暂停相关账户、API 密钥、余额、服务积分、订单或服务访问权限。

我们可能会向 Paddle、Stripe、银行、卡网络、钱包、支付网络、税务服务提供商或争议处理机构提供订单记录、交付记录、使用日志、余额记录、税务记录、发票、收据、退款记录、支持通信、账户活动和安全记录，以调查和应对争议。

对于重复收费、未送货、扣除不正确、税务问题、发票、收据和账单问题，请先联系我们。直接发起退款可能会导致帐户暂停、退款延迟、争议费用或未来的购买限制。

如果您已经联系银行、卡网络、钱包提供商或支付服务提供商发起争议，请在退款通信中告诉我们争议状态和参考号。隐藏正在进行的争议、同时请求重复退款或收到退款后继续退款可能会被视为滥用退款。

## 11. 政策更新

我们可能会不时更新本退款政策。更新后的政策一般适用于更新后发生的购买、交付、使用和退款请求，除非适用法律或支付服务提供商规则另有要求。

## 12. 联系方式

有关购买、交付、帐户余额、服务积分、重复收费、错误扣除、税款、发票、收据、退款资格、Paddle 收据、Stripe 收据或付款争议的问题，请联系 support@flatkey.ai 或写信至 VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, United States。

以上内容均以英文版本为准。`,
    sla: `# flatkey.ai 服务等级协议

最后更新时间：2026 年 6 月 13 日

本服务等级协议（“SLA”）说明 VOC AI INC（“VOC AI”、“我们”或“我们的”）提供的 flatkey.ai 服务的可用性目标和支持流程。

## 1. 范围

本 SLA 适用于我们直接运营的 flatkey.ai 托管仪表板、API 网关、路由、计量和账户服务。它不适用于第三方 AI 模型提供商、支付提供商、客户网络、客户应用、测试功能、不可抗力事件、计划维护、滥用缓解、账户暂停，或由客户配置、凭据、集成或政策违规导致的问题。

## 2. 可用性目标

我们针对覆盖的 flatkey.ai 服务端点设定 99.5% 的月度可用性目标。可用性由我们的生产监控系统基于覆盖服务进行测量。

## 3. 维护和服务变更

我们可能会执行计划维护或紧急维护，以提升安全性、可靠性、性能或合规性。我们会合理努力降低客户影响，并在可行时通过仪表板、网站、电子邮件或支持渠道提供通知。

## 4. 第三方依赖

flatkey.ai 会将请求路由至第三方模型提供商，并依赖云、网络、支付、安全和分析服务提供商。第三方故障、限流、政策变化、区域限制、模型行为或提供商侧失败不属于本 SLA 范围。

## 5. 支持

如遇服务可用性问题，请联系 support@flatkey.ai，并提供账户邮箱、受影响端点、可用的请求 ID、时间戳、错误消息和影响摘要。我们会根据严重程度、可用记录和运营风险审查支持请求。

## 6. 补救

除非单独书面协议另有约定，本 SLA 不产生自动服务积分、退款、罚金或约定赔偿。任何善意调整、余额更正或支持补救均根据用户协议和适用政策逐案处理。

## 7. 更新

我们可能会不时更新本 SLA。更新后的 SLA 通常适用于更新后的服务期间。

## 8. 联系方式

如对本 SLA 或服务事件有疑问，请联系 support@flatkey.ai 或写信至 VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, United States。

以上内容均以英文版本为准。`,
  },
  fr: {
    terms: `# Contrat d'utilisation de flatkey.ai

Dernière mise à jour : 4 juin 2026

Le présent Contrat d'utilisation (« Contrat ») s'applique aux services flatkey.ai fournis par VOC AI INC (« VOC AI », « nous », « notre » ou « notre ») via flatkey.ai, le tableau de bord, les API, les pages de paiement, la documentation et les canaux d'assistance (les « Services »).En enregistrant un compte, en créant une organisation, en ajoutant le solde d'un compte prépayé, en générant ou en utilisant une clé API, en appelant des API de modèle, en accédant au tableau de bord ou en utilisant les Services, vous acceptez le présent Accord, notre Politique de confidentialité, notre Politique de remboursement, la documentation, les pages de tarification et toute règle supplémentaire applicable.

Entité opérationnelle : VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, États-Unis.Contact : support@flatkey.ai.

## 1. Aperçu des services

flatkey.ai est un service d'accès à l'API IA, de routage de modèles, de mesure d'utilisation, de tableau de bord et de solde de compte prépayé.Les utilisateurs peuvent accéder à différentes fonctionnalités du modèle d'IA via une API et un tableau de bord unifiés, gérer les clés API, les autorisations des équipes, la sélection du modèle, les enregistrements de demandes, les soldes, les crédits, la facturation et les questions d'assistance.

flatkey.ai n'est pas le modèle lui-même.Nous ne garantissons pas qu'un modèle, une API, un prix, une fenêtre de contexte, une limite de débit, une disponibilité régionale, un comportement de sortie, une règle de traitement des données ou une politique de tiers particuliers resteront disponibles ou inchangés.Nous pouvons ajouter, supprimer, restreindre ou modifier des modèles, des fonctionnalités, des prix et des règles d'utilisation en fonction des besoins du produit, des changements de coûts, des exigences de sécurité, des obligations de conformité, des exigences du fournisseur de modèles ou des modifications apportées aux services tiers.

## 2. Éligibilité, comptes et organisations

Vous devez avoir au moins 13 ans.Si vous avez moins de 18 ans, vous devez avoir l'autorisation de votre parent ou tuteur légal.Si vous utilisez les Services au nom d'une entreprise, d'une organisation ou d'une autre entité, vous déclarez que vous avez le pouvoir d'accepter le présent Contrat au nom de cette entité.

Vous devez fournir des informations véridiques, exactes, complètes et courantes sur votre compte, votre entreprise, votre facturation, vos taxes et vos coordonnées.Vous êtes responsable des administrateurs, des membres, des applications, des clés API, des informations d'identification d'accès, des demandes, des intégrations, des méthodes de paiement et de l'utilisation du solde de votre compte.

Les administrateurs de l'organisation peuvent inviter des membres de l'équipe et configurer les autorisations, les budgets, les modèles, les journaux, les clés et les paramètres de sécurité.Les configurations d'administrateur peuvent affecter les membres de l'organisation et les utilisateurs finaux de votre application.Vous devez vous assurer que les membres de votre équipe et les utilisateurs finaux respectent le présent Contrat, notre documentation et les conditions applicables du fournisseur de modèles.

Si vous pensez que votre compte, votre clé API, vos identifiants d'accès, votre mode de paiement ou votre accès au tableau de bord ont été utilisés sans autorisation, vous devez nous contacter rapidement et prendre les mesures appropriées pour révoquer, alterner, désactiver ou restreindre l'accès.

## 3. Solde prépayé, frais et livraison numérique

Les Services peuvent vous demander d'acheter le solde d'un compte prépayé ou des crédits de service avant d'appeler des API ou d'utiliser certaines fonctionnalités.Avant l'achat, vous aurez la possibilité de consulter le montant de la commande, la devise, les taxes, les frais, le mode de paiement et les règles de tarification indiquées sur la page applicable.

Le solde du compte et les crédits de service ne peuvent être utilisés que pour les services flatkey.ai éligibles.Il ne s’agit pas d’espèces, de dépôts, de monnaie électronique, de cartes cadeaux, d’instruments de paiement, de comptes retirables ou de produits financiers.Sauf accord exprès écrit de notre part ou si la loi applicable l’exige autrement, le solde du compte et les crédits de service ne peuvent pas être retirés, échangés contre de l’argent, cédés, utilisés comme garantie, investis ou utilisés en dehors des Services.

Une fois le paiement ou l'approbation de la commande réussi, le solde ou les crédits achetés sont généralement envoyés électroniquement sur votre compte et peuvent être utilisés immédiatement pour les demandes d'API, les appels de modèles ou d'autres fonctionnalités payantes.Lorsque vous effectuez une demande, le système déduit le solde en fonction du prix du modèle alors en vigueur, de l'utilisation des entrées, de l'utilisation des sorties, des accès au cache, des demandes, des fichiers, des images, des taxes, des frais, de la conversion de devises et de toute autre règle de facturation affichée sur la page ou le flux de paiement concerné.

La période d'expiration du solde ou des crédits est déterminée par la page d'achat, la description de la commande, l'affichage du tableau de bord ou la confirmation écrite de notre part.Nous pouvons restreindre, geler, annuler ou traiter, en vertu de la politique de remboursement, tout solde ou crédit associé à des comptes inactifs depuis longtemps, des comptes suspendus, des comptes fermés, une activité frauduleuse ou des violations de la politique.

## 4. Paiements, taxes et factures

Vous autorisez VOC AI et nos prestataires de services de paiement à facturer le mode de paiement sélectionné pour les montants des commandes, les taxes, les frais et autres frais applicables.Les paiements peuvent être traités par Paddle, Stripe, des banques, des réseaux de cartes, des portefeuilles, des fournisseurs de méthodes de paiement locaux, des fournisseurs de lutte contre la fraude, des prestataires fiscaux, des fournisseurs de factures ou d'autres prestataires de services nécessaires.

En fonction du mode de paiement utilisé, la partie responsable de l'encaissement, de la facturation, du calcul des taxes, de l'exécution du remboursement et du traitement des litiges peut varier.Si Paddle traite une commande en tant que marchand officiel ou vendeur, Paddle peut être responsable de la collecte des paiements, des taxes, des factures, des reçus, des remboursements et des workflows de litige de paiement.Si Stripe ou un autre fournisseur agit uniquement en tant que processeur de paiement, VOC AI peut rester le vendeur et le processeur peut gérer les activités liées au paiement en notre nom.

Vous devez fournir une adresse de facturation exacte, le nom de l'entreprise, un numéro d'identification fiscale, des informations TVA/TPS, une adresse e-mail et des informations de facturation.Vous êtes responsable des taxes, des problèmes de facture, des problèmes de reçus, des échecs de paiement, des retards de remboursement, des contrôles de conformité ou des coûts supplémentaires causés par des informations inexactes, incomplètes ou obsolètes.

## 5. Conditions et restrictions du fournisseur modèle

Les Services peuvent vous permettre, à vous, aux membres de votre équipe, à vos applications ou à vos utilisateurs finaux, d'accéder à des modèles, des API, des outils ou des fonctionnalités fournis par des fournisseurs de modèles tiers ou des prestataires de services techniques.Vous comprenez et acceptez que l'utilisation de tout modèle ou service tiers peut également être soumise aux conditions, politiques, restrictions régionales, règles de sécurité, règles de traitement des données et limitations d'utilisation de ce modèle ou service tiers.

Vous êtes responsable de confirmer, avant d'utiliser un modèle particulier, que le modèle et ses règles sont adaptés à votre cas d'utilisation, y compris l'utilisation commerciale, l'utilisation destinée aux clients, les données sensibles, les secteurs réglementés, les décisions à haut risque, l'accès régional, les mineurs, la sécurité du contenu et la publication des résultats.Vous devez également vous assurer que les membres de votre équipe et les utilisateurs finaux utilisent les modèles pertinents conformément au présent Contrat, à notre documentation et aux règles tierces applicables.

Certains modèles ou fonctionnalités peuvent ne pas permettre l'accès à certaines régions, secteurs, entités, objectifs ou types de demandes.Vous ne pouvez pas utiliser de VPN, de proxys, de comptes multiples, de fausses informations, de solutions techniques ou d'autres méthodes pour contourner les restrictions de modèle, régionales, d'identité, de sécurité ou de conformité.Nous pouvons suspendre, restreindre, fermer ou supprimer votre accès aux modèles, comptes, clés API, soldes ou fonctionnalités pertinents si nous recevons une demande d'un tiers, détectons un risque ou pensons raisonnablement que les règles ont été violées.

Nous ne modifions pas, ne renonçons pas et ne remplaçons pas les conditions des fournisseurs de modèles tiers.Les fournisseurs de modèles peuvent modifier leurs conditions, leurs prix, leurs fonctionnalités, leur disponibilité, leurs méthodes de traitement des données ou leurs restrictions d'accès à tout moment.Votre utilisation continue d’un modèle signifie que vous acceptez les règles alors en vigueur.

## 6. Responsabilité de configuration

Vous êtes responsable de la sélection des modèles, de la configuration des comptes, de la définition des autorisations des équipes, de la gestion des clés API, de la configuration des budgets et des limites de taux, du contrôle des sources de demandes, de l'examen des entrées et des sorties et de la détermination si les services sont adaptés à votre scénario commercial.

Si vous intégrez flatkey.ai dans votre propre produit ou service, vous devez conserver le contrôle de votre application, de l'accès des utilisateurs finaux, des autorisations de compte, des clés API, du solde, des crédits, des sources de demandes, des journaux, de la gestion des abus et du support client.Vous ne pouvez pas autoriser les utilisateurs finaux à obtenir, contrôler, revendre, diviser, utiliser en masse ou contourner directement votre application pour utiliser les comptes flatkey.ai, les clés API, le solde ou les crédits.

Vous êtes responsable des membres de votre équipe, des applications, des intégrations, des utilisateurs finaux, des scripts automatisés, des paramètres d'autorisation et de la gestion des clés.L'utilisation, les frais, les litiges ou les pertes causés par votre configuration, une fuite de clé, le comportement de l'utilisateur final, les paramètres d'autorisation, des erreurs de script ou des problèmes de gestion interne relèvent de votre responsabilité, sauf s'ils sont directement causés par notre erreur système vérifiable.

## 7. Contenu utilisateur et sortie IA

Les invites, textes, fichiers, images, codes, données, configurations, demandes et autres contenus que vous soumettez aux Services sont des « Entrées ».Les réponses de modèle, le contenu généré ou d'autres résultats renvoyés par les Services sont des « Sorties ».Les entrées et les sorties sont collectivement du « contenu utilisateur ».

Vous conservez les droits que vous détenez légalement sur vos Entrées.Pour fournir, acheminer, mesurer, dépanner, prendre en charge, sécuriser, auditer, examiner les remboursements et améliorer les Services, vous nous accordez une licence non exclusive, mondiale et libre de droits pour traiter, transmettre, stocker, copier, afficher et utiliser le Contenu utilisateur et les métadonnées associées si nécessaire.

Vous déclarez que vous disposez de tous les droits, autorisations et consentements requis pour soumettre, traiter et transmettre les entrées.Vous ne pouvez pas soumettre de contenu qui viole les droits de propriété intellectuelle, les droits à la vie privée, les obligations de confidentialité, les obligations contractuelles ou la loi applicable.

Les sorties AI peuvent être inexactes, incomplètes, obsolètes, répétitives, biaisées, dangereuses, inadaptées à un objectif particulier ou similaires au contenu de tiers.Vous devez examiner et vérifier de manière indépendante les résultats avant de vous y fier, de les publier, de les utiliser commercialement, de les déployer en production ou de les utiliser à des fins juridiques, médicales, financières, d'emploi, de crédit, de sécurité, de conformité ou d'autres décisions importantes.Nous ne garantissons pas l’exactitude, le caractère unique, l’adéquation, la disponibilité ou la non-contrefaçon d’une quelconque sortie.

À moins que le tableau de bord, la documentation ou la description de la commande ne fournisse expressément une fonctionnalité pertinente, nous ne promettons pas de stocker l'historique complet des entrées ou des sorties.À des fins de dépannage, de sécurité, de mesure, de remboursement, de litige ou de conformité, nous pouvons conserver les métadonnées des demandes, les enregistrements d'erreurs, les enregistrements d'utilisation et les journaux nécessaires.

## 8. Pas de revente, de relais ou d'utilisation concurrentielle

Les comptes flatkey.ai, les clés API, le solde du compte, les crédits de service, la capacité d'accès au modèle et la capacité de tableau de bord sont destinés à être utilisés par vous et votre équipe autorisée dans votre propre entreprise ou application.Sauf si nous concluons un accord écrit distinct, vous ne pouvez pas fournir flatkey.ai à des tiers en tant qu'API autonome, solde, crédit, sous-compte, service de recharge, service de relais, service renommé, service d'agrégation ou service similaire, que ce soit par vente, transfert, distribution, location, partage ou autre accord indirect.

Vous ne pouvez pas accéder ou utiliser les Services dans le but de revendre l'accès à l'API, de créer un service concurrent, de contourner les règles des modèles tiers, de masquer le véritable utilisateur final, d'éviter les prix ou les limites, de contourner les restrictions régionales, de contourner l'examen de sécurité ou de contourner l'examen des paiements.

La revente non autorisée, le relais, le partage de compte, le masquage du véritable utilisateur, la création groupée de comptes, les appels concentrés anormaux, le contournement des limites ou l'évasion du contrôle des risques constituent une violation substantielle.Nous pouvons suspendre ou résilier les comptes, les clés API, le solde, les crédits et les commandes associés, et pouvons refuser ou limiter les remboursements, la restauration du solde ou les ajustements de crédit associés.

## 9. Conduite interdite

Vous ne pouvez pas :

- utiliser les Services à des fins illégales, frauduleuses, de contrefaçon, de harcèlement, de spam, de logiciels malveillants, de phishing, d'attaque de système, d'évasion réglementaire, d'invasion de la vie privée, de grattage de données sensibles, d'évasion de sanctions, de violation du contrôle des exportations ou de toute autre activité nuisible ;
- créer de fausses identités, usurper l'identité d'autrui, déformer les affiliations ou utiliser plusieurs comptes pour éviter les limites, les contrôles de risque, les prix, les remboursements ou les contrôles de conformité ;
- contourner ou interférer avec les limites de compte, les limites régionales, les règles de facturation, les limites de crédit, les limites de taux, les mécanismes de sécurité, les règles anti-abus, les restrictions de services tiers ou les processus de révision des paiements ;
- faire de l'ingénierie inverse, analyser, attaquer, tester sous contrainte, perturber, explorer, copier, gratter ou accéder sans autorisation aux services, API, systèmes, données ou comptes d'autres utilisateurs ;
- effectuer des tests contradictoires, des injections rapides, des tests de jailbreak, des tests de contournement de sécurité, des tests de résistance ou d'autres tests susceptibles de nuire aux modèles, aux Services, aux règles de tiers ou aux intérêts des utilisateurs sans notre approbation écrite ;
- soumettre ou distribuer du contenu contrefait, illégal, malveillant, frauduleux, trompeur, harcelant, sexuel, violent, haineux, portant atteinte à la vie privée, restreint ou violant la politique d'un tiers ;
- aider, encourager ou permettre à un tiers de faire l’une des choses ci-dessus.

## 10. Enregistrements de comptage, de livraison et d'examen

Nous conservons des enregistrements de commande, de paiement, de livraison, de solde, de crédit, de demande, de déduction, d'erreur, de remboursement, de rétrofacturation, de litige et de sécurité pour vérifier si la livraison a été effectuée, si une utilisation a eu lieu, si le solde a été correctement déduit, si une demande de remboursement est valide et si un compte montre une utilisation anormale.

Nous déployons des efforts raisonnables pour maintenir l'exactitude des enregistrements de comptage et de facturation, mais les systèmes complexes peuvent connaître des retards, des erreurs, des enregistrements en double ou des différences d'affichage.Si une erreur système vérifiable se produit, nous pouvons y remédier par le rétablissement du solde, la correction du crédit, l'ajustement de la facturation ou le remboursement.Les captures d'écran des utilisateurs, les enregistrements de tiers ou les journaux locaux peuvent être considérés comme des documents de support, mais l'examen final prendra en compte les enregistrements de notre système, les enregistrements de nos prestataires de services de paiement et les enregistrements de services tiers nécessaires.

Pour protéger la stabilité du service et les autres utilisateurs, nous pouvons surveiller les demandes anormales, les déductions anormales, les connexions anormales, les paiements anormaux, les appels groupés, les fuites de clés, les demandes malveillantes, les abus de rétrofacturation et les modèles d'utilisation qui violent le présent Accord, et nous pouvons temporairement restreindre les fonctionnalités associées au cours d'une enquête.

Nous pouvons procéder à un examen manuel ou automatisé des commandes à haut risque, des recharges importantes, une fréquence de recharge anormale, des informations de facturation incohérentes, des régions de connexion anormales, des sources de requêtes anormales, une simultanéité élevée sur de courtes périodes ou des alertes de prestataires de services de paiement.Pendant l'examen, la livraison, l'utilisation du solde, les remboursements, les factures ou les fonctionnalités du compte peuvent être retardés ou restreints.Après examen, nous restaurerons ou traiterons les questions pertinentes conformément aux dossiers applicables.

## 11. Remboursements

Les remboursements, le rétablissement du solde, les corrections de crédit et les ajustements de support sont traités dans le cadre de notre politique de remboursement flatkey.ai.En général, les crédits livrés et utilisés, le solde consommé, les demandes complétées et les services numériques fournis avec succès ne sont pas remboursables.

Les frais en double, la non-livraison, les erreurs système vérifiables, le solde inutilisé, les erreurs fiscales ou de facture, les litiges de paiement, les droits obligatoires des consommateurs ou les exigences du fournisseur de services de paiement seront examinés en fonction des enregistrements de commande, des enregistrements de livraison, des enregistrements d'utilisation, de l'état du paiement et des règles applicables.

## 12. Services tiers

Les Services peuvent s'appuyer sur des modèles, API, plateformes, services cloud, services de paiement, services fiscaux, services de facturation, hébergement, bases de données, courrier électronique, analyses, sécurité et outils d'assistance tiers.Les tiers fournissent des services et traitent les données selon leurs propres conditions, politiques et règles techniques.

Les services tiers peuvent être suspendus, limités, rejetés, interrompus, retarifiés, modifiés, restreints par région ou soumis à des méthodes de traitement des données modifiées.Nous ferons des efforts raisonnables pour maintenir les Services, mais nous ne garantissons pas la disponibilité continue de tout service tiers et ne sommes pas responsables au-delà du présent Accord des défaillances de tiers, des changements de politique, des problèmes de réseau, des restrictions régionales, du comportement du modèle, de la qualité de sortie ou des changements de coûts de tiers.

## 13. Suspension, résiliation et modifications du service

Si nous pensons que vous avez violé le présent Accord ou des politiques de tiers, utilisé les Services illégalement, commis une fraude, créé un risque de sanctions, causé un risque de paiement, abusé des rétrofacturations, créé un risque de sécurité, fourni les Services à des tiers sans autorisation, généré une utilisation anormale ou nous avoir causé un préjudice ou avoir causé un préjudice à des tiers, nous pouvons suspendre ou résilier des comptes, des commandes, des clés API, des soldes, des crédits, des autorisations d'équipe ou l'accès aux services.

Dans toute la mesure permise par la loi applicable, le solde ou les crédits associés à une fraude, un abus, une violation de la politique, un risque de sanctions, une utilisation illégale, un abus de rétrofacturation, une fourniture non autorisée à des tiers ou des incidents de sécurité graves peuvent être restreints, gelés, annulés, livraison refusée ou non remboursés.

Vous pouvez cesser d'utiliser les Services.La fermeture du compte n'affecte pas les obligations de paiement, la responsabilité d'utilisation, le traitement des litiges, la vérification de la conformité, les obligations d'indemnisation ou les dispositions du présent Accord qui, de par leur nature, devraient continuer à s'appliquer.

Nous pouvons modifier, suspendre ou interrompre tout ou partie des services, modèles, fonctionnalités, prix, documentation ou méthodes d'accès.Sauf si la loi applicable ou la politique de remboursement l'exige autrement, nous ne sommes pas responsables des remboursements, dommages ou compensations dus à des modifications de modèles tiers, à l'arrêt de fonctionnalités, à des modifications de prix, à des restrictions régionales, à des limites de tarifs ou à des modifications de service.

## 14. Propriété intellectuelle, commentaires et confidentialité

Le site Web, le tableau de bord, les logiciels, les API, la documentation, les marques, les conceptions, les systèmes de commande, les systèmes de facturation, les systèmes de contrôle des risques et la technologie associée sont la propriété de VOC AI ou de ses concédants de licence.À l'exception du droit limité d'utiliser les services en vertu du présent accord, nous ne vous transférons aucun droit de propriété intellectuelle.

Si vous nous fournissez des suggestions, des commentaires, des rapports ou des idées d'amélioration, vous nous accordez le droit d'utiliser, de copier, de modifier, de publier et de commercialiser ces commentaires sans paiement de votre part.

Si l'une des parties divulgue des informations marquées comme confidentielles ou qui devraient raisonnablement être considérées comme confidentielles de par leur nature, la partie destinataire doit les protéger avec un soin raisonnable et les utiliser uniquement dans la mesure nécessaire à l'exécution du présent Contrat ou à la fourniture des Services.La divulgation requise par la loi, les régulateurs, les tribunaux, les prestataires de services de paiement, les autorités fiscales ou les organismes de traitement des litiges est autorisée.

## 15. Avis de non-responsabilité et limitation de responsabilité

Les Services sont fournis « tels quels » et « selon leur disponibilité ».Dans toute la mesure permise par la loi applicable, nous ne garantissons pas que les Services seront ininterrompus, sans erreur, sans vulnérabilité, sans perte ou adaptés aux besoins de votre entreprise, ni que tout modèle, API, prix, crédit, sortie, latence, limite de débit, disponibilité régionale, mode de paiement ou service tiers restera disponible.

Dans toute la mesure permise par la loi applicable, VOC AI n'est pas responsable des dommages indirects, accessoires, spéciaux, consécutifs, exemplaires ou punitifs, de la perte de bénéfices, de la perte de revenus, de la perte de clientèle, de la perte de données, de l'interruption des activités, des coûts d'approvisionnement de remplacement, des sorties d'IA, de la conduite de services tiers, de conduite de paiement de tiers ou de conduite de plateforme tierce.

Dans toute la mesure permise par la loi applicable, la responsabilité totale de VOC AI découlant des Services, des commandes, du solde, de la livraison, de l'utilisation, des remboursements ou du présent Contrat ne dépassera pas le montant le plus élevé entre le montant que vous avez réellement payé pour les Services concernés au cours des 3 mois précédant la réclamation et non remboursé, ou 100 USD. Cette limitation ne s'applique pas à la responsabilité qui ne peut être limitée par la loi.

## 16. Indemnisation

Dans toute la mesure permise par la loi applicable, vous indemniserez et dégagerez VOC AI, ses sociétés affiliées, ses prestataires de services et ses prestataires de services tiers des réclamations, pertes, responsabilités, pénalités, coûts et dépenses découlant de l'activité de votre compte, du contenu utilisateur, de l'utilisation de la clé API, des intégrations, de l'utilisation illégale, de la violation du présent accord, de la violation des politiques de tiers, de la fourniture non autorisée à des tiers, de la violation, des violations de la vie privée, des erreurs d'informations fiscales, des litiges de paiement, des rétrofacturations ou de la conduite des membres de l'équipe.

## 17. Loi applicable et règlement des litiges

Sans limiter la protection des consommateurs, la protection des données ou les droits obligatoires des lois locales, le présent accord est régi par les lois de l'État de Californie, aux États-Unis, sans égard aux règles de conflit de lois.

Pour tout litige relatif au présent Contrat ou aux Services, les parties tenteront d'abord de bonne foi de résoudre le litige en contactant support@flatkey.ai.Si le différend n'est pas résolu, à l'exception des questions de petites créances ou des questions pour lesquelles l'arbitrage est interdit par la loi, les parties conviennent de soumettre le différend à l'arbitrage en Californie devant un prestataire d'arbitrage compétent selon ses règles.Vous et VOC AI renoncez chacun au droit de résoudre les litiges par le biais de recours collectifs, d'actions représentatives ou de procès devant jury, à moins que la loi applicable ne permette une telle renonciation.

## 18. Modifications apportées au présent accord

Nous pouvons mettre à jour cet accord de temps à autre.Les modifications importantes peuvent être notifiées via le site Web, le tableau de bord, le courrier électronique ou tout autre moyen raisonnable.L'accord mis à jour s'applique généralement aux nouvelles commandes, aux nouvelles utilisations et à l'utilisation continue des services après la mise à jour.Si vous n'acceptez pas la mise à jour, vous devez cesser d'utiliser les services et gérer le solde inutilisé ou la fermeture du compte conformément aux politiques applicables.

## 19. Contacter

Pour toute question concernant le présent Contrat, les commandes, la facturation, les remboursements, la conformité, les avis ou les problèmes de service, contactez support@flatkey.ai ou écrivez à VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, États-Unis.


Tous les contenus ci-dessus sont soumis à la version anglaise.`,
    privacy: `# Politique de confidentialité de flatkey.ai

Dernière mise à jour : 4 juin 2026

Cette politique de confidentialité explique comment VOC AI INC (« VOC AI », « nous », « notre » ou « notre ») collecte, utilise, partage, conserve et protège les informations lorsque vous accédez ou utilisez flatkey.ai, les services flatkey.ai, les sites Web, tableaux de bord, API, pages de paiement, documentation et canaux d'assistance associés.

Entité opérationnelle : VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, États-Unis.Contact : support@flatkey.ai.

## 1. Portée

Cette politique s'applique à l'enregistrement du compte, à la gestion de l'organisation, aux achats, aux recharges, à la livraison, à l'accès aux API, au routage des modèles, aux enregistrements d'utilisation, à la facturation, aux remboursements, à l'assistance, à l'examen de sécurité et aux services numériques associés que nous fournissons.Les services modèles tiers, les prestataires de services de paiement, les portefeuilles, les banques, les réseaux de cartes, les services cloud, les outils d'analyse ou d'autres sites Web traitent les informations selon leurs propres politiques et conditions de confidentialité.Cette politique ne remplace pas les politiques de tiers.

## 2. Informations que nous collectons

Nous pouvons collecter les informations que vous fournissez directement, notamment votre nom, votre adresse e-mail, votre mot de passe ou vos informations d'authentification, le nom de l'entreprise, votre rôle, les membres de l'équipe, l'adresse de facturation, les informations professionnelles, le numéro d'identification fiscale, les informations sur la TVA/TPS, les informations sur la facture, les informations sur la commande, les messages d'assistance, les demandes de remboursement, les documents de conformité, les paramètres du tableau de bord et les communications avec nous.

Lorsque vous utilisez les Services, nous pouvons traiter des informations relatives à la prestation et à l'utilisation du service, notamment le numéro de commande, l'ID de paiement, l'état de livraison, le solde, les dossiers de crédit, le nom de la clé API, l'ID de demande, l'horodatage, la sélection du service, la sélection du modèle, les entrées, les sorties, les fichiers, les images, le code, les invites, l'utilisation, le montant de la déduction, le prix, la latence, les journaux d'erreurs, les informations de routage et les événements de sécurité.

Nous pouvons également collecter automatiquement des informations techniques, notamment l'adresse IP, les identifiants de l'appareil, le type de navigateur, le système d'exploitation, l'emplacement déduit du réseau, les pages visitées, l'URL de référence, les événements de session, les enregistrements de connexion, les clics et les actions, les journaux de diagnostic, les journaux de crash, les données de performances, les signaux antifraude et des informations similaires.

Nous pouvons recevoir des informations relatives à votre compte, vos commandes, vos paiements, vos autorisations, votre utilisation, votre sécurité ou vos questions d'assistance de la part de prestataires de services de paiement, de fournisseurs d'authentification, de fournisseurs antifraude, d'outils d'assistance, d'outils d'analyse, d'entreprises clientes, d'administrateurs d'équipe ou de prestataires de services tiers.

## 3. Entrées, sorties et traitement du modèle

Les entrées que vous soumettez et les sorties que vous recevez peuvent transiter par nos systèmes si nécessaire pour fournir les services et peuvent être envoyées au service modèle ou au service technique concerné pour compléter la demande.Différents modèles et services tiers peuvent avoir des règles différentes en matière de traitement des données, de journalisation, de formation, de conservation et de sécurité.Vous devez examiner les règles applicables avant d'utiliser un modèle particulier et éviter de soumettre des informations que vous n'êtes pas autorisé à soumettre ou des informations sensibles qui ne sont pas nécessaires.

À moins que le tableau de bord, la documentation ou la description de la commande ne fournisse expressément une fonctionnalité pertinente, nous ne promettons pas de stocker l'historique complet des entrées ou des sorties.À des fins de dépannage, de sécurité, de mesure, de remboursement, de litige ou de conformité, nous pouvons conserver les métadonnées des demandes, les enregistrements d'erreurs, les enregistrements d'utilisation, les journaux nécessaires et les documents que vous fournissez volontairement dans les communications d'assistance.

Nous pouvons utiliser des informations agrégées, anonymisées ou anonymisées à des fins d'analyse statistique, de planification des capacités, de gestion des coûts, d'analyse des modèles et de la qualité des services, d'amélioration des produits, de modélisation des risques et d'opérations commerciales.Ces informations ne permettront pas raisonnablement d’identifier une personne en particulier.

## 4. Cookies et technologies similaires

Nous utilisons des cookies, du stockage local, des pixels, des journaux et des technologies similaires pour vous garder connecté, protéger les sessions, mémoriser vos préférences, finaliser le paiement, détecter les fraudes et les abus, mesurer les visites, surveiller les performances, résoudre les problèmes et améliorer les services.Vous pouvez contrôler certains cookies via les paramètres du navigateur, mais la désactivation des cookies peut affecter la connexion, le tableau de bord, le paiement, la sécurité, les statistiques d'utilisation ou les fonctionnalités d'assistance.

## 5. Informations de paiement et de commande

Les paiements peuvent être traités par Paddle, Stripe, des banques, des réseaux de cartes, des portefeuilles, des fournisseurs de méthodes de paiement locaux, des fournisseurs de lutte contre la fraude, des prestataires fiscaux, des fournisseurs de factures ou d'autres prestataires de services nécessaires.Nous pouvons recevoir ou stocker l'identifiant de paiement, l'identifiant de paiement, le numéro de commande, l'état du paiement, l'état d'autorisation, l'état du règlement, le produit, le montant, la devise, le montant de la taxe, le taux d'imposition, la juridiction fiscale, le numéro de facture, le numéro de reçu, l'état du remboursement, l'état de rétrofacturation ou de litige, l'adresse de facturation, le pays, le nom de l'entreprise, l'identifiant fiscal, l'e-mail de facturation et les informations nécessaires au traitement de l'assistance.

Nous ne stockons pas intentionnellement les numéros de carte complets, les codes de vérification de carte, les identifiants de compte bancaire ou les identifiants de portefeuille dans nos propres systèmes.Les données des moyens de paiement sont traitées par le prestataire de services de paiement concerné conformément à ses règles de sécurité, de confidentialité et de conformité du réseau de paiement.Nous pouvons conserver des métadonnées de paiement limitées, telles que le nom du fournisseur de paiement, le type de mode de paiement, les quatre derniers chiffres de la carte fournis par le fournisseur, l'ID de paiement, l'URL du reçu, l'URL de la facture, l'ID de remboursement et l'ID du litige pour la facturation, les taxes, la comptabilité, l'assistance, le remboursement et le traitement des litiges.

## 6. Comment nous utilisons les informations

Nous utilisons les informations pour créer et authentifier des comptes, traiter les commandes et les paiements, fournir des crédits de service, maintenir le solde et les enregistrements d'utilisation, fournir un accès API, traiter les demandes, calculer l'utilisation et les frais, gérer les factures, les reçus, les remboursements et les litiges, envoyer des avis de service, répondre aux demandes d'assistance, résoudre les problèmes, détecter et prévenir la fraude, les abus, les incidents de sécurité et les violations de politique, appliquer le contrat d'utilisation et les règles de tiers, respecter les obligations fiscales, comptables, d'audit, juridiques et de conformité, et protéger les droits et la sécurité des utilisateurs de VOC AI,les prestataires de services tiers, les prestataires de services de paiement et le public.

Si vous choisissez de recevoir des notifications de marketing, de mises à jour de produits ou d'événements, nous pouvons utiliser vos coordonnées pour envoyer ces communications.Vous pouvez vous désinscrire en utilisant la méthode de désabonnement dans l'e-mail ou en nous contactant.Les avis de service, les avis de sécurité, les avis de facturation et les mentions légales ne sont pas affectés par les désinscriptions marketing.

## 7. Traitement prudent des informations

Nous limitons l'accès interne en fonction des besoins de l'entreprise et des responsabilités du personnel, et utilisons des processus de gestion des autorisations, de journalisation, de cryptage raisonnable, de surveillance, de sauvegarde et d'audit pour protéger les informations de compte, de commande, de paiement, d'utilisation et d'assistance.Pour les remboursements, les rétrofacturations, les appels anormaux, les incidents de sécurité ou les contrôles de conformité, nous pouvons conserver des enregistrements plus détaillés et effectuer un examen supplémentaire.

Nous ne vous demanderons pas, dans les communications d'assistance, de fournir des informations d'identification de paiement complètes, des mots de passe, des clés API en texte brut ou d'autres informations d'identification sensibles inutiles.Si le dépannage nécessite des captures d’écran ou des journaux, vous devez supprimer les informations sensibles sans rapport.Si les documents contiennent des informations sensibles inutiles, nous pouvons vous demander de soumettre une version expurgée.

Nous déployons des efforts raisonnables pour limiter le partage d'informations à ce qui est pertinent pour fournir les Services, traiter les paiements, compléter les demandes, résoudre les problèmes, calculer les factures, gérer les remboursements, répondre aux litiges, répondre aux exigences légales ou protéger la sécurité du service.

## 8. Comment nous partageons les informations

Nous pouvons partager des informations avec des prestataires de services qui nous aident à exploiter les Services, notamment l'hébergement, les bases de données, la mise en cache, la mise en réseau, la journalisation, la surveillance, la sécurité, l'authentification, la messagerie électronique, le support client, l'analyse, le paiement, les taxes, la facture, le reçu, la lutte contre la fraude, la conformité, l'audit et les prestataires de conseils professionnels.

Pour finaliser la prestation de services, les demandes d'API, les appels de modèles ou le traitement technique, nous pouvons envoyer le contenu utilisateur nécessaire, les informations de demande, les identifiants de compte, les informations d'utilisation et les métadonnées pour modéliser des services, des plateformes API, des fournisseurs de cloud, des fournisseurs de passerelles ou d'autres plateformes tierces.Les tiers traitent les informations associées selon leurs propres conditions, politiques de confidentialité, règles de traitement des données et politiques d'utilisation.

Nous pouvons également divulguer des informations lorsque la loi applicable, les assignations à comparaître, les ordonnances judiciaires, les demandes gouvernementales, les autorités fiscales, les règles des réseaux de paiement, les exigences d'audit ou les exigences réglementaires l'exigent, ou pour enquêter sur une fraude, des rétrofacturations, des litiges de paiement, des abus, des incidents de sécurité, des violations de politique, une infraction, un risque de sanctions ou pour protéger les droits, la propriété, la sécurité et l'intégrité du service.

Si nous sommes impliqués dans une fusion, une acquisition, un financement, une restructuration, une vente d'actifs, une faillite ou une transaction similaire, des informations peuvent être divulguées ou transférées dans le cadre de cette transaction.Le destinataire doit continuer à traiter les informations conformément à la loi applicable et aux principes de protection reflétés dans la présente politique.

## 9. Rétention

Nous conservons les informations aussi longtemps que nécessaire pour fournir les Services, conserver les enregistrements de comptes et de commandes, délivrer des crédits de service, calculer l'utilisation et la facturation, gérer les remboursements et les litiges, respecter les obligations fiscales et comptables, prévenir la fraude et les abus, assurer la sécurité, répondre aux exigences d'audit et de conformité et protéger les droits.

Les informations sur le compte sont généralement conservées pendant une période raisonnable après la clôture du compte.Les enregistrements de commandes, de taxes, de factures, de comptabilité et de litiges peuvent être conservés plus longtemps si la loi ou les règles du réseau de paiement l'exigent.Les journaux de sécurité, les journaux de diagnostic et les enregistrements techniques sont conservés selon les besoins des opérations, de la sécurité et du dépannage.

Les enregistrements de demandes d'API, d'erreurs et d'utilisation peuvent avoir des périodes de conservation différentes en fonction de la fonctionnalité, du type de journal, des besoins de sécurité et des exigences de conformité.Nous conservons ces enregistrements dans la mesure nécessaire pour fournir les Services, résoudre les problèmes, calculer les factures, gérer les remboursements, répondre aux litiges, prévenir les abus et répondre aux exigences légales.

Lorsque les informations ne sont plus nécessaires, nous supprimons, anonymisons ou limitons le traitement ultérieur conformément à la loi applicable et aux processus commerciaux.

## 10. Transferts internationaux

VOC AI est situé aux États-Unis.Nous, nos prestataires de services, prestataires de services de paiement et prestataires de services tiers pouvons traiter des informations aux États-Unis, en Europe, en Asie ou dans d'autres pays et régions.Les lois sur la protection des données dans ces pays peuvent différer des lois dans lesquelles vous résidez.Nous utiliserons des garanties de transfert transfrontalières appropriées lorsque la loi applicable l’exige.

## 11. Sécurité

Nous utilisons des mesures administratives, techniques et organisationnelles telles que les contrôles d'accès, la gestion des autorisations, les journaux, le cryptage raisonnable, la surveillance, les sauvegardes, les audits et les processus internes pour protéger les informations.Aucun système ne peut être garanti d’une sécurité absolue.Vous êtes également responsable de la protection de votre compte, de votre mot de passe, de votre courrier électronique, de vos appareils, de vos clés API, de vos identifiants d'accès, de votre compte de paiement et des identifiants de service associés.

Si vous pensez que votre compte, votre clé API, votre mode de paiement ou vos données ont été consultés ou utilisés sans autorisation, contactez-nous immédiatement.

## 12. Vos choix et droits

Vous pouvez mettre à jour certaines informations de compte, de facturation et d'équipe dans le tableau de bord.En fonction de votre emplacement et de la loi applicable, vous pouvez avoir le droit de demander l'accès, la correction, la suppression, la portabilité, la restriction, l'objection, le retrait du consentement, la désinscription de certains partages de données ou de vous plaindre auprès d'un régulateur.

Nous devrons peut-être vérifier votre identité avant de traiter une demande.Nous pouvons également conserver certaines informations lorsque la loi applicable l'autorise ou l'exige, telles que la fiscalité, la comptabilité, la sécurité, le contrôle des risques, le paiement, les litiges, l'audit, la conformité ou les dossiers juridiques.

Nous ne vendons pas intentionnellement des informations personnelles contre de l'argent.Si la loi applicable traite certaines publicités, analyses ou partages de données comme une « vente » ou un « partage », vous pouvez nous contacter pour exercer tout droit de désinscription applicable.

## 13. Confidentialité des enfants

Les Services ne sont pas destinés aux enfants de moins de 13 ans et nous ne collectons pas sciemment d'informations personnelles auprès d'enfants de moins de 13 ans. Si vous pensez qu'un enfant nous a fourni des informations, contactez-nous afin que nous puissions les examiner et, le cas échéant, les supprimer.

## 14. Mises à jour des politiques

Nous pouvons mettre à jour cette politique de confidentialité de temps à autre.Les modifications importantes peuvent être notifiées via le site Web, le tableau de bord, le courrier électronique ou tout autre moyen raisonnable.La politique mise à jour s'applique aux activités de traitement de l'information après la mise à jour.

## 15. Contacter

Pour des questions relatives à la confidentialité, des demandes de données, des rapports de sécurité ou des demandes de protection des données, contactez support@flatkey.ai ou écrivez à VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, États-Unis.


Tous les contenus ci-dessus sont soumis à la version anglaise.`,
    refund: `# Politique de remboursement de flatkey.ai

Dernière mise à jour : 4 juin 2026

Cette politique de remboursement s'applique aux services flatkey.ai fournis par VOC AI INC (« VOC AI », « nous », « notre » ou « notre ») via flatkey.ai, les pages de paiement, le tableau de bord et les canaux d'assistance, y compris les recharges de compte, le solde du compte prépayé, les crédits de service, l'utilisation de l'API, la prestation de services numériques et les questions d'assistance associées.

Entité opérationnelle : VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, États-Unis.Contact : support@flatkey.ai.

## 1. Principes de base

flatkey.ai fournit des services numériques.Le solde du compte, les crédits de service et les services numériques associés sont généralement livrés par voie électronique immédiatement après le paiement ou l'approbation de la commande et peuvent être utilisés immédiatement pour les demandes d'API, les appels de modèles, le traitement de fichiers, le traitement d'images, le traitement de demandes ou d'autres fonctionnalités payantes.Une fois la livraison et l'utilisation effectuées, des coûts de modèle tiers, de service cloud, de paiement, de taxes, de réseau et d'infrastructure peuvent être engagés.

Nos principes de remboursement sont les suivants : la non-livraison, les frais en double, les erreurs système vérifiables et les exigences légales obligatoires font l'objet d'un examen prioritaire ;Les crédits livrés et utilisés, le solde consommé, les demandes complétées et les services numériques fournis avec succès ne sont généralement pas remboursables.

Cette politique ne limite pas les droits non renonçables de remboursement, d'annulation, de retrait, de contenu numérique, de service numérique ou de litige de paiement prévus par la loi applicable.

## 2. Fenêtre de remboursement pour le solde inutilisé

Le solde du compte ou les crédits de service inutilisés peuvent être soumis pour examen de remboursement dans les 24 heures suivant la finalisation de l'achat.Après 24 heures, le solde inutilisé n'est généralement pas éligible à un remboursement en espèces, sauf si la loi applicable l'exige autrement, si les règles du fournisseur de services de paiement l'exigent autrement ou si nous confirmons des frais en double, une non-livraison, une erreur système vérifiable ou une erreur fiscale ou de facture.

Si une page d'achat, une description de commande, un accord d'entreprise ou la loi applicable prévoit une période de remboursement plus longue, la règle la plus spécifique s'appliquera.Les crédits promotionnels, récompenses, essais, coupons, cadeaux, soldes gratuits ou crédits gratuits ne sont généralement pas éligibles à un remboursement en espèces.

## 3. Remboursements ou ajustements que nous pouvons examiner

Vous pouvez demander un remboursement, un rétablissement de solde, une correction de crédit ou un ajustement de compte dans les situations suivantes :

- la même commande a été facturée plus d'une fois ;
- le paiement a réussi mais le solde du compte, les crédits de service ou les services numériques n'ont pas été fournis ;
- le paiement a échoué, a été annulé ou a été annulé, mais le mode de paiement affiche toujours des frais ;
- notre erreur système vérifiable a provoqué une déduction en double, une déduction incorrecte, un comptage incorrect ou une délivrance de crédit incorrecte ;
- vous demandez dans les 24 heures suivant l'achat et le solde ou les crédits associés n'ont pas été utilisés, transférés, abusés ou associés à une activité suspecte ;
- le traitement des taxes, de la facture, du reçu, de la devise, du montant de la commande ou du mode de paiement doit être corrigé ;
- la loi applicable, les règles des prestataires de services de paiement, les règles des services numériques, les règles fiscales ou les règles des réseaux de paiement exigent un remboursement ;
- VOC AI, Paddle, Stripe ou un autre fournisseur de services de paiement de commande d'origine détermine après examen qu'un remboursement ou un ajustement est approprié.

La méthode d'approbation et de traitement dépend du statut de la commande, des enregistrements de livraison, des enregistrements d'utilisation, de l'état du paiement, des exigences fiscales et de facturation, des résultats de l'examen des risques, des règles du fournisseur de services de paiement et de la loi applicable.

## 4. Processus d'examen

Nous examinons les demandes de remboursement ou d'ajustement à l'aide des enregistrements de commande, des enregistrements de prestataires de services de paiement, des enregistrements de livraison, des enregistrements de solde, des journaux d'utilisation, des identifiants de demande, des enregistrements d'erreurs, des communications d'assistance, des enregistrements fiscaux et des enregistrements de factures.Pour les litiges d'utilisation, nous nous concentrons sur la question de savoir si les demandes ont réellement eu lieu, si le solde a été déduit, si une déduction en double s'est produite, s'il y a eu une erreur système et si les demandes pertinentes proviennent de votre compte, de votre clé API, des membres de votre équipe, de votre application ou de votre intégration.

Lors de l'examen, nous pouvons vous demander de fournir l'adresse e-mail de votre compte, votre numéro de commande, votre identifiant de paiement, votre reçu, votre facture, votre identifiant de demande, votre horodatage, votre capture d'écran, votre message d'erreur ou toute autre information raisonnablement nécessaire.Les demandes qui ne peuvent pas vérifier la commande, la propriété du compte, l'état de livraison, l'état d'utilisation ou l'état de paiement peuvent ne pas être approuvées.

Si nous constatons que la commande ou l'utilisation associée implique une revente non autorisée, un relais, un partage de compte, un masquage du véritable utilisateur, une création groupée de compte, des appels concentrés anormaux, une fraude, un abus, un risque de sanctions, un abus de rétrofacturation ou un contournement de limite, nous pouvons suspendre l'examen, refuser les remboursements, limiter la restauration du solde ou prendre des mesures de restriction de compte en vertu des Conditions d'utilisation.

Si la même commande a fait l'objet d'un processus de rétrofacturation, de litige de paiement, d'annulation de paiement ou d'enquête auprès du fournisseur de services de paiement, nous le traiterons généralement via le processus du fournisseur de services de paiement ou du réseau de cartes concerné et n'émettrons pas séparément un remboursement en espèces indépendant en même temps, pour éviter les remboursements en double ou les conflits comptables.Une fois le processus de litige terminé, si des corrections au solde du compte ou à la facturation restent nécessaires, nous les traiterons en fonction du résultat final et des enregistrements du système.

## 5. Articles généralement non remboursables

Sauf lorsque la loi applicable en dispose autrement, les éléments suivants ne sont généralement pas remboursables :

- le solde ou les crédits de service utilisés pour les requêtes API, les appels de modèles, le traitement de fichiers, le traitement d'images, l'utilisation du cache, le traitement des requêtes ou d'autres fonctionnalités payantes ;
- les services numériques qui ont été livrés et démarrés avec succès ;
- les frais causés par les comptes, les membres de l'équipe, les clés API, les scripts automatisés, les intégrations, les clés divulguées, les paramètres d'autorisation, le personnel interne ou les utilisateurs autorisés ;
- les coûts des modèles tiers, les coûts des services cloud, les frais minimums, l'utilisation excessive, les taxes, les différences de conversion de devises, les frais bancaires, les frais de réseau de cartes, les frais de réseau, les frais de fournisseur de services de paiement ou les frais de plateforme tierce ;
- promotion, récompense, essai, coupon, cadeau, solde gratuit ou crédits gratuits ;
- les commandes, soldes ou crédits de service associés à une fraude, un abus, un risque de sanctions, une utilisation illégale, des violations de politique, un partage de compte, une revente non autorisée, un relais, une fourniture à des tiers, un abus de rétrofacturation ou un contournement de limite ;
- les demandes basées sur l'insatisfaction concernant la qualité de la sortie de l'IA, le comportement du modèle, la disponibilité du service, la latence, les limites de débit, les changements de prix, les restrictions régionales ou les changements de politique de tiers, lorsque le service a été fourni comme décrit ou que les crédits pertinents ont été utilisés ;
- les problèmes causés par des informations inexactes sur le compte, l'e-mail, la facturation, les taxes, l'entreprise, la facture ou le paiement que vous avez fournies, à moins que la loi applicable ou les règles du fournisseur de services de paiement n'exigent une correction ou un remboursement.

## 6. Contenu numérique et droits des consommateurs

Pour le contenu numérique ou les services numériques fournis et utilisables immédiatement, dans la mesure permise par la loi applicable, vous pouvez perdre les droits légaux d'annulation ou de retrait une fois le solde du compte, les crédits de service ou les services associés livrés ou une fois que vous commencez à utiliser les services concernés.

Si votre emplacement offre aux consommateurs une protection, un remboursement, un retrait, une annulation ou des droits de litige inaliénables, nous traiterons les demandes conformément à la loi applicable, même si d'autres parties de cette politique indiquent le contraire.

## 7. Comment demander un remboursement

Contactez support@flatkey.ai et fournissez autant d'informations suivantes que possible :

- adresse e-mail du compte ;
- numéro de commande, identifiant de paiement, numéro de reçu Paddle, numéro de reçu Stripe, référence de paiement ou numéro de facture ;
- date d'achat, montant, devise et type de mode de paiement ;
- motif de la demande de remboursement ou d’ajustement ;
- captures d'écran pertinentes, messages d'erreur, état de livraison, enregistrements de solde ou enregistrements de tableau de bord ;
- pour les problèmes d'utilisation, le nom de la clé API, l'ID de demande, l'horodatage, le modèle ou le nom du service.

Les frais en double, la non-livraison, les déductions incorrectes, les erreurs de facture, les problèmes fiscaux ou les anomalies de paiement doivent être soumis dès qu'ils sont découverts.Nous pouvons demander des informations supplémentaires pour vérifier la propriété du compte, les enregistrements d'achat, l'état de livraison, l'état d'utilisation, l'état de paiement, les informations fiscales et l'éligibilité au remboursement.

## 8. Méthode de remboursement et délai de traitement

Les remboursements en espèces approuvés reviennent généralement au mode de paiement d'origine.Le temps de traitement dépend de Paddle, Stripe, des banques, des réseaux de cartes, des portefeuilles, des fournisseurs de méthodes de paiement locaux et d'autres prestataires de services concernés.Nous ne pouvons pas garantir quand un tiers terminera la publication.

Dans certains cas, nous pouvons résoudre un problème par le rétablissement du solde, la correction du crédit, l'ajustement du compte, la note de crédit, la correction de la facture ou la mise à jour du reçu, en particulier lorsque le problème concerne un échec de livraison, un comptage incorrect, une déduction en double ou une erreur d'enregistrement du compte.

Les taxes, factures, notes de crédit, reçus, conversion de devises et limitations des méthodes de paiement peuvent être gérées par le prestataire de services de paiement de la commande d'origine.Si une commande est entrée dans le statut de rétrofacturation, de litige, de contrôle des risques, de révision fiscale ou de restriction du fournisseur de services de paiement, les remboursements peuvent prendre plus de temps ou doivent suivre le processus approprié.

## 9. Paddle, Stripe et autres fournisseurs de services de paiement

Si une commande est traitée par Paddle en tant que marchand officiel ou vendeur, Paddle peut déterminer ou exécuter les remboursements, taxes, factures, notes de crédit, reçus et litiges de paiement conformément à son processus.

Si une commande est traitée par Stripe ou un autre processeur de paiement, VOC AI peut examiner la demande de remboursement et, si possible, demander au processeur de renvoyer le remboursement approuvé vers le mode de paiement d'origine.Les règles et délais de traitement peuvent varier selon le prestataire de services de paiement, le pays, la devise, le mode de paiement et la banque.

## 10. Rétrofacturations et litiges de paiement

Si vous lancez une rétrofacturation, un litige de paiement, une annulation de paiement ou un processus similaire, nous pouvons suspendre les comptes, les clés API, le solde, les crédits de service, les commandes ou l'accès au service associés pendant l'enquête.

Nous pouvons fournir à Paddle, Stripe, aux banques, aux réseaux de cartes, aux portefeuilles, aux réseaux de paiement, aux prestataires de services fiscaux ou aux organismes de traitement des litiges des enregistrements de commandes, des enregistrements de livraison, des journaux d'utilisation, des enregistrements de solde, des enregistrements fiscaux, des factures, des reçus, des enregistrements de remboursement, des communications d'assistance, des activités de compte et des enregistrements de sécurité pour enquêter et répondre aux litiges.

Veuillez d'abord nous contacter en cas de frais en double, de non-livraison, de déductions incorrectes, de problèmes fiscaux, de factures, de reçus et de problèmes de facturation.Le lancement direct d'une rétrofacturation peut entraîner la suspension du compte, des retards de remboursement, des frais de litige ou des restrictions d'achat futurs.

Si vous avez déjà contacté une banque, un réseau de cartes, un fournisseur de portefeuille ou un prestataire de services de paiement pour lancer un litige, indiquez-nous l'état du litige et le numéro de référence dans les communications de remboursement.Masquer un litige actif, demander des remboursements en double en même temps ou poursuivre une rétrofacturation après avoir reçu un remboursement peut être traité comme un abus de rétrofacturation.

## 11. Mises à jour des politiques

Nous pouvons mettre à jour cette politique de remboursement de temps à autre.La Politique mise à jour s'applique généralement aux achats, livraisons, utilisations et demandes de remboursement survenant après la mise à jour, à moins que la loi applicable ou les règles du fournisseur de services de paiement n'exigent le contraire.

## 12. Contacter

Pour toute question concernant les achats, la livraison, le solde du compte, les crédits de service, les frais en double, les déductions incorrectes, les taxes, les factures, les reçus, l'éligibilité au remboursement, les reçus Paddle, les reçus Stripe ou les litiges de paiement, contactez support@flatkey.ai ou écrivez à VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, États-Unis.

Tous les contenus ci-dessus sont soumis à la version anglaise.`,
    sla: `# Accord de niveau de service flatkey.ai

Dernière mise à jour : 13 juin 2026

Le présent accord de niveau de service (« SLA ») décrit l'objectif de disponibilité et le processus d'assistance des services flatkey.ai fournis par VOC AI INC (« VOC AI », « nous » ou « notre »).

## 1. Portée

Ce SLA s'applique au tableau de bord hébergé, à la passerelle API, au routage, à la mesure d'utilisation et aux services de compte flatkey.ai que nous exploitons directement. Il ne s'applique pas aux fournisseurs de modèles IA tiers, aux prestataires de paiement, aux réseaux clients, aux applications clients, aux fonctionnalités bêta, aux cas de force majeure, à la maintenance planifiée, aux mesures contre les abus, aux suspensions de compte ou aux problèmes causés par la configuration, les identifiants, les intégrations ou les violations de politique du client.

## 2. Objectif de disponibilité

Nous visons une disponibilité mensuelle de 99,5 % pour les points de terminaison couverts du service flatkey.ai. La disponibilité est mesurée par nos systèmes de surveillance de production pour les services couverts.

## 3. Maintenance et changements de service

Nous pouvons effectuer une maintenance planifiée ou d'urgence pour améliorer la sécurité, la fiabilité, les performances ou la conformité. Nous faisons des efforts raisonnables pour réduire l'impact client et, lorsque cela est possible, fournir un avis via le tableau de bord, le site web, l'e-mail ou les canaux d'assistance.

## 4. Dépendances tierces

flatkey.ai achemine les requêtes vers des fournisseurs de modèles tiers et dépend de fournisseurs cloud, réseau, paiement, sécurité et analyse. Les pannes, limitations de débit, changements de politique, restrictions régionales, comportements de modèle ou défaillances côté fournisseur tiers sont hors du champ de ce SLA.

## 5. Assistance

Pour les problèmes de disponibilité du service, contactez support@flatkey.ai avec l'e-mail du compte, le point de terminaison affecté, les ID de requête disponibles, les horodatages, les messages d'erreur et un résumé de l'impact. Nous examinons les demandes d'assistance selon la gravité, les enregistrements disponibles et le risque opérationnel.

## 6. Recours

Sauf accord écrit distinct prévoyant un recours différent, ce SLA ne crée pas automatiquement de crédits de service, remboursements, pénalités ou dommages-intérêts forfaitaires. Tout geste commercial, correction de solde ou mesure d'assistance est traité au cas par cas selon le Contrat d'utilisation et les politiques applicables.

## 7. Mises à jour

Nous pouvons mettre à jour ce SLA de temps à autre. Le SLA mis à jour s'applique généralement aux périodes de service suivant la mise à jour.

## 8. Contact

Pour toute question concernant ce SLA ou un incident de service, contactez support@flatkey.ai ou écrivez à VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, États-Unis.

Tous les contenus ci-dessus sont soumis à la version anglaise.`,
  },
  ja: {
    terms: `# flatkey.ai ユーザー同意書

最終更新日: 2026 年 6 月 4 日

このユーザー契約 (「契約」) は、VOC AI株式会社 (「VOC AI」、「当社」、「当社」) が flatkey.ai、ダッシュボード、API、チェックアウト ページ、ドキュメント、サポート チャネルを通じて提供する flatkey.ai サービス (「サービス」) に適用されます。アカウントの登録、組織の作成、プリペイド アカウント残高の追加、API キーの生成または使用、モデル API の呼び出し、ダッシュボードへのアクセス、またはその他のサービスの使用により、お客様は、本契約、当社のプライバシー ポリシー、返金ポリシー、ドキュメント、価格設定ページ、および該当する補足規則に同意したものとみなされます。

運営主体: VOC AI株式会社, 東京都港区六本木三丁目３−２７スハラ六本木３階。

## 1. サービス概要

flatkey.ai は、AI API アクセス、モデル ルーティング、使用量測定、ダッシュボード、プリペイド アカウント残高サービスです。ユーザーは、統合された API とダッシュボードを通じてさまざまな AI モデル機能にアクセスし、API キー、チームの権限、モデルの選択、レコードのリクエスト、残高、クレジット、請求、およびサポート事項を管理できます。

flatkey.ai はモデルそのものではありません。当社は、特定のモデル、API、価格、コンテキスト ウィンドウ、レート制限、地域での利用可能性、出力動作、データ処理ルール、またはサードパーティ ポリシーが引き続き利用可能であること、または変更されないことを保証しません。当社は、製品のニーズ、コストの変更、セキュリティ要件、コンプライアンス義務、モデルプロバイダーの要件、またはサードパーティサービスの変更に基づいて、モデル、機能、価格、および使用ルールを追加、削除、制限、または変更する場合があります。

## 2. 資格、アカウント、組織

13 歳以上である必要があります。18 歳未満の場合は、親または法定後見人の許可が必要です。あなたが会社、組織、またはその他の団体を代表して本サービスを使用する場合、あなたはその団体を代表して本契約に同意する権限を持っていることを表明するものとします。

真実、正確、完全な現在のアカウント情報、ビジネス情報、請求情報、税金情報、および連絡先情報を提供する必要があります。あなたは、管理者、メンバー、アプリケーション、API キー、アクセス認証情報、リクエスト、統合、支払い方法、およびアカウントの残高の使用に対して責任を負います。

組織管理者はチーム メンバーを招待し、権限、予算、モデル、ログ、キー、セキュリティ設定を構成できます。管理者の構成は、組織のメンバーやアプリケーションのエンド ユーザーに影響を与える可能性があります。お客様は、チーム メンバーとエンド ユーザーが本契約、当社のドキュメント、および該当するモデル プロバイダーの規約に準拠していることを確認する必要があります。

アカウント、API キー、アクセス認証情報、支払い方法、またはダッシュボードへのアクセスが許可なく使用されたと思われる場合は、直ちに当社に連絡し、アクセスを取り消し、ローテーション、無効化、または制限するための適切な措置を講じる必要があります。

## 3. プリペイド残高、料金、デジタル配信

本サービスでは、API を呼び出したり、特定の機能を使用したりする前に、プリペイド アカウント残高またはサービス クレジットを購入することが必要な場合があります。購入前に、該当するページに表示される注文金額、通貨、税金、手数料、支払い方法、価格設定ルールを確認する機会があります。

アカウント残高とサービス クレジットは、対象となる flatkey.ai サービスにのみ使用できます。現金、預金、電子マネー、ギフトカード、支払手段、引き出し可能な口座、金融商品ではありません。当社が書面で明示的に同意するか、適用される法律で別段の定めがある場合を除き、アカウント残高およびサービス クレジットは、引き出し、現金との引き換え、譲渡、担保としての使用、投資、またはサービス外での使用を行うことはできません。

支払いまたは注文の承認が完了すると、通常、購入した残高またはクレジットはアカウントに電子的に配信され、API リクエスト、モデル呼び出し、またはその他の有料機能にすぐに使用できます。リクエストを行うと、システムは、その時点のモデル価格、入力使用量、出力使用量、キャッシュ ヒット、リクエスト、ファイル、画像、税金、手数料、通貨換算、および関連ページまたはチェックアウト フローに表示されるその他の請求ルールに従って残高を差し引きます。

残高またはクレジットの有効期限は、購入ページ、注文の説明、ダッシュボードの表示、または当社からの書面による確認によって決まります。当社は、長期間非アクティブなアカウント、一時停止されたアカウント、閉鎖されたアカウント、不正行為、またはポリシー違反に関連する残高またはクレジットを、返金ポリシーに基づいて制限、凍結、キャンセル、または処理する場合があります。

## 4. 支払い、税金、請求書

お客様は、VOC AI および当社の決済サービス プロバイダーに対し、注文金額、税金、手数料、およびその他の該当する料金を選択した支払い方法に請求することを承認するものとします。支払いは、Paddle、Stripe、銀行、カード ネットワーク、ウォレット、現地の支払い方法プロバイダー、不正行為防止プロバイダー、税務プロバイダー、請求書プロバイダー、またはその他の必要なサービス プロバイダーによって処理される場合があります。

チェックアウト方法に応じて、徴収、請求、税計算、返金の実行、および紛争処理の責任を負う当事者が異なる場合があります。Paddle が登録販売者または販売者として注文を処理する場合、Paddle は支払いの徴収、税金、請求書、領収書、返金、支払い紛争のワークフローに責任を負う場合があります。Stripe または他のプロバイダーが支払い処理者としてのみ機能する場合、VOC AI が販売者として残り、処理者が当社に代わって支払い関連の活動を処理する場合があります。

正確な請求先住所、会社名、納税者番号、VAT/GST 情報、電子メール アドレス、請求書情報を提供する必要があります。税金、請求書の問題、領収書の問題、支払いの失敗、払い戻しの遅延、コンプライアンスのレビュー、または不正確、不完全、または古い情報に起因する追加費用については、お客様の責任となります。

## 5. モデルプロバイダーの利用規約と制限

本サービスにより、お客様、お客様のチーム メンバー、お客様のアプリケーション、またはエンド ユーザーは、サードパーティのモデル プロバイダーまたはテクニカル サービス プロバイダーが提供するモデル、API、ツール、または機能にアクセスできる場合があります。お客様は、モデルまたはサードパーティのサービスの使用には、そのモデルまたはサードパーティのサービスの条件、ポリシー、地域制限、安全規則、データ処理規則、および使用制限が適用される場合があることを理解し、これに同意するものとします。

お客様には、特定のモデルを使用する前に、そのモデルとそのルールが商用利用、顧客向けの使用、機密データ、規制された業界、リスクの高い意思決定、地域アクセス、未成年者、コンテンツの安全性、出力の公開などのユースケースに適していることを確認する責任があります。また、チーム メンバーとエンド ユーザーが、本契約、当社のドキュメント、および該当するサードパーティの規則に従って関連モデルを使用していることを確認する必要があります。

特定のモデルまたは機能では、特定の地域、業界、エンティティ、目的、またはリクエストの種類によるアクセスが許可されない場合があります。VPN、プロキシ、複数のアカウント、虚偽の情報、技術的な回避策、またはモデル、地域、ID、セキュリティ、またはコンプライアンスの制限を回避するその他の方法を使用することはできません。当社は、第三者からのリクエストを受け取った場合、リスクを検出した場合、またはルールに違反していると合理的に判断した場合、関連するモデル、アカウント、API キー、残高、または機能へのアクセスを一時停止、制限、閉鎖、または削除することがあります。

当社は、サードパーティ モデル プロバイダーの規約を変更、放棄、または置き換えることはありません。モデルプロバイダーは、条件、価格、機能、可用性、データ処理方法、またはアクセス制限をいつでも変更する場合があります。モデルを継続的に使用するということは、その時点で適用されるルールを受け入れることを意味します。

## 6. 設定の責任

お客様には、モデルの選択、アカウントの構成、チーム権限の設定、API キーの管理、予算とレート制限の構成、リクエスト ソースの制御、入出力のレビュー、サービスがお客様のビジネス シナリオに適しているかどうかの判断を行う責任があります。

flatkey.ai を独自の製品またはサービスに統合する場合は、アプリケーション、エンドユーザー アクセス、アカウント権限、API キー、残高、クレジット、リクエスト ソース、ログ、不正行為の処理、およびカスタマー サポートに対する制御を維持する必要があります。エンド ユーザーが flatkey.ai アカウント、API キー、残高、またはクレジットを使用するためにアプリケーションを直接取得、制御、再販、分割、一括使用、またはバイパスすることを許可することはできません。

あなたは、チームメンバー、アプリケーション、統合、エンドユーザー、自動スクリプト、権限設定、およびキー管理に対して責任を負います。お客様の構成、キーの漏洩、エンドユーザーの行為、権限設定、スクリプトのエラー、または内部管理の問題に起因する使用、料金、紛争、または損失については、当社の検証可能なシステム エラーが直接の原因でない限り、お客様の責任となります。

## 7. ユーザーコンテンツと AI 出力

プロンプト、テキスト、ファイル、画像、コード、データ、構成、リクエスト、およびサービスに送信するその他のコンテンツは「入力」です。モデル応答、生成されたコンテンツ、またはサービスによって返されるその他の結果は「出力」です。入力と出力は総称して「ユーザー コンテンツ」と呼ばれます。

あなたは、自分の入力に関して合法的に保有する権利を保持します。本サービスの提供、ルーティング、測定、トラブルシューティング、サポート、保護、監査、返金の確認、および改善を行うために、必要に応じてユーザー コンテンツおよび関連メタデータを処理、送信、保存、コピー、表示、および使用するための非独占的で世界規模のロイヤリティフリーのライセンスを当社に付与するものとします。

あなたは、入力を送信、処理、送信するために必要なすべての権利、許可、および同意を持っていることを表明します。知的財産権、プライバシー権、機密保持義務、契約上の義務、または適用法に違反するコンテンツを送信することはできません。

AI 出力は、不正確、不完全、時代遅れ、反復的、偏っていて、安全ではなく、特定の目的に適していない、またはサードパーティのコンテンツに類似している可能性があります。出力を信頼したり、公開したり、商業的に使用したり、運用環境に導入したり、法律、医療、財務、雇用、信用、安全性、コンプライアンス、またはその他の重要な決定に使用したりする前に、出力を独自にレビューおよび検証する必要があります。当社は、出力の正確性、独自性、適合性、可用性、または非侵害を保証しません。

ダッシュボード、ドキュメント、または注文の説明で関連する機能が明示的に提供されていない限り、完全な入力履歴または出力履歴を保存することは保証されません。トラブルシューティング、セキュリティ、計測、返金、紛争、またはコンプライアンスの目的で、当社はリクエストのメタデータ、エラー記録、使用記録、および必要なログを保持する場合があります。

## 8. 再販、中継、または競争上の使用の禁止

flatkey.ai アカウント、API キー、アカウント残高、サービス クレジット、モデル アクセス機能、およびダッシュボード機能は、お客様自身のビジネスまたはアプリケーションでお客様およびお客様の承認されたチームが使用するためのものです。当社が別途書面による契約を締結しない限り、販売、譲渡、配布、レンタル、共有、またはその他の間接的な取り決めによっても、flatkey.ai をスタンドアロン API、残高、クレジット、サブアカウント、トップアップ サービス、リレー サービス、リブランド サービス、アグリゲーション サービス、または同様のサービスとして第三者に提供することはできません。

API アクセスの再販、競合サービスの構築、サードパーティ モデル ルールの回避、真のエンド ユーザーの隠蔽、価格や制限の回避、地域制限の回避、セキュリティ レビューの回避、または支払いレビューの回避を目的として、サービスにアクセスしたり使用したりすることはできません。

不正転売、中継、アカウント共有、真のユーザーの隠蔽、一括アカウント作成、異常な集中通話、制限回避、リスク管理回避は重大な違反となります。当社は、関連するアカウント、API キー、残高、クレジット、注文を一時停止または終了する場合があり、また関連する払い戻し、残高の回復、またはクレジットの調整を拒否または制限する場合があります。

## 9. 禁止行為

次のことは禁止されています:

- 違法、詐欺、侵害、嫌がらせ、スパム、マルウェア、フィッシング、システム攻撃、規制回避、プライバシー侵害、機密データのスクレイピング、制裁回避、輸出管理違反、またはその他の有害な活動に本サービスを使用すること。
- 制限、リスク管理、価格設定、返金、コンプライアンス審査を回避するために、偽の身元を作成したり、他人になりすましたり、所属を偽ったり、または複数のアカウントを使用したりすること。
- アカウント制限、地域制限、請求ルール、クレジット制限、レート制限、安全メカニズム、悪用防止ルール、サードパーティのサービス制限、または支払い審査プロセスを回避または妨害すること。
- サービス、API、システム、データ、または他のユーザーのアカウントに対するリバース エンジニアリング、スキャン、攻撃、ストレス テスト、中断、クロール、コピー、スクレイピング、または承認なしのアクセス。
- 当社の書面による承認なしに、敵対的テスト、プロンプト インジェクション、ジェイルブレイク テスト、安全バイパス テスト、ストレス テスト、またはモデル、サービス、サードパーティのルール、またはユーザーの利益を損なう可能性のあるその他のテストを実施すること。
- 侵害的、違法、悪意のある、詐欺的、誤解を招く、嫌がらせ、性的、暴力的、憎しみに満ちた、プライバシーを侵害する、制限された、またはサードパーティのポリシーに違反するコンテンツを送信または配布すること。
- 第三者による上記のいずれかの行為を支援、奨励、または許可すること。

## 10. 測定、配信、およびレビュー記録

当社は、注文、支払い、配送、残高、クレジット、リクエスト、控除、エラー、返金、チャージバック、紛争、およびセキュリティ記録を維持し、配送が完了したかどうか、使用が発生したかどうか、残高が正しく差し引かれたかどうか、返金リクエストが有効かどうか、およびアカウントに異常な使用が示されていないかどうかを検証します。

当社では、計測と請求の記録を正確に保つために合理的な努力を払っていますが、複雑なシステムでは遅延、エラー、重複した記録、または表示の違いが発生する可能性があります。検証可能なシステムエラーが発生した場合、当社は残高の回復、クレジットの修正、請求額の調整、または返金を通じて問題に対処することがあります。ユーザーのスクリーンショット、サードパーティの記録、またはローカル ログは裏付け資料とみなされる場合がありますが、最終審査では、当社のシステム記録、決済サービスプロバイダーの記録、および必要なサードパーティのサービス記録が考慮されます。

サービスの安定性と他のユーザーを保護するために、当社は異常なリクエスト、異常な減額、異常なログイン、異常な支払い、大量通話、キー漏洩、悪意のあるリクエスト、チャージバックの悪用、および本契約に違反する使用パターンを監視する場合があり、調査中に関連機能を一時的に制限する場合があります。

当社は、リスクの高い注文、多額の補充、異常な補充頻度、一貫性のない請求情報、異常なログイン領域、異常なリクエスト ソース、短期間の大量の同時実行、または決済サービス プロバイダーのアラートについて、手動または自動でレビューを行う場合があります。審査中は、配送、残高の使用、返金、請求書、またはアカウントの機能が遅延または制限される場合があります。調査後、該当する記録に従って関連事項を復元または処理します。

## 11. 払い戻し

返金、残高の回復、クレジットの修正、およびサポートの調整は、flatkey.ai 返金ポリシーに基づいて処理されます。一般に、提供および使用されたクレジット、消費された残高、完了したリクエスト、および正常に提供されたデジタル サービスは返金できません。

重複請求、配達不能、検証可能なシステム エラー、未使用残高、税または請求書のエラー、支払いに関する紛争、消費者の義務的権利、または支払いサービス プロバイダーの要件は、注文記録、配送記録、使用記録、支払いステータス、および適用されるルールに基づいて確認されます。

## 12. サードパーティサービス

本サービスは、サードパーティのモデル、API、プラットフォーム、クラウド サービス、支払いサービス、税務サービス、請求書サービス、ホスティング、データベース、電子メール、分析、セキュリティ、およびサポート ツールに依存する場合があります。サードパーティは、独自の条件、ポリシー、技術的ルールに基づいてサービスを提供し、データを処理します。

サードパーティのサービスは、一時停止、料金制限、拒否、中止、価格変更、変更、地域による制限、またはデータ処理方法の変更の対象となる場合があります。当社はサービスを維持するために合理的な努力をしますが、サードパーティのサービスの継続的な可用性を保証するものではなく、サードパーティの障害、ポリシーの変更、ネットワークの問題、地域制限、モデルの動作、出力品質、またはサードパーティのコストの変更について本契約を超えて責任を負いません。

## 13. サービスの停止、終了、変更

お客様が本契約または第三者のポリシーに違反した、サービスを不法に使用した、詐欺に関与した、制裁リスクを生じさせた、支払いリスクを引き起こした、チャージバックを悪用した、セキュリティリスクを生じさせた、許可なく他人にサービスを提供した、異常な使用を引き起こした、または当社または第三者に損害を与えたと当社が判断した場合、当社は、アカウント、注文、API キー、残高、クレジット、チーム権限、またはサービスへのアクセスを一時停止または終了することがあります。

適用法で認められる最大限の範囲で、詐欺、悪用、ポリシー違反、制裁リスク、違法使用、チャージバックの悪用、他者への不正提供、または重大なセキュリティインシデントに関連する残高またはクレジットは、制限、凍結、キャンセル、配送の拒否、または返金されない場合があります。

サービスの使用を停止することができます。アカウントの閉鎖は、支払い義務、使用責任、紛争処理、コンプライアンス審査、補償義務、または性質上引き続き適用される本契約の規定には影響しません。

当社は、サービス、モデル、機能、価格、ドキュメント、またはアクセス方法の一部またはすべてを変更、一時停止、または中止することがあります。適用される法律または返金ポリシーで別段の定めがない限り、当社は、サードパーティのモデル変更、機能の中止、価格変更、地域制限、レート制限、またはサービスの変更に起因する返金、損害、または補償に対して責任を負いません。

## 14. 知的財産、フィードバック、機密保持

Web サイト、ダッシュボード、ソフトウェア、API、ドキュメント、ブランド、商標、デザイン、注文システム、請求システム、リスク管理システム、および関連テクノロジーは、VOC AI またはそのライセンサーが所有しています。本契約に基づくサービスを使用する限定的な権利を除き、当社はいかなる知的財産権もお客様に譲渡しません。

お客様が提案、フィードバック、問題報告、または改善のアイデアを当社に提供した場合、お客様は、そのフィードバックを無償で使用、コピー、変更、公開、商品化する権利を当社に付与するものとします。

いずれかの当事者が機密としてマークされた情報、またはその性質上機密であると合理的に理解されるべき情報を開示した場合、受領側当事者はそれを合理的な注意を払って保護し、本契約の履行またはサービスの提供に必要な場合にのみ使用しなければなりません。法律、規制当局、裁判所、決済サービスプロバイダー、税務当局、または紛争処理機関によって要求された開示は許可されます。

## 15. 免責事項と責任の制限

本サービスは「現状のまま」および「利用可能な状態で」提供されます。適用される法律で認められる最大限の範囲で、当社は、サービスが中断されないこと、エラーがないこと、脆弱性がないこと、損失がないこと、またはお客様のビジネス ニーズに適していること、またはモデル、API、価格、クレジット、出力、遅延、レート制限、地域の可用性、支払い方法、サードパーティ サービスが引き続き利用可能であることを保証しません。

適用法で認められる最大限の範囲で、VOC AI は、間接的、偶発的、特別、結果的、懲罰的、または懲罰的損害、逸失利益、逸失収益、逸失営業権、データ損失、事業中断、代替調達コスト、AI 出力、サードパーティのサービス行為、サードパーティの支払い行為、またはサードパーティのプラットフォーム行為に対して責任を負いません。

適用法で認められる最大限の範囲で、本サービス、注文、残高、配送、使用、返金、または本契約から生じるVOC AIの責任総額は、請求前の3か月以内に関連サービスに対して実際に支払い、返金されなかった金額、または100ドルのいずれか大きい方を超えないものとします。この制限は、法律で制限できない責任には適用されません。

## 16. 補償

適用法で認められる最大限の範囲で、お客様は、お客様のアカウント活動、ユーザー コンテンツ、API キーの使用、統合、違法使用、本契約の違反、サードパーティのポリシー違反、他者への不正提供、権利侵害、プライバシー侵害、税務情報エラー、支払い紛争、チャージバック、またはチームメンバーの行動。

## 17. 準拠法と紛争解決

放棄できない消費者保護、データ保護、または強制的な現地法の権利を制限することなく、本契約は、抵触法の規定に関係なく、米国カリフォルニア州法に準拠します。

本契約またはサービスに関連する紛争については、両当事者はまず support@flatkey.ai に連絡し、誠意を持って紛争の解決を試みます。少額訴訟問題または法律で仲裁が禁止されている問題を除き、紛争が解決されない場合、両当事者は、カリフォルニア州の規定に基づき、カリフォルニア州の管轄の仲裁プロバイダーによる仲裁に紛争を付託することに同意します。お客様および VOC AI はそれぞれ、適用法で権利放棄が認められていない限り、集団訴訟、代表訴訟、または陪審裁判を通じて紛争を解決する権利を放棄します。

## 18. 本契約の変更

当社は本契約を随時更新することがあります。重大な変更は、Web サイト、ダッシュボード、電子メール、またはその他の合理的な手段を通じて通知される場合があります。更新された契約は通常、更新後のサービスの新規注文、新規使用、および継続使用に適用されます。更新に同意しない場合は、サービスの使用を停止し、該当するポリシーに基づいて未使用残高またはアカウントの閉鎖を処理する必要があります。

## 19. 連絡先

本契約、注文、請求、返金、コンプライアンス、通知、またはサービスの問題に関するご質問については、support@flatkey.ai にお問い合わせいただくか、VOC AI株式会社, 東京都港区六本木三丁目３−２７スハラ六本木３階 まで書面でご連絡ください。


上記内容はすべて英語版に準拠するものとします。`,
    privacy: `# flatkey.ai プライバシー ポリシー

最終更新日: 2026 年 6 月 4 日

このプライバシー ポリシーでは、お客様が flatkey.ai、flatkey.ai サービス、関連 Web サイト、ダッシュボード、API、チェックアウト ページ、ドキュメント、サポート チャネルにアクセスまたは使用する際に、VOC AI株式会社 (「VOC AI」、「当社」、「当社」) がどのように情報を収集、使用、共有、保持、保護するかについて説明します。

運営主体: VOC AI株式会社, 東京都港区六本木三丁目３−２７スハラ六本木３階。

## 1. 範囲

このポリシーは、アカウント登録、組織管理、購入、チャージ、配信、API アクセス、モデル ルーティング、使用記録、請求、返金、サポート、セキュリティ レビュー、および当社が提供する関連デジタル サービスに適用されます。サードパーティ モデル サービス、決済サービス プロバイダー、ウォレット、銀行、カード ネットワーク、クラウド サービス、分析ツール、またはその他の Web サイトは、独自のプライバシー ポリシーと規約に基づいて情報を処理します。このポリシーはサードパーティのポリシーに代わるものではありません。

## 2. 当社が収集する情報

当社は、名前、電子メール アドレス、パスワードまたは認証情報、会社名、役割、チーム メンバー、請求先住所、ビジネス情報、納税者番号、VAT/GST 情報、請求書情報、注文情報、サポート メッセージ、返金リクエスト、コンプライアンス資料、ダッシュボード設定、当社との通信など、お客様が直接提供した情報を収集する場合があります。

お客様が本サービスを使用する場合、当社は、注文番号、支払い ID、配送状況、残高、信用記録、API キー名、リクエスト ID、タイムスタンプ、サービスの選択、モデルの選択、入力、出力、ファイル、画像、コード、プロンプト、使用状況、控除額、価格、遅延、エラー ログ、ルーティング情報、セキュリティ イベントなど、サービスの提供と使用に関連する情報を処理する場合があります。

また、当社は、IP アドレス、デバイス識別子、ブラウザの種類、オペレーティング システム、ネットワークから推測される位置、訪問したページ、参照 URL、セッション イベント、ログイン記録、クリックとアクション、診断ログ、クラッシュ ログ、パフォーマンス データ、不正防止信号、および同様の情報を含む技術情報を自動的に収集する場合があります。

当社は、決済サービスプロバイダー、認証プロバイダー、不正行為対策プロバイダー、サポートツール、分析ツール、企業顧客、チーム管理者、またはサードパーティサービスプロバイダーから、お客様のアカウント、注文、支払い、許可、使用状況、セキュリティ、またはサポート事項に関連する情報を受け取る場合があります。

## 3. 入力、出力、モデル処理

お客様が送信した入力および受信した出力は、サービスを提供するために必要に応じて当社のシステムを通過し、リクエストを完了するために関連するモデル サービスまたは技術サービスに送信される場合があります。モデルやサードパーティのサービスが異なれば、データ処理、ロギング、トレーニング、保持、セキュリティ ルールも異なる場合があります。特定のモデルを使用する前に適用されるルールを確認し、送信を許可されていない情報や不必要な機密情報の送信を避ける必要があります。

ダッシュボード、ドキュメント、または注文の説明で関連する機能が明示的に提供されていない限り、完全な入力履歴または出力履歴を保存することは保証されません。トラブルシューティング、セキュリティ、計測、返金、紛争、またはコンプライアンスの目的で、当社はリクエストのメタデータ、エラー記録、使用記録、必要なログ、およびサポート通信でお客様が自発的に提供した資料を保持する場合があります。

当社は、統計分析、キャパシティプランニング、コスト管理、モデルおよびサービス品質分析、製品改善、リスクモデリング、および事業運営のために、集約、匿名化、または匿名化された情報を使用することがあります。このような情報は特定の個人を合理的に特定するものではありません。

## 4. Cookie および類似のテクノロジー

当社は、ログイン状態の維持、セッションの保護、設定の記憶、チェックアウトの完了、詐欺や悪用の検出、訪問数の測定、パフォーマンスの監視、問題のトラブルシューティング、およびサービスの改善のために、Cookie、ローカル ストレージ、ピクセル、ログ、および同様のテクノロジーを使用します。ブラウザの設定を通じて一部の Cookie を制御できますが、Cookie を無効にすると、ログイン、ダッシュボード、チェックアウト、セキュリティ、使用状況統計、またはサポート機能に影響を与える可能性があります。

## 5. 支払いと注文に関する情報

支払いは、Paddle、Stripe、銀行、カード ネットワーク、ウォレット、現地の支払い方法プロバイダー、不正行為防止プロバイダー、税務プロバイダー、請求書プロバイダー、またはその他の必要なサービス プロバイダーによって処理される場合があります。当社は、支払い ID、チェックアウト ID、注文番号、支払いステータス、承認ステータス、決済ステータス、製品、金額、通貨、税額、税率、税管轄区域、請求書番号、受領書番号、返金ステータス、チャージバックまたは紛争ステータス、請求先住所、国、企業名、納税 ID、請求先電子メール、およびサポート処理に必要な情報を受信または保存する場合があります。

当社では、完全なカード番号、カード検証コード、銀行口座の認証情報、またはウォレットの認証情報を意図的に独自のシステムに保存することはありません。支払い方法のデータは、セキュリティ、プライバシー、および支払いネットワークのコンプライアンス ルールに従って、関連する支払いサービス プロバイダーによって処理されます。当社は、請求、税金、会計、サポート、返金、紛争処理のために、支払いプロバイダー名、支払い方法の種類、プロバイダーが提供するカードの下 4 桁、支払い ID、領収書 URL、請求書 URL、返金 ID、および紛争処理 ID などの限定された支払いメタデータを保持する場合があります。

## 6. 情報の使用方法

当社は、アカウントの作成と認証、注文と支払いの処理、サービス クレジットの提供、残高と使用記録の維持、API アクセスの提供、リクエストの処理、使用量と料金の計算、請求書、領収書、返金、紛争の処理、サービス通知の送信、サポート リクエストへの対応、問題のトラブルシューティング、詐欺、悪用、セキュリティ インシデント、およびポリシー違反の検出と防止、ユーザー契約とサードパーティの規則の施行、税金、会計、監査、法的およびコンプライアンスの義務の遵守、VOC の権利と安全の保護のために情報を使用します。AI、ユーザー、サードパーティ サービス プロバイダー、決済サービス プロバイダー、そして一般大衆。

お客様がマーケティング、製品アップデート、またはイベント通知の受信を選択した場合、当社はそれらの連絡を送信するためにお客様の連絡先情報を使用することがあります。電子メール内の購読解除方法を使用するか、当社に連絡することでオプトアウトできます。サービス通知、セキュリティ通知、請求通知、および法的通知は、マーケティング オプトアウトの影響を受けません。

## 7. 情報の取り扱いについて

当社は、ビジネス ニーズと担当者の責任に基づいて内部アクセスを制限し、権限管理、ロギング、合理的な暗号化、監視、バックアップ、監査プロセスを使用して、アカウント、注文、支払い、使用状況、およびサポート情報を保護します。払い戻し、チャージバック、異常な通話、セキュリティインシデント、またはコンプライアンスレビューの場合、当社はより詳細な記録を保管し、追加のレビューを実行する場合があります。

当社は、サポート通信において、完全な支払い認証情報、パスワード、平文の API キー、またはその他の不必要な機密認証情報の提供を求めることはありません。トラブルシューティングにスクリーンショットやログが必要な場合は、関係のない機密情報を編集する必要があります。資料に不必要な機密情報が含まれている場合、編集したバージョンの提出をお願いする場合があります。

当社は、情報の共有を、サービスの提供、支払いの処理、リクエストの完了、問題のトラブルシューティング、請求額の計算、返金の処理、紛争への対応、法的要件の遵守、またはサービスのセキュリティの保護に関連するものに限定するために合理的な努力を払っています。

## 8. 情報の共有方法

当社は、ホスティング、データベース、キャッシュ、ネットワーキング、ロギング、モニタリング、セキュリティ、認証、電子メール、カスタマー サポート、分析、支払い、税金、請求書、領収書、不正行為防止、コンプライアンス、監査、および専門的な助言プロバイダーを含む、サービスの運営に役立つサービス プロバイダーと情報を共有する場合があります。

サービス配信、API リクエスト、モデル呼び出し、または技術的処理を完了するために、必要なユーザー コンテンツ、リクエスト情報、アカウント ID、使用状況情報、およびメタデータをモデル サービス、API プラットフォーム、クラウド プロバイダー、ゲートウェイ プロバイダー、またはその他のサードパーティ プラットフォームに送信する場合があります。サードパーティは、独自の条件、プライバシー ポリシー、データ処理規則、および使用ポリシーに基づいて関連情報を処理します。

また、当社は、適用法、召喚状、裁判所命令、政府の要請、税務当局、決済ネットワーク規則、監査要件、規制要件によって要求された場合、または詐欺、チャージバック、支払い紛争、悪用、セキュリティインシデント、ポリシー違反、侵害、制裁リスクを調査するため、または権利、財産、安全性、およびサービスの完全性を保護するために情報を開示する場合があります。

当社が合併、買収、資金調達、再編、資産売却、破産、または同様の取引に関与している場合、その取引の一環として情報が開示または移転される場合があります。受信者は、適用される法律および本ポリシーに反映されている保護原則に従って情報を処理し続ける必要があります。

## 9. 保持

当社は、サービスの提供、アカウントと注文の記録の維持、サービス クレジットの提供、使用量と請求の計算、返金と紛争の処理、税務と会計上の義務の遵守、詐欺と悪用の防止、セキュリティのサポート、監査とコンプライアンスの要件の満たし、権利の保護に必要な期間、情報を保持します。

アカウント情報は通常、アカウント閉鎖後も合理的な期間保持されます。注文、税金、請求書、会計、および紛争の記録は、法律または決済ネットワークの規則の要求に応じて、より長く保存される場合があります。セキュリティ ログ、診断ログ、技術記録は、操作、セキュリティ、トラブルシューティングの必要に応じて保存されます。

API リクエスト、エラー、および使用状況の記録には、機能、ログの種類、セキュリティの必要性、およびコンプライアンス要件に応じて異なる保存期間が設定される場合があります。当社は、サービスの提供、問題のトラブルシューティング、請求額の計算、返金の処理、紛争への対応、悪用の防止、および法的要件を満たすために必要な範囲内で、かかる記録を保持します。

情報が不要になった場合、適用される法律およびビジネスプロセスに従って削除、匿名化、またはさらなる処理を制限します。

## 10. 国際送金

VOC AI株式会社は日本にあります。当社、当社のサービスプロバイダー、決済サービスプロバイダー、およびサードパーティのサービスプロバイダーは、日本、米国、ヨーロッパ、アジア、またはその他の国や地域で情報を処理する場合があります。それらの地域のデータ保護法は、お客様の所在地の法律と異なる場合があります。当社は、適用法で義務付けられている場合には、適切な国境を越えた転送の保護措置を講じます。

## 11. セキュリティ

当社は、情報を保護するために、アクセス制御、権限管理、ログ、合理的な暗号化、監視、バックアップ、監査、内部プロセスなどの管理的、技術的、組織的な対策を講じています。絶対的な安全性を保証できるシステムはありません。また、お客様には、アカウント、パスワード、電子メール、デバイス、API キー、アクセス資格情報、支払いアカウント、および関連サービス資格情報を保護する責任があります。

あなたのアカウント、API キー、支払い方法、またはデータが許可なくアクセスまたは使用されていると思われる場合は、ただちに当社にご連絡ください。

## 12. あなたの選択と権利

ダッシュボードで一部のアカウント、請求情報、チーム情報を更新できます。お住まいの地域および適用される法律によっては、アクセス、修正、削除、移植性、制限、異議、同意の撤回、特定のデータ共有のオプトアウトを要求したり、規制当局に苦情を申し立てたりする権利がある場合があります。

リクエストを処理する前に、お客様の身元を確認する必要がある場合があります。また、当社は、税金、会計、セキュリティ、リスク管理、支払い、紛争、監査、コンプライアンス、または法的記録など、適用される法律で許可または義務付けられている特定の情報を保持する場合があります。

当社は意図的に個人情報を金銭目的で販売することはありません。適用法により特定の広告、分析、またはデータ共有が「販売」または「共有」として扱われる場合、お客様は当社に連絡して、該当するオプトアウト権利を行使することができます。

## 13. 子供のプライバシー

本サービスは 13 歳未満の子供を対象としたものではなく、当社が故意に 13 歳未満の子供から個人情報を収集することはありません。子供が当社に情報を提供したと思われる場合は、当社が情報を確認し、必要に応じて削除できるよう、当社にご連絡ください。

## 14. ポリシーの更新

当社は、このプライバシー ポリシーを随時更新することがあります。重大な変更は、Web サイト、ダッシュボード、電子メール、またはその他の合理的な手段を通じて通知される場合があります。更新後の本ポリシーは、更新後の情報処理活動に適用されます。

## 15. 連絡先

プライバシーに関するご質問、データリクエスト、セキュリティレポート、またはデータ保護に関するお問い合わせについては、support@flatkey.ai にご連絡いただくか、VOC AI株式会社, 東京都港区六本木三丁目３−２７スハラ六本木３階 まで書面でご連絡ください。


上記内容はすべて英語版に準拠するものとします。`,
    refund: `# flatkey.ai 返金ポリシー

最終更新日: 2026 年 6 月 4 日

この返金ポリシーは、VOC AI株式会社 (「VOC AI」、「当社」、「当社」) が flatkey.ai、チェックアウト ページ、ダッシュボード、サポート チャネルを通じて提供する flatkey.ai サービス (アカウントのチャージ、プリペイド アカウント残高、サービス クレジット、API の使用状況、デジタル サービスの提供、および関連するサポート事項を含む) に適用されます。

運営主体: VOC AI株式会社, 東京都港区六本木三丁目３−２７スハラ六本木３階。

## 1. 基本原則

flatkey.ai はデジタル サービスを提供します。アカウント残高、サービス クレジット、および関連デジタル サービスは、通常、支払いまたは注文の承認が成功した直後に電子的に配信され、API リクエスト、モデル呼び出し、ファイル処理、画像処理、リクエスト処理、またはその他の有料機能にすぐに使用できます。配信および使用が発生すると、サードパーティ モデル、クラウド サービス、支払い、税金、ネットワーク、およびインフラストラクチャのコストが発生する可能性があります。

当社の返金原則は次のとおりです。不達、二重請求、検証可能なシステムエラー、必須の法的要件は優先的に審査されます。配信および使用されたクレジット、消費された残高、完了したリクエスト、および正常に提供されたデジタル サービスは、通常、払い戻しできません。

このポリシーは、適用法によって規定される消費者の非放棄的な返金、キャンセル、撤回、デジタル コンテンツ、デジタル サービス、または支払いに関する紛争の権利を制限するものではありません。

## 2. 未使用残高の返金窓口

未使用のアカウント残高またはサービス クレジットは、購入完了後 24 時間以内に払い戻し審査のために提出できます。24 時間を経過すると、適用される法律で別段の定めがある場合、決済サービスプロバイダーの規則で別段の定めがある場合、または重複請求、配達不能、検証可能なシステム エラー、税または請求書エラーが当社で確認された場合を除き、未使用の残高は通常、現金払い戻しの対象にはなりません。

購入ページ、注文の説明、企業契約、または適用される法律でより長い払い戻し期間が規定されている場合は、より具体的なルールが適用されます。プロモーション、特典、トライアル、クーポン、ギフト、無料残高、または無料クレジットは、通常、現金払い戻しの対象にはなりません。

## 3. 当社が検討する場合がある返金または調整

次の状況では、返金、残高の回復、信用訂正、またはアカウントの調整をリクエストできます。

- 同じ注文が複数回請求さ​​れた。
- 支払いは成功しましたが、アカウント残高、サービス クレジット、またはデジタル サービスが提供されませんでした。
- 支払いが失敗したか、取り消されたか、またはキャンセルされましたが、支払い方法には依然として料金が表示されます。
- 当社の検証可能なシステムエラーにより、重複した控除、誤った控除、誤った計量、または誤ったクレジットの配信が発生した。
- 購入後 24 時間以内にリクエストし、関連する残高またはクレジットが使用、譲渡、乱用、または不審な活動に関連付けられていないこと。
- 税金、請求書、領収書、通貨、注文金額、または支払い方法の処理には修正が必要です。
- 適用法、決済サービスプロバイダーの規則、デジタルサービス規則、税金規則、または決済ネットワーク規則により返金が必要となる場合。
- VOC AI、Paddle、Stripe、またはその他の元の注文支払いサービス プロバイダーは、審査後に返金または調整が適切であると判断します。

承認および処理方法は、注文状況、配送記録、使用記録、支払い状況、税金および請求書の要件、リスクレビューの結果、決済サービスプロバイダーの規則、および適用される法律によって異なります。

## 4. レビュープロセス

当社は、注文記録、決済サービスプロバイダーの記録、配送記録、残高記録、使用ログ、リクエストID、エラー記録、サポート通信、納税記録、請求書記録を使用して返金または調整リクエストを確認します。使用に関する紛争については、リクエストが実際に発生したかどうか、残高が差し引かれたかどうか、重複した差し引きが発生したかどうか、システムエラーがあったかどうか、関連するリクエストがアカウント、API キー、チームメンバー、アプリケーション、または統合からのものかどうかに焦点を当てます。

レビュー中に、アカウントの電子メール、注文番号、支払い ID、領収書、請求書、リクエスト ID、タイムスタンプ、スクリーンショット、エラー メッセージ、またはその他の合理的に必要な情報の提供を求める場合があります。ご注文、アカウント所有者、配送状況、使用状況、支払い状況を確認できないリクエストは承認されない場合があります。

関連する注文または使用に不正な再販、中継、アカウント共有、真のユーザーの隠蔽、大量のアカウント作成、異常な集中通話、詐欺、悪用、制裁リスク、チャージバックの悪用、または回避の制限が含まれていることが判明した場合、当社は審査の一時停止、返金の拒否、残高の回復の制限、またはユーザー契約に基づくアカウント制限措置を講じることがあります。

同じ注文でチャージバック、支払い紛争、支払い取り消し、または支払いサービス プロバイダーの調査プロセスが開始された場合、当社は通常、関連する支払いサービス プロバイダーまたはカード ネットワーク プロセスを通じて処理し、重複した払い戻しや会計上の矛盾を避けるために、独立した現金払い戻しを同時に個別に発行することはありません。紛争処理終了後、アカウント残高または請求の修正が必要な場合は、最終結果とシステム記録に基づいて処理します。

## 5. 通常返品不可の商品

適用される法律で別段の定めがある場合を除き、通常、以下のものは返金できません。

- API リクエスト、モデル呼び出し、ファイル処理、画像処理、キャッシュの使用、リクエスト処理、またはその他の有料機能に使用される残高またはサービス クレジット。
- 正常に配信および開始されたデジタル サービス。
- アカウント、チームメンバー、API キー、自動スクリプト、統合、キーの漏洩、権限設定、内部担当者、または承認されたユーザーによって発生する料金。
- サードパーティのモデル費用、クラウド サービスの費用、最低料金、超過使用量、税金、通貨換算差額、銀行手数料、カード ネットワーク料金、ネットワーク料金、決済サービス プロバイダー料金、またはサードパーティ プラットフォーム料金。
- プロモーション、特典、トライアル、クーポン、ギフト、無料残高、または無料クレジット。
- 詐欺、悪用、制裁リスク、違法使用、ポリシー違反、アカウント共有、不正再販、中継、他者への提供、チャージバックの悪用、または制限の回避に関連する注文、残高、またはサービス クレジット。
- AI 出力の品質、モデルの動作、サービスの可用性、遅延、レート制限、価格変更、地域制限、またはサードパーティのポリシー変更に対する不満に基づくリクエスト (サービスが説明どおりに提供された場合、または関連するクレジットが使用された場合)。
- 適用される法律または決済サービスプロバイダーの規則により修正または返金が必要な場合を除き、お客様が提供した不正確なアカウント、電子メール、請求情報、税金、ビジネス情報、請求書、または支払い情報によって引き起こされた問題。

## 6. デジタルコンテンツと消費者の権利

配信され、すぐに使用できるデジタル コンテンツまたはデジタル サービスについては、適用法で認められる範囲で、アカウント残高、サービス クレジット、または関連サービスが配信された後、または関連サービスの使用を開始した後は、法定のキャンセルまたは撤回の権利を失う場合があります。

お客様の所在地が放棄できない消費者保護、返金、撤回、キャンセル、または紛争の権利を提供している場合、本ポリシーの他の部分に別の記載がある場合でも、当社は適用法に従ってリクエストを処理します。

## 7. 返金リクエスト方法

support@flatkey.ai に連絡し、次の情報をできるだけ多く提供してください。

- アカウントのメールアドレス。
- 注文番号、支払い ID、Paddle レシート番号、Stripe レシート番号、支払い参照番号、または請求書番号。
- 購入日、金額、通貨、支払い方法の種類。
- 返金または調整リクエストの理由。
- 関連するスクリーンショット、エラー メッセージ、配信ステータス、残高記録、またはダッシュボードの記録。
- 使用法の問題、API キー名、リクエスト ID、タイムスタンプ、モデル、またはサービス名。

重複請求、不達、誤った控除、請求書の間違い、税金の問題、または支払いの異常は、発見次第すぐに提出する必要があります。当社は、アカウントの所有権、購入記録、配送状況、使用状況、支払い状況、税金情報、返金資格を確認するために追加情報を要求する場合があります。

## 8. 返金方法と処理時間

承認された現金払い戻しは通常、元の支払い方法に戻ります。処理時間は、Paddle、Stripe、銀行、カード ネットワーク、ウォレット、現地の支払い方法プロバイダー、およびその他の関連サービス プロバイダーによって異なります。第三者がいつ投稿を完了するかについては保証できません。

場合によっては、特に問題が配達の失敗、誤った計量、重複した控除、または口座記録のエラーに関するものである場合、残高の回復、信用訂正、口座調整、クレジットノート、請求書の訂正、または領収書の更新を通じて問題を解決することがあります。

税金、請求書、クレジットノート、領収書、通貨換算、および支払い方法の制限は、元の注文の支払いサービスプロバイダーによって処理される場合があります。注文がチャージバック、紛争、リスク管理、税務調査、または決済サービスプロバイダーの制限ステータスに入っている場合、返金にはさらに時間がかかるか、関連するプロセスに従う必要がある場合があります。

## 9. Paddle、Stripe、その他の決済サービスプロバイダー

注文が登録販売者または販売者として Paddle によって処理される場合、Paddle はそのプロセスに従って、返金、税金、請求書、クレジットノート、領収書、および支払いに関する紛争事項を決定または実行することがあります。

注文が Stripe または別の決済処理業者によって処理された場合、VOC AI は返金リクエストを確認し、可能な場合には、承認された返金を元の支払い方法に戻すよう処理業者に指示することがあります。処理ルールとタイミングは、決済サービスプロバイダー、国、通貨、支払い方法、銀行によって異なる場合があります。

## 10. チャージバックと支払いに関する紛争

お客様がチャージバック、支払いに関する異議申し立て、支払いの取り消し、または同様のプロセスを開始した場合、当社は調査中に関連するアカウント、API キー、残高、サービス クレジット、注文、またはサービス アクセスを一時停止することがあります。

当社は、紛争を調査し対応するために、注文記録、配送記録、使用ログ、残高記録、納税記録、請求書、領収書、返金記録、サポート通信、アカウント活動、およびセキュリティ記録を Paddle、Stripe、銀行、カード ネットワーク、ウォレット、支払いネットワーク、税務サービス プロバイダー、または紛争処理機関に提供する場合があります。

二重請求、配達不能、誤った控除、税金の問題、請求書、領収書、請求書の問題については、まずご連絡ください。チャージバックを直接開始すると、アカウントの停止、払い戻しの遅延、異議申し立て手数料、または将来の購入制限が発生する可能性があります。

すでに銀行、カード ネットワーク、ウォレット プロバイダー、または決済サービス プロバイダーに連絡して紛争を開始している場合は、払い戻しの連絡で紛争のステータスと参照番号をお知らせください。進行中の異議申し立てを非表示にしたり、同時に重複して払い戻しを要求したり、払い戻しを受け取った後にチャージバックを継続したりすることは、チャージバックの不正行為として扱われる可能性があります。

## 11. ポリシーの更新

当社は、この返金ポリシーを随時更新することがあります。更新されたポリシーは、適用される法律または決済サービスプロバイダーの規則で別段の定めがある場合を除き、更新後に発生する購入、配送、使用、および返金リクエストに通常適用されます。

## 12. 連絡先

購入、配送、アカウント残高、サービス クレジット、重複請求、誤った控除、税金、請求書、領収書、返金資格、Paddle の領収書、Stripe の領収書、または支払いに関する紛争に関するご質問については、support@flatkey.ai までご連絡いただくか、VOC AI株式会社, 東京都港区六本木三丁目３−２７スハラ六本木３階 まで書面でご連絡ください。

上記内容はすべて英語版に準拠するものとします。`,
    sla: `# flatkey.ai サービス レベル契約

最終更新日: 2026 年 6 月 13 日

本サービス レベル契約 (「SLA」) は、VOC AI株式会社 (「VOC AI」、「当社」) が提供する flatkey.ai サービスの可用性目標およびサポート プロセスを説明するものです。

## 1. 範囲

本 SLA は、当社が直接運用する flatkey.ai のホスト型ダッシュボード、API ゲートウェイ、ルーティング、計測、およびアカウント サービスに適用されます。第三者 AI モデル プロバイダー、決済プロバイダー、顧客ネットワーク、顧客アプリケーション、ベータ機能、不可抗力、計画メンテナンス、不正利用対策、アカウント停止、または顧客の設定、認証情報、統合、ポリシー違反に起因する問題には適用されません。

## 2. 可用性目標

当社は、対象となる flatkey.ai サービス エンドポイントについて月間 99.5% の可用性を目標とします。可用性は、対象サービスに対する当社の本番監視システムによって測定されます。

## 3. メンテナンスおよびサービス変更

当社は、セキュリティ、信頼性、性能、またはコンプライアンスを改善するために、計画メンテナンスまたは緊急メンテナンスを実施する場合があります。当社は顧客への影響を軽減するため合理的な努力を行い、実務上可能な場合、ダッシュボード、ウェブサイト、メール、またはサポート チャネルで通知します。

## 4. 第三者依存関係

flatkey.ai はリクエストを第三者モデル プロバイダーにルーティングし、クラウド、ネットワーク、決済、セキュリティ、分析プロバイダーに依存します。第三者の障害、レート制限、ポリシー変更、地域制限、モデル動作、またはプロバイダー側の失敗は本 SLA の対象外です。

## 5. サポート

サービス可用性の問題については、support@flatkey.ai まで、アカウント メール、影響を受けたエンドポイント、利用可能なリクエスト ID、タイムスタンプ、エラー メッセージ、影響概要を添えてご連絡ください。当社は重大度、利用可能な記録、運用リスクに基づいてサポート リクエストを確認します。

## 6. 救済

別途書面契約で異なる救済が定められていない限り、本 SLA は自動的なサービス クレジット、返金、違約金、または予定損害賠償を生じさせるものではありません。善意による調整、残高修正、またはサポート上の対応は、ユーザー契約および適用ポリシーに基づき個別に処理されます。

## 7. 更新

当社は本 SLA を随時更新する場合があります。更新後の SLA は通常、更新後のサービス期間に適用されます。

## 8. 連絡先

本 SLA またはサービス インシデントに関するご質問は、support@flatkey.ai までご連絡いただくか、VOC AI株式会社, 東京都港区六本木三丁目３−２７スハラ六本木３階 まで書面でご連絡ください。

上記内容はすべて英語版に準拠するものとします。`,
  },
  ru: {
    terms: `# Пользовательское соглашение flatkey.ai

Последнее обновление: 4 июня 2026 г.

Настоящее Пользовательское соглашение («Соглашение») применяется к услугам flatkey.ai, предоставляемым VOC AI INC («VOC AI», «мы», «нас» или «наш») через flatkey.ai, панель управления, API, страницы оформления заказа, документацию и каналы поддержки («Услуги»).Регистрируя учетную запись, создавая организацию, добавляя предоплаченный баланс счета, генерируя или используя ключ API, вызывая API модели, получая доступ к информационной панели или иным образом используя Услуги, вы соглашаетесь с настоящим Соглашением, нашей Политикой конфиденциальности, Политикой возврата средств, документацией, страницами с ценами и любыми применимыми дополнительными правилами.

Операционная организация: VOC AI INC, 160 E Tasman Drive, Suite 202, Сан-Хосе, Калифорния 95134, США.Контакт: support@flatkey.ai.

## 1. Обзор услуг

flatkey.ai — это доступ к AI API, маршрутизация моделей, измерение использования, информационная панель и служба предоплаченного баланса счета.Пользователи могут получить доступ к различным возможностям модели ИИ через унифицированный API и панель управления, управлять ключами API, разрешениями команды, выбором модели, записями запросов, балансами, кредитами, выставлением счетов и вопросами поддержки.

flatkey.ai — это не сама модель.Мы не гарантируем, что какая-либо конкретная модель, API, цена, контекстное окно, ограничение скорости, региональная доступность, поведение вывода, правило обработки данных или сторонняя политика останутся доступными или неизмененными.Мы можем добавлять, удалять, ограничивать или изменять модели, функции, цены и правила использования в зависимости от потребностей продукта, изменений стоимости, требований безопасности, обязательств по обеспечению соответствия, требований поставщика моделей или изменений в сторонних услугах.

## 2. Право на участие, счета и организации

Вам должно быть не менее 13 лет.Если вам меньше 18 лет, вам необходимо получить разрешение от вашего родителя или законного опекуна.Если вы используете Услуги от имени компании, организации или другого лица, вы подтверждаете, что у вас есть полномочия принять настоящее Соглашение от имени этого лица.

Вы должны предоставить правдивую, точную, полную и текущую учетную, деловую, платежную, налоговую и контактную информацию.Вы несете ответственность за администраторов, участников, приложения, ключи API, учетные данные доступа, запросы, интеграцию, способы оплаты и использование баланса под вашей учетной записью.

Администраторы организации могут приглашать членов команды и настраивать разрешения, бюджеты, модели, журналы, ключи и параметры безопасности.Конфигурации администратора могут повлиять на членов организации и конечных пользователей вашего приложения.Вы должны убедиться, что члены вашей команды и конечные пользователи соблюдают настоящее Соглашение, нашу документацию и применимые условия поставщика модели.

Если вы считаете, что ваша учетная запись, ключ API, учетные данные доступа, способ оплаты или доступ к панели управления были использованы без авторизации, вы должны немедленно связаться с нами и предпринять соответствующие шаги для отзыва, ротации, отключения или ограничения доступа.

## 3. Предоплаченный баланс, комиссии и цифровая доставка

Службы могут потребовать от вас приобрести предоплаченный баланс счета или кредиты на услуги перед вызовом API или использованием определенных функций.Перед покупкой у вас будет возможность просмотреть сумму заказа, валюту, налоги, сборы, способ оплаты и правила ценообразования, указанные на соответствующей странице.

Остаток счета и кредиты на услуги можно использовать только для соответствующих критериям услуг flatkey.ai.Это не наличные, депозиты, электронные деньги, подарочные карты, платежные инструменты, счета для снятия средств или финансовые продукты.Если мы прямо не договорились в письменной форме или действующее законодательство не требует иного, баланс счета и кредиты на услуги не могут быть сняты, погашены за наличные, переуступлены, использованы в качестве залога, инвестированы или использованы вне Услуг.

После успешной оплаты или утверждения заказа приобретенный баланс или кредиты обычно доставляются в электронном виде на вашу учетную запись и могут быть немедленно использованы для запросов API, вызовов моделей или других платных функций.Когда вы делаете запрос, система списывает баланс в соответствии с текущей ценой модели, использованием входных данных, использованием выходных данных, попаданиями в кэш, запросами, файлами, изображениями, налогами, сборами, конвертацией валюты и любыми другими правилами выставления счетов, показанными на соответствующей странице или в процессе оформления заказа.

Срок действия баланса или кредитов определяется страницей покупки, описанием заказа, отображением панели управления или письменным подтверждением от нас.Мы можем ограничить, заморозить, отменить или обрабатывать в соответствии с Политикой возврата любой баланс или кредиты, связанные с длительно неактивными учетными записями, приостановленными учетными записями, закрытыми учетными записями, мошеннической деятельностью или нарушениями политики.

## 4. Платежи, налоги и счета-фактуры

Вы разрешаете VOC AI и нашим поставщикам платежных услуг взимать с вас выбранный способ оплаты суммы заказа, налоги, сборы и другие применимые сборы.Платежи могут обрабатываться Paddle, Stripe, банками, карточными сетями, кошельками, местными поставщиками способов оплаты, поставщиками услуг по борьбе с мошенничеством, поставщиками налогов, поставщиками счетов или другими поставщиками необходимых услуг.

В зависимости от метода оформления заказа сторона, ответственная за сбор средств, выставление счетов, расчет налогов, возврат средств и разрешение споров, может различаться.Если Paddle обрабатывает заказ в качестве зарегистрированного продавца или продавца, Paddle может нести ответственность за сбор платежей, налоги, счета-фактуры, квитанции, возврат средств и рабочие процессы по спорам о платежах.Если Stripe или другой поставщик выступает только в качестве обработчика платежей, VOC AI может оставаться продавцом, а обработчик может осуществлять деятельность, связанную с платежами, от нашего имени.

Вы должны предоставить точный платежный адрес, название компании, идентификационный номер налогоплательщика, информацию об НДС/GST, адрес электронной почты и информацию о счете.Вы несете ответственность за налоги, проблемы со счетами, проблемы с квитанциями, сбои в платежах, задержки возврата средств, проверки соблюдения требований или дополнительные расходы, вызванные неточной, неполной или устаревшей информацией.

## 5. Условия и ограничения поставщика модели

Службы могут предоставлять вам, членам вашей команды, вашим приложениям или конечным пользователям доступ к моделям, API, инструментам или функциям, предоставляемым сторонними поставщиками моделей или поставщиками технических услуг.Вы понимаете и соглашаетесь с тем, что использование любой модели или сторонней службы также может регулироваться условиями, политиками, региональными ограничениями, правилами безопасности, правилами обработки данных и ограничениями использования этой модели или сторонней службы.

Перед использованием конкретной модели вы несете ответственность за подтверждение того, что модель и ее правила подходят для вашего варианта использования, включая коммерческое использование, использование для клиентов, конфиденциальные данные, регулируемые отрасли, решения с высоким уровнем риска, региональный доступ, несовершеннолетние, безопасность контента и публикацию результатов.Вы также должны убедиться, что члены вашей команды и конечные пользователи используют соответствующие модели в соответствии с настоящим Соглашением, нашей документацией и применимыми сторонними правилами.

Некоторые модели или функции могут не разрешать доступ для определенных регионов, отраслей, организаций, целей или типов запросов.Вы не имеете права использовать VPN, прокси-серверы, несколько учетных записей, ложную информацию, технические обходные пути или другие методы для обхода ограничений модели, региона, идентификации, безопасности или соответствия требованиям.Мы можем приостановить, ограничить, закрыть или удалить ваш доступ к соответствующим моделям, учетным записям, ключам API, балансу или функциям, если мы получим запрос третьей стороны, обнаружим риск или обоснованно полагаем, что правила были нарушены.

Мы не изменяем, не отменяем и не заменяем условия сторонних поставщиков моделей.Поставщики моделей могут в любое время изменить свои условия, цены, функции, доступность, методы обработки данных или ограничения доступа.Продолжение использования модели означает, что вы принимаете действующие на тот момент правила.

## 6. Ответственность за конфигурацию

Вы несете ответственность за выбор моделей, настройку учетных записей, настройку разрешений для группы, управление ключами API, настройку бюджетов и ограничений ставок, контроль источников запросов, проверку входных и выходных данных, а также определение того, подходят ли Услуги для вашего бизнес-сценария.

Если вы интегрируете flatkey.ai в свой собственный продукт или услугу, вы должны сохранить контроль над своим приложением, доступом конечных пользователей, разрешениями учетной записи, ключами API, балансом, кредитами, источниками запросов, журналами, обработкой злоупотреблений и поддержкой клиентов.Вы не можете разрешить конечным пользователям напрямую получать, контролировать, перепродавать, разделять, массово использовать или обходить ваше приложение для использования учетных записей flatkey.ai, ключей API, баланса или кредитов.

Вы несете ответственность за членов своей команды, приложения, интеграцию, конечных пользователей, автоматизированные сценарии, настройки разрешений и управление ключами.Вы несете ответственность за использование, сборы, споры или убытки, вызванные вашей конфигурацией, утечкой ключей, поведением конечного пользователя, настройками разрешений, ошибками сценариев или внутренними проблемами управления, если они не вызваны напрямую проверяемой системной ошибкой.

## 7. Пользовательский контент и результаты искусственного интеллекта

Подсказки, текст, файлы, изображения, код, данные, конфигурации, запросы и другой контент, который вы отправляете в Службы, являются «Входными данными».Ответы модели, сгенерированный контент или другие результаты, возвращаемые Службами, являются «Выходными данными».Входные и выходные данные вместе являются «Пользовательским контентом».

Вы сохраняете за собой права, которыми вы по закону обладаете в отношении своих Входных данных.Для предоставления, маршрутизации, измерения, устранения неполадок, поддержки, защиты, аудита, проверки возмещения средств и улучшения Услуг вы предоставляете нам неисключительную, действующую во всем мире, безвозмездную лицензию на обработку, передачу, хранение, копирование, отображение и использование Пользовательского контента и связанных с ним метаданных по мере необходимости.

Вы заявляете, что обладаете всеми правами, разрешениями и согласиями, необходимыми для отправки, обработки и передачи Входных данных.Вы не имеете права отправлять контент, который нарушает права интеллектуальной собственности, права на неприкосновенность частной жизни, обязательства по конфиденциальности, договорные обязательства или применимое законодательство.

Результаты ИИ могут быть неточными, неполными, устаревшими, повторяющимися, предвзятыми, небезопасными, непригодными для определенной цели или похожими на сторонний контент.Вы должны независимо просмотреть и проверить Результаты, прежде чем полагаться на них, публиковать, использовать их в коммерческих целях, внедрять в производство или использовать их для юридических, медицинских, финансовых, трудовых, кредитных, безопасности, соблюдения требований или других важных решений.Мы не гарантируем точность, уникальность, пригодность, доступность или отсутствие нарушений каких-либо результатов.

Если в информационной панели, документации или описании заказа явно не предусмотрена соответствующая функция, мы не обещаем хранить полную историю ввода или вывода.В целях устранения неполадок, обеспечения безопасности, измерения, возврата денег, споров или соблюдения требований мы можем сохранять метаданные запросов, записи об ошибках, записи использования и необходимые журналы.

## 8. Запрещено перепродажа, ретрансляция или конкурентное использование.

Учетные записи flatkey.ai, ключи API, баланс учетной записи, кредиты на услуги, возможности доступа к моделям и возможности информационной панели предназначены для использования вами и вашей авторизованной командой в вашем собственном бизнесе или приложении.Если мы не заключим отдельное письменное соглашение, вы не имеете права предоставлять flatkey.ai третьим лицам в качестве отдельного API, баланса, кредита, субсчета, услуги пополнения счета, услуги ретрансляции, услуги ребрендинга, услуги агрегирования или аналогичной услуги, будь то путем продажи, передачи, распространения, аренды, совместного использования или другого косвенного соглашения.

Вы не имеете права получать доступ к Сервисам или использовать их с целью перепродажи доступа к API, создания конкурирующей службы, обхода правил сторонней модели, сокрытия истинного конечного пользователя, обхода цен или ограничений, обхода региональных ограничений, обхода проверки безопасности или обхода проверки платежей.

Несанкционированная перепродажа, передача, совместное использование учетной записи, сокрытие истинного пользователя, массовое создание учетной записи, ненормальные концентрированные звонки, обход ограничений или уклонение от контроля рисков являются существенным нарушением.Мы можем приостановить или прекратить действие связанных учетных записей, ключей API, баланса, кредитов и заказов, а также отказать или ограничить соответствующие возвраты средств, восстановление баланса или корректировку кредита.

## 9. Запрещенное поведение

Вы не можете:

- использовать Услуги для незаконных, мошеннических, нарушающих права, преследования, спама, вредоносного ПО, фишинга, системных атак, уклонения от нормативных требований, вторжения в частную жизнь, сбора конфиденциальных данных, уклонения от санкций, нарушения экспортного контроля или другой вредной деятельности;
- создавать ложные личности, выдавать себя за других, искажать сведения о принадлежности или использовать несколько учетных записей, чтобы избежать ограничений, контроля рисков, ценообразования, возмещения или проверки соответствия;
- обходить или вмешиваться в ограничения учетной записи, региональные ограничения, правила выставления счетов, кредитные лимиты, ограничения ставок, механизмы безопасности, правила борьбы со злоупотреблениями, ограничения сторонних услуг или процессы проверки платежей;
- реконструировать, сканировать, атаковать, стресс-тестировать, нарушать, сканировать, копировать, очищать или получать без разрешения доступ к Сервисам, API, системам, данным или учетным записям других пользователей;
- проводить состязательное тестирование, быстрое внедрение, тестирование джейлбрейка, тестирование обхода безопасности, стресс-тестирование или другое тестирование, которое может нанести ущерб моделям, Сервисам, сторонним правилам или интересам пользователей без нашего письменного разрешения;
- отправлять или распространять контент, нарушающий авторские права, незаконный, вредоносный, мошеннический, вводящий в заблуждение, преследующий, сексуальный, жестокий, разжигающий ненависть, нарушающий конфиденциальность, ограниченный или нарушающий политику третьих лиц;
- помогать, поощрять или разрешать третьим лицам совершать любые из вышеперечисленных действий.

## 10. Отчеты об учете, доставке и проверке

Мы ведем записи о заказах, платежах, доставке, балансе, кредите, запросах, вычетах, ошибках, возмещениях, возвратных платежах, спорах и безопасности, чтобы проверить, была ли доставка завершена, имело ли место использование, правильно ли был списан баланс, действителен ли запрос на возврат и показывает ли учетная запись ненормальное использование.

Мы прилагаем разумные усилия для обеспечения точности записей учета и выставления счетов, но в сложных системах могут возникать задержки, ошибки, дублированные записи или различия в отображении.Если возникает поддающаяся проверке системная ошибка, мы можем устранить ее путем восстановления баланса, корректировки кредита, корректировки счетов или возврата денег.Скриншоты пользователей, сторонние записи или локальные журналы могут считаться вспомогательными материалами, но при окончательной проверке будут учитываться записи нашей системы, записи поставщиков платежных услуг и необходимые записи сторонних услуг.

Чтобы защитить стабильность сервиса и других пользователей, мы можем отслеживать ненормальные запросы, ненормальные списания, ненормальные входы в систему, ненормальные платежи, массовые вызовы, утечку ключей, вредоносные запросы, злоупотребление возвратными платежами и модели использования, которые нарушают настоящее Соглашение, а также можем временно ограничить соответствующие функции во время расследования.

Мы можем проводить ручную или автоматическую проверку заказов с высоким риском, крупных пополнений, ненормальной частоты пополнений, противоречивой платежной информации, ненормальных регионов входа в систему, ненормальных источников запросов, кратковременного высокого параллелизма или предупреждений поставщика платежных услуг.Во время проверки доставка, использование баланса, возврат средств, счета-фактуры или функции учетной записи могут быть отложены или ограничены.После проверки мы восстановим или решим соответствующие вопросы в соответствии с применимыми записями.

## 11. Возврат средств

Возврат средств, восстановление баланса, корректировка кредитов и корректировка поддержки осуществляются в соответствии с нашей Политикой возврата средств flatkey.ai.Как правило, доставленные и использованные кредиты, израсходованный баланс, выполненные запросы и успешно предоставленные цифровые услуги не подлежат возврату.

Двойные платежи, непоставка, проверяемые системные ошибки, неиспользованный баланс, ошибки в налогах или счетах, споры по платежам, обязательные права потребителей или требования поставщика платежных услуг будут проверены на основе записей о заказах, записях о доставке, записях об использовании, статусе платежа и применимых правилах.

## 12. Сторонние сервисы

Сервисы могут использовать сторонние модели, API, платформы, облачные сервисы, платежные сервисы, налоговые сервисы, сервисы выставления счетов, хостинг, базы данных, электронную почту, инструменты аналитики, безопасности и поддержки.Третьи стороны предоставляют услуги и обрабатывают данные в соответствии со своими собственными условиями, политиками и техническими правилами.

Услуги третьих лиц могут быть приостановлены, ограничены по ставке, отклонены, прекращены, изменены цены, изменены, ограничены по регионам или могут быть изменены методы обработки данных.Мы будем прилагать разумные усилия для поддержания Сервисов, но мы не гарантируем постоянную доступность каких-либо сторонних сервисов и не несем ответственности за пределами настоящего Соглашения за сбои третьих сторон, изменения политики, сетевые проблемы, региональные ограничения, поведение модели, качество продукции или изменения затрат третьих сторон.

## 13. Приостановление, прекращение действия и изменения в обслуживании

Если мы считаем, что вы нарушили настоящее Соглашение или политики третьих лиц, использовали Услуги незаконно, участвовали в мошенничестве, создавали риск санкций, создавали риск оплаты, злоупотребляли возвратными платежами, создавали угрозу безопасности, предоставляли Услуги другим лицам без разрешения, вызывали ненормальное использование или причиняли вред нам или третьим лицам, мы можем приостановить или прекратить действие учетных записей, заказов, ключей API, баланса, кредитов, разрешений команды или доступа к услугам.

В максимальной степени, разрешенной применимым законодательством, баланс или кредиты, связанные с мошенничеством, злоупотреблением, нарушением политики, риском санкций, незаконным использованием, злоупотреблением возвратом платежей, несанкционированным предоставлением другим лицам или серьезными инцидентами безопасности, могут быть ограничены, заморожены, отменены, отказано в доставке или не возвращены.

Вы можете прекратить использование Сервисов.Закрытие учетной записи не влияет на платежные обязательства, ответственность за использование, разрешение споров, проверку соответствия, обязательства по возмещению убытков или положения настоящего Соглашения, которые по своей природе должны продолжать применяться.

Мы можем изменить, приостановить или прекратить работу части или всех Услуг, моделей, функций, цен, документации или методов доступа.Если действующее законодательство или Политика возврата не требуют иного, мы не несем ответственности за возврат средств, ущерб или компенсацию в связи с изменениями моделей третьих лиц, прекращением использования функций, изменениями цен, региональными ограничениями, ограничениями тарифов или изменениями в услугах.

## 14. Интеллектуальная собственность, обратная связь и конфиденциальность

Веб-сайт, панель управления, программное обеспечение, API, документация, бренды, товарные знаки, дизайн, системы заказов, системы выставления счетов, системы контроля рисков и соответствующие технологии принадлежат VOC AI или ее лицензиарам.За исключением ограниченного права на использование Услуг по настоящему Соглашению, мы не передаем вам никаких прав интеллектуальной собственности.

Если вы предоставляете нам предложения, отзывы, отчеты о проблемах или идеи по улучшению, вы предоставляете нам право использовать, копировать, изменять, публиковать и коммерциализировать эти отзывы без оплаты вам.

Если какая-либо из сторон раскрывает информацию, которая помечена как конфиденциальная или должна разумно пониматься как конфиденциальная по своему характеру, принимающая сторона должна защищать ее с разумной осторожностью и использовать ее только в случае необходимости для выполнения настоящего Соглашения или предоставления Услуг.Разглашение информации, требуемое законом, регулирующими органами, судами, поставщиками платежных услуг, налоговыми органами или органами по разрешению споров, разрешено.

## 15. Отказ от ответственности и ограничение ответственности

Услуги предоставляются «как есть» и «по мере доступности».В максимальной степени, разрешенной действующим законодательством, мы не гарантируем, что Услуги будут работать бесперебойно, без ошибок, без уязвимостей, без потерь или будут подходить для нужд вашего бизнеса, а также что любая модель, API, цена, кредит, выход, задержка, ограничение скорости, региональная доступность, способ оплаты или сторонние услуги останутся доступными.

В максимальной степени, разрешенной применимым законодательством, VOC AI не несет ответственности за косвенные, случайные, особые, косвенные, штрафные или штрафные убытки, упущенную выгоду, упущенный доход, утраченную репутацию, потерю данных, прерывание бизнеса, затраты на замену закупок, результаты ИИ, поведение сторонних служб, платежное поведение третьих лиц или поведение сторонней платформы.

В максимальной степени, разрешенной применимым законодательством, общая ответственность VOC AI, возникающая в связи с Услугами, заказами, остатком, доставкой, использованием, возмещениями или настоящим Соглашением, не будет превышать большую из сумм, которые вы фактически заплатили за соответствующие Услуги в течение 3 месяцев до подачи претензии и не были возвращены, или 100 долларов США. Это ограничение не распространяется на ответственность, которая не может быть ограничена законом.

## 16. Возмещение ущерба

В максимальной степени, разрешенной применимым законодательством, вы обязуетесь возмещать и ограждать VOC AI, ее аффилированные лица, поставщиков услуг и сторонних поставщиков услуг от претензий, убытков, обязательств, штрафов, издержек и расходов, возникающих в результате активности вашей учетной записи, пользовательского контента, использования ключа API, интеграции, незаконного использования, нарушения настоящего Соглашения, нарушения политик третьих лиц, несанкционированного предоставления третьим лицам, нарушений конфиденциальности, ошибок в налоговой информации, споров по платежам, возвратных платежей или поведения членов команды.

## 17. Применимое право и разрешение споров

Настоящее Соглашение регулируется законодательством штата Калифорния, США, без учета норм коллизионного права, не ограничивая никакую защиту потребителей, защиту данных или обязательные права местного законодательства, от которых нельзя отказаться.

В случае любого спора, касающегося настоящего Соглашения или Услуг, стороны сначала попытаются добросовестно разрешить спор, обратившись по адресу support@flatkey.ai.Если спор не разрешен, за исключением вопросов мелких претензий или вопросов, по которым арбитраж запрещен законом, стороны соглашаются передать спор на рассмотрение в арбитраж в Калифорнии перед компетентным органом арбитража в соответствии с его правилами.Вы и VOC AI отказываетесь от права разрешать споры посредством коллективных исков, представительских исков или судов присяжных, если применимое законодательство не разрешает такой отказ.

## 18. Изменения к настоящему Соглашению

Мы можем время от времени обновлять настоящее Соглашение.О существенных изменениях можно уведомлять через веб-сайт, информационную панель, электронную почту или другие разумные средства.Обновленное Соглашение обычно применяется к новым заказам, новому использованию и продолжению использования Услуг после обновления.Если вы не согласны с обновлением, вам следует прекратить использование Услуг и принять меры по неиспользованному балансу или закрытию учетной записи в соответствии с применимыми политиками.

## 19. Контакт

По вопросам настоящего Соглашения, заказов, выставления счетов, возмещения средств, соблюдения требований, уведомлений или вопросов обслуживания обращайтесь по адресу support@flatkey.ai или пишите по адресу VOC AI INC, 160 E Tasman Drive, Suite 202, Сан-Хосе, Калифорния 95134, США.


Все вышеперечисленное содержимое подлежит английской версии.`,
    privacy: `# Политика конфиденциальности flatkey.ai

Последнее обновление: 4 июня 2026 г.

В настоящей Политике конфиденциальности объясняется, как VOC AI INC («VOC AI», «мы», «нас» или «наш») собирает, использует, передает, сохраняет и защищает информацию, когда вы получаете доступ или используете flatkey.ai, услуги flatkey.ai, связанные веб-сайты, информационные панели, API, страницы оформления заказа, документацию и каналы поддержки.

Операционная организация: VOC AI INC, 160 E Tasman Drive, Suite 202, Сан-Хосе, Калифорния 95134, США.Контакт: support@flatkey.ai.

## 1. Область применения

Настоящая Политика применяется к регистрации учетной записи, управлению организацией, покупкам, пополнениям, доставке, доступу к API, маршрутизации моделей, записям об использовании, выставлению счетов, возвратам средств, поддержке, проверке безопасности и сопутствующим цифровым услугам, которые мы предоставляем.Сторонние модельные сервисы, поставщики платежных услуг, кошельки, банки, карточные сети, облачные сервисы, инструменты аналитики или другие веб-сайты обрабатывают информацию в соответствии со своими собственными политиками и условиями конфиденциальности.Настоящая Политика не заменяет политики третьих сторон.

## 2. Информация, которую мы собираем

Мы можем собирать информацию, которую вы предоставляете напрямую, включая имя, адрес электронной почты, пароль или аутентификационную информацию, название компании, роль, членов команды, платежный адрес, бизнес-информацию, налоговый идентификатор, информацию НДС/GST, информацию о счетах, информацию о заказе, сообщения поддержки, запросы на возврат средств, материалы по обеспечению соответствия, настройки информационной панели и общение с нами.

Когда вы используете Сервисы, мы можем обрабатывать информацию, касающуюся доставки и использования услуг, включая номер заказа, идентификатор платежа, статус доставки, баланс, кредитные записи, имя ключа API, идентификатор запроса, временную метку, выбор услуги, выбор модели, входы и выходы, файлы, изображения, код, подсказки, использование, сумму вычета, цену, задержку, журналы ошибок, информацию о маршрутизации и события безопасности.

Мы также можем автоматически собирать техническую информацию, включая IP-адрес, идентификаторы устройств, тип браузера, операционную систему, сетевое местоположение, посещенные страницы, ссылающийся URL-адрес, события сеанса, записи входа в систему, клики и действия, журналы диагностики, журналы сбоев, данные о производительности, сигналы борьбы с мошенничеством и аналогичную информацию.

Мы можем получать информацию, касающуюся вашей учетной записи, заказов, платежей, разрешений, использования, безопасности или вопросов поддержки, от поставщиков платежных услуг, поставщиков аутентификации, поставщиков услуг по борьбе с мошенничеством, инструментов поддержки, инструментов аналитики, корпоративных клиентов, администраторов групп или сторонних поставщиков услуг.

## 3. Входы, выходы и обработка модели.

Входные данные, которые вы отправляете, и Результаты, которые вы получаете, могут проходить через наши системы, если это необходимо для предоставления Услуг, и могут быть отправлены в соответствующую модельную службу или техническую службу для выполнения запроса.Различные модели и сторонние сервисы могут иметь разные правила обработки, ведения журнала, обучения, хранения и безопасности данных.Вам следует ознакомиться с применимыми правилами перед использованием конкретной модели и избегать предоставления информации, на которую вы не имеете права отправлять, или конфиденциальной информации, в которой нет необходимости.

Если в информационной панели, документации или описании заказа явно не предусмотрена соответствующая функция, мы не обещаем хранить полную историю ввода или вывода.В целях устранения неполадок, обеспечения безопасности, измерения, возврата денег, оспаривания или соблюдения требований мы можем сохранять метаданные запросов, записи об ошибках, записи использования, необходимые журналы и материалы, которые вы добровольно предоставляете в сообщениях службы поддержки.

Мы можем использовать агрегированную, анонимизированную или обезличенную информацию для статистического анализа, планирования мощности, управления затратами, анализа моделей и качества услуг, улучшения продуктов, моделирования рисков и бизнес-операций.Такая информация не позволит разумно идентифицировать конкретного человека.

## 4. Файлы cookie и аналогичные технологии

Мы используем файлы cookie, локальное хранилище, пиксели, журналы и аналогичные технологии, чтобы поддерживать ваш вход в систему, защищать сеансы, запоминать настройки, совершать покупки, обнаруживать мошенничество и злоупотребления, измерять посещения, отслеживать производительность, устранять проблемы и улучшать Услуги.Вы можете управлять некоторыми файлами cookie через настройки браузера, но отключение файлов cookie может повлиять на вход в систему, панель управления, оформление заказа, безопасность, статистику использования или функции поддержки.

## 5. Информация об оплате и заказе

Платежи могут обрабатываться Paddle, Stripe, банками, карточными сетями, кошельками, местными поставщиками способов оплаты, поставщиками услуг по борьбе с мошенничеством, поставщиками налогов, поставщиками счетов или другими поставщиками необходимых услуг.Мы можем получать или хранить идентификатор платежа, идентификатор оформления заказа, номер заказа, статус платежа, статус авторизации, статус расчета, продукт, сумму, валюту, сумму налога, ставку налога, налоговую юрисдикцию, номер счета, номер квитанции, статус возврата, возвратный платеж или статус спора, платежный адрес, страну, название компании, налоговый идентификатор, адрес электронной почты для выставления счетов и информацию, необходимую для обработки поддержки.

Мы намеренно не храним полные номера карт, коды проверки карт, данные банковского счета или данные кошелька в наших собственных системах.Данные о способе оплаты обрабатываются соответствующим поставщиком платежных услуг в соответствии с его правилами безопасности, конфиденциальности и соответствия требованиям платежной сети.Мы можем сохранять ограниченные метаданные платежа, такие как имя поставщика платежей, тип способа оплаты, последние четыре цифры карты, предоставленные поставщиком, идентификатор платежа, URL-адрес квитанции, URL-адрес счета-фактуры, идентификатор возврата и идентификатор спора для выставления счетов, налогов, бухгалтерского учета, поддержки, возврата средств и разрешения споров.

## 6. Как мы используем информацию

Мы используем информацию для создания и аутентификации учетных записей, обработки заказов и платежей, предоставления сервисных кредитов, ведения записей о балансе и использовании, предоставления доступа к API, обработки запросов, расчета использования и сборов, обработки счетов, квитанций, возвратов и споров, отправки уведомлений об обслуживании, ответа на запросы поддержки, устранения неполадок, обнаружения и предотвращения мошенничества, злоупотреблений, инцидентов безопасности и нарушений политики, обеспечения соблюдения Пользовательского соглашения и правил третьих сторон, соблюдения налоговых, бухгалтерских, аудиторских, юридических и нормативных обязательств, а также защиты прав и безопасности VOC AI,пользователи, сторонние поставщики услуг, поставщики платежных услуг и общественность.

Если вы решите получать маркетинговые сообщения, обновления продуктов или уведомления о мероприятиях, мы можем использовать вашу контактную информацию для отправки этих сообщений.Вы можете отказаться от подписки, используя метод отказа от подписки в электронном письме или связавшись с нами.Отказ от маркетинговой рассылки не влияет на служебные уведомления, уведомления о безопасности, уведомления о выставлении счетов и юридические уведомления.

## 7. Бережное обращение с информацией

Мы ограничиваем внутренний доступ в зависимости от потребностей бизнеса и обязанностей персонала и используем процессы управления разрешениями, ведения журналов, разумного шифрования, мониторинга, резервного копирования и аудита для защиты информации об учетных записях, заказах, платежах, использовании и поддержке.В случае возмещения средств, возвратных платежей, ненормальных звонков, инцидентов безопасности или проверки соответствия мы можем вести более подробный учет и проводить дополнительную проверку.

Мы не будем просить вас в службе поддержки предоставить полные платежные данные, пароли, ключи API в виде открытого текста или другие ненужные конфиденциальные учетные данные.Если для устранения неполадок требуются снимки экрана или журналы, вам следует удалить несвязанную конфиденциальную информацию.Если материалы содержат ненужную конфиденциальную информацию, мы можем попросить вас предоставить отредактированную версию.

Мы прилагаем разумные усилия, чтобы ограничить обмен информацией только тем, что имеет отношение к предоставлению Услуг, обработке платежей, выполнению запросов, устранению неполадок, расчету счетов, обработке возмещений, реагированию на споры, соблюдению юридических требований или защите безопасности услуг.

## 8. Как мы делимся информацией

Мы можем делиться информацией с поставщиками услуг, которые помогают нам управлять Услугами, включая хостинг, базы данных, кэширование, работу в сети, ведение журналов, мониторинг, безопасность, аутентификацию, электронную почту, поддержку клиентов, аналитику, оплату, налоги, счета-фактуры, квитанции, борьбу с мошенничеством, соблюдение требований, аудит и профессиональные консультации.

Для завершения предоставления услуг, запросов API, вызовов моделей или технической обработки мы можем отправлять необходимый Пользовательский контент, запрашивать информацию, идентификаторы учетных записей, информацию об использовании и метаданные для моделирования сервисов, платформ API, поставщиков облачных услуг, поставщиков шлюзов или других сторонних платформ.Третьи лица обрабатывают соответствующую информацию в соответствии со своими собственными условиями, политиками конфиденциальности, правилами обработки данных и политиками использования.

Мы также можем раскрывать информацию, когда этого требует действующее законодательство, повестки в суд, постановления суда, правительственные запросы, налоговые органы, правила платежной сети, требования аудита или нормативные требования, или для расследования случаев мошенничества, возвратных платежей, платежных споров, злоупотреблений, инцидентов безопасности, нарушений политики, нарушений, риска санкций или для защиты прав, собственности, безопасности и целостности услуг.

Если мы участвуем в слиянии, приобретении, финансировании, реструктуризации, продаже активов, банкротстве или аналогичной сделке, информация может быть раскрыта или передана как часть этой сделки.Получатель должен продолжать обрабатывать информацию в соответствии с действующим законодательством и принципами защиты, отраженными в настоящей Политике.

## 9. Удержание

Мы храним информацию до тех пор, пока это необходимо для предоставления Услуг, ведения учета учетных записей и заказов, предоставления кредитов за услуги, расчета использования и выставления счетов, обработки возмещений и споров, выполнения налоговых и бухгалтерских обязательств, предотвращения мошенничества и злоупотреблений, поддержки безопасности, соблюдения требований аудита и соответствия, а также защиты прав.

Информация об учетной записи обычно сохраняется в течение разумного периода после закрытия учетной записи.Записи о заказах, налогах, счетах, бухгалтерском учете и спорах могут храниться дольше, как того требует закон или правила платежной сети.Журналы безопасности, журналы диагностики и технические записи сохраняются по мере необходимости для операций, безопасности и устранения неполадок.

Записи о запросах API, ошибках и использовании могут иметь разные сроки хранения в зависимости от функции, типа журнала, требований безопасности и требований соответствия.Мы сохраняем такие записи в объеме, необходимом для предоставления Услуг, устранения неполадок, расчета счетов, обработки возмещений, реагирования на споры, предотвращения злоупотреблений и соблюдения требований законодательства.

Когда информация больше не нужна, мы удаляем, анонимизируем или ограничиваем дальнейшую обработку в соответствии с применимым законодательством и бизнес-процессами.

## 10. Международные переводы

VOC AI находится в США.Мы, наши поставщики услуг, поставщики платежных услуг и сторонние поставщики услуг можем обрабатывать информацию в США, Европе, Азии или других странах и регионах.Законы о защите данных в этих местах могут отличаться от законов того места, где вы находитесь.Мы будем использовать соответствующие гарантии трансграничной передачи, если этого требует действующее законодательство.

## 11. Безопасность

Мы используем административные, технические и организационные меры, такие как контроль доступа, управление разрешениями, журналы, разумное шифрование, мониторинг, резервное копирование, аудит и внутренние процессы для защиты информации.Ни одна система не может быть гарантирована абсолютно безопасной.Вы также несете ответственность за защиту своей учетной записи, пароля, электронной почты, устройств, ключей API, учетных данных доступа, платежного аккаунта и учетных данных соответствующих служб.

Если вы считаете, что к вашей учетной записи, ключу API, способу оплаты или данным был осуществлен доступ или использован без авторизации, немедленно свяжитесь с нами.

## 12. Ваш выбор и права

Вы можете обновить некоторую информацию об учетной записи, счетах и ​​команде на панели управления.В зависимости от вашего местоположения и применимого законодательства вы можете иметь право запросить доступ, исправление, удаление, переносимость, ограничение, возражение, отзыв согласия, отказ от обмена определенными данными или подать жалобу регулирующему органу.

Перед обработкой запроса нам может потребоваться подтвердить вашу личность.Мы также можем хранить определенную информацию, если это разрешено или требуется применимым законодательством, например, налоговые, бухгалтерские данные, данные безопасности, контроль рисков, платежи, споры, аудит, соответствие или юридические записи.

Мы не намеренно продаем личную информацию за деньги.Если действующее законодательство рассматривает определенную рекламу, аналитику или обмен данными как «продажу» или «передачу», вы можете связаться с нами, чтобы воспользоваться любыми применимыми правами на отказ.

## 13. Конфиденциальность детей

Услуги не предназначены для детей до 13 лет, и мы сознательно не собираем личную информацию от детей до 13 лет. Если вы считаете, что ребенок предоставил нам информацию, свяжитесь с нами, чтобы мы могли просмотреть и, при необходимости, удалить ее.

## 14. Обновления политики

Мы можем время от времени обновлять настоящую Политику конфиденциальности.О существенных изменениях можно уведомлять через веб-сайт, информационную панель, электронную почту или другие разумные средства.Обновленная Политика распространяется на деятельность по обработке информации после обновления.

## 15. Контакт

По вопросам конфиденциальности, запросам данных, отчетам о безопасности или вопросам защиты данных обращайтесь по адресу support@flatkey.ai или пишите по адресу VOC AI INC, 160 E Tasman Drive, Suite 202, Сан-Хосе, Калифорния 95134, США.


Все вышеперечисленное содержимое подлежит английской версии.`,
    refund: `# Политика возврата средств flatkey.ai

Последнее обновление: 4 июня 2026 г.

Настоящая Политика возврата средств применяется к услугам flatkey.ai, предоставляемым VOC AI INC («VOC AI», «мы», «нас» или «наш») через flatkey.ai, страницы оформления заказа, панель управления и каналы поддержки, включая пополнение счета, предоплаченный баланс счета, сервисные кредиты, использование API, предоставление цифровых услуг и соответствующие вопросы поддержки.

Операционная организация: VOC AI INC, 160 E Tasman Drive, Suite 202, Сан-Хосе, Калифорния 95134, США.Контакт: support@flatkey.ai.

## 1. Основные принципы

flatkey.ai предоставляет цифровые услуги.Баланс счета, кредиты на услуги и соответствующие цифровые услуги обычно доставляются в электронном виде сразу после успешной оплаты или утверждения заказа и могут быть немедленно использованы для запросов API, вызовов моделей, обработки файлов, обработки изображений, обработки запросов или других платных функций.После доставки и использования могут возникнуть затраты на использование сторонней модели, облачных услуг, платежей, налогов, затрат на сеть и инфраструктуру.

Наши принципы возврата средств таковы: непоставка, дублирование платежей, проверяемые системные ошибки и обязательные юридические требования подлежат приоритетному рассмотрению;доставленные и использованные кредиты, израсходованный баланс, выполненные запросы и успешно предоставленные цифровые услуги, как правило, не подлежат возврату.

Настоящая Политика не ограничивает не подлежащие отказу права потребителя на возмещение, аннулирование, отзыв, цифровой контент, цифровые услуги или права на споры о платежах, предусмотренные применимым законодательством.

## 2. Окно возврата неиспользованного остатка

Неиспользованный баланс счета или кредиты на услуги могут быть отправлены на проверку возврата в течение 24 часов после завершения покупки.По истечении 24 часов неиспользованный остаток, как правило, не подлежит возврату денежных средств, за исключением случаев, когда действующее законодательство требует иного, правила поставщика платежных услуг требуют иного или мы подтверждаем двойные платежи, непоставку, проверяемую системную ошибку или ошибку налога или счета-фактуры.

Если страница покупки, описание заказа, корпоративное соглашение или действующее законодательство предусматривают более длительный период возврата, будет применяться более конкретное правило.Рекламные, вознаграждения, пробные версии, купоны, подарки, свободный баланс или бесплатные кредиты, как правило, не подлежат возврату денежных средств.

## 3. Возврат средств или корректировки, которые мы можем рассмотреть.

Вы можете запросить возврат средств, восстановление баланса, корректировку кредита или корректировку счета в следующих ситуациях:

- один и тот же заказ был оплачен более одного раза;
- платеж прошел успешно, но баланс счета, кредиты на услуги или цифровые услуги не были доставлены;
- платеж не прошел, был отменен или отменен, но в способе оплаты по-прежнему отображается списание;
- ошибка нашей поддающейся проверке системы привела к двойному вычету, неправильному вычету, неправильному учету или неправильной выдаче кредита;
- вы запрашиваете в течение 24 часов после покупки, и соответствующий баланс или кредиты не были использованы, переданы, злоупотреблены или связаны с подозрительной деятельностью;
- необходимо исправить налог, счет-фактуру, квитанцию, валюту, сумму заказа или способ оплаты;
- применимое законодательство, правила поставщика платежных услуг, правила цифровых услуг, налоговые правила или правила платежной сети требуют возврата средств;
- VOC AI, Paddle, Stripe или другой поставщик услуг по оплате первоначального заказа после проверки определяет, что возврат средств или корректировка являются целесообразными.

Способ утверждения и обработки зависит от статуса заказа, записей о доставке, записей об использовании, статуса платежа, требований к налогам и счетам, результатов проверки рисков, правил поставщика платежных услуг и применимого законодательства.

## 4. Процесс проверки

Мы рассматриваем запросы на возврат средств или корректировку с использованием записей заказов, записей поставщиков платежных услуг, записей о доставке, записей баланса, журналов использования, идентификаторов запросов, записей об ошибках, сообщений службы поддержки, налоговых записей и записей счетов.В спорах об использовании мы обращаем внимание на то, действительно ли были выполнены запросы, был ли списан баланс, произошло ли дублирование списаний, произошла ли системная ошибка и поступили ли соответствующие запросы от вашей учетной записи, ключа API, членов команды, приложения или интеграции.

Во время проверки мы можем попросить вас предоставить адрес электронной почты учетной записи, номер заказа, идентификатор платежа, квитанцию, счет-фактуру, идентификатор запроса, отметку времени, снимок экрана, сообщение об ошибке или другую разумно необходимую информацию.Запросы, которые не могут подтвердить заказ, право собственности на учетную запись, статус доставки, статус использования или статус оплаты, могут быть не одобрены.

Если мы обнаружим, что соответствующий заказ или использование включает в себя несанкционированную перепродажу, передачу, совместное использование учетной записи, сокрытие настоящего пользователя, массовое создание учетной записи, ненормальные концентрированные вызовы, мошенничество, злоупотребление, риск санкций, злоупотребление возвратными платежами или обход ограничений, мы можем приостановить проверку, отказать в возмещении средств, ограничить восстановление баланса или принять меры по ограничению учетной записи в соответствии с Пользовательским соглашением.

Если один и тот же заказ вступил в процесс возврата платежа, спора о платеже, отмены платежа или расследования поставщика платежных услуг, мы, как правило, обрабатываем его через соответствующего поставщика платежных услуг или через процесс сети карт и не будем отдельно одновременно осуществлять независимый возврат денежных средств, чтобы избежать дублирования возвратов или конфликтов в учете.Если после завершения процесса спора возникнет необходимость в корректировке баланса счета или счетов, мы обработаем их на основе окончательного результата и системных записей.

## 5. Товары, как правило, не подлежат возврату.

За исключением случаев, когда действующее законодательство требует иного, как правило, возврату не подлежат:

- баланс или кредиты на обслуживание, используемые для запросов API, вызовов моделей, обработки файлов, обработки изображений, использования кэша, обработки запросов или других платных функций;
- цифровые услуги, которые были успешно доставлены и запущены;
- сборы, вызванные учетными записями, членами команды, ключами API, автоматизированными скриптами, интеграциями, утечкой ключей, настройками разрешений, внутренним персоналом или авторизованными пользователями;
- затраты на сторонние модели, затраты на облачные услуги, минимальные сборы, превышение использования, налоги, разницы при конвертации валют, банковские комиссии, комиссии карточной сети, сетевые комиссии, комиссии поставщика платежных услуг или комиссии сторонней платформы;
- рекламные, вознаграждения, пробные версии, купоны, подарки, свободный баланс или бесплатные кредиты;
- заказы, баланс или кредиты на услуги, связанные с мошенничеством, злоупотреблением, риском санкций, незаконным использованием, нарушением политики, совместным использованием учетной записи, несанкционированной перепродажей, передачей, предоставлением третьим лицам, злоупотреблением возвратными платежами или обходом ограничений;
- запросы, основанные на неудовлетворенности качеством вывода ИИ, поведением модели, доступностью услуги, задержкой, ограничениями скорости, изменениями цен, региональными ограничениями или изменениями сторонней политики, когда услуга была предоставлена, как описано, или были использованы соответствующие кредиты;
- проблемы, вызванные неточной информацией об учетной записи, электронной почте, выставлении счетов, налогах, бизнесе, счете или платежной информации, которую вы предоставили, за исключением случаев, когда действующее законодательство или правила поставщика платежных услуг требуют исправления или возврата денег.

## 6. Цифровой контент и права потребителей

В отношении цифрового контента или цифровых услуг, которые доставляются и могут быть использованы немедленно, в той степени, в которой это разрешено действующим законодательством, вы можете потерять установленные законом права на отмену или отзыв средств после того, как баланс счета, кредиты на услуги или сопутствующие услуги будут доставлены или когда вы начнете использовать соответствующие услуги.

Если в вашем регионе предусмотрены не подлежащие отказу права на защиту потребителей, возврат денег, отзыв, аннулирование или оспаривание, мы будем обрабатывать запросы в соответствии с применимым законодательством, даже если в других частях настоящей Политики указано иное.

## 7. Как запросить возврат средств

Свяжитесь с нами по адресу support@flatkey.ai и предоставьте как можно больше следующей информации:

- адрес электронной почты аккаунта;
- номер заказа, идентификатор платежа, номер квитанции Paddle, номер квитанции Stripe, номер платежа или номер счета-фактуры;
- дата покупки, сумма, валюта и тип способа оплаты;
- причина запроса на возврат или корректировку;
- соответствующие снимки экрана, сообщения об ошибках, статус доставки, записи баланса или записи информационной панели;
- для проблем использования, имя ключа API, идентификатор запроса, метка времени, модель или имя службы.

Двойные платежи, непоставки, неправильные вычеты, ошибки в счетах, проблемы с налогами или отклонения в платежах следует сообщать сразу после их обнаружения.Мы можем запросить дополнительную информацию для проверки владения учетной записью, записей о покупках, статуса доставки, статуса использования, статуса оплаты, налоговой информации и права на возврат средств.

## 8. Способ возврата и время обработки

Утвержденные возвраты денежных средств обычно возвращаются к исходному способу оплаты.Время обработки зависит от Paddle, Stripe, банков, карточных сетей, кошельков, местных поставщиков способов оплаты и других соответствующих поставщиков услуг.Мы не можем гарантировать, когда третья сторона завершит публикацию.

В некоторых случаях мы можем решить проблему путем восстановления баланса, корректировки кредита, корректировки счета, кредит-ноты, исправления счета-фактуры или обновления квитанции, особенно если проблема касается сбоя доставки, неправильного учета, двойного вычета или ошибки записи счета.

Налоги, счета-фактуры, кредит-ноты, квитанции, конвертация валюты и ограничения способов оплаты могут обрабатываться поставщиком услуг оплаты исходного заказа.Если заказ имеет статус возврата платежа, оспаривания, контроля рисков, налоговой проверки или статуса ограничения поставщика платежных услуг, возврат средств может занять больше времени или должен следовать соответствующей процедуре.

## 9. Paddle, Stripe и другие поставщики платежных услуг

Если заказ обрабатывается Paddle в качестве зарегистрированного продавца или продавца, Paddle может определять или осуществлять возврат средств, налоги, счета-фактуры, кредит-ноты, квитанции и вопросы, связанные с спорами по платежам, в соответствии со своим процессом.

Если заказ обрабатывается Stripe или другим платежным процессором, VOC AI может рассмотреть запрос на возврат средств и, если это возможно, поручить процессору вернуть утвержденный возврат средств на исходный способ оплаты.Правила и сроки обработки могут различаться в зависимости от поставщика платежных услуг, страны, валюты, способа оплаты и банка.

## 10. Возвратные платежи и споры о платежах

Если вы инициируете возврат платежа, оспаривание платежа, отмену платежа или аналогичный процесс, мы можем приостановить связанные учетные записи, ключи API, баланс, кредиты на услуги, заказы или доступ к услугам на время расследования.

Мы можем предоставлять Paddle, Stripe, банкам, карточным сетям, кошелькам, платежным сетям, поставщикам налоговых услуг или органам по разрешению споров записи заказов, записи о доставке, журналы использования, записи баланса, налоговые записи, счета-фактуры, квитанции, записи о возмещении, сообщения службы поддержки, активность учетной записи и записи безопасности для расследования и реагирования на споры.

Пожалуйста, сначала свяжитесь с нами, если возникнут дублированные платежи, непоставка, неправильные вычеты, проблемы с налогами, счета-фактуры, квитанции и проблемы с выставлением счетов.Непосредственное инициирование возврата платежа может привести к блокировке учетной записи, задержкам возврата средств, комиссиям за споры или ограничениям на будущие покупки.

Если вы уже связались с банком, карточной сетью, поставщиком кошельков или поставщиком платежных услуг, чтобы инициировать спор, сообщите нам статус спора и ссылочный номер в сообщении о возврате средств.Сокрытие активного спора, одновременный запрос двойного возмещения или продолжение возврата платежа после получения возмещения могут рассматриваться как злоупотребление возвратом платежа.

## 11. Обновления политики

Мы можем время от времени обновлять настоящую Политику возврата средств.Обновленная Политика обычно применяется к запросам на покупки, поставки, использование и возврат средств, возникающим после обновления, если применимое законодательство или правила поставщика платежных услуг не требуют иного.

## 12. Контакт

По вопросам покупок, доставки, баланса счета, кредитов на услуги, двойных платежей, неправильных вычетов, налогов, счетов, квитанций, права на возмещение, квитанций Paddle, квитанций Stripe или споров по платежам обращайтесь по адресу support@flatkey.ai или пишите по адресу VOC AI INC, 160 E Tasman Drive, Suite 202, Сан-Хосе, Калифорния 95134, США.

Все вышеперечисленное содержимое подлежит английской версии.`,
    sla: `# Соглашение об уровне обслуживания flatkey.ai

Последнее обновление: 13 июня 2026 г.

Настоящее соглашение об уровне обслуживания («SLA») описывает целевой уровень доступности и процесс поддержки сервисов flatkey.ai, предоставляемых VOC AI INC («VOC AI», «мы», «нас» или «наш»).

## 1. Область действия

Это SLA применяется к размещенной панели управления flatkey.ai, API-шлюзу, маршрутизации, учету использования и сервисам учетных записей, которыми мы управляем напрямую. Оно не применяется к сторонним поставщикам AI-моделей, платежным провайдерам, сетям клиентов, приложениям клиентов, бета-функциям, форс-мажору, плановому обслуживанию, мерам против злоупотреблений, приостановке учетной записи или проблемам, вызванным конфигурацией клиента, учетными данными, интеграциями или нарушениями политик.

## 2. Целевой уровень доступности

Мы стремимся к 99,5% ежемесячной доступности покрываемых конечных точек сервиса flatkey.ai. Доступность измеряется нашими производственными системами мониторинга для покрываемых сервисов.

## 3. Обслуживание и изменения сервиса

Мы можем выполнять плановое или экстренное обслуживание для улучшения безопасности, надежности, производительности или соответствия требованиям. Мы прилагаем разумные усилия для снижения влияния на клиентов и, когда это практически возможно, уведомляем через панель управления, сайт, электронную почту или каналы поддержки.

## 4. Сторонние зависимости

flatkey.ai маршрутизирует запросы к сторонним поставщикам моделей и зависит от облачных, сетевых, платежных, защитных и аналитических провайдеров. Сторонние сбои, ограничения скорости, изменения политик, региональные ограничения, поведение моделей или отказы на стороне провайдера находятся вне этого SLA.

## 5. Поддержка

По вопросам доступности сервиса обращайтесь на support@flatkey.ai, указав email учетной записи, затронутую конечную точку, доступные ID запросов, временные метки, сообщения об ошибках и краткое описание влияния. Мы рассматриваем обращения с учетом серьезности, доступных записей и операционного риска.

## 6. Средства защиты

Если отдельное письменное соглашение не предусматривает иное средство защиты, это SLA не создает автоматических сервисных кредитов, возвратов, штрафов или заранее оцененных убытков. Любая добровольная корректировка, исправление баланса или поддержка рассматриваются индивидуально в соответствии с Пользовательским соглашением и применимыми политиками.

## 7. Обновления

Мы можем время от времени обновлять это SLA. Обновленное SLA обычно применяется к периодам обслуживания после обновления.

## 8. Контакт

По вопросам этого SLA или сервисного инцидента обращайтесь на support@flatkey.ai или пишите по адресу VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, United States.

Все вышеперечисленное содержимое подлежит английской версии.`,
  },
  vi: {
    terms: `# Thỏa thuận người dùng flatkey.ai

Cập nhật lần cuối: ngày 4 tháng 6 năm 2026

Thỏa thuận người dùng này ("Thỏa thuận") áp dụng cho các dịch vụ flatkey.ai do VOC AI INC ("VOC AI", "chúng tôi" hoặc "của chúng tôi") cung cấp thông qua flatkey.ai, bảng điều khiển, API, trang thanh toán, tài liệu và kênh hỗ trợ ("Dịch vụ").Bằng cách đăng ký tài khoản, tạo tổ chức, thêm số dư tài khoản trả trước, tạo hoặc sử dụng khóa API, gọi API mô hình, truy cập trang tổng quan hoặc sử dụng Dịch vụ, bạn đồng ý với Thỏa thuận này, Chính sách quyền riêng tư, Chính sách hoàn tiền, tài liệu, trang định giá và mọi quy tắc bổ sung hiện hành của chúng tôi.

Đơn vị điều hành: VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, Hoa Kỳ.Liên hệ: support@flatkey.ai.

## 1. Tổng quan về dịch vụ

flatkey.ai là dịch vụ truy cập API AI, định tuyến mô hình, đo mức sử dụng, bảng điều khiển và dịch vụ số dư tài khoản trả trước.Người dùng có thể truy cập các khả năng khác nhau của mô hình AI thông qua API và bảng điều khiển hợp nhất, quản lý khóa API, quyền của nhóm, lựa chọn mô hình, hồ sơ yêu cầu, số dư, tín dụng, thanh toán và các vấn đề hỗ trợ.

Bản thân flatkey.ai không phải là mô hình.Chúng tôi không đảm bảo rằng bất kỳ mô hình, API, giá, khung ngữ cảnh, giới hạn tốc độ, tình trạng sẵn có theo khu vực, hành vi đầu ra, quy tắc xử lý dữ liệu hoặc chính sách bên thứ ba cụ thể nào sẽ vẫn có sẵn hoặc không thay đổi.Chúng tôi có thể thêm, xóa, hạn chế hoặc sửa đổi mẫu mã, tính năng, giá cả và quy tắc sử dụng dựa trên nhu cầu sản phẩm, thay đổi về chi phí, yêu cầu bảo mật, nghĩa vụ tuân thủ, yêu cầu của nhà cung cấp mẫu hoặc thay đổi đối với dịch vụ của bên thứ ba.

## 2. Tính đủ điều kiện, tài khoản và tổ chức

Bạn phải ít nhất 13 tuổi.Nếu bạn dưới 18 tuổi, bạn phải có sự cho phép của cha mẹ hoặc người giám hộ hợp pháp.Nếu bạn sử dụng Dịch vụ thay mặt cho một công ty, tổ chức hoặc tổ chức khác, bạn tuyên bố rằng bạn có quyền chấp nhận Thỏa thuận này thay mặt cho tổ chức đó.

Bạn phải cung cấp thông tin trung thực, chính xác, đầy đủ và hiện tại về tài khoản, doanh nghiệp, thanh toán, thuế và thông tin liên hệ.Bạn chịu trách nhiệm về quản trị viên, thành viên, ứng dụng, khóa API, thông tin xác thực truy cập, yêu cầu, tích hợp, phương thức thanh toán và việc sử dụng số dư trong tài khoản của bạn.

Quản trị viên tổ chức có thể mời các thành viên trong nhóm và định cấu hình quyền, ngân sách, mô hình, nhật ký, khóa và cài đặt bảo mật.Cấu hình quản trị viên có thể ảnh hưởng đến các thành viên tổ chức và người dùng cuối ứng dụng của bạn.Bạn phải đảm bảo rằng các thành viên trong nhóm và người dùng cuối của bạn tuân thủ Thỏa thuận này, tài liệu của chúng tôi và các điều khoản hiện hành của nhà cung cấp mô hình.

Nếu bạn tin rằng tài khoản, khóa API, thông tin xác thực truy cập, phương thức thanh toán hoặc quyền truy cập trang tổng quan của bạn đã bị sử dụng trái phép, bạn phải liên hệ ngay với chúng tôi và thực hiện các bước thích hợp để thu hồi, xoay vòng, vô hiệu hóa hoặc hạn chế quyền truy cập.

## 3. Số dư trả trước, phí và giao hàng kỹ thuật số

Dịch vụ có thể yêu cầu bạn mua số dư tài khoản trả trước hoặc tín dụng dịch vụ trước khi gọi API hoặc sử dụng một số tính năng nhất định.Trước khi mua, bạn sẽ có cơ hội xem lại số tiền đặt hàng, đơn vị tiền tệ, thuế, phí, phương thức thanh toán và quy tắc định giá được hiển thị trên trang áp dụng.

Số dư tài khoản và tín dụng dịch vụ chỉ có thể được sử dụng cho Dịch vụ flatkey.ai đủ điều kiện.Chúng không phải là tiền mặt, tiền gửi, tiền điện tử, thẻ quà tặng, công cụ thanh toán, tài khoản có thể rút hoặc sản phẩm tài chính.Trừ khi chúng tôi đồng ý rõ ràng bằng văn bản hoặc luật hiện hành có yêu cầu khác, số dư tài khoản và tín dụng dịch vụ không được rút, quy đổi thành tiền mặt, chuyển nhượng, sử dụng làm tài sản thế chấp, đầu tư hoặc sử dụng bên ngoài Dịch vụ.

Sau khi thanh toán thành công hoặc phê duyệt đơn hàng, số dư đã mua hoặc tín dụng thường được gửi điện tử đến tài khoản của bạn và có thể được sử dụng ngay lập tức cho các yêu cầu API, lệnh gọi mô hình hoặc các tính năng trả phí khác.Khi bạn thực hiện yêu cầu, hệ thống sẽ khấu trừ số dư theo giá mô hình hiện tại, mức sử dụng đầu vào, mức sử dụng đầu ra, lần truy cập bộ nhớ đệm, yêu cầu, tệp, hình ảnh, thuế, phí, quy đổi tiền tệ và bất kỳ quy tắc thanh toán nào khác được hiển thị trên trang hoặc quy trình thanh toán có liên quan.

Khoảng thời gian hết hạn đối với số dư hoặc tín dụng được xác định bởi trang mua hàng, mô tả đơn hàng, màn hình bảng điều khiển hoặc xác nhận bằng văn bản từ chúng tôi.Chúng tôi có thể hạn chế, đóng băng, hủy hoặc xử lý theo Chính sách hoàn tiền mọi số dư hoặc tín dụng liên quan đến tài khoản không hoạt động trong thời gian dài, tài khoản bị tạm ngưng, tài khoản đã đóng, hoạt động gian lận hoặc vi phạm chính sách.

## 4. Thanh toán, Thuế và Hóa đơn

Bạn ủy quyền cho VOC AI và các nhà cung cấp dịch vụ thanh toán của chúng tôi tính phí theo phương thức thanh toán đã chọn của bạn đối với số tiền đặt hàng, thuế, phí và các khoản phí hiện hành khác.Các khoản thanh toán có thể được xử lý bởi Paddle, Stripe, ngân hàng, mạng thẻ, ví, nhà cung cấp phương thức thanh toán địa phương, nhà cung cấp chống gian lận, nhà cung cấp thuế, nhà cung cấp hóa đơn hoặc nhà cung cấp dịch vụ cần thiết khác.

Tùy thuộc vào phương thức thanh toán, bên chịu trách nhiệm thu tiền, lập hoá đơn, tính thuế, thực hiện hoàn tiền và xử lý tranh chấp có thể khác nhau.Nếu Paddle xử lý đơn đặt hàng với tư cách là Người bán chính thức hoặc người bán thì Paddle có thể chịu trách nhiệm về việc thu tiền thanh toán, thuế, hóa đơn, biên lai, tiền hoàn lại và quy trình tranh chấp thanh toán.Nếu Stripe hoặc nhà cung cấp khác chỉ đóng vai trò là bên xử lý thanh toán thì VOC AI có thể vẫn là người bán và bên xử lý có thể thay mặt chúng tôi xử lý các hoạt động liên quan đến thanh toán.

Bạn phải cung cấp địa chỉ thanh toán, tên công ty, mã số thuế, thông tin VAT/GST, địa chỉ email và thông tin hóa đơn chính xác.Bạn chịu trách nhiệm về thuế, vấn đề về hóa đơn, vấn đề về biên lai, lỗi thanh toán, chậm trễ hoàn tiền, đánh giá tuân thủ hoặc chi phí bổ sung do thông tin không chính xác, không đầy đủ hoặc lỗi thời gây ra.

## 5. Điều khoản và hạn chế của nhà cung cấp mẫu

Dịch vụ có thể cho phép bạn, các thành viên trong nhóm, ứng dụng hoặc người dùng cuối của bạn truy cập vào các mô hình, API, công cụ hoặc tính năng do nhà cung cấp mô hình hoặc nhà cung cấp dịch vụ kỹ thuật bên thứ ba cung cấp.Bạn hiểu và đồng ý rằng việc sử dụng bất kỳ mô hình hoặc dịch vụ bên thứ ba nào cũng có thể phải tuân theo các điều khoản, chính sách, hạn chế khu vực, quy tắc an toàn, quy tắc xử lý dữ liệu và giới hạn sử dụng của mô hình hoặc dịch vụ bên thứ ba đó.

Bạn có trách nhiệm xác nhận trước khi sử dụng một mô hình cụ thể rằng mô hình đó và các quy tắc của nó phù hợp với trường hợp sử dụng của bạn, bao gồm sử dụng thương mại, sử dụng hướng tới khách hàng, dữ liệu nhạy cảm, các ngành được quản lý, các quyết định có rủi ro cao, quyền truy cập khu vực, trẻ vị thành niên, an toàn nội dung và xuất bản kết quả đầu ra.Bạn cũng phải đảm bảo rằng các thành viên trong nhóm và người dùng cuối của bạn sử dụng các mô hình có liên quan theo Thỏa thuận này, tài liệu của chúng tôi và các quy tắc hiện hành của bên thứ ba.

Một số kiểu máy hoặc tính năng nhất định có thể không cho phép một số khu vực, ngành, tổ chức, mục đích hoặc loại yêu cầu nhất định truy cập.Bạn không được sử dụng VPN, proxy, nhiều tài khoản, thông tin sai lệch, giải pháp kỹ thuật hoặc các phương pháp khác để vượt qua các hạn chế về mô hình, khu vực, danh tính, bảo mật hoặc tuân thủ.Chúng tôi có thể tạm dừng, hạn chế, đóng hoặc xóa quyền truy cập của bạn vào các mô hình, tài khoản, khóa API, số dư hoặc tính năng có liên quan nếu chúng tôi nhận được yêu cầu của bên thứ ba, phát hiện rủi ro hoặc có lý do hợp lý để tin rằng các quy tắc đã bị vi phạm.

Chúng tôi không sửa đổi, từ bỏ hoặc thay thế các điều khoản của nhà cung cấp mô hình bên thứ ba.Nhà cung cấp mô hình có thể thay đổi các điều khoản, giá cả, tính năng, tính khả dụng, phương pháp xử lý dữ liệu hoặc hạn chế truy cập bất kỳ lúc nào.Việc bạn tiếp tục sử dụng mô hình có nghĩa là bạn chấp nhận các quy tắc hiện hành hiện hành.

## 6. Trách nhiệm cấu hình

Bạn chịu trách nhiệm chọn mô hình, định cấu hình tài khoản, đặt quyền cho nhóm, quản lý khóa API, định cấu hình ngân sách và giới hạn tỷ lệ, kiểm soát nguồn yêu cầu, xem xét đầu vào và đầu ra cũng như xác định xem Dịch vụ có phù hợp với tình huống kinh doanh của bạn hay không.

Nếu tích hợp flatkey.ai vào sản phẩm hoặc dịch vụ của riêng mình, bạn phải giữ quyền kiểm soát ứng dụng, quyền truy cập của người dùng cuối, quyền tài khoản, khóa API, số dư, tín dụng, nguồn yêu cầu, nhật ký, xử lý lạm dụng và hỗ trợ khách hàng.Bạn không được phép cho phép người dùng cuối trực tiếp lấy, kiểm soát, bán lại, phân chia, sử dụng số lượng lớn hoặc bỏ qua ứng dụng của bạn để sử dụng tài khoản flatkey.ai, khóa API, số dư hoặc tín dụng.

Bạn chịu trách nhiệm về các thành viên trong nhóm, ứng dụng, tiện ích tích hợp, người dùng cuối, tập lệnh tự động, cài đặt quyền và quản lý khóa.Việc sử dụng, phí, tranh chấp hoặc tổn thất do cấu hình của bạn, rò rỉ khóa, hành vi của người dùng cuối, cài đặt quyền, lỗi tập lệnh hoặc sự cố quản lý nội bộ là trách nhiệm của bạn trừ khi do lỗi hệ thống có thể kiểm chứng trực tiếp của chúng tôi gây ra.

## 7. Nội dung người dùng và đầu ra AI

Lời nhắc, văn bản, tệp, hình ảnh, mã, dữ liệu, cấu hình, yêu cầu và nội dung khác mà bạn gửi tới Dịch vụ là "Đầu vào".Phản hồi mô hình, nội dung được tạo hoặc các kết quả khác được Dịch vụ trả về là "Đầu ra".Đầu vào và đầu ra được gọi chung là "Nội dung người dùng".

Bạn giữ các quyền mà bạn có một cách hợp pháp đối với Thông tin đầu vào của mình.Để cung cấp, định tuyến, đo lường, khắc phục sự cố, hỗ trợ, bảo mật, kiểm tra, xem xét khoản tiền hoàn lại và cải thiện Dịch vụ, bạn cấp cho chúng tôi giấy phép không độc quyền, toàn cầu, miễn phí bản quyền để xử lý, truyền, lưu trữ, sao chép, hiển thị và sử dụng Nội dung người dùng cũng như siêu dữ liệu liên quan nếu cần.

Bạn tuyên bố rằng bạn có tất cả các quyền, sự cho phép và sự đồng ý cần thiết để gửi, xử lý và truyền Thông tin đầu vào.Bạn không được gửi nội dung vi phạm quyền sở hữu trí tuệ, quyền riêng tư, nghĩa vụ bảo mật, nghĩa vụ hợp đồng hoặc luật hiện hành.

Kết quả đầu ra AI có thể không chính xác, không đầy đủ, lỗi thời, lặp đi lặp lại, sai lệch, không an toàn, không phù hợp cho một mục đích cụ thể hoặc tương tự với nội dung của bên thứ ba.Bạn phải xem xét và xác minh một cách độc lập Kết quả đầu ra trước khi dựa vào, xuất bản, sử dụng chúng cho mục đích thương mại, triển khai trong sản xuất hoặc sử dụng chúng cho các quyết định pháp lý, y tế, tài chính, việc làm, tín dụng, an toàn, tuân thủ hoặc các quyết định quan trọng khác.Chúng tôi không đảm bảo tính chính xác, tính duy nhất, sự phù hợp, tính sẵn có hoặc việc không vi phạm bất kỳ Đầu ra nào.

Trừ khi trang tổng quan, tài liệu hoặc mô tả đơn hàng cung cấp rõ ràng tính năng có liên quan, chúng tôi không hứa sẽ lưu trữ toàn bộ lịch sử Đầu vào hoặc Đầu ra.Vì mục đích khắc phục sự cố, bảo mật, đo lường, hoàn tiền, tranh chấp hoặc tuân thủ, chúng tôi có thể giữ lại siêu dữ liệu yêu cầu, hồ sơ lỗi, hồ sơ sử dụng và nhật ký cần thiết.

## 8. Không bán lại, chuyển tiếp hoặc sử dụng cạnh tranh

Tài khoản flatkey.ai, khóa API, số dư tài khoản, tín dụng dịch vụ, khả năng truy cập mô hình và khả năng bảng điều khiển sẽ được bạn và nhóm được ủy quyền của bạn sử dụng trong doanh nghiệp hoặc ứng dụng của riêng bạn.Trừ khi chúng tôi ký kết một thỏa thuận bằng văn bản riêng, bạn không được cung cấp flatkey.ai cho bên thứ ba dưới dạng API độc lập, số dư, tín dụng, tài khoản phụ, dịch vụ nạp tiền, dịch vụ chuyển tiếp, dịch vụ đổi thương hiệu, dịch vụ tổng hợp hoặc dịch vụ tương tự, cho dù bằng cách bán, chuyển nhượng, phân phối, cho thuê, chia sẻ hoặc sắp xếp gián tiếp khác.

Bạn không được truy cập hoặc sử dụng Dịch vụ nhằm mục đích bán lại quyền truy cập API, xây dựng dịch vụ cạnh tranh, bỏ qua các quy tắc mô hình của bên thứ ba, che giấu người dùng cuối thực sự, tránh giá hoặc giới hạn, bỏ qua các hạn chế khu vực, bỏ qua đánh giá bảo mật hoặc bỏ qua xem xét thanh toán.

Bán lại, chuyển tiếp, chia sẻ tài khoản trái phép, ẩn người dùng thực, tạo tài khoản hàng loạt, gọi điện tập trung bất thường, vượt giới hạn hoặc trốn tránh kiểm soát rủi ro là vi phạm nghiêm trọng.Chúng tôi có thể tạm dừng hoặc chấm dứt các tài khoản, khóa API, số dư, tín dụng và đơn đặt hàng có liên quan, đồng thời có thể từ chối hoặc hạn chế hoàn tiền liên quan, khôi phục số dư hoặc điều chỉnh tín dụng.

## 9. Hành vi bị cấm

Bạn có thể không:

- sử dụng Dịch vụ cho mục đích bất hợp pháp, lừa đảo, vi phạm, quấy rối, spam, phần mềm độc hại, lừa đảo, tấn công hệ thống, trốn tránh quy định, xâm phạm quyền riêng tư, thu thập dữ liệu nhạy cảm, trốn tránh lệnh trừng phạt, vi phạm kiểm soát xuất khẩu hoặc hoạt động có hại khác;
- tạo danh tính giả, mạo danh người khác, xuyên tạc các liên kết hoặc sử dụng nhiều tài khoản để tránh các giới hạn, kiểm soát rủi ro, định giá, hoàn tiền hoặc đánh giá tuân thủ;
- bỏ qua hoặc can thiệp vào giới hạn tài khoản, giới hạn khu vực, quy tắc thanh toán, giới hạn tín dụng, giới hạn tỷ lệ, cơ chế an toàn, quy tắc chống lạm dụng, hạn chế dịch vụ của bên thứ ba hoặc quy trình xem xét thanh toán;
- kỹ sư đảo ngược, quét, tấn công, kiểm tra sức chịu tải, làm gián đoạn, thu thập dữ liệu, sao chép, thu thập dữ liệu hoặc truy cập trái phép vào Dịch vụ, API, hệ thống, dữ liệu hoặc tài khoản của người dùng khác;
- tiến hành thử nghiệm đối nghịch, chèn nhanh, thử nghiệm bẻ khóa, thử nghiệm bỏ qua an toàn, thử nghiệm căng thẳng hoặc thử nghiệm khác có thể làm suy yếu các mô hình, Dịch vụ, quy tắc của bên thứ ba hoặc lợi ích của người dùng mà không có sự chấp thuận bằng văn bản của chúng tôi;
- gửi hoặc phân phối nội dung vi phạm, bất hợp pháp, độc hại, lừa đảo, gây hiểu lầm, quấy rối, tình dục, bạo lực, hận thù, xâm phạm quyền riêng tư, bị hạn chế hoặc vi phạm chính sách của bên thứ ba;
- hỗ trợ, khuyến khích hoặc cho phép bất kỳ bên thứ ba nào thực hiện bất kỳ điều nào ở trên.

## 10. Hồ sơ đo lường, giao hàng và đánh giá

Chúng tôi duy trì hồ sơ đặt hàng, thanh toán, giao hàng, số dư, tín dụng, yêu cầu, khấu trừ, sai sót, hoàn tiền, bồi hoàn, tranh chấp và hồ sơ bảo mật để xác minh xem việc giao hàng đã hoàn tất hay chưa, việc sử dụng có xảy ra hay không, số dư có được khấu trừ chính xác hay không, liệu yêu cầu hoàn tiền có hợp lệ hay không và liệu một tài khoản có hiển thị việc sử dụng bất thường hay không.

Chúng tôi nỗ lực hợp lý để giữ cho hồ sơ đo lường và thanh toán được chính xác, nhưng các hệ thống phức tạp có thể gặp phải sự chậm trễ, sai sót, hồ sơ trùng lặp hoặc hiển thị khác biệt.Nếu xảy ra lỗi hệ thống có thể kiểm chứng, chúng tôi có thể giải quyết lỗi đó thông qua khôi phục số dư, chỉnh sửa tín dụng, điều chỉnh thanh toán hoặc hoàn tiền.Ảnh chụp màn hình người dùng, hồ sơ của bên thứ ba hoặc nhật ký địa phương có thể được coi là tài liệu hỗ trợ, nhưng đánh giá cuối cùng sẽ xem xét hồ sơ hệ thống của chúng tôi, hồ sơ nhà cung cấp dịch vụ thanh toán và hồ sơ dịch vụ cần thiết của bên thứ ba.

Để bảo vệ sự ổn định của dịch vụ và những người dùng khác, chúng tôi có thể giám sát các yêu cầu bất thường, khấu trừ bất thường, đăng nhập bất thường, thanh toán bất thường, cuộc gọi hàng loạt, rò rỉ khóa, yêu cầu độc hại, lạm dụng khoản bồi hoàn và các kiểu sử dụng vi phạm Thỏa thuận này và chúng tôi có thể tạm thời hạn chế các tính năng liên quan trong quá trình điều tra.

Chúng tôi có thể tiến hành xem xét thủ công hoặc tự động các đơn đặt hàng có rủi ro cao, số lần nạp tiền lớn, tần suất nạp tiền bất thường, thông tin thanh toán không nhất quán, khu vực đăng nhập bất thường, nguồn yêu cầu bất thường, mức độ đồng thời cao trong thời gian ngắn hoặc cảnh báo của nhà cung cấp dịch vụ thanh toán.Trong quá trình xem xét, giao hàng, sử dụng số dư, hoàn tiền, hóa đơn hoặc các tính năng tài khoản có thể bị trì hoãn hoặc hạn chế.Sau khi xem xét, chúng tôi sẽ khôi phục hoặc xử lý các vấn đề liên quan theo hồ sơ hiện hành.

## 11. Hoàn tiền

Việc hoàn tiền, khôi phục số dư, điều chỉnh tín dụng và điều chỉnh hỗ trợ được xử lý theo Chính sách hoàn tiền flatkey.ai của chúng tôi.Nói chung, các khoản tín dụng đã giao và sử dụng, số dư đã tiêu dùng, các yêu cầu đã hoàn thành và các dịch vụ kỹ thuật số được cung cấp thành công sẽ không được hoàn lại.

Các khoản phí trùng lặp, không giao hàng, lỗi hệ thống có thể xác minh, số dư chưa sử dụng, lỗi thuế hoặc hóa đơn, tranh chấp thanh toán, quyền bắt buộc của người tiêu dùng hoặc yêu cầu của nhà cung cấp dịch vụ thanh toán sẽ được xem xét dựa trên hồ sơ đơn hàng, hồ sơ giao hàng, hồ sơ sử dụng, trạng thái thanh toán và các quy tắc hiện hành.

## 12. Dịch vụ của bên thứ ba

Dịch vụ có thể dựa vào các mô hình, API, nền tảng, dịch vụ đám mây, dịch vụ thanh toán, dịch vụ thuế, dịch vụ hóa đơn, lưu trữ, cơ sở dữ liệu, email, phân tích, bảo mật và các công cụ hỗ trợ của bên thứ ba.Các bên thứ ba cung cấp dịch vụ và xử lý dữ liệu theo các điều khoản, chính sách và quy tắc kỹ thuật của riêng họ.

Các dịch vụ của bên thứ ba có thể bị tạm dừng, giới hạn tỷ lệ, bị từ chối, ngừng cung cấp, định giá lại, sửa đổi, hạn chế theo khu vực hoặc chịu sự thay đổi về phương pháp xử lý dữ liệu.Chúng tôi sẽ nỗ lực hợp lý để duy trì Dịch vụ nhưng chúng tôi không đảm bảo tính sẵn có liên tục của bất kỳ dịch vụ bên thứ ba nào và không chịu trách nhiệm ngoài Thỏa thuận này đối với lỗi của bên thứ ba, thay đổi chính sách, sự cố mạng, hạn chế khu vực, hành vi mô hình, chất lượng đầu ra hoặc thay đổi chi phí của bên thứ ba.

## 13. Đình chỉ, chấm dứt và thay đổi dịch vụ

Nếu chúng tôi tin rằng bạn đã vi phạm Thỏa thuận này hoặc chính sách của bên thứ ba, sử dụng Dịch vụ một cách bất hợp pháp, gian lận, tạo ra rủi ro bị trừng phạt, gây ra rủi ro thanh toán, lạm dụng khoản bồi hoàn, tạo ra rủi ro bảo mật, cung cấp Dịch vụ cho người khác mà không được phép, tạo ra cách sử dụng bất thường hoặc gây hại cho chúng tôi hoặc bên thứ ba, chúng tôi có thể tạm dừng hoặc chấm dứt tài khoản, đơn đặt hàng, khóa API, số dư, tín dụng, quyền của nhóm hoặc quyền truy cập dịch vụ.

Trong phạm vi tối đa được pháp luật hiện hành cho phép, số dư hoặc tín dụng liên quan đến gian lận, lạm dụng, vi phạm chính sách, rủi ro bị trừng phạt, sử dụng bất hợp pháp, lạm dụng hoàn tiền, cung cấp trái phép cho người khác hoặc sự cố bảo mật nghiêm trọng có thể bị hạn chế, đóng băng, hủy bỏ, từ chối giao hàng hoặc không được hoàn tiền.

Bạn có thể ngừng sử dụng Dịch vụ.Việc đóng tài khoản không ảnh hưởng đến nghĩa vụ thanh toán, trách nhiệm sử dụng, xử lý tranh chấp, đánh giá tuân thủ, nghĩa vụ bồi thường hoặc các điều khoản của Thỏa thuận này mà về bản chất sẽ tiếp tục được áp dụng.

Chúng tôi có thể sửa đổi, tạm dừng hoặc ngừng một phần hoặc toàn bộ Dịch vụ, kiểu máy, tính năng, giá cả, tài liệu hoặc phương thức truy cập.Trừ khi luật hiện hành hoặc Chính sách hoàn tiền có yêu cầu khác, chúng tôi không chịu trách nhiệm hoàn tiền, thiệt hại hoặc bồi thường do thay đổi mô hình của bên thứ ba, ngừng cung cấp tính năng, thay đổi giá, hạn chế khu vực, giới hạn tỷ lệ hoặc thay đổi dịch vụ.

## 14. Sở hữu trí tuệ, phản hồi và bảo mật

Trang web, bảng điều khiển, phần mềm, API, tài liệu, nhãn hiệu, nhãn hiệu, thiết kế, hệ thống đặt hàng, hệ thống thanh toán, hệ thống kiểm soát rủi ro và công nghệ liên quan đều thuộc sở hữu của VOC AI hoặc người cấp phép của VOC AI.Ngoại trừ quyền hạn chế sử dụng Dịch vụ theo Thỏa thuận này, chúng tôi không chuyển giao bất kỳ quyền sở hữu trí tuệ nào cho bạn.

Nếu bạn cung cấp đề xuất, phản hồi, đưa ra báo cáo hoặc ý tưởng cải tiến cho chúng tôi, bạn cấp cho chúng tôi quyền sử dụng, sao chép, sửa đổi, xuất bản và thương mại hóa phản hồi đó mà không phải trả tiền cho bạn.

Nếu một trong hai bên tiết lộ thông tin được đánh dấu là bí mật hoặc được hiểu một cách hợp lý là bí mật theo bản chất của thông tin đó thì bên nhận phải bảo vệ thông tin đó một cách cẩn trọng và chỉ sử dụng thông tin đó khi cần thiết để thực hiện Thỏa thuận này hoặc cung cấp Dịch vụ.Được phép tiết lộ theo yêu cầu của pháp luật, cơ quan quản lý, tòa án, nhà cung cấp dịch vụ thanh toán, cơ quan thuế hoặc cơ quan giải quyết tranh chấp.

## 15. Tuyên bố miễn trừ trách nhiệm và giới hạn trách nhiệm pháp lý

Dịch vụ được cung cấp "nguyên trạng" và "có sẵn".Trong phạm vi tối đa được luật hiện hành cho phép, chúng tôi không đảm bảo rằng Dịch vụ sẽ không bị gián đoạn, không có lỗi, không có lỗ hổng bảo mật, không bị mất mát hoặc phù hợp với nhu cầu kinh doanh của bạn hoặc bất kỳ mô hình, API, giá, tín dụng, đầu ra, độ trễ, giới hạn tốc độ, tính khả dụng theo khu vực, phương thức thanh toán hoặc dịch vụ của bên thứ ba sẽ vẫn khả dụng.

Trong phạm vi tối đa được luật hiện hành cho phép, VOC AI không chịu trách nhiệm về các thiệt hại gián tiếp, ngẫu nhiên, đặc biệt, do hậu quả, mang tính chất cảnh báo hoặc trừng phạt, mất lợi nhuận, mất doanh thu, mất thiện chí, mất dữ liệu, gián đoạn kinh doanh, chi phí mua sắm thay thế, Đầu ra AI, hành vi dịch vụ của bên thứ ba, hành vi thanh toán của bên thứ ba hoặc hành vi nền tảng của bên thứ ba.

Trong phạm vi tối đa được pháp luật hiện hành cho phép, tổng trách nhiệm pháp lý của VOC AI phát sinh từ Dịch vụ, đơn đặt hàng, số dư, giao hàng, sử dụng, hoàn tiền hoặc Thỏa thuận này sẽ không vượt quá số tiền lớn hơn số tiền bạn thực sự đã thanh toán cho Dịch vụ liên quan trong 3 tháng trước khi yêu cầu và không được hoàn trả hoặc 100 USD. Giới hạn này không áp dụng cho trách nhiệm pháp lý không thể bị giới hạn bởi luật pháp.

## 16. Bồi thường

Trong phạm vi tối đa được luật hiện hành cho phép, bạn sẽ bồi thường và tránh cho VOC AI, các chi nhánh, nhà cung cấp dịch vụ và nhà cung cấp dịch vụ bên thứ ba của VOC AI khỏi các khiếu nại, tổn thất, trách nhiệm pháp lý, hình phạt, chi phí và chi phí phát sinh từ hoạt động tài khoản của bạn, Nội dung người dùng, việc sử dụng khóa API, tích hợp, sử dụng trái pháp luật, vi phạm Thỏa thuận này, vi phạm chính sách của bên thứ ba, cung cấp trái phép cho người khác, vi phạm, vi phạm quyền riêng tư, lỗi thông tin thuế, tranh chấp thanh toán, khoản bồi hoàn hoặc hành vi của thành viên nhóm.

## 17. Luật điều chỉnh và giải quyết tranh chấp

Không giới hạn bất kỳ quyền bảo vệ người tiêu dùng, bảo vệ dữ liệu hoặc quyền bắt buộc nào theo luật pháp địa phương, Thỏa thuận này được điều chỉnh bởi luật pháp của Bang California, Hoa Kỳ mà không tính đến xung đột với các quy tắc luật pháp.

Đối với mọi tranh chấp liên quan đến Thỏa thuận này hoặc Dịch vụ, trước tiên các bên sẽ cố gắng giải quyết tranh chấp một cách thiện chí bằng cách liên hệ với support@flatkey.ai.Nếu tranh chấp không được giải quyết, ngoại trừ các vấn đề khiếu nại nhỏ hoặc các vấn đề mà pháp luật nghiêm cấm phân xử bằng trọng tài, các bên đồng ý gửi tranh chấp ra trọng tài ở California trước một nhà cung cấp dịch vụ trọng tài có thẩm quyền theo quy định của trọng tài.Bạn và VOC AI đều từ bỏ quyền giải quyết tranh chấp thông qua các vụ kiện tập thể, hành động đại diện hoặc xét xử trước bồi thẩm đoàn, trừ khi luật hiện hành không cho phép từ bỏ quyền đó.

## 18. Thay đổi đối với Thỏa thuận này

Thỉnh thoảng chúng tôi có thể cập nhật Thỏa thuận này.Những thay đổi quan trọng có thể được thông báo qua trang web, bảng điều khiển, email hoặc các phương tiện hợp lý khác.Thỏa thuận cập nhật thường áp dụng cho các đơn đặt hàng mới, cách sử dụng mới và việc tiếp tục sử dụng Dịch vụ sau khi cập nhật.Nếu bạn không đồng ý với bản cập nhật, bạn nên ngừng sử dụng Dịch vụ và xử lý số dư chưa sử dụng hoặc đóng tài khoản theo chính sách hiện hành.

## 19. Liên hệ

Nếu có câu hỏi về Thỏa thuận này, đơn đặt hàng, thanh toán, hoàn tiền, tuân thủ, thông báo hoặc vấn đề dịch vụ, hãy liên hệ với support@flatkey.ai hoặc gửi thư tới VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, United States.


Tất cả các nội dung trên sẽ có phiên bản tiếng Anh.`,
    privacy: `# Chính sách quyền riêng tư của flatkey.ai

Cập nhật lần cuối: ngày 4 tháng 6 năm 2026

Chính sách quyền riêng tư này giải thích cách VOC AI INC ("VOC AI", "chúng tôi" hoặc "của chúng tôi") thu thập, sử dụng, chia sẻ, lưu giữ và bảo vệ thông tin khi bạn truy cập hoặc sử dụng flatkey.ai, các dịch vụ flatkey.ai, các trang web, trang tổng quan, API, trang thanh toán, tài liệu và kênh hỗ trợ có liên quan.

Đơn vị điều hành: VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, Hoa Kỳ.Liên hệ: support@flatkey.ai.

## 1. Phạm vi

Chính sách này áp dụng cho việc đăng ký tài khoản, quản lý tổ chức, mua hàng, nạp tiền, phân phối, truy cập API, định tuyến mô hình, hồ sơ sử dụng, thanh toán, hoàn tiền, hỗ trợ, đánh giá bảo mật và các dịch vụ kỹ thuật số liên quan mà chúng tôi cung cấp.Dịch vụ mô hình bên thứ ba, nhà cung cấp dịch vụ thanh toán, ví, ngân hàng, mạng thẻ, dịch vụ đám mây, công cụ phân tích hoặc các trang web khác xử lý thông tin theo chính sách và điều khoản về quyền riêng tư của họ.Chính sách này không thay thế các chính sách của bên thứ ba.

## 2. Thông tin chúng tôi thu thập

Chúng tôi có thể thu thập thông tin bạn cung cấp trực tiếp, bao gồm tên, địa chỉ email, mật khẩu hoặc thông tin xác thực, tên công ty, vai trò, thành viên nhóm, địa chỉ thanh toán, thông tin doanh nghiệp, ID thuế, thông tin VAT/GST, thông tin hóa đơn, thông tin đặt hàng, thông báo hỗ trợ, yêu cầu hoàn tiền, tài liệu tuân thủ, cài đặt trang tổng quan và thông tin liên lạc với chúng tôi.

Khi bạn sử dụng Dịch vụ, chúng tôi có thể xử lý thông tin liên quan đến việc cung cấp và sử dụng dịch vụ, bao gồm số đơn đặt hàng, ID thanh toán, trạng thái giao hàng, số dư, hồ sơ tín dụng, tên khóa API, ID yêu cầu, dấu thời gian, lựa chọn dịch vụ, lựa chọn mô hình, Đầu vào, Đầu ra, tệp, hình ảnh, mã, lời nhắc, cách sử dụng, số tiền khấu trừ, giá cả, độ trễ, nhật ký lỗi, thông tin định tuyến và các sự kiện bảo mật.

Chúng tôi cũng có thể tự động thu thập thông tin kỹ thuật, bao gồm địa chỉ IP, số nhận dạng thiết bị, loại trình duyệt, hệ điều hành, vị trí mạng được suy ra, các trang đã truy cập, URL giới thiệu, sự kiện phiên, bản ghi đăng nhập, lần nhấp và hành động, nhật ký chẩn đoán, nhật ký sự cố, dữ liệu hiệu suất, tín hiệu chống lừa đảo và thông tin tương tự.

Chúng tôi có thể nhận thông tin liên quan đến tài khoản, đơn đặt hàng, thanh toán, quyền, cách sử dụng, bảo mật hoặc các vấn đề hỗ trợ của bạn từ nhà cung cấp dịch vụ thanh toán, nhà cung cấp xác thực, nhà cung cấp chống gian lận, công cụ hỗ trợ, công cụ phân tích, khách hàng doanh nghiệp, quản trị viên nhóm hoặc nhà cung cấp dịch vụ bên thứ ba.

## 3. Đầu vào, đầu ra và xử lý mô hình

Đầu vào bạn gửi và Đầu ra bạn nhận được có thể đi qua hệ thống của chúng tôi khi cần thiết để cung cấp Dịch vụ và có thể được gửi đến dịch vụ mẫu hoặc dịch vụ kỹ thuật có liên quan để hoàn thành yêu cầu.Các mô hình và dịch vụ của bên thứ ba khác nhau có thể có các quy tắc xử lý, ghi nhật ký, đào tạo, lưu giữ và bảo mật dữ liệu khác nhau.Bạn nên xem lại các quy tắc hiện hành trước khi sử dụng một mô hình cụ thể và tránh gửi thông tin mà bạn không được phép gửi hoặc thông tin nhạy cảm không cần thiết.

Trừ khi trang tổng quan, tài liệu hoặc mô tả đơn hàng cung cấp rõ ràng tính năng có liên quan, chúng tôi không hứa sẽ lưu trữ toàn bộ lịch sử Đầu vào hoặc Đầu ra.Vì mục đích khắc phục sự cố, bảo mật, đo lường, hoàn tiền, tranh chấp hoặc tuân thủ, chúng tôi có thể giữ lại siêu dữ liệu yêu cầu, hồ sơ lỗi, hồ sơ sử dụng, nhật ký cần thiết và tài liệu mà bạn tự nguyện cung cấp trong thông tin liên lạc hỗ trợ.

Chúng tôi có thể sử dụng thông tin tổng hợp, ẩn danh hoặc không xác định để phân tích thống kê, lập kế hoạch năng lực, quản lý chi phí, phân tích mô hình và chất lượng dịch vụ, cải tiến sản phẩm, lập mô hình rủi ro và hoạt động kinh doanh.Thông tin như vậy sẽ không xác định hợp lý một cá nhân cụ thể.

## 4. Cookie và các công nghệ tương tự

Chúng tôi sử dụng cookie, bộ nhớ cục bộ, pixel, nhật ký và các công nghệ tương tự để giúp bạn luôn đăng nhập, bảo vệ phiên, ghi nhớ tùy chọn, hoàn tất thanh toán, phát hiện gian lận và lạm dụng, đo lường lượt truy cập, theo dõi hiệu suất, khắc phục sự cố và cải thiện Dịch vụ.Bạn có thể kiểm soát một số cookie thông qua cài đặt trình duyệt, nhưng việc tắt cookie có thể ảnh hưởng đến hoạt động đăng nhập, trang tổng quan, thanh toán, bảo mật, thống kê sử dụng hoặc chức năng hỗ trợ.

## 5. Thông tin thanh toán và đặt hàng

Các khoản thanh toán có thể được xử lý bởi Paddle, Stripe, ngân hàng, mạng thẻ, ví, nhà cung cấp phương thức thanh toán địa phương, nhà cung cấp chống gian lận, nhà cung cấp thuế, nhà cung cấp hóa đơn hoặc nhà cung cấp dịch vụ cần thiết khác.Chúng tôi có thể nhận hoặc lưu trữ ID thanh toán, ID thanh toán, số đơn đặt hàng, trạng thái thanh toán, trạng thái ủy quyền, trạng thái thanh toán, sản phẩm, số tiền, đơn vị tiền tệ, số tiền thuế, thuế suất, khu vực pháp lý về thuế, số hóa đơn, số biên nhận, trạng thái hoàn tiền, trạng thái bồi hoàn hoặc tranh chấp, địa chỉ thanh toán, quốc gia, tên doanh nghiệp, ID thuế, email thanh toán và thông tin cần thiết để xử lý hỗ trợ.

Chúng tôi không cố ý lưu trữ số thẻ đầy đủ, mã xác minh thẻ, thông tin xác thực tài khoản ngân hàng hoặc thông tin xác thực ví trong hệ thống của chúng tôi.Dữ liệu phương thức thanh toán được xử lý bởi nhà cung cấp dịch vụ thanh toán có liên quan theo các quy tắc tuân thủ về bảo mật, quyền riêng tư và mạng thanh toán.Chúng tôi có thể giữ lại siêu dữ liệu thanh toán hạn chế, chẳng hạn như tên nhà cung cấp thanh toán, loại phương thức thanh toán, bốn chữ số cuối của thẻ do nhà cung cấp cung cấp, ID thanh toán, URL biên nhận, URL hóa đơn, ID hoàn tiền và ID tranh chấp để thanh toán, thuế, kế toán, hỗ trợ, hoàn tiền và xử lý tranh chấp.

## 6. Cách chúng tôi sử dụng thông tin

Chúng tôi sử dụng thông tin để tạo và xác thực tài khoản, xử lý đơn đặt hàng và thanh toán, cung cấp tín dụng dịch vụ, duy trì số dư và hồ sơ sử dụng, cung cấp quyền truy cập API, xử lý yêu cầu, tính toán mức sử dụng và phí, xử lý hóa đơn, biên nhận, hoàn tiền và tranh chấp, gửi thông báo dịch vụ, phản hồi yêu cầu hỗ trợ, khắc phục sự cố, phát hiện và ngăn chặn gian lận, lạm dụng, sự cố bảo mật và vi phạm chính sách, thực thi Thỏa thuận người dùng và các quy tắc của bên thứ ba, tuân thủ các nghĩa vụ về thuế, kế toán, kiểm toán, pháp lý và tuân thủ, đồng thời bảo vệ quyền và sự an toàn của VOC AI, người dùng, dịch vụ bên thứ banhà cung cấp dịch vụ thanh toán, nhà cung cấp dịch vụ thanh toán và công chúng.

Nếu bạn chọn nhận thông báo tiếp thị, cập nhật sản phẩm hoặc sự kiện, chúng tôi có thể sử dụng thông tin liên hệ của bạn để gửi những thông tin liên lạc đó.Bạn có thể từ chối bằng phương pháp hủy đăng ký trong email hoặc bằng cách liên hệ với chúng tôi.Thông báo dịch vụ, thông báo bảo mật, thông báo thanh toán và thông báo pháp lý không bị ảnh hưởng bởi việc từ chối tiếp thị.

## 7. Xử lý thông tin cẩn thận

Chúng tôi giới hạn quyền truy cập nội bộ dựa trên nhu cầu kinh doanh và trách nhiệm nhân sự, đồng thời quản lý quyền, ghi nhật ký, mã hóa hợp lý, giám sát, sao lưu và quy trình kiểm tra để bảo vệ thông tin tài khoản, đơn hàng, thanh toán, sử dụng và hỗ trợ.Để hoàn lại tiền, yêu cầu bồi hoàn, cuộc gọi bất thường, sự cố bảo mật hoặc đánh giá tuân thủ, chúng tôi có thể lưu giữ hồ sơ chi tiết hơn và thực hiện đánh giá bổ sung.

Chúng tôi sẽ không yêu cầu bạn trong quá trình liên lạc hỗ trợ để cung cấp thông tin xác thực thanh toán đầy đủ, mật khẩu, khóa API văn bản gốc hoặc thông tin xác thực nhạy cảm không cần thiết khác.Nếu việc khắc phục sự cố yêu cầu ảnh chụp màn hình hoặc nhật ký, bạn nên loại bỏ thông tin nhạy cảm không liên quan.Nếu tài liệu chứa thông tin nhạy cảm không cần thiết, chúng tôi có thể yêu cầu bạn gửi phiên bản đã được biên tập lại.

Chúng tôi sử dụng những nỗ lực hợp lý để hạn chế chia sẻ thông tin ở những nội dung liên quan đến việc cung cấp Dịch vụ, xử lý thanh toán, hoàn thành yêu cầu, khắc phục sự cố, tính toán hóa đơn, xử lý hoàn tiền, giải quyết tranh chấp, đáp ứng các yêu cầu pháp lý hoặc bảo vệ an ninh dịch vụ.

## 8. Cách chúng tôi chia sẻ thông tin

Chúng tôi có thể chia sẻ thông tin với các nhà cung cấp dịch vụ giúp chúng tôi vận hành Dịch vụ, bao gồm lưu trữ, cơ sở dữ liệu, bộ nhớ đệm, kết nối mạng, ghi nhật ký, giám sát, bảo mật, xác thực, email, hỗ trợ khách hàng, phân tích, thanh toán, thuế, hóa đơn, biên nhận, chống gian lận, tuân thủ, kiểm toán và các nhà cung cấp tư vấn chuyên nghiệp.

Để hoàn tất việc cung cấp dịch vụ, yêu cầu API, lệnh gọi mô hình hoặc xử lý kỹ thuật, chúng tôi có thể gửi Nội dung người dùng cần thiết, thông tin yêu cầu, số nhận dạng tài khoản, thông tin sử dụng và siêu dữ liệu tới các dịch vụ mô hình, nền tảng API, nhà cung cấp đám mây, nhà cung cấp cổng hoặc nền tảng bên thứ ba khác.Các bên thứ ba xử lý thông tin liên quan theo các điều khoản, chính sách quyền riêng tư, quy tắc xử lý dữ liệu và chính sách sử dụng của riêng họ.

Chúng tôi cũng có thể tiết lộ thông tin khi luật pháp hiện hành yêu cầu, trát đòi hầu tòa, lệnh tòa, yêu cầu của chính phủ, cơ quan thuế, quy tắc mạng thanh toán, yêu cầu kiểm toán hoặc yêu cầu pháp lý hoặc để điều tra gian lận, khoản bồi hoàn, tranh chấp thanh toán, lạm dụng, sự cố bảo mật, vi phạm chính sách, vi phạm, rủi ro trừng phạt hoặc để bảo vệ quyền, tài sản, sự an toàn và tính toàn vẹn của dịch vụ.

Nếu chúng tôi tham gia vào việc sáp nhập, mua lại, cấp vốn, tái cơ cấu, bán tài sản, phá sản hoặc giao dịch tương tự, thông tin có thể được tiết lộ hoặc chuyển giao như một phần của giao dịch đó.Người nhận phải tiếp tục xử lý thông tin theo luật hiện hành và các nguyên tắc bảo vệ được phản ánh trong Chính sách này.

## 9. Giữ lại

Chúng tôi lưu giữ thông tin trong khoảng thời gian cần thiết để cung cấp Dịch vụ, duy trì hồ sơ tài khoản và đơn đặt hàng, cung cấp tín dụng dịch vụ, tính toán mức sử dụng và thanh toán, xử lý các khoản hoàn tiền và tranh chấp, tuân thủ nghĩa vụ thuế và kế toán, ngăn chặn gian lận và lạm dụng, hỗ trợ bảo mật, đáp ứng các yêu cầu kiểm toán và tuân thủ cũng như bảo vệ quyền.

Thông tin tài khoản thường được lưu giữ trong một khoảng thời gian hợp lý sau khi đóng tài khoản.Hồ sơ đặt hàng, thuế, hóa đơn, kế toán và tranh chấp có thể được lưu giữ lâu hơn theo yêu cầu của pháp luật hoặc các quy tắc của mạng thanh toán.Nhật ký bảo mật, nhật ký chẩn đoán và hồ sơ kỹ thuật được lưu giữ khi cần thiết cho hoạt động, bảo mật và khắc phục sự cố.

Các bản ghi yêu cầu, lỗi và sử dụng API có thể có thời gian lưu giữ khác nhau tùy thuộc vào tính năng, loại nhật ký, nhu cầu bảo mật và yêu cầu tuân thủ.Chúng tôi lưu giữ những hồ sơ đó trong phạm vi cần thiết để cung cấp Dịch vụ, khắc phục sự cố, tính toán hóa đơn, xử lý việc hoàn tiền, giải quyết tranh chấp, ngăn chặn lạm dụng và đáp ứng các yêu cầu pháp lý.

Khi thông tin không còn cần thiết, chúng tôi xóa, ẩn danh hoặc hạn chế xử lý thêm theo luật hiện hành và quy trình kinh doanh.

## 10. Chuyển khoản quốc tế

VOC AI được đặt tại Hoa Kỳ.Chúng tôi, nhà cung cấp dịch vụ, nhà cung cấp dịch vụ thanh toán và nhà cung cấp dịch vụ bên thứ ba của chúng tôi có thể xử lý thông tin ở Hoa Kỳ, Châu Âu, Châu Á hoặc các quốc gia và khu vực khác.Luật bảo vệ dữ liệu ở những địa điểm đó có thể khác với luật ở nơi bạn sinh sống.Chúng tôi sẽ sử dụng các biện pháp bảo vệ chuyển giao xuyên biên giới thích hợp khi luật pháp hiện hành yêu cầu.

## 11. Bảo mật

Chúng tôi sử dụng các biện pháp hành chính, kỹ thuật và tổ chức như kiểm soát truy cập, quản lý quyền, nhật ký, mã hóa hợp lý, giám sát, sao lưu, kiểm tra và quy trình nội bộ để bảo vệ thông tin.Không có hệ thống nào có thể được đảm bảo an toàn tuyệt đối.Bạn cũng chịu trách nhiệm bảo vệ tài khoản, mật khẩu, email, thiết bị, khóa API, thông tin xác thực truy cập, tài khoản thanh toán và thông tin xác thực dịch vụ liên quan của mình.

Nếu bạn tin rằng tài khoản, khóa API, phương thức thanh toán hoặc dữ liệu của bạn đã bị truy cập hoặc sử dụng trái phép, hãy liên hệ với chúng tôi ngay lập tức.

## 12. Lựa chọn và Quyền của Bạn

Bạn có thể cập nhật một số thông tin tài khoản, thanh toán và nhóm trong trang tổng quan.Tùy thuộc vào vị trí của bạn và luật hiện hành, bạn có thể có quyền yêu cầu quyền truy cập, chỉnh sửa, xóa, di chuyển, hạn chế, phản đối, rút ​​lại sự đồng ý, từ chối chia sẻ dữ liệu nhất định hoặc khiếu nại với cơ quan quản lý.

Chúng tôi có thể cần xác minh danh tính của bạn trước khi xử lý yêu cầu.Chúng tôi cũng có thể lưu giữ một số thông tin nhất định khi được pháp luật hiện hành cho phép hoặc yêu cầu, chẳng hạn như hồ sơ thuế, kế toán, bảo mật, kiểm soát rủi ro, thanh toán, tranh chấp, kiểm toán, tuân thủ hoặc pháp lý.

Chúng tôi không cố ý bán thông tin cá nhân để lấy tiền.Nếu luật hiện hành coi một số quảng cáo, phân tích hoặc chia sẻ dữ liệu nhất định là "bán" hoặc "chia sẻ", thì bạn có thể liên hệ với chúng tôi để thực hiện bất kỳ quyền từ chối hiện hành nào.

## 13. Quyền riêng tư của trẻ em

Dịch vụ không hướng tới trẻ em dưới 13 tuổi và chúng tôi không cố ý thu thập thông tin cá nhân từ trẻ em dưới 13 tuổi. Nếu bạn cho rằng một đứa trẻ đã cung cấp thông tin cho chúng tôi, hãy liên hệ với chúng tôi để chúng tôi có thể xem xét và xóa thông tin đó nếu thích hợp.

## 14. Cập nhật chính sách

Thỉnh thoảng chúng tôi có thể cập nhật Chính sách quyền riêng tư này.Những thay đổi quan trọng có thể được thông báo qua trang web, bảng điều khiển, email hoặc các phương tiện hợp lý khác.Chính sách cập nhật áp dụng cho các hoạt động xử lý thông tin sau khi cập nhật.

## 15. Liên hệ

Đối với các câu hỏi về quyền riêng tư, yêu cầu dữ liệu, báo cáo bảo mật hoặc yêu cầu bảo vệ dữ liệu, hãy liên hệ với support@flatkey.ai hoặc viết thư cho VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, United States.


Tất cả các nội dung trên sẽ có phiên bản tiếng Anh.`,
    refund: `# Chính sách hoàn tiền của flatkey.ai

Cập nhật lần cuối: ngày 4 tháng 6 năm 2026

Chính sách hoàn tiền này áp dụng cho các dịch vụ flatkey.ai do VOC AI INC cung cấp ("VOC AI", "chúng tôi" hoặc "của chúng tôi") thông qua flatkey.ai, trang thanh toán, bảng điều khiển và các kênh hỗ trợ, bao gồm nạp tiền tài khoản, số dư tài khoản trả trước, tín dụng dịch vụ, sử dụng API, cung cấp dịch vụ kỹ thuật số và các vấn đề hỗ trợ liên quan.

Đơn vị điều hành: VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, Hoa Kỳ.Liên hệ: support@flatkey.ai.

## 1. Nguyên tắc cơ bản

flatkey.ai cung cấp dịch vụ kỹ thuật số.Số dư tài khoản, tín dụng dịch vụ và các dịch vụ kỹ thuật số liên quan thường được gửi dưới dạng điện tử ngay sau khi thanh toán hoặc phê duyệt đơn hàng thành công và có thể được sử dụng ngay lập tức cho các yêu cầu API, lệnh gọi mô hình, xử lý tệp, xử lý hình ảnh, xử lý yêu cầu hoặc các tính năng trả phí khác.Khi quá trình phân phối và sử dụng diễn ra, chi phí mô hình, dịch vụ đám mây, thanh toán, thuế, mạng và cơ sở hạ tầng của bên thứ ba có thể phát sinh.

Nguyên tắc hoàn tiền của chúng tôi là: không giao hàng, tính phí trùng lặp, lỗi hệ thống có thể xác minh và các yêu cầu pháp lý bắt buộc được ưu tiên xem xét;các khoản tín dụng đã giao và sử dụng, số dư đã tiêu dùng, các yêu cầu đã hoàn thành và các dịch vụ kỹ thuật số được cung cấp thành công thường không được hoàn lại.

Chính sách này không giới hạn bất kỳ quyền hoàn tiền, hủy, rút ​​lui, nội dung kỹ thuật số, dịch vụ kỹ thuật số hoặc tranh chấp thanh toán không thể từ bỏ nào của người tiêu dùng theo luật hiện hành.

## 2. Thời hạn hoàn tiền cho số dư chưa sử dụng

Số dư tài khoản hoặc tín dụng dịch vụ chưa sử dụng có thể được gửi để xem xét hoàn tiền trong vòng 24 giờ sau khi hoàn tất giao dịch mua.Sau 24 giờ, số dư chưa sử dụng thường không đủ điều kiện để được hoàn lại tiền mặt trừ khi luật hiện hành có yêu cầu khác, quy định của nhà cung cấp dịch vụ thanh toán có yêu cầu khác hoặc chúng tôi xác nhận các khoản phí trùng lặp, không giao hàng, lỗi hệ thống có thể xác minh hoặc lỗi về thuế hoặc hóa đơn.

Nếu trang mua hàng, mô tả đơn hàng, thỏa thuận doanh nghiệp hoặc luật hiện hành quy định thời gian hoàn tiền dài hơn thì quy tắc cụ thể hơn sẽ được áp dụng.Khuyến mại, tặng thưởng, dùng thử, phiếu giảm giá, quà tặng, số dư miễn phí hoặc tín dụng miễn phí thường không đủ điều kiện để được hoàn lại tiền mặt.

## 3. Hoàn tiền hoặc điều chỉnh mà chúng tôi có thể xem xét

Bạn có thể yêu cầu hoàn lại tiền, khôi phục số dư, sửa tín dụng hoặc điều chỉnh tài khoản trong các trường hợp sau:

- cùng một đơn hàng đã bị tính phí nhiều lần;
- thanh toán thành công nhưng số dư tài khoản, tín dụng dịch vụ hoặc dịch vụ kỹ thuật số không được chuyển giao;
- thanh toán không thành công, bị đảo ngược hoặc bị hủy nhưng phương thức thanh toán vẫn hiển thị một khoản phí;
- lỗi hệ thống có thể kiểm chứng của chúng tôi đã gây ra khoản khấu trừ trùng lặp, khoản khấu trừ không chính xác, đo lường không chính xác hoặc chuyển tín dụng không chính xác;
- bạn yêu cầu trong vòng 24 giờ sau khi mua và số dư hoặc tín dụng liên quan chưa được sử dụng, chuyển nhượng, lạm dụng hoặc liên quan đến hoạt động đáng ngờ;
- cần chỉnh sửa về thuế, hóa đơn, biên nhận, tiền tệ, số tiền đặt hàng hoặc phương thức thanh toán;
- luật hiện hành, quy tắc của nhà cung cấp dịch vụ thanh toán, quy tắc dịch vụ kỹ thuật số, quy tắc thuế hoặc quy tắc mạng thanh toán yêu cầu hoàn tiền;
- VOC AI, Paddle, Stripe hoặc nhà cung cấp dịch vụ thanh toán đơn hàng ban đầu khác xác định sau khi xem xét rằng việc hoàn tiền hoặc điều chỉnh là phù hợp.

Phương thức phê duyệt và xử lý tùy thuộc vào trạng thái đơn hàng, hồ sơ giao hàng, hồ sơ sử dụng, trạng thái thanh toán, yêu cầu về thuế và hóa đơn, kết quả xem xét rủi ro, quy tắc của nhà cung cấp dịch vụ thanh toán và luật hiện hành.

## 4. Quy trình xem xét

Chúng tôi xem xét các yêu cầu hoàn tiền hoặc điều chỉnh bằng cách sử dụng hồ sơ đơn hàng, hồ sơ nhà cung cấp dịch vụ thanh toán, hồ sơ giao hàng, hồ sơ số dư, nhật ký sử dụng, ID yêu cầu, hồ sơ lỗi, thông tin liên lạc hỗ trợ, hồ sơ thuế và hồ sơ hóa đơn.Đối với các tranh chấp về việc sử dụng, chúng tôi tập trung vào việc liệu các yêu cầu có thực sự xảy ra hay không, số dư có bị khấu trừ hay không, có xảy ra khoản khấu trừ trùng lặp hay không, có lỗi hệ thống hay không và liệu các yêu cầu liên quan có đến từ tài khoản, khóa API, thành viên nhóm, ứng dụng hoặc tích hợp của bạn hay không.

Trong quá trình xem xét, chúng tôi có thể yêu cầu bạn cung cấp email tài khoản, số đơn đặt hàng, ID thanh toán, biên nhận, hóa đơn, ID yêu cầu, dấu thời gian, ảnh chụp màn hình, thông báo lỗi hoặc thông tin cần thiết hợp lý khác.Những yêu cầu không thể xác minh đơn hàng, quyền sở hữu tài khoản, trạng thái giao hàng, trạng thái sử dụng hoặc trạng thái thanh toán có thể không được chấp thuận.

Nếu chúng tôi thấy rằng đơn đặt hàng hoặc việc sử dụng liên quan liên quan đến việc bán lại, chuyển tiếp, chia sẻ tài khoản trái phép, ẩn người dùng thực, tạo tài khoản hàng loạt, gọi điện tập trung bất thường, gian lận, lạm dụng, rủi ro trừng phạt, lạm dụng bồi hoàn hoặc hạn chế gian lận, chúng tôi có thể tạm dừng xem xét, từ chối hoàn tiền, hạn chế khôi phục số dư hoặc thực hiện các biện pháp hạn chế tài khoản theo Thỏa thuận người dùng.

Nếu cùng một đơn đặt hàng đã tham gia quy trình bồi hoàn, tranh chấp thanh toán, đảo ngược thanh toán hoặc quy trình điều tra nhà cung cấp dịch vụ thanh toán, chúng tôi thường sẽ xử lý yêu cầu đó thông qua quy trình của mạng lưới thẻ hoặc nhà cung cấp dịch vụ thanh toán có liên quan và sẽ không phát hành khoản hoàn trả bằng tiền mặt độc lập riêng biệt cùng một lúc, để tránh hoàn tiền trùng lặp hoặc xung đột kế toán.Sau khi quá trình tranh chấp kết thúc, nếu vẫn cần chỉnh sửa số dư tài khoản hoặc thanh toán, chúng tôi sẽ xử lý chúng dựa trên kết quả cuối cùng và hồ sơ hệ thống.

## 5. Các mặt hàng thường không được hoàn lại

Trừ khi luật hiện hành có yêu cầu khác, những khoản sau đây thường không được hoàn lại:

- số dư hoặc tín dụng dịch vụ được sử dụng cho các yêu cầu API, lệnh gọi mô hình, xử lý tệp, xử lý hình ảnh, sử dụng bộ đệm, xử lý yêu cầu hoặc các tính năng trả phí khác;
- các dịch vụ kỹ thuật số đã được cung cấp và bắt đầu thành công;
- các khoản phí do tài khoản, thành viên nhóm, khóa API, tập lệnh tự động, tiện ích tích hợp, khóa bị rò rỉ, cài đặt quyền, nhân viên nội bộ hoặc người dùng được ủy quyền gây ra;
- chi phí mô hình của bên thứ ba, chi phí dịch vụ đám mây, phí tối thiểu, mức sử dụng vượt mức, thuế, chênh lệch chuyển đổi tiền tệ, phí ngân hàng, phí mạng thẻ, phí mạng, phí nhà cung cấp dịch vụ thanh toán hoặc phí nền tảng của bên thứ ba;
- khuyến mại, khen thưởng, dùng thử, phiếu giảm giá, quà tặng, số dư miễn phí hoặc tín dụng miễn phí;
- đơn đặt hàng, số dư hoặc tín dụng dịch vụ liên quan đến gian lận, lạm dụng, rủi ro bị trừng phạt, sử dụng trái pháp luật, vi phạm chính sách, chia sẻ tài khoản, bán lại trái phép, chuyển tiếp, cung cấp cho người khác, lạm dụng bồi hoàn hoặc gian lận giới hạn;
- các yêu cầu dựa trên sự không hài lòng với chất lượng đầu ra AI, hành vi của mô hình, tính khả dụng của dịch vụ, độ trễ, giới hạn tốc độ, thay đổi về giá, hạn chế trong khu vực hoặc thay đổi chính sách của bên thứ ba, trong đó dịch vụ được cung cấp như mô tả hoặc các khoản tín dụng liên quan đã được sử dụng;
- các vấn đề gây ra bởi thông tin tài khoản, email, thanh toán, thuế, doanh nghiệp, hóa đơn hoặc thanh toán không chính xác mà bạn đã cung cấp, trừ khi luật hiện hành hoặc quy định của nhà cung cấp dịch vụ thanh toán yêu cầu chỉnh sửa hoặc hoàn lại tiền.

## 6. Nội dung số và quyền của người tiêu dùng

Đối với nội dung kỹ thuật số hoặc dịch vụ kỹ thuật số được cung cấp và có thể sử dụng ngay lập tức, trong phạm vi được luật hiện hành cho phép, bạn có thể mất quyền hủy hoặc rút lui theo luật định sau khi số dư tài khoản, tín dụng dịch vụ hoặc các dịch vụ liên quan được cung cấp hoặc khi bạn bắt đầu sử dụng các dịch vụ liên quan.

Nếu địa điểm của bạn cung cấp các quyền bảo vệ người tiêu dùng không thể từ bỏ, hoàn tiền, rút ​​lui, hủy bỏ hoặc tranh chấp, chúng tôi sẽ xử lý các yêu cầu theo luật hiện hành ngay cả khi các phần khác của Chính sách này có quy định khác.

## 7. Cách yêu cầu hoàn tiền

Liên hệ support@flatkey.ai và cung cấp càng nhiều thông tin sau càng tốt:

- email tài khoản;
- số đơn đặt hàng, ID thanh toán, số biên nhận Paddle, số biên nhận Stripe, tham chiếu thanh toán hoặc số hóa đơn;
- ngày mua, số tiền, loại tiền và loại phương thức thanh toán;
- lý do yêu cầu hoàn tiền hoặc điều chỉnh;
- ảnh chụp màn hình, thông báo lỗi, trạng thái giao hàng, bản ghi số dư hoặc bản ghi bảng điều khiển có liên quan;
- để biết các vấn đề về sử dụng, tên khóa API, ID yêu cầu, dấu thời gian, kiểu máy hoặc tên dịch vụ.

Các khoản phí trùng lặp, không giao hàng, khấu trừ không chính xác, lỗi hóa đơn, vấn đề về thuế hoặc thanh toán bất thường phải được gửi ngay khi được phát hiện.Chúng tôi có thể yêu cầu thông tin bổ sung để xác minh quyền sở hữu tài khoản, hồ sơ mua hàng, trạng thái giao hàng, trạng thái sử dụng, trạng thái thanh toán, thông tin thuế và khả năng đủ điều kiện hoàn tiền.

## 8. Phương thức hoàn tiền và thời gian xử lý

Khoản hoàn trả bằng tiền mặt đã được phê duyệt thường quay trở lại phương thức thanh toán ban đầu.Thời gian xử lý tùy thuộc vào Paddle, Stripe, ngân hàng, mạng thẻ, ví, nhà cung cấp phương thức thanh toán địa phương và các nhà cung cấp dịch vụ có liên quan khác.Chúng tôi không thể đảm bảo khi nào bên thứ ba sẽ hoàn thành việc đăng.

Trong một số trường hợp, chúng tôi có thể giải quyết vấn đề thông qua việc khôi phục số dư, chỉnh sửa tín dụng, điều chỉnh tài khoản, ghi chú tín dụng, chỉnh sửa hóa đơn hoặc cập nhật biên lai, đặc biệt khi vấn đề liên quan đến lỗi giao hàng, đo lường không chính xác, khấu trừ trùng lặp hoặc lỗi ghi chép tài khoản.

Các giới hạn về thuế, hóa đơn, ghi chú tín dụng, biên lai, chuyển đổi tiền tệ và phương thức thanh toán có thể được xử lý bởi nhà cung cấp dịch vụ thanh toán đơn hàng ban đầu.Nếu đơn đặt hàng đã chuyển sang trạng thái bồi hoàn, tranh chấp, kiểm soát rủi ro, xem xét thuế hoặc hạn chế của nhà cung cấp dịch vụ thanh toán thì việc hoàn tiền có thể mất nhiều thời gian hơn hoặc phải tuân theo quy trình liên quan.

## 9. Paddle, Stripe và các nhà cung cấp dịch vụ thanh toán khác

Nếu một đơn đặt hàng được Paddle xử lý với tư cách là Người bán chính thức hoặc người bán, thì Paddle có thể xác định hoặc thực hiện các khoản hoàn tiền, thuế, hóa đơn, giấy báo có, biên lai và các vấn đề tranh chấp thanh toán theo quy trình của Paddle.

Nếu đơn đặt hàng được xử lý bởi Stripe hoặc bộ xử lý thanh toán khác, VOC AI có thể xem xét yêu cầu hoàn tiền và nếu khả thi, sẽ hướng dẫn bộ xử lý trả lại số tiền hoàn lại đã được phê duyệt cho phương thức thanh toán ban đầu.Quy tắc và thời gian xử lý có thể khác nhau tùy theo nhà cung cấp dịch vụ thanh toán, quốc gia, đơn vị tiền tệ, phương thức thanh toán và ngân hàng.

## 10. Khoản bồi hoàn và tranh chấp thanh toán

Nếu bạn bắt đầu yêu cầu bồi hoàn, tranh chấp thanh toán, đảo ngược thanh toán hoặc quy trình tương tự, chúng tôi có thể tạm dừng các tài khoản, khóa API, số dư, tín dụng dịch vụ, đơn đặt hàng hoặc quyền truy cập dịch vụ có liên quan trong quá trình điều tra.

Chúng tôi có thể cung cấp cho Paddle, Stripe, ngân hàng, mạng thẻ, ví, mạng thanh toán, nhà cung cấp dịch vụ thuế hoặc cơ quan xử lý tranh chấp hồ sơ đặt hàng, hồ sơ giao hàng, nhật ký sử dụng, hồ sơ số dư, hồ sơ thuế, hóa đơn, biên lai, hồ sơ hoàn tiền, thông tin liên lạc hỗ trợ, hoạt động tài khoản và hồ sơ bảo mật để điều tra và giải quyết tranh chấp.

Trước tiên, vui lòng liên hệ với chúng tôi nếu có các khoản phí trùng lặp, không giao hàng, khấu trừ không chính xác, các vấn đề về thuế, hóa đơn, biên lai và các vấn đề thanh toán.Việc trực tiếp thực hiện yêu cầu bồi hoàn có thể dẫn đến việc tạm ngưng tài khoản, chậm trễ hoàn tiền, phí tranh chấp hoặc hạn chế mua hàng trong tương lai.

Nếu bạn đã liên hệ với ngân hàng, mạng thẻ, nhà cung cấp ví hoặc nhà cung cấp dịch vụ thanh toán để khởi kiện tranh chấp, hãy cho chúng tôi biết trạng thái tranh chấp và số tham chiếu trong thông báo hoàn tiền.Việc che giấu tranh chấp đang diễn ra, yêu cầu hoàn tiền trùng lặp cùng lúc hoặc tiếp tục yêu cầu bồi hoàn sau khi nhận được tiền hoàn lại có thể bị coi là lạm dụng khoản bồi hoàn.

## 11. Cập nhật chính sách

Đôi khi, chúng tôi có thể cập nhật Chính sách hoàn tiền này.Chính sách cập nhật thường áp dụng cho các yêu cầu mua hàng, giao hàng, sử dụng và hoàn tiền xảy ra sau khi cập nhật, trừ khi luật hiện hành hoặc quy định của nhà cung cấp dịch vụ thanh toán có yêu cầu khác.

## 12. Liên hệ

Đối với các câu hỏi về giao dịch mua, giao hàng, số dư tài khoản, tín dụng dịch vụ, các khoản phí trùng lặp, khấu trừ không chính xác, thuế, hóa đơn, biên lai, điều kiện hoàn tiền, biên nhận Paddle, biên lai Stripe hoặc tranh chấp thanh toán, hãy liên hệ với support@flatkey.ai hoặc viết thư cho VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, Hoa Kỳ.

Tất cả các nội dung trên sẽ có phiên bản tiếng Anh.`,
    sla: `# Thỏa thuận mức dịch vụ flatkey.ai

Cập nhật lần cuối: ngày 13 tháng 6 năm 2026

Thỏa thuận mức dịch vụ này ("SLA") mô tả mục tiêu khả dụng và quy trình hỗ trợ cho các dịch vụ flatkey.ai do VOC AI INC ("VOC AI", "chúng tôi" hoặc "của chúng tôi") cung cấp.

## 1. Phạm vi

SLA này áp dụng cho bảng điều khiển lưu trữ, cổng API, định tuyến, đo lường và dịch vụ tài khoản flatkey.ai mà chúng tôi trực tiếp vận hành. SLA này không áp dụng cho nhà cung cấp mô hình AI bên thứ ba, nhà cung cấp thanh toán, mạng của khách hàng, ứng dụng của khách hàng, tính năng beta, sự kiện bất khả kháng, bảo trì theo lịch, biện pháp giảm thiểu lạm dụng, tạm ngưng tài khoản hoặc các vấn đề do cấu hình, thông tin xác thực, tích hợp hoặc vi phạm chính sách của khách hàng gây ra.

## 2. Mục tiêu khả dụng

Chúng tôi đặt mục tiêu khả dụng hàng tháng 99,5% cho các endpoint dịch vụ flatkey.ai được bao phủ. Khả dụng được đo bởi hệ thống giám sát sản xuất của chúng tôi đối với các dịch vụ được bao phủ.

## 3. Bảo trì và thay đổi dịch vụ

Chúng tôi có thể thực hiện bảo trì theo lịch hoặc khẩn cấp để cải thiện bảo mật, độ tin cậy, hiệu năng hoặc tuân thủ. Chúng tôi nỗ lực hợp lý để giảm tác động đến khách hàng và, khi khả thi, thông báo qua bảng điều khiển, trang web, email hoặc kênh hỗ trợ.

## 4. Phụ thuộc bên thứ ba

flatkey.ai định tuyến yêu cầu đến nhà cung cấp mô hình bên thứ ba và phụ thuộc vào nhà cung cấp đám mây, mạng, thanh toán, bảo mật và phân tích. Sự cố, giới hạn tốc độ, thay đổi chính sách, hạn chế khu vực, hành vi mô hình hoặc lỗi từ phía nhà cung cấp bên thứ ba nằm ngoài SLA này.

## 5. Hỗ trợ

Đối với vấn đề khả dụng dịch vụ, hãy liên hệ support@flatkey.ai với email tài khoản, endpoint bị ảnh hưởng, ID yêu cầu nếu có, dấu thời gian, thông báo lỗi và tóm tắt tác động. Chúng tôi xem xét yêu cầu hỗ trợ dựa trên mức độ nghiêm trọng, hồ sơ sẵn có và rủi ro vận hành.

## 6. Biện pháp khắc phục

Trừ khi một thỏa thuận bằng văn bản riêng quy định biện pháp khác, SLA này không tự động tạo tín dụng dịch vụ, hoàn tiền, phạt hoặc bồi thường thiệt hại ấn định. Bất kỳ điều chỉnh thiện chí, sửa số dư hoặc hỗ trợ khắc phục nào đều được xử lý từng trường hợp theo Thỏa thuận người dùng và các chính sách áp dụng.

## 7. Cập nhật

Chúng tôi có thể cập nhật SLA này theo thời gian. SLA cập nhật thường áp dụng cho các kỳ dịch vụ sau khi cập nhật.

## 8. Liên hệ

Nếu có câu hỏi về SLA này hoặc sự cố dịch vụ, hãy liên hệ support@flatkey.ai hoặc viết thư cho VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, Hoa Kỳ.

Tất cả các nội dung trên sẽ có phiên bản tiếng Anh.`,
  },
}
