import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Send, Image as ImageIcon, Paperclip, Eraser } from 'lucide-react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
}

export function ChatInput({ value, onChange, onSend, disabled }: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="p-4 bg-background/95 backdrop-blur z-10 sticky bottom-0">
      <div className="max-w-3xl mx-auto relative">
        <div className="relative rounded-xl border bg-card shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
          <Textarea
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Shift + Enter 换行)"
            className="min-h-[60px] max-h-[200px] w-full resize-none border-0 bg-transparent p-3 focus-visible:ring-0 text-sm"
            rows={1}
          />
          <div className="flex items-center justify-between p-2 border-t bg-muted/20 rounded-b-xl">
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>上传图片</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>上传附件</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                    <Eraser className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>清除上下文</TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-2">
               <span className="text-[10px] text-muted-foreground hidden sm:inline-block">
                 Enter 发送
               </span>
               <Button 
                 onClick={onSend} 
                 disabled={!value.trim() || disabled}
                 size="icon"
                 className="h-8 w-8 rounded-lg"
               >
                 <Send className="h-4 w-4" />
               </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
