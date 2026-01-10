import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';

interface CodeExampleProps {
  code: string;
  onCopy: (code: string) => void;
}

export function CodeExample({ code, onCopy }: CodeExampleProps) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-muted p-4">
        <code className="text-sm">{code}</code>
      </pre>
      <Button
        size="sm"
        variant="ghost"
        className="absolute right-2 top-2"
        onClick={() => onCopy(code)}
      >
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}
