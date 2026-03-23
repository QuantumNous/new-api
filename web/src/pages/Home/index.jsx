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

import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Input,
  ScrollItem,
  ScrollList,
  Typography,
} from '@douyinfe/semi-ui';
import { IconCopy, IconFile, IconPlay } from '@douyinfe/semi-icons';
import { Link } from 'react-router-dom';
import { marked } from 'marked';
import { API, copy, showError, showSuccess } from '../../helpers';
import { API_ENDPOINTS } from '../../constants/common.constant';
import NoticeModal from '../../components/layout/NoticeModal';
import { StatusContext } from '../../context/Status';
import { useActualTheme } from '../../context/Theme';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const modelItems = [
  'Claude Opus 4.6',
  'Claude Sonnet 4.6',
  'GPT-5.4',
  'GPT-5.3 Codex',
  'Gemini 3.1 Pro',
  'Gemini 3 Flash',
  'GPT-5.1 Codex Max',
  'Claude Haiku 4.5',
  'Claude Opus 4.6',
  'Claude Sonnet 4.6',
  'GPT-5.4',
  'GPT-5.3 Codex',
  'Gemini 3.1 Pro',
  'Gemini 3 Flash',
  'GPT-5.1 Codex Max',
  'Claude Haiku 4.5',
];

const compareRows = [
  ['模型质量', '满血', '偷换 / 降智风险', '满血，支持验真'],
  ['稳定性', '高（但有风控）', '随时跑路', '正规渠道，零风控'],
  ['价格', '$200/月起', '极低但不透明', '¥9.9 起，额度直充'],
  ['上下文', '1M', '常被截断', '1M 完整支持'],
  ['Thinking', '支持', '常被阉割', '100% 原生支持'],
  ['多模型', '单厂商', '不确定', 'Claude + GPT + Gemini'],
  ['售后', '英文工单', '无', '中文即时响应'],
  ['风控风险', '封号可能', '极高', '零风控'],
  ['迁移成本', '—', '需适配', '改一行 Base URL'],
  ['退款保障', '无', '无', '偷换模型全额退'],
];

const valueCards = [
  {
    title: '原版直连，零阉割',
    body: '每次调用都是官方原版模型，不路由、不降级、不偷换。你拿到的输出 = 官方控制台的输出。',
  },
  {
    title: '额度直充，显示清楚',
    body: '充多少显示多少，到账即用，无复杂换算。不玩倍率游戏，也没有隐性账单刺客。',
  },
  {
    title: '直连直达，零折腾',
    body: '免翻墙、免外币信用卡、免 Billing 地址验证。换一行 Base URL，30 秒接入 Claude Code / Cursor / 任意客户端。',
  },
];

const capabilityCards = [
  {
    eyebrow: '28+ 模型',
    title: '已接入全球领先 AI 厂商',
    body: 'AI 御三家与更多主流模型统一接入，核心能力一目了然，不讲虚的，只解决真问题。',
  },
  {
    eyebrow: '¥9.9 起步',
    title: '额度直充，即充即用',
    body: '从 ¥9.9 起步到更高档位，充值后额度直接到账，展示直接，使用直接，无复杂折算。',
  },
  {
    eyebrow: 'SLA 在线',
    title: '凌晨三点不掉链子',
    body: '多渠道自动切换，故障秒级转移，优化线路稳定可用，关键时刻不断线。',
  },
  {
    eyebrow: 'OpenAI SDK',
    title: '改一行代码，迁移完毕',
    body: '100% 兼容 OpenAI SDK，替换 Base URL 即走，开发接入与现有客户端迁移都足够省心。',
  },
];

const Home = () => {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const actualTheme = useActualTheme();
  const [homePageContentLoaded, setHomePageContentLoaded] = useState(false);
  const [homePageContent, setHomePageContent] = useState('');
  const [noticeVisible, setNoticeVisible] = useState(false);
  const isMobile = useIsMobile();
  const docsLink = statusState?.status?.docs_link || '';
  const serverAddress =
    statusState?.status?.server_address || `${window.location.origin}`;
  const endpointItems = useMemo(
    () => API_ENDPOINTS.map((endpoint) => ({ value: endpoint })),
    [],
  );
  const [endpointIndex, setEndpointIndex] = useState(0);

  const displayHomePageContent = async () => {
    setHomePageContent(localStorage.getItem('home_page_content') || '');
    const res = await API.get('/api/home_page_content');
    const { success, message, data } = res.data;
    if (success) {
      let content = data;
      if (!data.startsWith('https://')) {
        content = marked.parse(data);
      }
      setHomePageContent(content);
      localStorage.setItem('home_page_content', content);

      if (data.startsWith('https://')) {
        const iframe = document.querySelector('iframe');
        if (iframe) {
          iframe.onload = () => {
            iframe.contentWindow.postMessage({ themeMode: actualTheme }, '*');
          };
        }
      }
    } else {
      showError(message);
      setHomePageContent('加载首页内容失败...');
    }
    setHomePageContentLoaded(true);
  };

  const handleCopyBaseURL = async () => {
    const ok = await copy(serverAddress);
    if (ok) {
      showSuccess(t('已复制到剪切板'));
    }
  };

  useEffect(() => {
    const checkNoticeAndShow = async () => {
      const lastCloseDate = localStorage.getItem('notice_close_date');
      const today = new Date().toDateString();
      if (lastCloseDate !== today) {
        try {
          const res = await API.get('/api/notice');
          const { success, data } = res.data;
          if (success && data && data.trim() !== '') {
            setNoticeVisible(true);
          }
        } catch (error) {
          console.error('获取公告失败:', error);
        }
      }
    };

    checkNoticeAndShow();
  }, []);

  useEffect(() => {
    displayHomePageContent().then();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setEndpointIndex((prev) => (prev + 1) % endpointItems.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [endpointItems.length]);

  const docsTarget = docsLink || '/about';
  const docsIsExternal = Boolean(docsLink);
  const pageBackground =
    actualTheme === 'dark'
      ? 'linear-gradient(180deg, #09111a 0%, #0d1722 42%, #101a16 100%)'
      : 'linear-gradient(180deg, #f8efe2 0%, #fffdf8 35%, #edf7f3 100%)';

  return (
    <div className='w-full overflow-x-hidden'>
      <NoticeModal
        visible={noticeVisible}
        onClose={() => setNoticeVisible(false)}
        isMobile={isMobile}
      />
      {homePageContentLoaded && homePageContent === '' ? (
        <div
          className='w-full overflow-x-hidden'
          style={{ background: pageBackground }}
        >
          <div className='relative mx-auto mt-[60px] max-w-7xl px-4 py-8 md:px-6 md:py-10 lg:px-8'>
            <div className='absolute left-[-120px] top-24 h-64 w-64 rounded-full bg-[#ffd39f]/40 blur-3xl' />
            <div className='absolute right-[-60px] top-10 h-72 w-72 rounded-full bg-[#68d5c0]/25 blur-3xl' />

            <section className='relative overflow-hidden rounded-[32px] border border-white/40 bg-white/75 p-6 shadow-[0_24px_80px_rgba(29,35,52,0.12)] backdrop-blur md:p-10 lg:p-12'>
              <div className='grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:items-start'>
                <div>
                  <div className='mb-5 inline-flex rounded-full border border-[#d8c6a4] bg-[#fff6e6] px-4 py-2 text-sm font-semibold text-[#7d4f11]'>
                    满血官方中转 + 优化线路 + 中文客服工单 + 新加坡技术团队运维
                  </div>
                  <h1 className='max-w-4xl text-4xl font-black leading-tight text-[#161515] md:text-6xl'>
                    拿命担保绝不降智，
                    <br />
                    接入即刻降本 95%。
                    <br />
                    发现一次偷换模型，全额退款。
                  </h1>
                  <p className='mt-6 max-w-3xl text-base leading-7 text-[#5b5347] md:text-xl md:leading-9'>
                    AI 御三家一键纳入：Claude · GPT · Gemini 全系满血
                    <br />
                    额度直充，¥9.9 起步 · 免翻墙 · 免信用卡 · 30 秒接入
                  </p>

                  <div className='mt-8 flex flex-wrap gap-3'>
                    <Link to='/console'>
                      <Button
                        theme='solid'
                        type='primary'
                        size={isMobile ? 'default' : 'large'}
                        className='!h-auto !rounded-full !bg-[#1d8f6d] px-7 py-3 !text-base !font-semibold'
                        icon={<IconPlay />}
                      >
                        进入控制台
                      </Button>
                    </Link>
                    {docsIsExternal ? (
                      <Button
                        size={isMobile ? 'default' : 'large'}
                        className='!h-auto !rounded-full border border-[#d7d2c6] !bg-white/80 px-7 py-3 !text-base !font-semibold !text-[#1f2328]'
                        icon={<IconFile />}
                        onClick={() => window.open(docsTarget, '_blank')}
                      >
                        阅读说明书
                      </Button>
                    ) : (
                      <Link to={docsTarget}>
                        <Button
                          size={isMobile ? 'default' : 'large'}
                          className='!h-auto !rounded-full border border-[#d7d2c6] !bg-white/80 px-7 py-3 !text-base !font-semibold !text-[#1f2328]'
                          icon={<IconFile />}
                        >
                          阅读说明书
                        </Button>
                      </Link>
                    )}
                  </div>

                  <div className='mt-8 rounded-[28px] border border-[#ebe3d3] bg-[#fffaf1] p-4 md:p-5'>
                    <div className='mb-2 flex flex-wrap items-center gap-2 text-sm font-medium text-[#846b44]'>
                      <span>接入只改一行 Base URL</span>
                      <span className='rounded-full bg-[#e7f6ef] px-3 py-1 text-[#1d8f6d]'>
                        兼容 OpenAI SDK
                      </span>
                    </div>
                    <Input
                      readonly
                      value={serverAddress}
                      size={isMobile ? 'default' : 'large'}
                      className='!rounded-2xl'
                      suffix={
                        <div className='flex items-center gap-2'>
                          <ScrollList
                            bodyHeight={32}
                            style={{ border: 'unset', boxShadow: 'unset' }}
                          >
                            <ScrollItem
                              mode='wheel'
                              cycled={true}
                              list={endpointItems}
                              selectedIndex={endpointIndex}
                              onSelect={({ index }) => setEndpointIndex(index)}
                            />
                          </ScrollList>
                          <Button
                            type='primary'
                            icon={<IconCopy />}
                            className='!rounded-xl'
                            onClick={handleCopyBaseURL}
                          />
                        </div>
                      }
                    />
                  </div>
                </div>

                <div className='rounded-[28px] border border-[#ece6db] bg-[#fffdfa] p-4 md:p-5'>
                  <div className='flex items-center justify-between gap-3'>
                    <div>
                      <div className='text-sm font-semibold uppercase tracking-[0.25em] text-[#8e6a2d]'>
                        满血模型池
                      </div>
                      <div className='mt-2 text-xl font-bold text-[#141414]'>
                        Claude · GPT · Gemini 全系主力阵容
                      </div>
                    </div>
                    <div className='rounded-full bg-[#1d8f6d] px-3 py-1 text-sm font-semibold text-white'>
                      量大价廉
                    </div>
                  </div>
                  <div className='mt-5 grid grid-cols-2 gap-3'>
                    {modelItems.map((item, index) => (
                      <div
                        key={`${item}-${index}`}
                        className='rounded-2xl border border-[#ebe3d3] bg-white px-4 py-3 text-sm font-semibold text-[#2c2c2c] shadow-[0_8px_24px_rgba(46,54,75,0.06)]'
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className='mt-8 grid gap-4 md:grid-cols-3'>
              {valueCards.map((card) => (
                <div
                  key={card.title}
                  className='rounded-[28px] border border-white/50 bg-white/70 p-6 shadow-[0_18px_50px_rgba(29,35,52,0.08)] backdrop-blur'
                >
                  <h2 className='text-xl font-bold text-[#171717]'>{card.title}</h2>
                  <p className='mt-3 text-sm leading-7 text-[#61584c] md:text-base'>
                    {card.body}
                  </p>
                </div>
              ))}
            </section>

            <section className='mt-8 rounded-[32px] border border-[#e9e1d3] bg-[#fff] p-6 shadow-[0_20px_60px_rgba(29,35,52,0.08)] md:p-8'>
              <div className='max-w-3xl'>
                <div className='text-sm font-semibold uppercase tracking-[0.28em] text-[#8e6a2d]'>
                  三方对比，一目了然
                </div>
                <h2 className='mt-3 text-3xl font-black text-[#181818] md:text-4xl'>
                  官方直连 vs 低价逆向 vs 满血 AI 接入
                </h2>
                <p className='mt-3 text-base leading-7 text-[#61584c]'>
                  不比花活，只比模型是否原版、线路是否稳定、接入是否省事、售后是否真能响应。
                </p>
              </div>
              <div className='mt-6 overflow-x-auto'>
                <table className='min-w-full border-separate border-spacing-0 overflow-hidden rounded-[24px]'>
                  <thead>
                    <tr>
                      <th className='bg-[#f8f1e5] px-4 py-4 text-left text-sm font-bold text-[#684b16]'>
                        对比维度
                      </th>
                      <th className='bg-[#f5f5f5] px-4 py-4 text-left text-sm font-bold text-[#30343a]'>
                        官方直连
                      </th>
                      <th className='bg-[#fff0f0] px-4 py-4 text-left text-sm font-bold text-[#8a3c3c]'>
                        低价逆向
                      </th>
                      <th className='bg-[#e8faf4] px-4 py-4 text-left text-sm font-bold text-[#16634b]'>
                        OpusClaw · 满血 AI 接入
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareRows.map((row, index) => (
                      <tr key={row[0]}>
                        <td className='border-t border-[#efe7d8] bg-[#fffaf2] px-4 py-4 text-sm font-semibold text-[#473d2f]'>
                          {row[0]}
                        </td>
                        <td className='border-t border-[#efe7d8] bg-white px-4 py-4 text-sm text-[#3a3f45]'>
                          {row[1]}
                        </td>
                        <td className='border-t border-[#efe7d8] bg-white px-4 py-4 text-sm text-[#7a5151]'>
                          {row[2]}
                        </td>
                        <td className='border-t border-[#efe7d8] bg-white px-4 py-4 text-sm font-semibold text-[#16634b]'>
                          {row[3]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className='mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]'>
              <div className='rounded-[32px] border border-[#eadfcb] bg-[#221d16] p-6 text-white shadow-[0_20px_60px_rgba(23,19,14,0.24)] md:p-8'>
                <div className='text-sm font-semibold uppercase tracking-[0.28em] text-[#f0c883]'>
                  时间才是最贵的成本
                </div>
                <div className='mt-6 grid gap-4'>
                  <div className='rounded-[24px] border border-white/10 bg-white/5 p-5'>
                    <div className='flex items-center justify-between gap-4'>
                      <div className='text-lg font-bold'>用弱模型“省钱”</div>
                      <div className='text-2xl font-black text-[#ffcf85]'>3 小时</div>
                    </div>
                    <p className='mt-3 text-sm leading-7 text-white/75'>
                      用 Haiku 省了 ¥50 API 费，多花 3 小时反复 debug。
                    </p>
                  </div>
                  <div className='rounded-[24px] border border-[#3fd0a8]/30 bg-[#123b31] p-5'>
                    <div className='flex items-center justify-between gap-4'>
                      <div className='text-lg font-bold'>用 Opus 一步到位</div>
                      <div className='text-2xl font-black text-[#79f2cb]'>10 分钟</div>
                    </div>
                    <p className='mt-3 text-sm leading-7 text-white/80'>
                      多花 ¥50 用 Opus，10 分钟精准搞定。你的时间值多少钱？
                    </p>
                  </div>
                </div>
              </div>

              <div className='grid gap-4 md:grid-cols-2'>
                {capabilityCards.map((card) => (
                  <div
                    key={card.title}
                    className='rounded-[28px] border border-white/55 bg-white/75 p-6 shadow-[0_18px_50px_rgba(29,35,52,0.08)] backdrop-blur'
                  >
                    <div className='text-sm font-semibold uppercase tracking-[0.22em] text-[#8e6a2d]'>
                      {card.eyebrow}
                    </div>
                    <h2 className='mt-3 text-2xl font-bold text-[#161616]'>
                      {card.title}
                    </h2>
                    <p className='mt-3 text-sm leading-7 text-[#62594d] md:text-base'>
                      {card.body}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className='mt-8 rounded-[32px] border border-[#dceee8] bg-[linear-gradient(135deg,#0f6b53_0%,#0d7d61_55%,#11a070_100%)] p-6 text-white shadow-[0_24px_80px_rgba(16,104,80,0.24)] md:p-8 lg:p-10'>
              <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center'>
                <div>
                  <div className='text-sm font-semibold uppercase tracking-[0.26em] text-white/70'>
                    官方原版模型，国内优化接入
                  </div>
                  <h2 className='mt-3 text-3xl font-black leading-tight md:text-4xl'>
                    满血官方中转，客服工单快速提交，
                    <br />
                    新加坡技术团队开发和运维。
                  </h2>
                  <p className='mt-4 max-w-3xl text-base leading-8 text-white/85'>
                    面向开发者、团队和高频调用场景，主打官方原版输出、优化线路、量大价廉、中文即时响应。模型不偷换，问题不甩锅，出了问题有人负责到底。
                  </p>
                </div>
                <div className='flex flex-wrap gap-3 lg:justify-end'>
                  <Link to='/contact'>
                    <Button
                      size={isMobile ? 'default' : 'large'}
                      className='!h-auto !rounded-full !border-none !bg-white px-7 py-3 !text-base !font-semibold !text-[#0f6b53]'
                    >
                      联系客服
                    </Button>
                  </Link>
                  <Link to='/console'>
                    <Button
                      size={isMobile ? 'default' : 'large'}
                      className='!h-auto !rounded-full border border-white/35 !bg-transparent px-7 py-3 !text-base !font-semibold !text-white'
                    >
                      立即接入
                    </Button>
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : (
        <div className='overflow-x-hidden w-full'>
          {homePageContent.startsWith('https://') ? (
            <iframe
              src={homePageContent}
              className='w-full h-screen border-none'
            />
          ) : (
            <div
              className='mt-[60px]'
              dangerouslySetInnerHTML={{ __html: homePageContent }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Home;
