import { useState } from 'react';
import { PageHeader } from '@/components/organisms/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/atoms/Loading';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SyncResult {
  added: string[];
  updated: string[];
  failed: string[];
}

export default function ModelSync() {
  const { toast } = useToast();
  const [selectedChannel, setSelectedChannel] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // 模拟渠道列表
  const channels = [
    { id: '1', name: 'OpenAI Channel', type: 'OpenAI' },
    { id: '2', name: 'Anthropic Channel', type: 'Anthropic' },
  ];

  const handleSync = async () => {
    if (!selectedChannel) {
      toast({
        variant: 'destructive',
        title: '同步失败',
        description: '请选择要同步的渠道',
      });
      return;
    }

    setIsSyncing(true);
    try {
      // TODO: 调用同步模型 API
      await new Promise(resolve => setTimeout(resolve, 2000));

      const result: SyncResult = {
        added: ['gpt-4-turbo', 'gpt-4-vision'],
        updated: ['gpt-4', 'gpt-3.5-turbo'],
        failed: [],
      };

      setSyncResult(result);

      toast({
        title: '同步成功',
        description: `新增 ${result.added.length} 个模型，更新 ${result.updated.length} 个模型`,
      });
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

  return (
    <div data-testid="model-sync-page">
      <PageHeader
        title="模型同步"
        description="从渠道同步最新的模型列表"
      />

      <div className="space-y-6">
        {/* 同步配置 */}
        <Card>
          <CardHeader>
            <CardTitle>同步配置</CardTitle>
            <CardDescription>
              选择要同步的渠道，系统将从该渠道获取最新的模型列表
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">选择渠道</label>
              <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                <SelectTrigger data-testid="channel-select">
                  <SelectValue placeholder="请选择渠道" />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.name} ({channel.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleSync}
              disabled={isSyncing || !selectedChannel}
              data-testid="sync-button"
            >
              {isSyncing && <LoadingSpinner className="mr-2" />}
              <RefreshCw className="mr-2 h-4 w-4" />
              开始同步
            </Button>
          </CardContent>
        </Card>

        {/* 同步结果 */}
        {syncResult && (
          <Card>
            <CardHeader>
              <CardTitle>同步结果</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 新增模型 */}
              {syncResult.added.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="font-medium">新增模型 ({syncResult.added.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {syncResult.added.map((model) => (
                      <Badge key={model} variant="default">
                        {model}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 更新模型 */}
              {syncResult.updated.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">更新模型 ({syncResult.updated.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {syncResult.updated.map((model) => (
                      <Badge key={model} variant="secondary">
                        {model}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 失败模型 */}
              {syncResult.failed.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="font-medium">同步失败 ({syncResult.failed.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {syncResult.failed.map((model) => (
                      <Badge key={model} variant="destructive">
                        {model}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
