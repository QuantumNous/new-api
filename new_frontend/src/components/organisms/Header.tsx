import { Menu, Moon, Sun, User, LogOut, Settings, Globe, Wallet, Key, Activity, Building2, ChevronDown, Rocket } from 'lucide-react';
import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useCurrentUser, useLogout } from '@/hooks/useAuth';
import { APP_NAME } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onMenuClick?: () => void;
  className?: string;
  showMenuTrigger?: boolean;
}

const navLinks = [
  { label: '模型', href: '/models' },
  { label: '对话', href: '/chat' },
  { label: '定价', href: '/pricing' },
  { label: '文档', href: '/api-docs' },
  { label: '控制台', href: '/console' },
];

export function Header({ onMenuClick, className, showMenuTrigger = true }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const user = useCurrentUser();
  const logout = useLogout();
  
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleUserMenuMouseEnter = () => {
    if (userMenuTimeoutRef.current) {
      clearTimeout(userMenuTimeoutRef.current);
      userMenuTimeoutRef.current = null;
    }
    setIsUserMenuOpen(true);
  };

  const handleUserMenuMouseLeave = () => {
    userMenuTimeoutRef.current = setTimeout(() => {
      setIsUserMenuOpen(false);
    }, 300);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleLogout = () => {
    logout.mutate();
  };

  const getUserInitials = () => {
    if (!user) return 'U';
    const name = user.displayName || user.username;
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        className
      )}
      data-testid="app-header"
    >
      <div className="flex h-16 w-full max-w-full items-center justify-between px-4 md:px-6">
        {/* 移动端菜单按钮 */}
        {showMenuTrigger && (
          <Button
            variant="ghost"
            size="icon"
            className="mr-2 md:hidden"
            onClick={onMenuClick}
            data-testid="mobile-menu-button"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}

        {/* Logo 和标题 */}
        <Link to="/" className="flex items-center gap-2 group ml-8 md:ml-12">
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400 }}
            className="flex items-center gap-2"
          >
            <Rocket className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold" data-testid="app-title">
              {APP_NAME}
            </h1>
          </motion.div>
        </Link>

        {/* 桌面端导航链接 */}
        <nav className="hidden md:flex items-center gap-1 ml-auto">
          {navLinks.map((link) => (
            <Link key={link.href} to={link.href}>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="ghost"
                  className="h-9 px-4 text-sm font-medium transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:shadow-sm"
                >
                  {link.label}
                </Button>
              </motion.div>
            </Link>
          ))}
        </nav>

        {/* 右侧操作区 */}
        <div className="flex items-center gap-1">
          {/* 主题切换 */}
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 transition-all duration-200 hover:bg-primary/10 hover:text-primary"
              onClick={toggleTheme}
              data-testid="theme-toggle"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          </motion.div>

          {/* 语言选择 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 transition-all duration-200 hover:bg-primary/10 hover:text-primary"
                  data-testid="language-menu-trigger"
                >
                  <Globe className="h-4 w-4" />
                </Button>
              </motion.div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>简体中文</DropdownMenuItem>
              <DropdownMenuItem>English</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 用户菜单 */}
          {user ? (
            <DropdownMenu open={isUserMenuOpen} onOpenChange={setIsUserMenuOpen} modal={false}>
              <DropdownMenuTrigger asChild>
                <motion.div 
                  whileHover={{ scale: 1.02 }} 
                  whileTap={{ scale: 0.98 }}
                  className="cursor-pointer"
                  onMouseEnter={handleUserMenuMouseEnter}
                  onMouseLeave={handleUserMenuMouseLeave}
                >
                  <div 
                    className="flex items-center gap-3 rounded-full border border-border/40 bg-background/50 backdrop-blur pl-4 pr-1.5 py-1.5 hover:bg-accent/50 transition-colors group"
                    data-testid="user-menu-trigger"
                  >
                    <div className="flex flex-col items-end text-right">
                      <span className="text-xs font-medium text-foreground/80 group-hover:text-foreground transition-colors">
                         ¥ {((user.quota - user.usedQuota) / 500000).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-muted-foreground/80 group-hover:text-muted-foreground transition-colors max-w-[80px] truncate">
                        {user.displayName || user.username}
                      </span>
                    </div>
                    <Avatar className="h-8 w-8 border-2 border-background shadow-sm transition-transform group-hover:scale-105">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </motion.div>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="w-56" 
                onMouseEnter={handleUserMenuMouseEnter}
                onMouseLeave={handleUserMenuMouseLeave}
              >
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user.displayName || user.username}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => window.location.href = '/console/tokens'}
                  data-testid="credits-menu-item"
                  className="cursor-pointer"
                >
                  <Wallet className="mr-2 h-4 w-4" />
                  额度
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => window.location.href = '/console/tokens'}
                  data-testid="keys-menu-item"
                  className="cursor-pointer"
                >
                  <Key className="mr-2 h-4 w-4" />
                  API 密钥
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => window.location.href = '/console/logs/self'}
                  data-testid="activity-menu-item"
                  className="cursor-pointer"
                >
                  <Activity className="mr-2 h-4 w-4" />
                  活动
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => window.location.href = '/console/settings/general'}
                  data-testid="settings-menu-item"
                  className="cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  设置
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => window.location.href = '/enterprise'}
                  data-testid="enterprise-menu-item"
                  className="cursor-pointer"
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  企业版
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  data-testid="logout-menu-item"
                  className="cursor-pointer text-destructive hover:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden md:flex items-center gap-1">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link to="/auth/login">
                  <Button variant="ghost" className="h-9 transition-all duration-200 hover:bg-primary/10 hover:text-primary">
                    登录
                  </Button>
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link to="/auth/register">
                  <Button className="h-9 transition-all duration-200 hover:shadow-md">
                    注册
                  </Button>
                </Link>
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
