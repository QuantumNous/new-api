import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Grid, List, ChevronDown, ChevronUp, X, Zap, DollarSign, Cpu, Globe, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/atoms/Loading';
import { Header } from '@/components/organisms/Header';
import api from '@/lib/api/client';
import { APP_NAME } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface Model {
  model_name?: string;
  description?: string;
  icon?: string;
  tags?: string;
  vendor_id?: number;
  model_ratio?: number;
  model_price?: number;
  completion_ratio?: number;
  enable_groups?: string[];
  supported_endpoint_types?: string[];
  quota_type?: number; // 0=按量计费, 1=按次计费
  vendor_name?: string;
  vendor_icon?: string;
}

export default function ModelsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'price-low' | 'price-high' | 'ratio-low' | 'ratio-high'>('newest');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    sort: false,
    provider: false,
    inputModality: false,
    outputModality: false,
    contextLength: false,
    category: false,
  });
  const [groupRatio, setGroupRatio] = useState<Record<string, number>>({});
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [showRatio, setShowRatio] = useState(false);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.get('/pricing');
      // 确保返回的是数组
      const modelsArray = Array.isArray(data?.data) ? data.data : [];
      setModels(modelsArray);
      // 保存分组倍率
      if (data?.group_ratio) {
        setGroupRatio(data.group_ratio);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '获取模型列表失败');
      console.error('Failed to fetch models:', err);
      setModels([]);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateModelPrice = (model: Model) => {
    // 1. 选择实际使用的分组倍率
    let usedGroupRatio = 1;
    if (selectedGroup !== 'all' && groupRatio[selectedGroup] !== undefined) {
      usedGroupRatio = groupRatio[selectedGroup];
    } else if (model.enable_groups && model.enable_groups.length > 0) {
      // 在模型可用分组中选择倍率最小的分组
      let minRatio = Number.POSITIVE_INFINITY;
      model.enable_groups.forEach((g) => {
        const r = groupRatio[g];
        if (r !== undefined && r < minRatio) {
          minRatio = r;
          usedGroupRatio = r;
        }
      });
    }

    // 2. 根据计费类型计算价格
    if (model.quota_type === 0) {
      // 按量计费
      const inputRatioPrice = (model.model_ratio || 0) * 2 * usedGroupRatio;
      const completionRatioPrice = (model.model_ratio || 0) * (model.completion_ratio || 0) * 2 * usedGroupRatio;
      return {
        inputPrice: inputRatioPrice,
        completionPrice: completionRatioPrice,
        usedGroupRatio,
        isPerToken: true,
      };
    } else if (model.quota_type === 1) {
      // 按次计费
      const price = (model.model_price || 0) * usedGroupRatio;
      return {
        price,
        usedGroupRatio,
        isPerToken: false,
      };
    }

    // 未知计费类型
    return {
      price: 0,
      usedGroupRatio,
      isPerToken: false,
    };
  };

  const providers = ['all', ...Array.from(new Set(models.map(m => m.icon).filter(Boolean)))];

  const filteredModels = models.filter(model => {
    const name = model.model_name || '';
    const description = model.description || '';
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProvider = selectedProvider === 'all' || model.icon === selectedProvider;
    return matchesSearch && matchesProvider;
  });

  const sortedModels = [...filteredModels].sort((a, b) => {
    const priceA = calculateModelPrice(a);
    const priceB = calculateModelPrice(b);

    switch (sortBy) {
      case 'price-low':
        // 按价格从低到高排序
        if (priceA.isPerToken && priceB.isPerToken) {
          return priceA.inputPrice - priceB.inputPrice;
        } else if (!priceA.isPerToken && !priceB.isPerToken) {
          return priceA.price - priceB.price;
        } else {
          // 混合类型时，按量计费排在前面
          return priceA.isPerToken ? -1 : 1;
        }
      case 'price-high':
        // 按价格从高到低排序
        if (priceA.isPerToken && priceB.isPerToken) {
          return priceB.inputPrice - priceA.inputPrice;
        } else if (!priceA.isPerToken && !priceB.isPerToken) {
          return priceB.price - priceA.price;
        } else {
          // 混合类型时，按次计费排在前面
          return priceA.isPerToken ? 1 : -1;
        }
      case 'ratio-low':
        // 按分组倍率从低到高排序
        return priceA.usedGroupRatio - priceB.usedGroupRatio;
      case 'ratio-high':
        // 按分组倍率从高到低排序
        return priceB.usedGroupRatio - priceA.usedGroupRatio;
      default:
        // 默认按模型名称排序
        return (a.model_name || '').localeCompare(b.model_name || '');
    }
  });

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedProvider('all');
    setSortBy('newest');
  };

  const hasActiveFilters = searchQuery || selectedProvider !== 'all' || sortBy !== 'newest';

  const getModelLogo = (icon?: string) => {
    if (!icon) return '🚀';
    const lowerIcon = icon.toLowerCase();
    if (lowerIcon.includes('openai')) return '🤖';
    if (lowerIcon.includes('anthropic')) return '🧠';
    if (lowerIcon.includes('google')) return '💎';
    if (lowerIcon.includes('meta')) return '🦙';
    if (lowerIcon.includes('mistral')) return '🌪️';
    if (lowerIcon.includes('alibaba') || lowerIcon.includes('aliyun')) return '🐉';
    if (lowerIcon.includes('deepseek')) return '🔍';
    if (lowerIcon.includes('venice')) return '🎨';
    if (lowerIcon.includes('cortecs')) return '⚡';
    return '🚀';
  };

  const formatPrice = (price?: number, ratio?: number) => {
    if (price === undefined || price === null || price === 0) {
      if (ratio && ratio > 0) {
        return `${ratio}x`;
      }
      return 'N/A';
    }
    return `$${price.toFixed(4)}`;
  };

  const parseTags = (tags?: string) => {
    if (!tags) return [];
    return tags.split(',').map(tag => tag.trim()).filter(Boolean);
  };

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const FilterSection = ({ title, children, sectionKey }: { title: string; children: React.ReactNode; sectionKey: string }) => (
    <div className={sidebarCollapsed ? 'hidden' : ''}>
      <motion.button
        onClick={() => toggleSection(sectionKey)}
        className="w-full flex items-center justify-between text-left font-semibold mb-3 text-sm hover:text-primary transition-colors"
        whileHover={{ x: 2 }}
      >
        {title}
        <motion.div
          animate={{ rotate: collapsedSections[sectionKey] ? -90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </motion.button>
      <AnimatePresence>
        {!collapsedSections[sectionKey] && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* 渐变背景动画 */}
      <div className="absolute inset-0 -z-10">
        <motion.div
          className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 dark:bg-indigo-600/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-500/10 dark:bg-purple-600/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      {/* 使用项目统一的 Header */}
      <Header />

      {/* 主内容区 - 左侧筛选器 + 右侧模型列表 */}
      <div className="container mx-auto px-4 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-purple-500 to-blue-500 bg-clip-text text-transparent">
              模型库
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">探索最先进的 AI 模型</p>
          </motion.div>
        </div>

        <div className="flex gap-6">
          {/* 左侧筛选器 - 桌面端显示 */}
          <aside 
            className={cn(
              'hidden lg:block flex-shrink-0 transition-all duration-300',
              sidebarCollapsed ? 'w-16' : 'w-72'
            )}
          >
            <div className="sticky top-24 space-y-4 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2 custom-scrollbar">
              {/* 侧边栏折叠按钮 */}
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="w-full h-8 border-primary/20 hover:border-primary/40 hover:bg-primary/5"
                >
                  {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </Button>
              </motion.div>

              {/* 排序 */}
              <FilterSection title="排序" sectionKey="sort">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full text-sm border rounded-lg px-3 py-2 bg-background border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                >
                  <option value="newest">最新</option>
                  <option value="price-low">价格：低到高</option>
                  <option value="price-high">价格：高到低</option>
                  <option value="ratio-low">倍率：低到高</option>
                  <option value="ratio-high">倍率：高到低</option>
                </select>
              </FilterSection>

              {/* 提供商筛选 */}
              <FilterSection title="提供商" sectionKey="provider">
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {providers.map(provider => (
                    <motion.label 
                      key={provider} 
                      className="flex items-center gap-2 cursor-pointer hover:bg-primary/5 p-2 rounded-lg transition-colors"
                      whileHover={{ x: 2 }}
                    >
                      <input
                        type="radio"
                        name="provider"
                        value={provider}
                        checked={selectedProvider === provider}
                        onChange={(e) => setSelectedProvider(e.target.value)}
                        className="rounded text-primary focus:ring-primary"
                      />
                      <span className="text-sm">
                        {provider === 'all' ? '全部' : provider}
                      </span>
                    </motion.label>
                  ))}
                </div>
              </FilterSection>

              {/* 输入模态 */}
              <FilterSection title="输入模态" sectionKey="inputModality">
                <div className="space-y-2">
                  {['文本', '图片', '音频', '视频'].map(modality => (
                    <label key={modality} className="flex items-center gap-2 cursor-pointer hover:bg-primary/5 p-2 rounded-lg transition-colors">
                      <input type="checkbox" className="rounded text-primary focus:ring-primary" />
                      <span className="text-sm">{modality}</span>
                    </label>
                  ))}
                </div>
              </FilterSection>

              {/* 输出模态 */}
              <FilterSection title="输出模态" sectionKey="outputModality">
                <div className="space-y-2">
                  {['文本', '图片', '嵌入'].map(modality => (
                    <label key={modality} className="flex items-center gap-2 cursor-pointer hover:bg-primary/5 p-2 rounded-lg transition-colors">
                      <input type="checkbox" className="rounded text-primary focus:ring-primary" />
                      <span className="text-sm">{modality}</span>
                    </label>
                  ))}
                </div>
              </FilterSection>

              {/* 上下文长度 */}
              <FilterSection title="上下文长度" sectionKey="contextLength">
                <div className="space-y-2">
                  {['< 32K', '32K - 128K', '128K - 1M', '> 1M'].map(range => (
                    <label key={range} className="flex items-center gap-2 cursor-pointer hover:bg-primary/5 p-2 rounded-lg transition-colors">
                      <input type="checkbox" className="rounded text-primary focus:ring-primary" />
                      <span className="text-sm">{range}</span>
                    </label>
                  ))}
                </div>
              </FilterSection>

              {/* 分类 */}
              <FilterSection title="分类" sectionKey="category">
                <div className="space-y-2">
                  {['推理', '编程', '多模态', '嵌入'].map(category => (
                    <label key={category} className="flex items-center gap-2 cursor-pointer hover:bg-primary/5 p-2 rounded-lg transition-colors">
                      <input type="checkbox" className="rounded text-primary focus:ring-primary" />
                      <span className="text-sm">{category}</span>
                    </label>
                  ))}
                </div>
              </FilterSection>
            </div>
          </aside>

          {/* 右侧模型列表 */}
          <div className="flex-1 min-w-0">
            {/* 搜索和工具栏 */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="搜索模型名称或描述..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={hasActiveFilters ? "default" : "outline"}
                  size="sm"
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                >
                  清除筛选
                </Button>
                <div className="flex border rounded-lg overflow-hidden">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => setViewMode('grid')}
                    className="rounded-none"
                  >
                    <Grid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => setViewMode('list')}
                    className="rounded-none border-l"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            {/* 移动端筛选器 - 仅在移动端显示 */}
            <div className="lg:hidden mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="w-full gap-2"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filters
                {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>

              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mt-4"
                  >
                    <div className="border rounded-lg p-4 space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">排序</label>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as any)}
                          className="w-full text-sm border rounded-md px-3 py-2 bg-background"
                        >
                          <option value="newest">最新</option>
                          <option value="price-low">价格：低到高</option>
                          <option value="price-high">价格：高到低</option>
                          <option value="ratio-low">倍率：低到高</option>
                          <option value="ratio-high">倍率：高到低</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block">提供商</label>
                        <select
                          value={selectedProvider}
                          onChange={(e) => setSelectedProvider(e.target.value)}
                          className="w-full text-sm border rounded-md px-3 py-2 bg-background"
                        >
                          {providers.map(provider => (
                            <option key={provider} value={provider}>
                              {provider === 'all' ? '全部' : provider}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block">输入模态</label>
                        <div className="grid grid-cols-2 gap-2">
                          {['文本', '图片', '音频', '视频'].map(modality => (
                            <label key={modality} className="flex items-center gap-2 text-sm">
                              <input type="checkbox" className="rounded" />
                              {modality}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block">输出模态</label>
                        <div className="grid grid-cols-2 gap-2">
                          {['文本', '图片', '嵌入'].map(modality => (
                            <label key={modality} className="flex items-center gap-2 text-sm">
                              <input type="checkbox" className="rounded" />
                              {modality}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block">上下文长度</label>
                        <div className="grid grid-cols-2 gap-2">
                          {['< 32K', '32K - 128K', '128K - 1M', '> 1M'].map(range => (
                            <label key={range} className="flex items-center gap-2 text-sm">
                              <input type="checkbox" className="rounded" />
                              {range}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block">分类</label>
                        <div className="grid grid-cols-2 gap-2">
                          {['推理', '编程', '多模态', '嵌入'].map(category => (
                            <label key={category} className="flex items-center gap-2 text-sm">
                              <input type="checkbox" className="rounded" />
                              {category}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 模型数量 */}
            <div className="mb-6">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full"
              >
                <span className="text-sm text-muted-foreground">共</span>
                <span className="text-lg font-bold text-primary">{filteredModels.length}</span>
                <span className="text-sm text-muted-foreground">个模型</span>
              </motion.div>
            </div>

            {/* 加载状态 */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-20">
                <LoadingSpinner className="h-12 w-12 mb-4" />
                <p className="text-muted-foreground">加载模型中...</p>
              </div>
            )}

            {/* 错误状态 */}
            {error && (
              <div className="flex flex-col items-center justify-center py-20">
                <p className="text-destructive text-lg mb-4">{error}</p>
                <Button onClick={fetchModels}>重试</Button>
              </div>
            )}

            {/* 模型列表 */}
            {!isLoading && !error && (
              <>
                {sortedModels.length === 0 ? (
                  <div className="text-center py-20">
                    <p className="text-muted-foreground text-lg">没有找到匹配的模型</p>
                    {hasActiveFilters && (
                      <Button onClick={clearFilters} className="mt-4">
                        清除筛选
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6' : 'space-y-4'}>
                    {sortedModels.map((model, index) => (
                      <motion.div
                        key={model.model_name || index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index * 0.03, 0.5), duration: 0.4 }}
                        whileHover={{ y: -6, scale: 1.02 }}
                        className="cursor-pointer"
                        onClick={() => setSelectedModel(model)}
                      >
                        <Card className="h-full border hover:border-primary/50 transition-all duration-300 hover:shadow-xl bg-gradient-to-br from-card to-card/50">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <motion.div
                                  className="text-3xl"
                                  whileHover={{ rotate: 360 }}
                                  transition={{ duration: 0.6 }}
                                >
                                  {getModelLogo(model.icon)}
                                </motion.div>
                                <CardTitle className="text-base font-semibold line-clamp-1">
                                  {model.model_name}
                                </CardTitle>
                              </div>
                            </div>
                            <CardDescription className="text-xs line-clamp-2 mt-2 text-muted-foreground/80">
                              {model.description || '暂无描述'}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="flex items-center gap-3 text-xs mb-3">
                              <div className="flex items-center gap-1 px-2 py-1 bg-primary/5 rounded-full">
                                <Globe className="w-3 h-3 text-primary" />
                                <span className="text-primary/80 font-medium">{model.vendor_name || model.icon || '未知'}</span>
                              </div>
                              <Badge variant="outline" className="text-xs px-2 py-0.5">
                                {model.quota_type === 1 ? '按次计费' : model.quota_type === 0 ? '按量计费' : '未知'}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between text-xs p-2 bg-muted/30 rounded-lg">
                              {(() => {
                                const priceData = calculateModelPrice(model);
                                if (priceData.isPerToken) {
                                  return (
                                    <>
                                      <div className="flex items-center gap-1">
                                        <DollarSign className="w-3 h-3 text-green-500" />
                                        <span className="font-semibold text-green-600 dark:text-green-400">
                                          ${priceData.inputPrice.toFixed(4)}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Zap className="w-3 h-3 text-yellow-500" />
                                        <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                                          ${priceData.completionPrice.toFixed(4)}
                                        </span>
                                      </div>
                                    </>
                                  );
                                } else {
                                  return (
                                    <div className="flex items-center gap-1 w-full justify-center">
                                      <DollarSign className="w-3 h-3 text-green-500" />
                                      <span className="font-semibold text-green-600 dark:text-green-400">
                                        ${priceData.price.toFixed(4)}
                                      </span>
                                    </div>
                                  );
                                }
                              })()}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-3">
                              {parseTags(model.tags).slice(0, 3).map((tag, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs px-2 py-0.5 bg-primary/10 text-primary/80 hover:bg-primary/20 transition-colors">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 模型详情对话框 */}
      <Dialog open={!!selectedModel} onOpenChange={() => setSelectedModel(null)}>
        <DialogContent className="max-w-2xl">
          {selectedModel && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-4 mb-2">
                  <span className="text-5xl">{getModelLogo(selectedModel.icon)}</span>
                  <div>
                    <DialogTitle className="text-2xl">{selectedModel.model_name}</DialogTitle>
                    <DialogDescription className="flex items-center gap-2 mt-1">
                      <Globe className="w-4 h-4" />
                      {selectedModel.icon || '未知'}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-2">模型描述</h4>
                  <p className="text-muted-foreground">{selectedModel.description || '暂无描述'}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-primary/5">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-5 h-5 text-green-500" />
                      <span className="font-semibold">价格</span>
                    </div>
                    <p className="text-2xl font-bold">{formatPrice(selectedModel.model_price, selectedModel.model_ratio)}</p>
                    <p className="text-sm text-muted-foreground">每 1K tokens 或倍率</p>
                  </div>
                  <div className="p-4 rounded-lg bg-primary/5">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-5 h-5 text-yellow-500" />
                      <span className="font-semibold">完成倍率</span>
                    </div>
                    <p className="text-2xl font-bold">{selectedModel.completion_ratio || 0}x</p>
                    <p className="text-sm text-muted-foreground">输出倍率</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">标签</h4>
                  <div className="flex flex-wrap gap-2">
                    {parseTags(selectedModel.tags).map((tag, idx) => (
                      <Badge key={idx} variant="default" className="text-sm px-3 py-1">
                        {tag}
                      </Badge>
                    )) || <span className="text-sm text-muted-foreground">暂无标签</span>}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
