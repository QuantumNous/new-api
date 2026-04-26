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

import React from 'react';
import { Avatar, Button, Card, Input } from '@heroui/react';
import { Copy, Users, BarChart2, TrendingUp, Gift, Zap } from 'lucide-react';

const InvitationCard = ({
  t,
  userState,
  renderQuota,
  setOpenTransfer,
  affLink,
  handleAffLinkClick,
}) => {
  return (
    <Card className='rounded-2xl border-0 shadow-sm' shadow='none'>
      <Card.Content>
      {/* 卡片头部 */}
      <div className='flex items-center mb-4'>
        <Avatar size='sm' color='success' className='mr-3 shadow-md'>
          <Avatar.Fallback>
            <Gift size={16} />
          </Avatar.Fallback>
        </Avatar>
        <div>
          <div className='text-lg font-medium text-foreground'>
            {t('邀请奖励')}
          </div>
          <div className='text-xs'>{t('邀请好友获得额外奖励')}</div>
        </div>
      </div>

      {/* 收益展示区域 */}
      <div className='flex w-full flex-col gap-4'>
        {/* 统计数据统一卡片 */}
        <Card className='w-full overflow-hidden rounded-xl' shadow='none'>
            <div
              className='relative h-30'
              style={{
                '--palette-primary-darkerChannel': '0 75 80',
                backgroundImage: `linear-gradient(0deg, rgba(var(--palette-primary-darkerChannel) / 80%), rgba(var(--palette-primary-darkerChannel) / 80%)), url('/cover-4.webp')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            >
              {/* 标题和按钮 */}
              <div className='relative z-10 h-full flex flex-col justify-between p-4'>
                <div className='flex justify-between items-center'>
                  <span className='text-base font-semibold text-white'>
                    {t('收益统计')}
                  </span>
                  <Button
                    size='sm'
                    variant='primary'
                    isDisabled={
                      !userState?.user?.aff_quota ||
                      userState?.user?.aff_quota <= 0
                    }
                    onPress={() => setOpenTransfer(true)}
                    className='rounded-lg'
                  >
                    <Zap size={12} className='mr-1' />
                    {t('划转到余额')}
                  </Button>
                </div>

                {/* 统计数据 */}
                <div className='grid grid-cols-3 gap-6 mt-4'>
                  {/* 待使用收益 */}
                  <div className='text-center'>
                    <div
                      className='text-base sm:text-2xl font-bold mb-2'
                      style={{ color: 'white' }}
                    >
                      {renderQuota(userState?.user?.aff_quota || 0)}
                    </div>
                    <div className='flex items-center justify-center text-sm'>
                      <TrendingUp
                        size={14}
                        className='mr-1'
                        style={{ color: 'rgba(255,255,255,0.8)' }}
                      />
                      <span className='text-xs text-white/80'>
                        {t('待使用收益')}
                      </span>
                    </div>
                  </div>

                  {/* 总收益 */}
                  <div className='text-center'>
                    <div
                      className='text-base sm:text-2xl font-bold mb-2'
                      style={{ color: 'white' }}
                    >
                      {renderQuota(userState?.user?.aff_history_quota || 0)}
                    </div>
                    <div className='flex items-center justify-center text-sm'>
                      <BarChart2
                        size={14}
                        className='mr-1'
                        style={{ color: 'rgba(255,255,255,0.8)' }}
                      />
                      <span className='text-xs text-white/80'>
                        {t('总收益')}
                      </span>
                    </div>
                  </div>

                  {/* 邀请人数 */}
                  <div className='text-center'>
                    <div
                      className='text-base sm:text-2xl font-bold mb-2'
                      style={{ color: 'white' }}
                    >
                      {userState?.user?.aff_count || 0}
                    </div>
                    <div className='flex items-center justify-center text-sm'>
                      <Users
                        size={14}
                        className='mr-1'
                        style={{ color: 'rgba(255,255,255,0.8)' }}
                      />
                      <span className='text-xs text-white/80'>
                        {t('邀请人数')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          <Card.Content className='p-4'>
          {/* 邀请链接部分 */}
          <div className='flex flex-col gap-2 sm:flex-row'>
            <Input
              value={affLink}
              readOnly
              aria-label={t('邀请链接')}
              className='flex-1 rounded-lg'
              fullWidth
            />
              <Button
                variant='primary'
                onPress={handleAffLinkClick}
                className='rounded-lg'
              >
                <Copy size={14} />
                {t('复制')}
              </Button>
          </div>
          </Card.Content>
        </Card>

        {/* 奖励说明 */}
        <Card className='w-full rounded-xl' shadow='none'>
          <Card.Header>
            <Card.Title className='text-sm text-muted'>
              {t('奖励说明')}
            </Card.Title>
          </Card.Header>
          <Card.Content>
          <div className='space-y-3'>
            <div className='flex items-start gap-2'>
              <span className='mt-2 size-2 rounded-full bg-emerald-500' />
              <span className='text-sm text-muted'>
                {t('邀请好友注册，好友充值后您可获得相应奖励')}
              </span>
            </div>

            <div className='flex items-start gap-2'>
              <span className='mt-2 size-2 rounded-full bg-emerald-500' />
              <span className='text-sm text-muted'>
                {t('通过划转功能将奖励额度转入到您的账户余额中')}
              </span>
            </div>

            <div className='flex items-start gap-2'>
              <span className='mt-2 size-2 rounded-full bg-emerald-500' />
              <span className='text-sm text-muted'>
                {t('邀请的好友越多，获得的奖励越多')}
              </span>
            </div>
          </div>
          </Card.Content>
        </Card>
      </div>
      </Card.Content>
    </Card>
  );
};

export default InvitationCard;
