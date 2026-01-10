import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Conversation } from '@/types/chat';

interface ConversationSidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string, e?: React.MouseEvent) => void;
}

export function ConversationSidebar({
  conversations,
  currentConversationId,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
}: ConversationSidebarProps) {
  return (
    <div className="w-72 border-r bg-muted/30 hidden md:flex flex-col">
      <div className="p-3 border-b">
        <Button onClick={onNewConversation} className="w-full justify-start gap-2" variant="default">
          <Plus className="h-4 w-4" />
          新建对话
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => onSelectConversation(conversation.id)}
              className={cn(
                "group flex items-center gap-3 p-3 text-sm rounded-lg cursor-pointer transition-all hover:bg-muted relative",
                currentConversationId === conversation.id ? "bg-muted font-medium" : "text-muted-foreground"
              )}
            >
              <div className="flex-1 overflow-hidden">
                <div className="truncate text-foreground">{conversation.title}</div>
                <div className="text-xs truncate opacity-70 mt-0.5">
                  {conversation.messages[conversation.messages.length - 1]?.content || "新对话"}
                </div>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-1/2 -translate-y-1/2 bg-muted/80 backdrop-blur-sm p-1 rounded-md">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => onDeleteConversation(conversation.id, e)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
          {conversations.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-8">
              暂无历史对话
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="p-3 border-t bg-muted/20">
         <div className="flex items-center gap-2 text-xs text-muted-foreground">
           <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">Free</Badge>
           <span>剩余额度: 1000 次</span>
         </div>
      </div>
    </div>
  );
}
