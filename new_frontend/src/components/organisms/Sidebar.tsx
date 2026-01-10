import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Key,
  FileText,
  Image,
  ListChecks,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  {
    title: '数据看板',
    href: '/console/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: '令牌管理',
    href: '/console/tokens',
    icon: Key,
  },
  {
    title: '使用日志',
    href: '/console/logs/usage',
    icon: FileText,
  },
  {
    title: '绘图日志',
    href: '/console/logs/image',
    icon: Image,
  },
  {
    title: '任务日志',
    href: '/console/logs/task',
    icon: ListChecks,
  },
];

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        initial={false}
        animate={{
          width: isCollapsed ? '72px' : '260px',
        }}
        transition={{
          duration: 0.35,
          ease: [0.25, 0.1, 0.25, 1],
        }}
        className={cn(
          'flex h-full flex-col border-r border-border/40 bg-gradient-to-b from-background via-background/95 to-background/90 backdrop-blur-sm',
          className
        )}
        data-testid="sidebar"
      >
        {/* 标题区域 */}
        <div className="flex h-14 items-center justify-between border-b border-border/40 bg-background/30 px-4">
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.h2
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="text-base font-semibold tracking-tight text-foreground/90"
              >
                控制台
              </motion.h2>
            )}
          </AnimatePresence>
          <div className="flex-1 flex justify-end">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleCollapse}
              className="h-7 w-7 rounded-lg text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-all duration-200"
            >
              <motion.div
                animate={{ rotate: isCollapsed ? 180 : 0 }}
                transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <ChevronLeft className="h-4 w-4" />
              </motion.div>
            </Button>
          </div>
        </div>

        {/* 导航区域 */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-0.5" data-testid="sidebar-nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-gradient-to-r from-primary/10 to-primary/5 text-primary shadow-sm'
                        : 'text-muted-foreground/70 hover:bg-accent/50 hover:text-foreground',
                      isCollapsed && 'justify-center'
                    )
                  }
                  data-testid={`nav-item-${item.href}`}
                >
                  {({ isActive }) => (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <motion.div
                          className={cn(
                            'flex w-full items-center gap-3',
                            isCollapsed && 'justify-center gap-0'
                          )}
                          initial={false}
                          whileHover={{ x: isCollapsed ? 0 : 2 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                        >
                          <motion.div
                            initial={false}
                            animate={{
                              scale: isActive ? 1 : 1,
                            }}
                            transition={{
                              duration: 0.2,
                              ease: "easeOut",
                            }}
                            className={cn(
                              'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                              isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground/70 group-hover:text-foreground'
                            )}
                          >
                            <Icon className="h-4.5 w-4.5" />
                          </motion.div>
                          <AnimatePresence mode="wait">
                            {!isCollapsed && (
                              <motion.span
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -8 }}
                                transition={{ duration: 0.15, ease: "easeOut" }}
                                className="flex-1 truncate"
                              >
                                {item.title}
                              </motion.span>
                            )}
                          </AnimatePresence>
                          {!isCollapsed && isActive && (
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ duration: 0.2, delay: 0.05 }}
                            >
                              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary" />
                            </motion.div>
                          )}
                          {isActive && (
                            <motion.div
                              layoutId="activeIndicator"
                              className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-0.5 rounded-r-full bg-primary"
                              transition={{
                                type: "spring",
                                stiffness: 400,
                                damping: 30,
                              }}
                            />
                          )}
                        </motion.div>
                      </TooltipTrigger>
                      {isCollapsed && (
                        <TooltipContent side="right" className="font-medium text-xs">
                          {item.title}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </ScrollArea>
      </motion.aside>
    </TooltipProvider>
  );
}
