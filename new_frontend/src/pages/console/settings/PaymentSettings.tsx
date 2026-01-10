import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PageHeader } from '@/components/organisms/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/atoms/Loading';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { CreditCard, DollarSign, Wallet } from 'lucide-react';

const paymentSchema = z.object({
  // Stripe
  stripeEnabled: z.boolean().default(false),
  stripeApiKey: z.string().optional(),
  stripeWebhookSecret: z.string().optional(),
  stripePrice: z.number().min(0).default(0),
  
  // Creem
  creemEnabled: z.boolean().default(false),
  creemApiKey: z.string().optional(),
  creemWebhookSecret: z.string().optional(),
  
  // 易付
  epayEnabled: z.boolean().default(false),
  epayPid: z.string().optional(),
  epayKey: z.string().optional(),
  
  // 充值链接
  topupLink: z.string().url().optional().or(z.literal('')),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

export default function PaymentSettings() {
  const { toast } = useToast();

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      stripeEnabled: false,
      stripePrice: 10,
      creemEnabled: false,
      epayEnabled: false,
      topupLink: '',
    },
  });

  const onSubmit = async (data: PaymentFormData) => {
    try {
      // TODO: 调用保存支付设置 API
      console.log(data);
      
      toast({
        title: '保存成功',
        description: '支付设置已更新',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '保存失败',
        description: error.response?.data?.message || '保存失败，请稍后重试',
      });
    }
  };

  return (
    <div data-testid="payment-settings-page">
      <PageHeader
        title="支付设置"
        description="配置充值和支付方式"
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Stripe */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                <CardTitle>Stripe 支付</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="stripeEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">启用 Stripe</FormLabel>
                      <FormDescription>
                        使用 Stripe 处理信用卡支付
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="stripe-enabled-switch"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch('stripeEnabled') && (
                <>
                  <FormField
                    control={form.control}
                    name="stripeApiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Key</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="sk_live_..."
                            data-testid="stripe-api-key-input"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Stripe Secret Key
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="stripeWebhookSecret"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Webhook Secret</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="whsec_..."
                            data-testid="stripe-webhook-secret-input"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          用于验证 Webhook 请求
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="stripePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>单价（美元/100万 tokens）</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="10.00"
                            data-testid="stripe-price-input"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormDescription>
                          充值时的单价设置
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* Creem */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                <CardTitle>Creem 支付</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="creemEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">启用 Creem</FormLabel>
                      <FormDescription>
                        使用 Creem 处理加密货币支付
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="creem-enabled-switch"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch('creemEnabled') && (
                <>
                  <FormField
                    control={form.control}
                    name="creemApiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Key</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="请输入 Creem API Key"
                            data-testid="creem-api-key-input"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="creemWebhookSecret"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Webhook Secret</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="请输入 Webhook Secret"
                            data-testid="creem-webhook-secret-input"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          用于验证 Webhook 请求
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* 易付 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                <CardTitle>易付支付</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="epayEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">启用易付</FormLabel>
                      <FormDescription>
                        使用易付处理支付
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="epay-enabled-switch"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch('epayEnabled') && (
                <>
                  <FormField
                    control={form.control}
                    name="epayPid"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>商户 PID</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="请输入商户 PID"
                            data-testid="epay-pid-input"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="epayKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>商户密钥</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="请输入商户密钥"
                            data-testid="epay-key-input"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* 充值链接 */}
          <Card>
            <CardHeader>
              <CardTitle>自定义充值链接</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="topupLink"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>充值链接</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://example.com/topup"
                        data-testid="topup-link-input"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      用户点击充值按钮时跳转的链接，留空使用默认充值页面
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Separator />

          {/* 操作按钮 */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              data-testid="save-payment-settings-button"
            >
              {form.formState.isSubmitting && <LoadingSpinner className="mr-2" />}
              保存设置
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
