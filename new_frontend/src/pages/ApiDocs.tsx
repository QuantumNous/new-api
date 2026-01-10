import { PageHeader } from '@/components/organisms/PageHeader';
import { QuickStart } from '@/components/organisms/QuickStart';
import { CodeExamples } from '@/components/organisms/CodeExamples';
import { ApiEndpoints } from '@/components/organisms/ApiEndpoints';
import { useToast } from '@/hooks/use-toast';
import { copyToClipboard } from '@/lib/utils';

export default function ApiDocs() {
  const { toast } = useToast();

  const handleCopy = async (text: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      toast({
        title: '复制成功',
        description: '代码已复制到剪贴板',
      });
    }
  };

  return (
    <div className="container max-w-5xl py-8" data-testid="api-docs-page">
      <PageHeader
        title="API 文档"
        description="完整的 API 接口文档和使用示例"
      />

      <div className="space-y-6">
        <QuickStart />
        <CodeExamples onCopy={handleCopy} />
        <ApiEndpoints />
      </div>
    </div>
  );
}
