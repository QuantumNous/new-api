import { Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Model } from '@/types/chat';
import { SUGGESTIONS } from '@/constants/chat';

interface WelcomeScreenProps {
  model: Model;
  onSuggestionClick: (suggestion: string) => void;
}

export function WelcomeScreen({ model, onSuggestionClick }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
      <div className="bg-primary/10 p-4 rounded-full">
        <Bot className="h-12 w-12 text-primary" />
      </div>
      <div>
        <h3 className="text-lg font-semibold">你好，我是 {model.name}</h3>
        <p className="text-sm text-muted-foreground mt-1">有什么我可以帮你的吗？</p>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full max-w-md mt-4">
        {SUGGESTIONS.map((suggestion) => (
          <Button 
            key={suggestion} 
            variant="outline" 
            className="h-auto py-2 px-3 text-xs justify-start font-normal"
            onClick={() => onSuggestionClick(suggestion)}
          >
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  );
}
