import React from 'react';
import { Button, Typography } from '@douyinfe/semi-ui';
import { IconPlus, IconDelete } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';

const HistorySidebar = ({ 
  isMobile, 
  onClose, 
  history = [], 
  onSelect, 
  selectedId, 
  onDelete 
}) => {
  const { t } = useTranslation();

  return (
    <div className={`flex flex-col h-full bg-gray-50 dark:bg-black border-r border-gray-200 dark:border-gray-800 ${isMobile ? 'w-full' : 'w-full'}`}>
      <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
        <Button 
            theme='solid' 
            type='primary' 
            block 
            icon={<IconPlus />} 
            onClick={() => onSelect(null)}
            className="w-full justify-center font-medium"
        >
            {t('New Chat')}
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {history.length === 0 && (
            <div className="text-center text-gray-400 dark:text-gray-600 text-sm mt-4">
                {t('No history')}
            </div>
        )}
        {history.map(item => (
          <div 
            key={item.ID} 
            className={`
                group relative flex flex-col p-3 rounded-lg cursor-pointer transition-colors border border-transparent
                ${selectedId === item.ID 
                    ? 'bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-gray-800 shadow-sm' 
                    : 'hover:bg-gray-100 dark:hover:bg-[#1a1a1a] text-gray-700 dark:text-gray-400'
                }
            `}
            onClick={() => onSelect(item)}
          >
            <div className="flex items-center justify-between w-full">
                <span className={`text-sm font-medium truncate pr-6 ${selectedId === item.ID ? 'text-gray-900 dark:text-gray-100' : ''}`}>
                    {item.title || t('New Chat')}
                </span>
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                {new Date(item.UpdatedAt).toLocaleDateString()}
            </span>
            
            {onDelete && (
                <div 
                    className="absolute right-2 top-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item.ID);
                    }}
                >
                    <IconDelete className="text-red-500" size="small" />
                </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistorySidebar;