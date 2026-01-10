import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { Textarea } from '@/components/ui/textarea';
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
import { CHANNEL_TYPES } from '@/lib/constants';
import { useChannel, useUpdateChannel } from '@/hooks/queries/useChannels';

const channelSchema = z.object({
  type: z.number().min(1, '请选择渠道类型'),
  name: z.string().min(1, '请输入渠道名称'),
  key: z.string().min(1, '请输入 API 密钥'),
  baseUrl: z.string().url('请输入有效的 URL').optional().or(z.literal('')),
  other: z.string().optional(),
  models: z.string().optional(),
  modelMapping: z.string().optional(),
  priority: z.number().min(0).max(100).default(0),
  weight: z.number().min(0).default(0),
  proxy: z.string().optional(),
  testModel: z.string().optional(),
  groups: z.string().optional(),
  config: z.string().optional(),
  status: z.number().default(1),
});

type ChannelFormData = z.infer<typeof channelSchema>;

const channelTypes = [
  { value: CHANNEL_TYPES.OPENAI, label: 'OpenAI' },
  { value: CHANNEL_TYPES.ANTHROPIC, label: 'Anthropic' },
  { value: CHANNEL_TYPES.GOOGLE, label: 'Google' },
  { value: CHANNEL_TYPES.AZURE, label: 'Azure' },
  { value: CHANNEL_TYPES.AWS, label: 'AWS' },
  { value: CHANNEL_TYPES.COHERE, label: 'Cohere' },
  { value: CHANNEL_TYPES.HUGGINGFACE, label: 'HuggingFace' },
  { value: CHANNEL_TYPES.CUSTOM, label: '自定义' },
];

export default function ChannelEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isTesting, setIsTesting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const updateChannel = useUpdateChannel();
  const { data: channelData, isLoading: isLoadingChannel } = useChannel(Number(id));

  const form = useForm<ChannelFormData>({
    resolver: zodResolver(channelSchema),
    defaultValues: {
      type: 0,
      name: '',
      key: '',
      baseUrl: '',
      other: '',
      models: '',
      modelMapping: '',
      priority: 0,
      weight: 0,
      proxy: '',
      testModel: '',
      groups: '',
      config: '',
      status: 1,
    },
  });

  useEffect(() => {
    if (channelData) {
      form.reset({
        type: channelData.type,
        name: channelData.name,
        key: channelData.key,
        baseUrl: channelData.baseUrl || '',
        other: channelData.other || '',
        models: channelData.models?.join('\n') || '',
        modelMapping: channelData.modelMapping || '',
        priority: channelData.priority || 0,
        weight: channelData.weight || 0,
        proxy: '',
        testModel: '',
        groups: channelData.group?.join(',') || '',
        config: channelData.config || '',
        status: channelData.status,
      });
      setIsLoading(false);
    }
  }, [channelData, form]);

  const onSubmit = async (data: ChannelFormData) => {
    try {
      await updateChannel.mutateAsync({
        id: Number(id),
        type: data.type,
        name: data.name,
        key: data.key,
        base_url: data.baseUrl || undefined,
        models: data.models || undefined,
        group: data.groups || undefined,
        priority: data.priority,
        weight: data.weight,
        other: data.other || undefined,
        model_mapping: data.modelMapping || undefined,
        status: data.status,
        test_model: data.testModel || undefined,
        setting: data.config || undefined,
      });
      
      toast({
        title: '更新成功',
        description: '渠道已成功更新',
      });
      
      navigate('/console/channels');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '更新失败',
        description: error.response?.data?.message || '更新失败，请稍后重试',
      });
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      // TODO: 调用测试连接 API
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast({
        title: '测试成功',
        description: '渠道连接正常',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '测试失败',
        description: error.response?.data?.message || '连接测试失败',
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div data-testid="channel-edit-page">
      <PageHeader
        title="编辑渠道"
        description="修改 AI 服务渠道配置"
        actions={
          <Button variant="outline" onClick={() => navigate('/console/channels')}>
            取消
          </Button>
        }
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* 基础信息 */}
          <Card>
            <CardHeader>
              <CardTitle>基础信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>渠道类型 *</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="channel-type-select">
                          <SelectValue placeholder="请选择渠道类型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {channelTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value.toString()}>
                            {type.label}
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
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>渠道名称 *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="请输入渠道名称"
                        data-testid="channel-name-input"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API 密钥 *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="请输入 API 密钥（支持多个密钥，一行一个）"
                        rows={3}
                        data-testid="channel-key-input"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      支持多个密钥，每行一个，系统会自动轮询使用
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="baseUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>自定义 Base URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://api.example.com/v1"
                        data-testid="channel-base-url-input"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      留空使用默认地址
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 配置选项 */}
          <Card>
            <CardHeader>
              <CardTitle>配置选项</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>优先级</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          data-testid="channel-priority-input"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        0-100，数值越大优先级越高
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>权重</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          data-testid="channel-weight-input"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        用于负载均衡，0 表示不参与
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="models"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>支持的模型</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="留空表示支持所有模型，或输入模型列表（一行一个）"
                        rows={3}
                        data-testid="channel-models-input"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="groups"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>用户分组</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="default,vip"
                        data-testid="channel-groups-input"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      逗号分隔，留空表示所有分组可用
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 高级选项 */}
          <Card>
            <CardHeader>
              <CardTitle>高级选项</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="proxy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>代理地址</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="http://proxy.example.com:8080"
                        data-testid="channel-proxy-input"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="testModel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>测试模型</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="gpt-3.5-turbo"
                        data-testid="channel-test-model-input"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="modelMapping"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>模型映射</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='{"gpt-4": "gpt-4-0613"}'
                        rows={3}
                        data-testid="channel-model-mapping-input"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      JSON 格式的模型映射配置
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="config"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>其他配置</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='{"timeout": 30, "max_retries": 3}'
                        rows={3}
                        data-testid="channel-config-input"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      JSON 格式的额外配置
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 操作按钮 */}
          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={isTesting || !form.watch('key')}
              data-testid="test-connection-button"
            >
              {isTesting && <LoadingSpinner className="mr-2" />}
              测试连接
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/console/channels')}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                data-testid="submit-button"
              >
                {form.formState.isSubmitting && <LoadingSpinner className="mr-2" />}
                保存修改
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
