import { PageHeader } from '@/components/organisms/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable, Column } from '@/components/organisms/DataTable';
import { Badge } from '@/components/ui/badge';
import { Monitor, Smartphone, Tablet, LogOut } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Session {
  id: string;
  deviceType: string;
  deviceName: string;
  ip: string;
  location: string;
  lastActive: number;
  current: boolean;
}

interface LoginHistory {
  id: string;
  ip: string;
  location: string;
  deviceType: string;
  time: number;
  success: boolean;
}

export default function Security() {
  const { toast } = useToast();

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="h-4 w-4" />;
      case 'tablet':
        return <Tablet className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const handleLogoutSession = async (sessionId: string) => {
    try {
      // TODO: 调用登出会话 API
      toast({
        title: '登出成功',
        description: '该设备已登出',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '登出失败',
        description: error.response?.data?.message || '操作失败',
      });
    }
  };

  const handleLogoutAllOthers = async () => {
    try {
      // TODO: 调用登出其他设备 API
      toast({
        title: '登出成功',
        description: '已登出所有其他设备',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '登出失败',
        description: error.response?.data?.message || '操作失败',
      });
    }
  };

  // 模拟数据
  const sessions: Session[] = [
    {
      id: '1',
      deviceType: 'desktop',
      deviceName: 'Chrome on Windows',
      ip: '192.168.1.100',
      location: '中国 北京',
      lastActive: Date.now() / 1000,
      current: true,
    },
  ];

  const loginHistory: LoginHistory[] = [];

  const sessionColumns: Column<Session>[] = [
    {
      key: 'deviceType',
      title: '设备',
      render: (value, record) => (
        <div className="flex items-center gap-2">
          {getDeviceIcon(value)}
          <div>
            <div className="font-medium">{record.deviceName}</div>
            <div className="text-xs text-muted-foreground">{record.ip}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'location',
      title: '位置',
    },
    {
      key: 'lastActive',
      title: '最后活动',
      render: (value) => formatDateTime(value * 1000),
    },
    {
      key: 'current',
      title: '状态',
      render: (value) => (
        value ? <Badge>当前设备</Badge> : <Badge variant="outline">其他设备</Badge>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: '100px',
      render: (_, record) => (
        !record.current && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleLogoutSession(record.id)}
            data-testid={`logout-session-${record.id}`}
          >
            <LogOut className="mr-1 h-3 w-3" />
            登出
          </Button>
        )
      ),
    },
  ];

  const historyColumns: Column<LoginHistory>[] = [
    {
      key: 'time',
      title: '时间',
      render: (value) => formatDateTime(value * 1000),
    },
    {
      key: 'ip',
      title: 'IP 地址',
    },
    {
      key: 'location',
      title: '位置',
    },
    {
      key: 'deviceType',
      title: '设备',
      render: (value) => (
        <div className="flex items-center gap-2">
          {getDeviceIcon(value)}
          <span className="capitalize">{value}</span>
        </div>
      ),
    },
    {
      key: 'success',
      title: '状态',
      render: (value) => (
        value ? (
          <Badge variant="outline" className="text-green-600">成功</Badge>
        ) : (
          <Badge variant="destructive">失败</Badge>
        )
      ),
    },
  ];

  return (
    <div data-testid="security-page">
      <PageHeader
        title="安全设置"
        description="管理您的登录会话和查看登录历史"
      />

      <div className="space-y-6">
        {/* 活动会话 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>活动会话</CardTitle>
                <CardDescription>
                  这些设备当前已登录您的账户
                </CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={handleLogoutAllOthers}
                data-testid="logout-all-others-button"
              >
                <LogOut className="mr-2 h-4 w-4" />
                登出其他设备
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={sessionColumns}
              data={sessions}
              pagination={false}
              emptyText="暂无活动会话"
            />
          </CardContent>
        </Card>

        {/* 登录历史 */}
        <Card>
          <CardHeader>
            <CardTitle>登录历史</CardTitle>
            <CardDescription>
              查看最近的登录记录
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={historyColumns}
              data={loginHistory}
              pagination={{
                page: 1,
                pageSize: 10,
                total: 0,
                onPageChange: () => {},
                onPageSizeChange: () => {},
              }}
              emptyText="暂无登录历史"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
