import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Globe, Zap, Shield } from 'lucide-react';

interface ApiRoute {
  name: string;
  url: string;
  description: string;
  icon: string;
}

interface ApiInfoProps {
  routes?: ApiRoute[];
}

export function ApiInfo({ routes = defaultRoutes }: ApiInfoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          API信息
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {routes.map((route, index) => (
          <div
            key={index}
            className="rounded-lg border p-4 hover:bg-accent/50 transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10 text-primary font-semibold text-sm">
                  {route.icon}
                </div>
                <h4 className="font-semibold">{route.name}</h4>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  测速
                </Button>
                <Button variant="outline" size="sm">
                  跳转
                </Button>
              </div>
            </div>
            <p className="text-sm font-mono text-muted-foreground mb-2">{route.url}</p>
            <p className="text-xs text-muted-foreground">{route.description}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const defaultRoutes: ApiRoute[] = [
  {
    name: '默认线路',
    url: 'https://api.example.com',
    description: '无CF，无超时限制，如果没有特殊需求，建议使用该线路',
    icon: '默认',
  },
  {
    name: 'Cloudflare线路',
    url: 'https://api.cloudflare.example.com',
    description: '非流下最大100秒超时，只推荐流模式请求的用户使用',
    icon: 'CF',
  },
  {
    name: '备用线路',
    url: 'https://api.backup.example.com',
    description: '备用线路，在主线路不可用时自动切换',
    icon: '备用',
  },
];
