import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  content: string;
  status: 'default' | 'in-progress' | 'success' | 'warning' | 'error';
  date: string;
}

interface SystemAnnouncementsProps {
  announcements?: Announcement[];
}

export function SystemAnnouncements({ announcements = defaultAnnouncements }: SystemAnnouncementsProps) {
  const getStatusColor = (status: Announcement['status']) => {
    switch (status) {
      case 'default': return 'bg-muted';
      case 'in-progress': return 'bg-blue-500';
      case 'success': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
    }
  };

  const getStatusText = (status: Announcement['status']) => {
    switch (status) {
      case 'default': return '默认';
      case 'in-progress': return '进行中';
      case 'success': return '成功';
      case 'warning': return '警告';
      case 'error': return '异常';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            系统公告
          </div>
          <span className="text-xs text-muted-foreground">显示最新20条</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 mb-4">
          {['default', 'in-progress', 'success', 'warning', 'error'].map((status) => (
            <div key={status} className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${getStatusColor(status as Announcement['status'])}`} />
              <span className="text-xs text-muted-foreground">{getStatusText(status as Announcement['status'])}</span>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {announcements.map((announcement) => (
            <div key={announcement.id} className="border-b pb-4 last:border-0">
              <div className="flex items-start gap-2 mb-2">
                <div className={`h-2 w-2 rounded-full mt-2 ${getStatusColor(announcement.status)}`} />
                <div className="flex-1">
                  <p className="text-sm">{announcement.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">{announcement.date}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const defaultAnnouncements: Announcement[] = [
  {
    id: '1',
    title: '新增模型',
    content: '新增Qwen千问、Deepseek系列低价模型，官方渠道满血稳定，低至5折起～',
    status: 'default',
    date: '1 个月前 2025-11-08 21:47',
  },
  {
    id: '2',
    title: '新增绘图模型',
    content: '已上架 flux-kontext-max flux-kontext-pro，支持接口 /v1/images/edits /v1/images/generations',
    status: 'success',
    date: '6 个月前 2025-07-01 10:20',
  },
  {
    id: '3',
    title: '价格调整',
    content: 'gemini-2.5-flash-preview-05-20的价格将同步为gemini-2.5-flash的价格',
    status: 'warning',
    date: '6 个月前 2025-06-24 17:55',
  },
];
