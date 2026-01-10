import { Navigate, useLocation } from 'react-router-dom';
import { useIsAuthenticated } from '@/hooks/useAuth';
import { LoadingPage } from '@/components/atoms/Loading';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useIsAuthenticated();
  const location = useLocation();

  // 这里可以添加加载状态检查
  // const { isLoading } = useCurrentUser();
  // if (isLoading) return <LoadingPage />;

  if (!isAuthenticated) {
    // 保存当前路径，登录后可以重定向回来
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
