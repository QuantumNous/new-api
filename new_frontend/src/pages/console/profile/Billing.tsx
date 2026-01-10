import { useState } from 'react';
import { PageHeader } from '@/components/organisms/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, Column } from '@/components/organisms/DataTable';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/atoms/Loading';
import { DollarSign, Gift, TrendingUp, Copy, ArrowUpRight } from 'lucide-react';
import { formatDateTime, copyToClipboard } from '@/lib/utils';

interface TopupRecord {
  id: string;
  amount: number;
  method: string;
  status: string;
  createdAt: number;
}

interface UsageRecord {
  date: string;
  requests: number;
  tokens: number;
  cost: number;
}

export default function Billing() {
  const { toast } = useToast();
  const [inviteCode, setInviteCode] = useState('ABC123XYZ');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferTarget, setTransferTarget] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 模拟数据
  const stats = {
    balance: 100.50,
    totalSpent: 250.00,
    inviteCount: 5,
    inviteEarnings: 25.00,
  };

  const topupRecords: TopupRecord[] = [
    {
      id: '1',
      amount: 100,
      method: 'Stripe',
      status: 'completed',
      createdAt: Date.now() / 1000 - 86400,
    },
  ];

  const usageRecords: UsageRecord[] = [
    {
      date: '2025-01-04',
      requests: 150,
      tokens: 50000,
      cost: 2.50,
    },
  ];

  const handleCopyInviteCode = async () => {
    const success = await copyToClipboard(inviteCode);
    if (success) {
      toast({
        title: '复制成功',
        description: '邀请码已复制到剪贴板',
      });
    }
  };

  const handleGenerateInviteCode = async () => {
    setIsLoading(true);
    try {
      // TODO: 调用生成邀请码 API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setInviteCode('NEW' + Math.random().toString(36).substring(2, 11).toUpperCase());
      
      toast({
        title: '生成成功',
        description: '新的邀请码已生成',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '生成失败',
        description: error.response?.data?.message || '操作失败',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferAmount || !transferTarget) {
      toast({
        variant: 'destructive',
        title: '转账失败',
        description: '请填写完整信息',
      });
      return;
    }

    setIsLoading(true);
    try {
      // TODO: 调用额度转账 API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: '转账成功',
        description: `已向 ${transferTarget} 转账 $${transferAmount}`,
      });
      
      setTransferAmount('');
      setTransferTarget('');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '转账失败',
        description: error.response?.data?.message || '操作失败',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const topupColumns: Column<TopupRecord>[] = [
    {
      key: 'createdAt',
      title: '时间',
      render: (value) => formatDateTime(value * 1000),
    },
    {
      key: 'amount',
      title: '金额',
      render: (value) => `$${value.toFixed(2)}`,
    },
    {
      key: 'method',
      title: '支付方式',
    },
    {
      key: 'status',
      title: '状态',
      render: (value) => {
        const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
          completed: { label: '已完成', variant: 'default' },
          pending: { label: '处理中', variant: 'secondary' },
          failed: { label: '失败', variant: 'destructive' },
        };
        const status = statusMap[value] || statusMap.pending;
        return <Badge variant={status.variant}>{status.label}</Badge>;
      },
    },
  ];

  const usageColumns: Column<UsageRecord>[] = [
    {
      key: 'date',
      title: '日期',
    },
    {
      key: 'requests',
      title: '请求数',
    },
    {
      key: 'tokens',
      title: 'Tokens',
      render: (value) => value.toLocaleString(),
    },
    {
      key: 'cost',
      title: '消耗',
      render: (value) => `$${value.toFixed(2)}`,
    },
  ];

  return (
    <div data-testid="billing-page">
      <PageHeader
        title="账单信息"
        description="管理您的充值、消费和邀请奖励"
      />

      <div className="space-y-6">
        {/* 账户概览 */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">账户余额</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.balance.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">可用额度</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">累计消费</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalSpent.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">总消费金额</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">邀请人数</CardTitle>
              <Gift className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.inviteCount}</div>
              <p className="text-xs text-muted-foreground">成功邀请</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">邀请收益</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.inviteEarnings.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">邀请奖励</p>
            </CardContent>
          </Card>
        </div>

        {/* 标签页 */}
        <Tabs defaultValue="topup" className="space-y-4">
          <TabsList>
            <TabsTrigger value="topup">充值记录</TabsTrigger>
            <TabsTrigger value="usage">使用统计</TabsTrigger>
            <TabsTrigger value="invite">邀请奖励</TabsTrigger>
            <TabsTrigger value="transfer">额度转账</TabsTrigger>
          </TabsList>

          {/* 充值记录 */}
          <TabsContent value="topup" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>充值记录</CardTitle>
                <CardDescription>查看您的充值历史</CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={topupColumns}
                  data={topupRecords}
                  pagination={{
                    page: 1,
                    pageSize: 10,
                    total: topupRecords.length,
                    onPageChange: () => {},
                    onPageSizeChange: () => {},
                  }}
                  emptyText="暂无充值记录"
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* 使用统计 */}
          <TabsContent value="usage" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>使用统计</CardTitle>
                <CardDescription>查看您的 API 使用情况</CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={usageColumns}
                  data={usageRecords}
                  pagination={{
                    page: 1,
                    pageSize: 10,
                    total: usageRecords.length,
                    onPageChange: () => {},
                    onPageSizeChange: () => {},
                  }}
                  emptyText="暂无使用记录"
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* 邀请奖励 */}
          <TabsContent value="invite" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>邀请奖励</CardTitle>
                <CardDescription>邀请好友注册，获得额度奖励</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>您的邀请码</Label>
                  <div className="flex gap-2">
                    <Input value={inviteCode} readOnly data-testid="invite-code-input" />
                    <Button
                      variant="outline"
                      onClick={handleCopyInviteCode}
                      data-testid="copy-invite-code-button"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleGenerateInviteCode}
                      disabled={isLoading}
                      data-testid="generate-invite-code-button"
                    >
                      {isLoading && <LoadingSpinner className="mr-2" />}
                      重新生成
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border bg-muted p-4">
                  <h4 className="mb-2 font-semibold">邀请规则</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• 好友使用您的邀请码注册，您将获得 $5 奖励</li>
                    <li>• 好友首次充值后，您将额外获得其充值金额的 10% 作为奖励</li>
                    <li>• 邀请奖励将自动添加到您的账户余额</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>已邀请人数</span>
                    <span className="font-semibold">{stats.inviteCount} 人</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>累计收益</span>
                    <span className="font-semibold">${stats.inviteEarnings.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 额度转账 */}
          <TabsContent value="transfer" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>额度转账</CardTitle>
                <CardDescription>将额度转给其他用户</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="transfer-target">目标用户</Label>
                  <Input
                    id="transfer-target"
                    placeholder="请输入用户名或用户 ID"
                    value={transferTarget}
                    onChange={(e) => setTransferTarget(e.target.value)}
                    data-testid="transfer-target-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transfer-amount">转账金额</Label>
                  <Input
                    id="transfer-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    data-testid="transfer-amount-input"
                  />
                  <p className="text-xs text-muted-foreground">
                    当前余额: ${stats.balance.toFixed(2)}
                  </p>
                </div>

                <Button
                  onClick={handleTransfer}
                  disabled={isLoading || !transferAmount || !transferTarget}
                  data-testid="transfer-button"
                >
                  {isLoading && <LoadingSpinner className="mr-2" />}
                  确认转账
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
