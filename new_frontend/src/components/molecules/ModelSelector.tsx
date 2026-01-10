import { Button } from '@/components/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Sparkles, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Model } from '@/types/chat';

interface ModelSelectorProps {
  selectedModel: Model;
  onModelChange: (model: Model) => void;
  models: Model[];
}

export function ModelSelector({ selectedModel, onModelChange, models }: ModelSelectorProps) {
  return (
    <HoverCard openDelay={200} closeDelay={200}>
      <HoverCardTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="hidden sm:inline-block">{selectedModel.name}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </HoverCardTrigger>
      <HoverCardContent align="end" className="w-64 p-0">
        <div className="p-2">
          <div className="px-2 py-1.5 text-sm font-medium">选择模型</div>
          <div className="h-px bg-border my-1" />
          <div className="space-y-0.5">
            {models.map((model) => (
              <div
                key={model.id}
                onClick={() => onModelChange(model)}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors hover:bg-muted",
                  selectedModel.id === model.id && "bg-muted"
                )}
              >
                <div className="w-6 h-6 flex items-center justify-center rounded-sm bg-muted text-xs flex-shrink-0">
                  {model.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{model.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{model.provider}</div>
                </div>
                {selectedModel.id === model.id && <Check className="h-3 w-3 text-primary flex-shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
