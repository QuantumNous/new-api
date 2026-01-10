import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from "@/components/ui/textarea";
import { X } from 'lucide-react';

interface ChatSettingsProps {
  open: boolean;
  onClose: () => void;
  temperature: number;
  onTemperatureChange: (value: number) => void;
  maxTokens: number;
  onMaxTokensChange: (value: number) => void;
}

export function ChatSettings({
  open,
  onClose,
  temperature,
  onTemperatureChange,
  maxTokens,
  onMaxTokensChange,
}: ChatSettingsProps) {
  if (!open) return null;

  return (
    <div className="w-72 border-l bg-card flex flex-col">
       <div className="flex flex-col h-full">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm">参数设置</h3>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Temperature</label>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>精确</span>
                  <span>{temperature}</span>
                  <span>随机</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                  aria-label="Temperature"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Max Tokens</label>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>短</span>
                  <span>{maxTokens}</span>
                  <span>长</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="4096"
                  step="100"
                  value={maxTokens}
                  onChange={(e) => onMaxTokensChange(parseInt(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                  aria-label="Max Tokens"
                />
              </div>

              <div className="pt-4 border-t">
                 <h4 className="text-sm font-medium mb-2">系统提示词</h4>
                 <Textarea 
                   placeholder="输入系统提示词..."
                   className="min-h-[100px] text-xs"
                 />
              </div>
            </div>
          </ScrollArea>
       </div>
    </div>
  );
}
