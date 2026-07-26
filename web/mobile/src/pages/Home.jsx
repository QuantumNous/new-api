import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid, NavBar, PullToRefresh } from 'antd-mobile';
import {
  AppstoreOutline,
  ClockCircleOutline,
  FileOutline,
  KeyOutline,
  MessageOutline,
  MovieOutline,
  PictureOutline,
  PlayOutline,
  SoundOutline,
} from 'antd-mobile-icons';

import { UserContext } from '@classic/context/User';
import { API } from '@classic/helpers/api';

import { showError, getSystemName } from '../shims/classic-utils';
import { pointsEnabled, renderPoints, renderQuota } from '../utils/quota';

const quickEntries = [
  { title: '对话', path: '/chat', icon: <MessageOutline />, bg: 'linear-gradient(135deg,#4f46e5,#7970ee)' },
  { title: '视频', path: '/video', icon: <MovieOutline />, bg: 'linear-gradient(135deg,#9d3b8f,#c05aa8)' },
  { title: '音乐', path: '/music', icon: <PlayOutline />, bg: 'linear-gradient(135deg,#b07a2f,#d2a253)' },
  { title: '语音', path: '/audio', icon: <SoundOutline />, bg: 'linear-gradient(135deg,#0f766e,#2ba79b)' },
  { title: '图像', path: '/image', icon: <PictureOutline />, bg: 'linear-gradient(135deg,#1d5f9e,#3f83c4)' },
  { title: '模型广场', path: '/models', icon: <AppstoreOutline />, bg: 'linear-gradient(135deg,#334155,#5b6b82)' },
  { title: '令牌', path: '/tokens', icon: <KeyOutline />, bg: 'linear-gradient(135deg,#42389d,#6656d6)' },
  { title: '工单', path: '/tickets', icon: <FileOutline />, bg: 'linear-gradient(135deg,#7c2d4f,#a4486f)' },
];

const Home = () => {
  const navigate = useNavigate();
  const [userState] = useContext(UserContext);
  const [self, setSelf] = useState(null);

  const loadSelf = useCallback(async () => {
    try {
      const res = await API.get('/api/user/self');
      const { success, message, data } = res.data;
      if (success) {
        setSelf(data);
      } else {
        showError(message);
      }
    } catch (e) {
      showError(e);
    }
  }, []);

  useEffect(() => {
    loadSelf();
  }, [loadSelf]);

  const displayName =
    self?.display_name || self?.username || userState?.user?.username || '';

  return (
    <div>
      <NavBar back={null}>{getSystemName()}</NavBar>
      <PullToRefresh onRefresh={loadSelf}>
        <div style={{ padding: 12 }}>
          <div className='m-hero'>
            <div
              style={{
                fontSize: 14.5,
                fontWeight: 500,
                marginBottom: 18,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>你好，{displayName}</span>
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  color: 'rgba(255,255,255,0.45)',
                }}
              >
                {getSystemName().toUpperCase()}
              </span>
            </div>
            <div className='hero-label'>剩余额度</div>
            <div className='hero-value'>
              {self ? renderQuota(self.quota) : '--'}
            </div>
            <div style={{ display: 'flex', gap: 32, marginTop: 16 }}>
              <div>
                <div className='hero-label'>已用</div>
                <div className='hero-sub'>
                  {self ? renderQuota(self.used_quota) : '--'}
                </div>
              </div>
              <div>
                <div className='hero-label'>调用次数</div>
                <div className='hero-sub'>{self ? self.request_count : '--'}</div>
              </div>
              {pointsEnabled() && (
                <div>
                  <div className='hero-label'>积分</div>
                  <div className='hero-sub'>
                    {self ? renderPoints(self.points_balance) : '--'}
                  </div>
                </div>
              )}
            </div>
            <div
              style={{
                marginTop: 16,
                fontSize: 11.5,
                color: 'rgba(255,255,255,0.45)',
              }}
            >
              充值请前往电脑端网站 · 余额实时同步
            </div>
          </div>

          <div className='m-section-title' style={{ paddingLeft: 4 }}>
            快捷入口
          </div>
          <Grid columns={4} gap={10}>
            {quickEntries.map((e) => (
              <Grid.Item key={e.path}>
                <div className='m-quick' onClick={() => navigate(e.path)}>
                  <div className='quick-icon' style={{ background: e.bg }}>
                    {e.icon}
                  </div>
                  <div className='quick-title'>{e.title}</div>
                </div>
              </Grid.Item>
            ))}
          </Grid>

          <div className='m-section-title' style={{ paddingLeft: 4 }}>
            最近
          </div>
          <div
            className='m-card'
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: '#6b7280',
              fontSize: 14,
            }}
            onClick={() => navigate('/logs')}
          >
            <ClockCircleOutline fontSize={18} />
            查看使用日志与消费明细
          </div>
        </div>
      </PullToRefresh>
    </div>
  );
};

export default Home;
