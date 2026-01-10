import { Button } from '@/components/ui/button';
import { Bell, HelpCircle } from 'lucide-react';

interface WelcomeHeaderProps {
  username?: string;
}

export function WelcomeHeader({ username = '用户' }: WelcomeHeaderProps) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return '凌晨好';
    if (hour < 12) return '早上好';
    if (hour < 14) return '中午好';
    if (hour < 18) return '下午好';
    return '晚上好';
  };

  return (
    <div className="mb-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-semibold">
          👋{getGreeting()}，{username}
        </h2>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon">
          <Bell className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon">
          <HelpCircle className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
