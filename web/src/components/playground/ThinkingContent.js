/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useRef } from 'react';
import { Typography } from '@douyinfe/semi-ui';
import MarkdownRenderer from '../common/markdown/MarkdownRenderer';
import { ChevronRight, ChevronUp, Brain, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ThinkingContent = ({
  message,
  finalExtractedThinkingContent,
  thinkingSource,
  styleState,
  onToggleReasoningExpansion
}) => {
  const { t } = useTranslation();
  const scrollRef = useRef(null);
  const lastContentRef = useRef('');

  const isThinkingStatus = message.status === 'loading' || message.status === 'incomplete';
  const headerText = (isThinkingStatus && !message.isThinkingComplete) ? t('思考中...') : t('思考过程');

  useEffect(() => {
    if (scrollRef.current && finalExtractedThinkingContent && message.isReasoningExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [finalExtractedThinkingContent, message.isReasoningExpanded]);

  useEffect(() => {
    if (!isThinkingStatus) {
      lastContentRef.current = '';
    }
  }, [isThinkingStatus]);

  if (!finalExtractedThinkingContent) return null;

  let prevLength = 0;
  if (isThinkingStatus && lastContentRef.current) {
    if (finalExtractedThinkingContent.startsWith(lastContentRef.current)) {
      prevLength = lastContentRef.current.length;
    }
  }

  if (isThinkingStatus) {
    lastContentRef.current = finalExtractedThinkingContent;
  }

  return (
    <div className="rounded-xl sm:rounded-2xl mb-2 sm:mb-4 overflow-hidden shadow-sm backdrop-blur-sm">
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gradient-to-r hover:from-white/20 hover:to-purple-50/30 transition-all"
        style={{
          background: 'linear-gradient(135deg, #4c1d95 0%, #6d28d9 50%, #7c3aed 100%)',
          position: 'relative'
        }}
        onClick={() => onToggleReasoningExpansion(message.id)}
      >
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-5 rounded-full"></div>
          <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white opacity-10 rounded-full"></div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 relative">
          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white/20 flex items-center justify-center shadow-lg">
            <Brain style={{ color: 'white' }} size={styleState.isMobile ? 12 : 16} />
          </div>
          <div className="flex flex-col">
            <Typography.Text strong style={{ color: 'white' }} className="text-sm sm:text-base">
              {headerText}
            </Typography.Text>
            {thinkingSource && (
              <Typography.Text style={{ color: 'white' }} className="text-xs mt-0.5 opacity-80 hidden sm:block">
                来源: {thinkingSource}
              </Typography.Text>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 relative">
          {isThinkingStatus && !message.isThinkingComplete && (
            <div className="flex items-center gap-1 sm:gap-2">
              <Loader2 style={{ color: 'white' }} className="animate-spin" size={styleState.isMobile ? 14 : 18} />
              <Typography.Text style={{ color: 'white' }} className="text-xs sm:text-sm font-medium opacity-90">
                思考中
              </Typography.Text>
            </div>
          )}
          {(!isThinkingStatus || message.isThinkingComplete) && (
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/20 flex items-center justify-center">
              {message.isReasoningExpanded ?
                <ChevronUp size={styleState.isMobile ? 12 : 16} style={{ color: 'white' }} /> :
                <ChevronRight size={styleState.isMobile ? 12 : 16} style={{ color: 'white' }} />
              }
            </div>
          )}
        </div>
      </div>
      <div
        className={`transition-all duration-500 ease-out ${message.isReasoningExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          } overflow-hidden bg-gradient-to-br from-purple-50 via-indigo-50 to-violet-50`}
      >
        {message.isReasoningExpanded && (
          <div className="p-3 sm:p-5 pt-2 sm:pt-4">
            <div
              ref={scrollRef}
              className="bg-white/70 backdrop-blur-sm rounded-lg sm:rounded-xl p-2 shadow-inner overflow-x-auto overflow-y-auto thinking-content-scroll"
              style={{
                maxHeight: '200px',
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(0, 0, 0, 0.3) transparent'
              }}
            >
              <div className="prose prose-xs sm:prose-sm prose-purple max-w-none text-xs sm:text-sm">
                <MarkdownRenderer
                  content={finalExtractedThinkingContent}
                  className=""
                  animated={isThinkingStatus}
                  previousContentLength={prevLength}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ThinkingContent; 