import { useNavigate } from 'react-router-dom';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/atoms/Loading';

const redemptionSchema = z.object({
  name: z.string().min(1, '请输入兑换码名称'),
  quota: z.number().min(0, '额度不能小于 0'),
  count: z.number().min(1, '数量至少为 1').max(100, '数量不能超过 100'),
});

type RedemptionFormData = z.infer<typeof redemptionSchema>;

export default function RedemptionCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<RedemptionFormData>({
    resolver: zodResolver(redemptionSchema),
    defaultValues: {
      name: '',
      quota: 100,
      count: 1,
    },
  });

  const onSubmit = async (data: RedemptionFormData) => {
    try {
      // TODO: 调用创建兑换码 API
      console.log('创建兑换码:', data);
      
      toast({
        title: '创建成功',
        description: `已成功创建 ${data.count} 个兑换码`,
      });
      
      navigate('/console/redemptions');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '创建失败',
        description: error.response?.data?.message || '创建失败，请稍后重试',
      });
    }
  };

  return (
    <div data-testid="redemption-create-page">
      <PageHeader
        title="创建兑换码"
        description="批量生成兑换码"
        actions={
          <Button variant="outline" onClick={() => navigate('/console/redemptions')}>
            取消
          </Button>
        }
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>兑换码配置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>名称 *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="请输入兑换码名称"
                        data-testid="name-input"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      用于标识这批兑换码
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quota"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>额度 *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="100"
                        data-testid="quota-input"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      每个兑换码的额度（美元）
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>生成数量 *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        placeholder="1"
                        data-testid="count-input"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormDescription>
                      一次最多生成 100 个兑换码
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/console/redemptions')}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              data-testid="submit-button"
            >
              {form.formState.isSubmitting && <LoadingSpinner className="mr-2" />}
              创建兑换码
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
