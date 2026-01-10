import { useState } from 'react';
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
import { DataTable, Column } from '@/components/organisms/DataTable';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/atoms/Loading';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Settings, RefreshCw, RotateCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ModelRatio {
  model: string;
  ratio: number;
  completionRatio: number;
}

const modelSettingsSchema = z.object({
  autoSyncEnabled: z.boolean().default(false),
  syncInterval: z.number().min(0).default(0),
  defaultRatio: z.number().min(0).default(1),
});

type ModelSettingsFormData = z.infer<typeof modelSettingsSchema>;

export default function ModelSettings() {
  const { toast } = useToast();
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const form = useForm<ModelSettingsFormData>({
    resolver: zodResolver(modelSettingsSchema),
    defaultValues: {
      autoSyncEnabled: false,
      syncInterval: 0,
      defaultRatio: 1,
    },
  });

  // 模拟数据
  const modelRatios: ModelRatio[] = [
    { model: 'gpt-4', ratio: 30, completionRatio: 60 },
    { model: 'gpt-3.5-turbo', ratio: 1, completionRatio: 2 },
    { model: 'claude-3-opus', ratio: 15, completionRatio: 75 },
  ];

  const onSubmit = async (data: ModelSettingsFormData) => {
    try {
      // TODO: 调用保存模型设置 API
      console.log(data);
      
      toast({
        title: '保存成功',
        description: '模型设置已更新',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '保存失败',
        description: error.response?.data?.message || '保存失败，请稍后重试',
      });
    }
  };

  const handleSyncRatios = async () => {
    setIsSyncing(true);
    try {
      // TODO: 调用同步倍率 API
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: '同步成功',
        description: '模型倍率已同步',
      });
      
      setShowSyncDialog(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '同步失败',
        description: error.response?.data?.message || '同步失败',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleResetRatios = async () => {
    setIsSyncing(true);
    try {
      // TODO: 调用重置倍率 API
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast({
        title: '重置成功',
        description: '模型倍率已重置为默认值',
      });
      
      setShowResetDialog(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '重置失败',
        description: error.response?.data?.message || '重置失败',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const columns: Column<ModelRatio>[] = [
    {
      key: 'model',
      title: '模型',
      render: (value) => <code className="text-sm">{value}</code>,
    },
    {
      key: 'ratio',
      title: 'Prompt 倍率',
      render: (value) => `${value}x`,
    },
    {
      key: 'completionRatio',
      title: 'Completion 倍率',
      render: (value) => `${value}x`,
    },
    {
      key: 'actions',
      title: '操作',
      width: '100px',
      render: (_, record) => (
        <Button size="sm" variant="outline" data-testid={`edit-ratio-${record.model}`}>
          编辑
        </Button>
      ),
    },
  ];

  return (
    <div data-testid="model-settings-page">
      <PageHeader
        title="模型设置"
        description="配置模型倍率和同步策略"
      />

      <div className="space-y-6">
        {/* 同步配置 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              <CardTitle>同步配置</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="autoSyncEnabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">自动同步</FormLabel>
                        <FormDescription>
                          定期从上游同步模型倍率
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="auto-sync-enabled-switch"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {form.watch('autoSyncEnabled') && (
                  <FormField
                    control={form.control}
                    name="syncInterval"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>同步间隔（小时）</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            placeholder="24"
                            data-testid="sync-interval-input"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormDescription>
                          0 表示不自动同步
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="defaultRatio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>默认倍率</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="1"
                          data-testid="default-ratio-input"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormDescription>
                        新模型的默认倍率
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  data-testid="save-model-settings-button"
                >
                  {form.formState.isSubmitting && <LoadingSpinner className="mr-2" />}
                  保存设置
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* 模型倍率列表 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>模型倍率</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowResetDialog(true)}
                  data-testid="reset-ratios-button"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  重置倍率
                </Button>
                <Button
                  onClick={() => setShowSyncDialog(true)}
                  data-testid="sync-ratios-button"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  同步倍率
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={modelRatios}
              pagination={{
                page: 1,
                pageSize: 10,
                total: modelRatios.length,
                onPageChange: () => {},
                onPageSizeChange: () => {},
              }}
              emptyText="暂无模型倍率数据"
            />
          </CardContent>
        </Card>
      </div>

      {/* 同步倍率对话框 */}
      <Dialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
        <DialogContent data-testid="sync-ratios-dialog">
          <DialogHeader>
            <DialogTitle>同步模型倍率</DialogTitle>
            <DialogDescription>
              从上游同步最新的模型倍率配置，这将覆盖当前的倍率设置。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSyncDialog(false)}
              disabled={isSyncing}
            >
              取消
            </Button>
            <Button
              onClick={handleSyncRatios}
              disabled={isSyncing}
              data-testid="confirm-sync-button"
            >
              {isSyncing && <LoadingSpinner className="mr-2" />}
              确认同步
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重置倍率对话框 */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent data-testid="reset-ratios-dialog">
          <DialogHeader>
            <DialogTitle>重置模型倍率</DialogTitle>
            <DialogDescription>
              将所有模型倍率重置为默认值，此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowResetDialog(false)}
              disabled={isSyncing}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetRatios}
              disabled={isSyncing}
              data-testid="confirm-reset-button"
            >
              {isSyncing && <LoadingSpinner className="mr-2" />}
              确认重置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
