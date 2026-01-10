import { Radio, Key, Users, Activity } from 'lucide-react';

export const STATS = [
  {
    title: '渠道总数',
    value: '12',
    icon: Radio,
    description: '8 个启用中',
    change: '+2',
  },
  {
    title: '令牌总数',
    value: '45',
    icon: Key,
    description: '42 个有效',
    change: '+5',
  },
  {
    title: '用户总数',
    value: '128',
    icon: Users,
    description: '120 个活跃',
    change: '+8',
  },
  {
    title: '今日请求',
    value: '1,234',
    icon: Activity,
    description: '+12% 较昨日',
    change: '+148',
  },
] as const;

export const REQUEST_TREND_DATA = [
  { date: '01-01', requests: 820, tokens: 45000 },
  { date: '01-02', requests: 932, tokens: 52000 },
  { date: '01-03', requests: 901, tokens: 49000 },
  { date: '01-04', requests: 1234, tokens: 68000 },
  { date: '01-05', requests: 1090, tokens: 61000 },
  { date: '01-06', requests: 1200, tokens: 65000 },
  { date: '01-07', requests: 1350, tokens: 72000 },
] as const;

export const COST_DATA = [
  { date: '01-01', cost: 12.5 },
  { date: '01-02', cost: 15.8 },
  { date: '01-03', cost: 14.2 },
  { date: '01-04', cost: 18.9 },
  { date: '01-05', cost: 16.7 },
  { date: '01-06', cost: 17.5 },
  { date: '01-07', cost: 19.3 },
] as const;

export const MODEL_DISTRIBUTION = [
  { name: 'GPT-4', value: 45, color: '#8b5cf6' },
  { name: 'GPT-3.5', value: 30, color: '#3b82f6' },
  { name: 'Claude', value: 15, color: '#10b981' },
  { name: 'Gemini', value: 10, color: '#f59e0b' },
] as const;

export const CHANNEL_STATUS_DATA = [
  { name: '启用', value: 8 },
  { name: '禁用', value: 3 },
  { name: '错误', value: 1 },
] as const;
