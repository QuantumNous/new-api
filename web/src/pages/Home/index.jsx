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
import { Claude, Gemini, OpenAI } from '@lobehub/icons';
import { Link } from 'react-router-dom';
import { marked } from 'marked';
import { API, copy, getSystemName, showError, showSuccess } from '../../helpers';
import { API_ENDPOINTS } from '../../constants/common.constant';
import NoticeModal from '../../components/layout/NoticeModal';
import { StatusContext } from '../../context/Status';
import { useActualTheme } from '../../context/Theme';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const modelItems = [
  {
    name: 'Claude Opus 系列',
    icon: Claude,
  },
  {
    name: 'Claude Sonnet / Haiku 系列',
    icon: Claude,
  },
  {
    name: 'Gemini Pro 系列',
    icon: Gemini,
  },
  {
    name: 'Gemini Flash 系列',
    icon: Gemini,
  },
  {
    name: 'GPT / GPT-mini 系列',
    icon: OpenAI,
  },
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
  const systemName = getSystemName();
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

  const docsTarget = '/guide';
  const pageBackground =
    actualTheme === 'dark'
      ? 'linear-gradient(180deg, #09111a 0%, #0d1722 42%, #101a16 100%)'
      : 'linear-gradient(180deg, #f8efe2 0%, #fffdf8 35%, #edf7f3 100%)';
  const isDark = actualTheme === 'dark';

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

            <section
              className={`relative overflow-hidden rounded-[32px] p-6 shadow-[0_24px_80px_rgba(29,35,52,0.12)] backdrop-blur md:p-10 lg:p-12 ${
                isDark
                  ? 'border border-white/10 bg-[#111926]/85'
                  : 'border border-white/40 bg-white/75'
              }`}
            >
              <div className='grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:items-start'>
                <div>
                  <div
                    className={`mb-5 inline-flex rounded-full px-4 py-2 text-sm font-semibold ${
                      isDark
                        ? 'border border-[#5c4a27] bg-[#2d2417] text-[#f3ca82]'
                        : 'border border-[#d8c6a4] bg-[#fff6e6] text-[#7d4f11]'
                    }`}
                  >
                    满血官方中转 + 优化线路 + 中文客服工单 + 极客团队运维
                  </div>
                  <h1
                    className={`max-w-4xl text-4xl font-black leading-tight md:text-6xl ${
                      isDark ? 'text-[#f5f7fb]' : 'text-[#161515]'
                    }`}
                  >
                    拿命担保绝不降智，
                    <br />
                    接入即刻降本 95%。
                    <br />
                    发现一次偷换模型，全额退款。
                  </h1>
                  <p
                    className={`mt-6 max-w-3xl text-base leading-7 md:text-xl md:leading-9 ${
                      isDark ? 'text-[#c1cad8]' : 'text-[#5b5347]'
                    }`}
                  >
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
                    <Link to={docsTarget}>
                      <Button
                        size={isMobile ? 'default' : 'large'}
                        className={`!h-auto !rounded-full px-7 py-3 !text-base !font-semibold ${
                          isDark
                            ? 'border !border-white/15 !bg-white/8 !text-white'
                            : 'border border-[#d7d2c6] !bg-white/80 !text-[#1f2328]'
                        }`}
                        icon={<IconFile />}
                      >
                        接入教程
                      </Button>
                    </Link>
                  </div>

                  <div
                    className={`mt-8 rounded-[28px] p-4 md:p-5 ${
                      isDark
                        ? 'border border-white/10 bg-[#182231]'
                        : 'border border-[#ebe3d3] bg-[#fffaf1]'
                    }`}
                  >
                    <div
                      className={`mb-2 flex flex-wrap items-center gap-2 text-sm font-medium ${
                        isDark ? 'text-[#c4b28d]' : 'text-[#846b44]'
                      }`}
                    >
                      <span>接入只改一行 Base URL</span>
                      <span
                        className={`rounded-full px-3 py-1 ${
                          isDark
                            ? 'bg-[#153428] text-[#79f2cb]'
                            : 'bg-[#e7f6ef] text-[#1d8f6d]'
                        }`}
                      >
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

                <div
                  className={`rounded-[28px] p-4 md:p-5 ${
                    isDark
                      ? 'border border-white/10 bg-[#151f2d]'
                      : 'border border-[#ece6db] bg-[#fffdfa]'
                  }`}
                >
                  <div className='flex items-center justify-between gap-3'>
                    <div>
                      <div
                        className={`text-sm font-semibold uppercase tracking-[0.25em] ${
                          isDark ? 'text-[#f0c883]' : 'text-[#8e6a2d]'
                        }`}
                      >
                        满血模型系列
                      </div>
                      <div
                        className={`mt-2 text-xl font-bold ${
                          isDark ? 'text-[#f5f7fb]' : 'text-[#141414]'
                        }`}
                      >
                        Claude · GPT · Gemini 最新系列全覆盖
                      </div>
                    </div>
                    <div className='whitespace-nowrap rounded-full bg-[#1d8f6d] px-3 py-1 text-sm font-semibold text-white'>
                      量大价廉
                    </div>
                  </div>
                  <div className='mt-5 grid gap-3 sm:grid-cols-2'>
                    {modelItems.map((item, index) => {
                      const Logo = item.icon;
                      return (
                      <div
                        key={`${item.name}-${index}`}
                        className={`rounded-2xl px-4 py-3 text-sm font-semibold shadow-[0_8px_24px_rgba(46,54,75,0.06)] ${
                          isDark
                            ? 'border border-white/10 bg-[#1b2838] text-[#e6edf8]'
                            : 'border border-[#ebe3d3] bg-white text-[#2c2c2c]'
                        }`}
                      >
                        <div className='flex items-center gap-3'>
                          <span
                            className={`flex h-8 w-8 items-center justify-center rounded-full ${
                              isDark ? 'bg-white/8' : 'bg-[#f7f1e4]'
                            }`}
                          >
                            <Logo size={18} />
                          </span>
                          <span>{item.name}</span>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section className='mt-8 grid gap-4 md:grid-cols-3'>
              {valueCards.map((card) => (
                <div
                  key={card.title}
                  className={`rounded-[28px] p-6 shadow-[0_18px_50px_rgba(29,35,52,0.08)] backdrop-blur ${
                    isDark
                      ? 'border border-white/10 bg-[#131d2b]/85'
                      : 'border border-white/50 bg-white/70'
                  }`}
                >
                  <h2
                    className={`text-xl font-bold ${
                      isDark ? 'text-[#f5f7fb]' : 'text-[#171717]'
                    }`}
                  >
                    {card.title}
                  </h2>
                  <p
                    className={`mt-3 text-sm leading-7 md:text-base ${
                      isDark ? 'text-[#bdc7d5]' : 'text-[#61584c]'
                    }`}
                  >
                    {card.body}
                  </p>
                </div>
              ))}
            </section>

            <section
              className={`mt-8 rounded-[32px] p-6 shadow-[0_20px_60px_rgba(29,35,52,0.08)] md:p-8 ${
                isDark
                  ? 'border border-white/10 bg-[#111a27]'
                  : 'border border-[#e9e1d3] bg-[#fff]'
              }`}
            >
              <div className='max-w-3xl'>
                <div
                  className={`text-sm font-semibold uppercase tracking-[0.28em] ${
                    isDark ? 'text-[#f0c883]' : 'text-[#8e6a2d]'
                  }`}
                >
                  三方对比，一目了然
                </div>
                <h2
                  className={`mt-3 text-3xl font-black md:text-4xl ${
                    isDark ? 'text-[#f5f7fb]' : 'text-[#181818]'
                  }`}
                >
                  官方直连 vs 低价逆向 vs 满血 AI 接入
                </h2>
                <p
                  className={`mt-3 text-base leading-7 ${
                    isDark ? 'text-[#bdc7d5]' : 'text-[#61584c]'
                  }`}
                >
                  不比花活，只比模型是否原版、线路是否稳定、接入是否省事、售后是否真能响应。
                </p>
              </div>
              <div className='mt-6 overflow-x-auto'>
                <table className='min-w-full border-separate border-spacing-0 overflow-hidden rounded-[24px]'>
                  <thead>
                    <tr>
                      <th
                        className={`px-4 py-4 text-left text-sm font-bold ${
                          isDark
                            ? 'bg-[#2c2417] text-[#f0c883]'
                            : 'bg-[#f8f1e5] text-[#684b16]'
                        }`}
                      >
                        对比维度
                      </th>
                      <th
                        className={`px-4 py-4 text-left text-sm font-bold ${
                          isDark
                            ? 'bg-[#1a2230] text-[#e6edf8]'
                            : 'bg-[#f5f5f5] text-[#30343a]'
                        }`}
                      >
                        官方直连
                      </th>
                      <th
                        className={`px-4 py-4 text-left text-sm font-bold ${
                          isDark
                            ? 'bg-[#2b1d22] text-[#f2b5b5]'
                            : 'bg-[#fff0f0] text-[#8a3c3c]'
                        }`}
                      >
                        低价逆向
                      </th>
                      <th
                        className={`px-4 py-4 text-left text-sm font-bold ${
                          isDark
                            ? 'bg-[#142a24] text-[#79f2cb]'
                            : 'bg-[#e8faf4] text-[#16634b]'
                        }`}
                      >
                        {systemName} · 满血 AI 接入
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareRows.map((row, index) => (
                      <tr key={row[0]}>
                        <td
                          className={`px-4 py-4 text-sm font-semibold ${
                            isDark
                              ? 'border-t border-white/10 bg-[#182131] text-[#d9c8ab]'
                              : 'border-t border-[#efe7d8] bg-[#fffaf2] text-[#473d2f]'
                          }`}
                        >
                          {row[0]}
                        </td>
                        <td
                          className={`px-4 py-4 text-sm ${
                            isDark
                              ? 'border-t border-white/10 bg-[#111a27] text-[#d3dbe7]'
                              : 'border-t border-[#efe7d8] bg-white text-[#3a3f45]'
                          }`}
                        >
                          {row[1]}
                        </td>
                        <td
                          className={`px-4 py-4 text-sm ${
                            isDark
                              ? 'border-t border-white/10 bg-[#111a27] text-[#d9aaaa]'
                              : 'border-t border-[#efe7d8] bg-white text-[#7a5151]'
                          }`}
                        >
                          {row[2]}
                        </td>
                        <td
                          className={`px-4 py-4 text-sm font-semibold ${
                            isDark
                              ? 'border-t border-white/10 bg-[#111a27] text-[#79f2cb]'
                              : 'border-t border-[#efe7d8] bg-white text-[#16634b]'
                          }`}
                        >
                          {row[3]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className='mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]'>
              <div
                className={`rounded-[32px] p-6 shadow-[0_20px_60px_rgba(23,19,14,0.24)] md:p-8 ${
                  isDark
                    ? 'border border-[#eadfcb] bg-[#221d16] text-white'
                    : 'border border-[#eadfcb] bg-[#fff7ec] text-[#2d251c]'
                }`}
              >
                <div
                  className={`text-sm font-semibold uppercase tracking-[0.28em] ${
                    isDark ? 'text-[#f0c883]' : 'text-[#8e6a2d]'
                  }`}
                >
                  时间才是最贵的成本
                </div>
                <div className='mt-6 grid gap-4'>
                  <div
                    className={`rounded-[24px] p-5 ${
                      isDark
                        ? 'border border-white/10 bg-white/5'
                        : 'border border-[#eadfcb] bg-white'
                    }`}
                  >
                    <div className='flex items-center justify-between gap-4'>
                      <div className='text-lg font-bold'>用某便宜国产开源模型</div>
                      <div className='text-2xl font-black text-[#ffcf85]'>3 小时</div>
                    </div>
                    <p
                      className={`mt-3 text-sm leading-7 ${
                        isDark ? 'text-white/75' : 'text-[#685d50]'
                      }`}
                    >
                      看起来省了点 API 费，结果多花 3 小时反复 debug。
                    </p>
                  </div>
                  <div
                    className={`rounded-[24px] p-5 ${
                      isDark
                        ? 'border border-[#3fd0a8]/30 bg-[#123b31]'
                        : 'border border-[#b9e8d7] bg-[#edf8f3]'
                    }`}
                  >
                    <div className='flex items-center justify-between gap-4'>
                      <div
                        className={`text-lg font-bold ${
                          isDark ? 'text-white' : 'text-[#134c3d]'
                        }`}
                      >
                        用 Opus 一步到位
                      </div>
                      <div className='text-2xl font-black text-[#79f2cb]'>10 分钟</div>
                    </div>
                    <p
                      className={`mt-3 text-sm leading-7 ${
                        isDark ? 'text-white/80' : 'text-[#386556]'
                      }`}
                    >
                      多花 ¥50 用 Opus，10 分钟精准搞定。你的时间值多少钱？
                    </p>
                  </div>
                </div>
              </div>

              <div className='grid gap-4 md:grid-cols-2'>
                {capabilityCards.map((card) => (
                  <div
                    key={card.title}
                  className={`rounded-[28px] p-6 shadow-[0_18px_50px_rgba(29,35,52,0.08)] backdrop-blur ${
                    isDark
                      ? 'border border-white/10 bg-[#131d2b]/85'
                      : 'border border-white/55 bg-white/75'
                  }`}
                  >
                    <div
                      className={`text-sm font-semibold uppercase tracking-[0.22em] ${
                        isDark ? 'text-[#f0c883]' : 'text-[#8e6a2d]'
                      }`}
                    >
                      {card.eyebrow}
                    </div>
                    <h2
                      className={`mt-3 text-2xl font-bold ${
                        isDark ? 'text-[#f5f7fb]' : 'text-[#161616]'
                      }`}
                    >
                      {card.title}
                    </h2>
                    <p
                      className={`mt-3 text-sm leading-7 md:text-base ${
                        isDark ? 'text-[#bdc7d5]' : 'text-[#62594d]'
                      }`}
                    >
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
                    极客团队开发和运维。
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
