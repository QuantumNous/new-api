import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Bot, User, Copy, Check, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { Message } from '@/types/chat';

interface MessageItemProps {
  message: Message;
  copiedMessageId: string | null;
  onCopy: (content: string, messageId: string) => void;
}

export function MessageItem({ message, copiedMessageId, onCopy }: MessageItemProps) {
  return (
    <div
      className={cn(
        "flex gap-3",
        message.role === 'user' ? "flex-row-reverse" : "flex-row"
      )}
    >
      <Avatar className="h-8 w-8 border">
        <AvatarFallback className={cn(message.role === 'assistant' ? "bg-primary text-primary-foreground" : "bg-muted")}>
          {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      
      <div className={cn(
        "flex flex-col max-w-[80%] min-w-0",
        message.role === 'user' ? "items-end" : "items-start"
      )}>
        <div className={cn(
          "px-4 py-2.5 rounded-2xl text-sm shadow-sm relative group",
          message.role === 'user' 
            ? "bg-primary text-primary-foreground rounded-br-none" 
            : "bg-card border rounded-bl-none text-card-foreground"
        )}>
           {message.role === 'assistant' ? (
             <ReactMarkdown 
               className="prose dark:prose-invert prose-sm max-w-none break-words"
               components={{
                pre: ({node, ...props}) => <pre className="overflow-auto w-full my-2 bg-muted/50 p-2 rounded-md">{props.children}</pre>,
                  code: ({node, ...props}) => <code className="bg-muted/50 px-1 py-0.5 rounded text-xs font-mono" {...props} />
               }}
             >
               {message.content}
             </ReactMarkdown>
           ) : (
             <div className="whitespace-pre-wrap break-words">{message.content}</div>
           )}
        </div>
        
        <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
           <span className="text-[10px] text-muted-foreground">
             {message.timestamp.toLocaleTimeString()}
           </span>
           <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onCopy(message.content, message.id)}>
             {copiedMessageId === message.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
           </Button>
           {message.role === 'assistant' && (
             <Button variant="ghost" size="icon" className="h-5 w-5">
               <RefreshCw className="h-3 w-3" />
             </Button>
           )}
        </div>
      </div>
    </div>
  );
}
