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
  onToggleReasoningExpansion,
}) => {
  const { t } = useTranslation();
  const scrollRef = useRef(null);
  const lastContentRef = useRef('');

  const isThinkingStatus =
    message.status === 'loading' || message.status === 'incomplete';
  const headerText =
    isThinkingStatus && !message.isThinkingComplete
      ? t('思考中...')
      : t('思考过程');

  useEffect(() => {
    if (
      scrollRef.current &&
      finalExtractedThinkingContent &&
      message.isReasoningExpanded
    ) {
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
    <div className='na-thinking-card'>
      <div
        className='na-thinking-header'
        onClick={() => onToggleReasoningExpansion(message.id)}
      >
        <div className='flex items-center gap-2 sm:gap-4 relative'>
          <div className='na-thinking-icon'>
            <Brain
              style={{ color: 'var(--na-text-inverse)' }}
              size={styleState.isMobile ? 12 : 16}
            />
          </div>
          <div className='flex flex-col'>
            <Typography.Text
              strong
              style={{ color: 'var(--na-text-inverse)' }}
              className='text-sm sm:text-base'
            >
              {headerText}
            </Typography.Text>
            {thinkingSource && (
              <Typography.Text
                style={{ color: 'var(--na-text-inverse)' }}
                className='text-xs mt-0.5 opacity-80 hidden sm:block'
              >
                来源: {thinkingSource}
              </Typography.Text>
            )}
          </div>
        </div>
        <div className='flex items-center gap-2 sm:gap-3 relative'>
          {isThinkingStatus && !message.isThinkingComplete && (
            <div className='flex items-center gap-1 sm:gap-2'>
              <Loader2
                style={{ color: 'var(--na-text-inverse)' }}
                className='animate-spin'
                size={styleState.isMobile ? 14 : 18}
              />
              <Typography.Text
                style={{ color: 'var(--na-text-inverse)' }}
                className='text-xs sm:text-sm font-medium opacity-90'
              >
                思考中
              </Typography.Text>
            </div>
          )}
          {(!isThinkingStatus || message.isThinkingComplete) && (
            <div className='na-thinking-toggle'>
              {message.isReasoningExpanded ? (
                <ChevronUp
                  size={styleState.isMobile ? 12 : 16}
                  style={{ color: 'var(--na-text-inverse)' }}
                />
              ) : (
                <ChevronRight
                  size={styleState.isMobile ? 12 : 16}
                  style={{ color: 'var(--na-text-inverse)' }}
                />
              )}
            </div>
          )}
        </div>
      </div>
      <div
        className={`transition-all duration-500 ease-out na-thinking-content-shell ${
          message.isReasoningExpanded
            ? 'na-thinking-content-shell-expanded'
            : 'na-thinking-content-shell-collapsed'
        }`}
      >
        {message.isReasoningExpanded && (
          <div className='na-thinking-content'>
            <div
              ref={scrollRef}
              className='na-thinking-scroll thinking-content-scroll'
            >
              <div className='prose prose-xs sm:prose-sm prose-purple max-w-none text-xs sm:text-sm'>
                <MarkdownRenderer
                  content={finalExtractedThinkingContent}
                  className=''
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
