import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CodeExample } from '@/components/molecules/CodeExample';
import { CURL_EXAMPLE, PYTHON_EXAMPLE, NODEJS_EXAMPLE } from '@/constants/api-docs';

interface CodeExamplesProps {
  onCopy: (code: string) => void;
}

export function CodeExamples({ onCopy }: CodeExamplesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>代码示例</CardTitle>
        <CardDescription>
          以下是不同编程语言的调用示例
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="curl">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="curl">cURL</TabsTrigger>
            <TabsTrigger value="python">Python</TabsTrigger>
            <TabsTrigger value="nodejs">Node.js</TabsTrigger>
          </TabsList>
          
          <TabsContent value="curl" className="space-y-2">
            <CodeExample code={CURL_EXAMPLE} onCopy={onCopy} />
          </TabsContent>
          
          <TabsContent value="python" className="space-y-2">
            <CodeExample code={PYTHON_EXAMPLE} onCopy={onCopy} />
          </TabsContent>
          
          <TabsContent value="nodejs" className="space-y-2">
            <CodeExample code={NODEJS_EXAMPLE} onCopy={onCopy} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
