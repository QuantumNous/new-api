import React from 'react';
import { Button } from '@douyinfe/semi-ui';
import { RefreshCw, Search } from 'lucide-react';

const DashboardHeader = ({
  getGreeting,
  greetingVisible,
  showSearchModal,
  refresh,
  loading,
  t,
}) => {
  return (
    <div className='console-dashboard__header flex items-center justify-between mb-4'>
      <h2
        className='console-dashboard__title text-2xl font-semibold transition-opacity duration-1000 ease-in-out'
        style={{ opacity: greetingVisible ? 1 : 0 }}
      >
        {getGreeting}
      </h2>
      <div className='console-dashboard__actions flex gap-3'>
        <Button
          type='tertiary'
          icon={<Search size={16} />}
          onClick={showSearchModal}
          className='console-dashboard__action console-dashboard__action--ghost'
        />
        <Button
          type='tertiary'
          icon={<RefreshCw size={16} />}
          onClick={refresh}
          loading={loading}
          className='console-dashboard__action console-dashboard__action--primary'
        />
      </div>
    </div>
  );
};

export default DashboardHeader;
