import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PRICING_PLANS } from '@/constants/pricing';

export function PricingPlans() {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr>
                <th className="text-left p-4 font-semibold text-lg">功能</th>
                {PRICING_PLANS.map((plan) => (
                  <th
                    key={plan.id}
                    className={`p-4 font-semibold text-lg text-center ${
                      plan.popular ? 'bg-primary/10 border-2 border-primary' : ''
                    }`}
                  >
                    {plan.name}
                    {plan.popular && (
                      <span className="block text-xs font-normal text-primary mt-1">最受欢迎</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-4 font-medium">平台费用</td>
                {PRICING_PLANS.map((plan) => (
                  <td key={plan.id} className="p-4 text-center">
                    {(plan as any).platformFeesLink ? (
                      <Link to={(plan as any).platformFeesLink} className="text-primary hover:underline">
                        {plan.platformFees}
                      </Link>
                    ) : (
                      plan.platformFees
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-t">
                <td className="p-4 font-medium">模型数量</td>
                {PRICING_PLANS.map((plan) => (
                  <td key={plan.id} className="p-4 text-center">{plan.models}</td>
                ))}
              </tr>
              <tr className="border-t">
                <td className="p-4 font-medium">提供商数量</td>
                {PRICING_PLANS.map((plan) => (
                  <td key={plan.id} className="p-4 text-center">{plan.providers}</td>
                ))}
              </tr>
              <tr className="border-t">
                <td className="p-4 font-medium">聊天和 API 访问</td>
                {PRICING_PLANS.map((plan) => (
                  <td key={plan.id} className="p-4 text-center">
                    {plan.chatApi && <Check className="mx-auto w-5 h-5 text-primary" />}
                  </td>
                ))}
              </tr>
              <tr className="border-t">
                <td className="p-4 font-medium">活动日志和导出</td>
                {PRICING_PLANS.map((plan) => (
                  <td key={plan.id} className="p-4 text-center">
                    {plan.activityLogs && <Check className="mx-auto w-5 h-5 text-primary" />}
                  </td>
                ))}
              </tr>
              <tr className="border-t">
                <td className="p-4 font-medium">自动路由、首选提供商选择</td>
                {PRICING_PLANS.map((plan) => (
                  <td key={plan.id} className="p-4 text-center">
                    {plan.autoRouting && <Check className="mx-auto w-5 h-5 text-primary" />}
                  </td>
                ))}
              </tr>
              <tr className="border-t">
                <td className="p-4 font-medium">预算和支出控制</td>
                {PRICING_PLANS.map((plan) => (
                  <td key={plan.id} className="p-4 text-center">
                    {plan.budgets && <Check className="mx-auto w-5 h-5 text-primary" />}
                  </td>
                ))}
              </tr>
              <tr className="border-t">
                <td className="p-4 font-medium">提示词缓存</td>
                {PRICING_PLANS.map((plan) => (
                  <td key={plan.id} className="p-4 text-center">
                    {plan.promptCaching && <Check className="mx-auto w-5 h-5 text-primary" />}
                  </td>
                ))}
              </tr>
              <tr className="border-t">
                <td className="p-4 font-medium">API 密钥配置</td>
                {PRICING_PLANS.map((plan) => (
                  <td key={plan.id} className="p-4 text-center">
                    {plan.provisioning && <Check className="mx-auto w-5 h-5 text-primary" />}
                  </td>
                ))}
              </tr>
              <tr className="border-t">
                <td className="p-4 font-medium">管理控制</td>
                {PRICING_PLANS.map((plan) => (
                  <td key={plan.id} className="p-4 text-center">
                    {plan.adminControls && <Check className="mx-auto w-5 h-5 text-primary" />}
                  </td>
                ))}
              </tr>
              <tr className="border-t">
                <td className="p-4 font-medium">基于数据策略的路由</td>
                {PRICING_PLANS.map((plan) => (
                  <td key={plan.id} className="p-4 text-center">
                    {plan.dataPolicyRouting && <Check className="mx-auto w-5 h-5 text-primary" />}
                  </td>
                ))}
              </tr>
              <tr className="border-t">
                <td className="p-4 font-medium">托管策略执行</td>
                {PRICING_PLANS.map((plan) => (
                  <td key={plan.id} className="p-4 text-center">
                    {plan.managedPolicy && <Check className="mx-auto w-5 h-5 text-primary" />}
                  </td>
                ))}
              </tr>
              <tr className="border-t">
                <td className="p-4 font-medium">提供商数据浏览器</td>
                {PRICING_PLANS.map((plan) => (
                  <td key={plan.id} className="p-4 text-center">
                    {plan.providerDataExplorer && <Check className="mx-auto w-5 h-5 text-primary" />}
                  </td>
                ))}
              </tr>
              <tr className="border-t">
                <td className="p-4 font-medium">SSO/SAML</td>
                {PRICING_PLANS.map((plan) => (
                  <td key={plan.id} className="p-4 text-center">
                    {plan.ssoSaml && <Check className="mx-auto w-5 h-5 text-primary" />}
                  </td>
                ))}
              </tr>
              <tr className="border-t">
                <td className="p-4 font-medium">合同 SLA</td>
                {PRICING_PLANS.map((plan) => (
                  <td key={plan.id} className="p-4 text-center">
                    {plan.contractualSlas && <Check className="mx-auto w-5 h-5 text-primary" />}
                  </td>
                ))}
              </tr>
              <tr className="border-t">
                <td className="p-4 font-medium">支付选项</td>
                {PRICING_PLANS.map((plan) => (
                  <td key={plan.id} className="p-4 text-center">{plan.paymentOptions}</td>
                ))}
              </tr>
              <tr className="border-t">
                <td className="p-4 font-medium">Token 定价</td>
                {PRICING_PLANS.map((plan) => (
                  <td key={plan.id} className="p-4 text-center">{plan.tokenPricing}</td>
                ))}
              </tr>
              <tr className="border-t">
                <td className="p-4 font-medium">支持</td>
                {PRICING_PLANS.map((plan) => (
                  <td key={plan.id} className="p-4 text-center">{plan.support}</td>
                ))}
              </tr>
              <tr className="border-t">
                <td className="p-4"></td>
                {PRICING_PLANS.map((plan) => (
                  <td key={plan.id} className="p-4 text-center">
                    <Link to={plan.ctaLink}>
                      <Button
                        variant={plan.popular ? 'default' : 'outline'}
                        className="w-full"
                      >
                        {plan.ctaText}
                      </Button>
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}