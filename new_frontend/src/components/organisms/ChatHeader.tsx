import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings } from 'lucide-react';
import { ModelSelector } from '@/components/molecules/ModelSelector';
import { Model } from '@/types/chat';

interface ChatHeaderProps {
  currentTitle: string;
  selectedModel: Model;
  onModelChange: (model: Model) => void;
  models: Model[];
  onToggleSettings: () => void;
}

export function ChatHeader({
  currentTitle,
  selectedModel,
  onModelChange,
  models,
  onToggleSettings,
}: ChatHeaderProps) {
  return (
    <div className="h-14 border-b flex items-center justify-between px-4 bg-background/95 backdrop-blur z-10 sticky top-0">
      <div className="flex items-center gap-2 overflow-hidden">
        <h2 className="text-sm font-semibold truncate max-w-[200px]">
          {currentTitle || '新对话'}
        </h2>
        <Badge variant="secondary" className="text-xs font-normal">
          {selectedModel.name}
        </Badge>
      </div>
      <div className="flex items-center gap-1">
        <ModelSelector
          selectedModel={selectedModel}
          onModelChange={onModelChange}
          models={models}
        />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleSettings}>
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
