import { WelcomeHeader } from '@/components/organisms/WelcomeHeader';
import { AccountStats, UsageStats, ResourceStats, PerformanceStats } from '@/components/organisms/StatGroup';
import { ModelAnalysis } from '@/components/organisms/ModelAnalysis';
import { ApiInfo } from '@/components/organisms/ApiInfo';
import { SystemAnnouncements } from '@/components/organisms/SystemAnnouncements';

export default function Dashboard() {
  return (
    <div data-testid="dashboard-page" className="space-y-6">
      <WelcomeHeader username="Root User" />

      <div className="grid gap-6 md:grid-cols-4">
        <AccountStats />
        <UsageStats />
        <ResourceStats />
        <PerformanceStats />
      </div>

      <ModelAnalysis />

      <div className="grid gap-6 md:grid-cols-2">
        <ApiInfo />
        <SystemAnnouncements />
      </div>
    </div>
  );
}
