import { Outlet } from 'react-router-dom';
import { APP_NAME } from '@/lib/constants';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen" data-testid="auth-layout">
      {/* 左侧装饰区 */}
      <div className="hidden w-1/2 bg-gradient-to-br from-primary to-primary/80 lg:block">
        <div className="flex h-full flex-col items-center justify-center p-12 text-white">
          <h1 className="mb-4 text-5xl font-bold">{APP_NAME}</h1>
          <p className="text-center text-xl opacity-90">
            现代化的 API 管理平台
          </p>
          <div className="mt-12 space-y-4 text-center">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                ✓
              </div>
              <span className="text-lg">多渠道统一管理</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                ✓
              </div>
              <span className="text-lg">智能负载均衡</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                ✓
              </div>
              <span className="text-lg">实时监控统计</span>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧表单区 */}
      <div className="flex w-full items-center justify-center bg-background p-8 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:hidden">
            <h1 className="text-3xl font-bold">{APP_NAME}</h1>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
