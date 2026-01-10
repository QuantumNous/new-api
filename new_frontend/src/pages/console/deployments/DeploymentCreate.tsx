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
import { Badge } from '@/components/ui/badge';

const deploymentSchema = z.object({
  name: z.string().min(1, '请输入部署名称'),
  model: z.string().min(1, '请选择模型'),
  hardware: z.string().min(1, '请选择硬件配置'),
  location: z.string().min(1, '请选择部署位置'),
  replicas: z.number().min(1, '副本数至少为 1').max(10, '副本数不能超过 10'),
});

type DeploymentFormData = z.infer<typeof deploymentSchema>;

export default function DeploymentCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<DeploymentFormData>({
    resolver: zodResolver(deploymentSchema),
    defaultValues: {
      name: '',
      model: '',
      hardware: '',
      location: '',
      replicas: 1,
    },
  });

  const models = [
    { value: 'gpt-4', label: 'GPT-4', price: 30 },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', price: 1 },
    { value: 'claude-3-opus', label: 'Claude 3 Opus', price: 15 },
  ];

  const hardwareOptions = [
    { value: 'cpu-2-4', label: '2 vCPU / 4 GB RAM', price: 0.05 },
    { value: 'cpu-4-8', label: '4 vCPU / 8 GB RAM', price: 0.10 },
    { value: 'gpu-t4', label: 'NVIDIA T4 GPU', price: 0.50 },
  ];

  const locations = [
    { value: 'us-east', label: 'US East (Virginia)' },
    { value: 'us-west', label: 'US West (Oregon)' },
    { value: 'eu-west', label: 'EU West (Ireland)' },
    { value: 'ap-east', label: 'AP East (Tokyo)' },
  ];

  const selectedModel = models.find(m => m.value === form.watch('model'));
  const selectedHardware = hardwareOptions.find(h => h.value === form.watch('hardware'));
  const replicas = form.watch('replicas') || 1;
  
  const estimatedCost = selectedModel && selectedHardware 
    ? ((selectedModel.price + selectedHardware.price) * replicas * 730).toFixed(2)
    : '0.00';

  const onSubmit = async (data: DeploymentFormData) => {
    try {
      // TODO: 调用创建部署 API
      console.log('创建部署:', data);
      
      toast({
        title: '创建成功',
        description: '部署正在启动中...',
      });
      
      navigate('/console/deployments');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '创建失败',
        description: error.response?.data?.message || '创建失败，请稍后重试',
      });
    }
  };

  return (
    <div data-testid="deployment-create-page">
      <PageHeader
        title="创建部署"
        description="部署 AI 模型到云端"
        actions={
          <Button variant="outline" onClick={() => navigate('/console/deployments')}>
            取消
          </Button>
        }
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* 基础配置 */}
          <Card>
            <CardHeader>
              <CardTitle>基础配置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>部署名称 *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="my-gpt4-deployment"
                        data-testid="name-input"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>模型 *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="model-select">
                          <SelectValue placeholder="请选择模型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {models.map((model) => (
                          <SelectItem key={model.value} value={model.value}>
                            <div className="flex items-center justify-between gap-4">
                              <span>{model.label}</span>
                              <Badge variant="secondary">${model.price}/M tokens</Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 硬件配置 */}
          <Card>
            <CardHeader>
              <CardTitle>硬件配置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="hardware"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>硬件规格 *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="hardware-select">
                          <SelectValue placeholder="请选择硬件配置" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {hardwareOptions.map((hw) => (
                          <SelectItem key={hw.value} value={hw.value}>
                            <div className="flex items-center justify-between gap-4">
                              <span>{hw.label}</span>
                              <Badge variant="secondary">${hw.price}/hour</Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>部署位置 *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="location-select">
                          <SelectValue placeholder="请选择部署位置" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations.map((loc) => (
                          <SelectItem key={loc.value} value={loc.value}>
                            {loc.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="replicas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>副本数 *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        data-testid="replicas-input"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormDescription>
                      副本数越多，可用性越高
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 费用预估 */}
          <Card>
            <CardHeader>
              <CardTitle>费用预估</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>模型费用</span>
                  <span>{selectedModel ? `$${selectedModel.price}/M tokens` : '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>硬件费用</span>
                  <span>{selectedHardware ? `$${selectedHardware.price}/hour` : '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>副本数</span>
                  <span>{replicas}</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between font-semibold">
                    <span>预估月费用</span>
                    <span className="text-lg text-primary">${estimatedCost}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    * 不包含模型调用费用，仅为基础设施费用
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/console/deployments')}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              data-testid="submit-button"
            >
              {form.formState.isSubmitting && <LoadingSpinner className="mr-2" />}
              创建部署
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
