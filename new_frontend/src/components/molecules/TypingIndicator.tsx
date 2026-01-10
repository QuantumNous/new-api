import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot } from 'lucide-react';
import { motion } from 'framer-motion';

export function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8 border">
         <AvatarFallback className="bg-primary text-primary-foreground">
            <Bot className="h-4 w-4" />
         </AvatarFallback>
      </Avatar>
      <div className="bg-card border px-4 py-3 rounded-2xl rounded-bl-none flex items-center gap-1 h-10">
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 0.6, repeat: Infinity }}
          className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
          className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
          className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full"
        />
      </div>
    </div>
  );
}
