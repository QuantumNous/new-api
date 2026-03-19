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
import { Card, Typography } from '@douyinfe/semi-ui';

const { Title, Text } = Typography;

const modelTiers = [
  {
    name: '基础档',
    points: '1 点',
    desc: '适合日常对话和轻量任务',
  },
  {
    name: '进阶档',
    points: '2 点',
    desc: '质量更稳定，适合生产场景',
  },
  {
    name: '旗舰档',
    points: '3-4 点',
    desc: '高质量推理与复杂任务优先',
  },
];

const Docs = () => {
  return (
    <div className='mt-[64px] px-3 md:px-6 pb-6'>
      <div className='max-w-5xl mx-auto'>
        <Card className='!rounded-2xl'>
          <Title heading={2}>YOUMI API 文档中心</Title>
          <Text type='secondary'>接入教程、模型说明、点数规则和常见问题都在这里。</Text>

          <div className='mt-5 p-4 rounded-xl border border-sky-200 bg-sky-50'>
            <Title heading={6}>快速入口</Title>
            <Text className='block !mb-1'>1. API 站点：注册、登录、获取 Key</Text>
            <Text className='block !mb-1'>2. 点数购买：购买套餐并兑换点数</Text>
            <Text className='block !mb-0'>3. 客户端接入：按教程填写 Base URL 与 API Key</Text>
          </div>

          <div className='mt-6 space-y-5'>
            <section>
              <Title heading={5}>关于模型与计费</Title>
              <Text className='block !mb-3'>
                平台采用按次计费，调用不同档位模型会扣除对应点数，不按上下文长度重复计费。
              </Text>
              <div className='overflow-x-auto rounded-lg border border-slate-200'>
                <table className='w-full text-left text-sm'>
                  <thead className='bg-slate-50'>
                    <tr>
                      <th className='px-3 py-2'>模型档位</th>
                      <th className='px-3 py-2'>单次消耗</th>
                      <th className='px-3 py-2'>说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelTiers.map((tier) => (
                      <tr key={tier.name} className='border-t border-slate-100'>
                        <td className='px-3 py-2'>{tier.name}</td>
                        <td className='px-3 py-2'>{tier.points}</td>
                        <td className='px-3 py-2'>{tier.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <Title heading={5}>福利与点数获取</Title>
              <Text className='block !mb-3'>
                常见活动：新用户注册赠送点数，邀请好友可获得奖励。实际活动以你的运营规则为准。
              </Text>
              <Text className='block !mb-1'>1. 在商城或支付页购买点数套餐。</Text>
              <Text className='block !mb-1'>2. 获得兑换码后，在控制台进行兑换。</Text>
              <Text className='block !mb-0'>3. 兑换成功后可立即开始调用模型。</Text>
            </section>

            <section>
              <Title heading={5}>SillyTavern 接入教程</Title>
              <Text className='block !mb-1'>1. 打开 SillyTavern 的 API 连接设置。</Text>
              <Text className='block !mb-1'>2. API 类型选择 Custom（自定义）。</Text>
              <Text className='block !mb-1'>3. 填写 Base URL 与 API Key：</Text>
              <pre className='rounded-lg bg-slate-900 text-slate-100 p-3 text-xs overflow-x-auto'>
{`Base URL: https://api.meeyo.org/v1
API Key: sk-xxxxxxxxxxxxxxxx`}
              </pre>
              <Text className='block !mt-2 !mb-0'>4. 点击连接并选择模型，出现可用状态即可开始对话。</Text>
            </section>

            <section>
              <Title heading={5}>其他客户端</Title>
              <Text className='block !mb-0'>
                Cherry Studio、Lobe Chat、OpenCat 等客户端均可按 OpenAI 兼容方式接入：填写统一网关地址与 Key 即可。
              </Text>
            </section>

            <section>
              <Title heading={5}>注意事项</Title>
              <Text className='block !mb-1'>1. 看不到模型通常是连接未成功，优先检查 URL 和 Key 是否有空格。</Text>
              <Text className='block !mb-1'>2. 建议开启流式输出以提升交互体验。</Text>
              <Text className='block !mb-1'>3. 切换预设后可能覆盖连接地址，请重新确认 Base URL。</Text>
              <Text className='block !mb-0'>4. 若出现上下文异常，请检查上下文长度、预设与扩展配置。</Text>
            </section>

            <section>
              <Title heading={5}>支持与反馈</Title>
              <Text className='block !mb-0'>
                如需客服支持，可在此处放置你的社群链接、工单地址或联系方式。
              </Text>

              <div className='mt-4 rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50 to-cyan-50 p-4'>
                <Title heading={6}>QQ群二维码</Title>
                <Text type='secondary' className='block !mb-3'>
                  扫码加入用户交流群，获取最新公告与使用支持。
                </Text>
                <img
                  src='/qq-group.jpg'
                  alt='QQ群二维码'
                  className='mx-auto w-full max-w-xs rounded-lg border border-sky-100 bg-white object-contain'
                  loading='lazy'
                />
              </div>
            </section>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Docs;
