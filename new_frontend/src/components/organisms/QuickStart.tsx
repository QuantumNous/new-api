import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Code } from '@/components/atoms/Typography';

export function QuickStart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>快速开始</CardTitle>
        <CardDescription>
          我们的 API 完全兼容 OpenAI API，您可以使用任何 OpenAI SDK 进行调用
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="mb-2 font-semibold">1. 获取 API 密钥</h4>
          <p className="text-sm text-muted-foreground">
            在控制台的令牌管理页面创建一个新的 API 密钥
          </p>
        </div>
        <div>
          <h4 className="mb-2 font-semibold">2. 设置 Base URL</h4>
          <Code>https://api.example.com/v1</Code>
        </div>
        <div>
          <h4 className="mb-2 font-semibold">3. 开始调用</h4>
          <p className="text-sm text-muted-foreground">
            使用您喜欢的编程语言和 SDK 开始调用 API
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
