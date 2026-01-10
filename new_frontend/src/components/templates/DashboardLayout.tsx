import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from '@/components/organisms/Header';
import { Sidebar } from '@/components/organisms/Sidebar';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  showSidebar?: boolean;
}

export function DashboardLayout({ showSidebar = true }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden" data-testid="dashboard-layout">
      {/* 顶栏 */}
      <Header onMenuClick={toggleSidebar} showMenuTrigger={showSidebar} />
      
      {/* 移动端侧边栏遮罩 */}
      {showSidebar && sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeSidebar}
          data-testid="sidebar-overlay"
        />
      )}

      {/* 内容区域 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 侧边栏 */}
        {showSidebar && (
          <div
            className={cn(
              'fixed inset-y-0 left-0 top-16 z-50 transition-transform duration-300 md:relative md:top-0 md:translate-x-0',
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            )}
          >
            <Sidebar onNavigate={closeSidebar} />
          </div>
        )}

        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto bg-muted/40 p-6" data-testid="main-content">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
