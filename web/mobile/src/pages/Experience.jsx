import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid, NavBar } from 'antd-mobile';
import {
  MessageOutline,
  MovieOutline,
  PictureOutline,
  PlayOutline,
  SoundOutline,
} from 'antd-mobile-icons';

const areas = [
  {
    key: 'chat',
    title: '对话',
    desc: '流式聊天，支持思考过程',
    icon: <MessageOutline />,
    bg: 'linear-gradient(135deg,#4f46e5,#7970ee)',
    path: '/chat',
  },
  {
    key: 'video',
    title: '视频生成',
    desc: '文生视频 · 图生视频',
    icon: <MovieOutline />,
    bg: 'linear-gradient(135deg,#9d3b8f,#c05aa8)',
    path: '/video',
  },
  {
    key: 'music',
    title: '音乐音效',
    desc: '文生音乐 · 文生音效',
    icon: <PlayOutline />,
    bg: 'linear-gradient(135deg,#b07a2f,#d2a253)',
    path: '/music',
  },
  {
    key: 'audio',
    title: '语音合成',
    desc: '情感合成 · 声音设计',
    icon: <SoundOutline />,
    bg: 'linear-gradient(135deg,#0f766e,#2ba79b)',
    path: '/audio',
  },
  {
    key: 'image',
    title: '图像生成',
    desc: '文生图 · 图生图',
    icon: <PictureOutline />,
    bg: 'linear-gradient(135deg,#1d5f9e,#3f83c4)',
    path: '/image',
  },
];

const Experience = () => {
  const navigate = useNavigate();
  return (
    <div>
      <NavBar back={null}>体验区</NavBar>
      <div style={{ padding: 12 }}>
        <Grid columns={2} gap={12}>
          {areas.map((a) => (
            <Grid.Item key={a.key}>
              <div className='m-tile' onClick={() => navigate(a.path)}>
                <div className='tile-icon' style={{ background: a.bg }}>
                  {a.icon}
                </div>
                <div className='tile-title'>{a.title}</div>
                <div className='tile-desc'>{a.desc}</div>
              </div>
            </Grid.Item>
          ))}
        </Grid>
        <p
          style={{
            textAlign: 'center',
            fontSize: 12,
            color: '#c0c4cc',
            marginTop: 20,
          }}
        >
          更多高级模式（数字人、克隆、翻唱…）请前往电脑端
        </p>
      </div>
    </div>
  );
};

export default Experience;
