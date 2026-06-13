import type { Locale } from "./locales";

type Copy = {
  nav: {
    pricing: string;
    modelPricing: string;
    home: string;
    console: string;
    rankings: string;
    blog: string;
    about: string;
    app: string;
    signIn: string;
    toggle: string;
    toggleTheme: string;
    light: string;
    dark: string;
    system: string;
    notifications: string;
    systemAnnouncements: string;
    latestPlatformUpdates: string;
    notice: string;
    timeline: string;
    noAnnouncements: string;
    noSystemAnnouncements: string;
    loading: string;
    close: string;
  };
  home: {
    title: string;
    description: string;
    primary: string;
    secondary: string;
  };
};

const copies: Record<Locale, Copy> = {
  en: {
    nav: {
      pricing: "Pricing",
      modelPricing: "Model Pricing",
      home: "Home",
      console: "Console",
      rankings: "Rankings",
      blog: "Blog",
      about: "About",
      app: "Open app",
      signIn: "Sign in",
      toggle: "Toggle navigation menu",
      toggleTheme: "Toggle theme",
      light: "Light",
      dark: "Dark",
      system: "System",
      notifications: "Notifications",
      systemAnnouncements: "System Announcements",
      latestPlatformUpdates: "Latest platform updates and notices",
      notice: "Notice",
      timeline: "Timeline",
      noAnnouncements: "No announcements at this time",
      noSystemAnnouncements: "No system announcements",
      loading: "Loading...",
      close: "Close",
    },
    home: {
      title: "One API gateway for production AI teams",
      description:
        "flatkey.ai unifies model access, routing, billing, usage analytics, and operational controls for teams shipping AI products.",
      primary: "View pricing",
      secondary: "Read the blog",
    },
  },
  zh: {
    nav: {
      pricing: "价格",
      modelPricing: "模型定价",
      home: "主页",
      console: "控制台",
      rankings: "排行",
      blog: "博客",
      about: "关于",
      app: "打开应用",
      signIn: "登录",
      toggle: "切换导航菜单",
      toggleTheme: "切换主题",
      light: "浅色",
      dark: "深色",
      system: "跟随系统",
      notifications: "通知",
      systemAnnouncements: "系统公告",
      latestPlatformUpdates: "最新平台更新和通知",
      notice: "通知",
      timeline: "时间线",
      noAnnouncements: "目前暂无公告",
      noSystemAnnouncements: "暂无系统公告",
      loading: "加载中...",
      close: "关闭",
    },
    home: {
      title: "面向生产团队的一站式 AI API 网关",
      description: "flatkey.ai 统一模型接入、路由、计费、用量分析和运营控制，帮助团队稳定交付 AI 产品。",
      primary: "查看价格",
      secondary: "阅读博客",
    },
  },
  es: {
    nav: {
      pricing: "Precios",
      modelPricing: "Precios de modelos",
      home: "Inicio",
      console: "Consola",
      rankings: "Rankings",
      blog: "Blog",
      about: "Acerca de",
      app: "Abrir app",
      signIn: "Iniciar sesión",
      toggle: "Alternar menú de navegación",
      toggleTheme: "Cambiar tema",
      light: "Claro",
      dark: "Oscuro",
      system: "Sistema",
      notifications: "Notificaciones",
      systemAnnouncements: "Anuncios del sistema",
      latestPlatformUpdates: "Últimas actualizaciones y avisos de la plataforma",
      notice: "Aviso",
      timeline: "Cronología",
      noAnnouncements: "No hay anuncios por ahora",
      noSystemAnnouncements: "No hay anuncios del sistema",
      loading: "Cargando...",
      close: "Cerrar",
    },
    home: {
      title: "Una puerta de enlace API para equipos de IA en producción",
      description:
        "flatkey.ai unifica acceso a modelos, enrutamiento, facturación, analítica de uso y controles operativos.",
      primary: "Ver precios",
      secondary: "Leer el blog",
    },
  },
  fr: {
    nav: {
      pricing: "Tarifs",
      modelPricing: "Tarifs des modèles",
      home: "Accueil",
      console: "Console",
      rankings: "Classements",
      blog: "Blog",
      about: "À propos",
      app: "Ouvrir l'app",
      signIn: "Se connecter",
      toggle: "Basculer le menu de navigation",
      toggleTheme: "Changer le thème",
      light: "Clair",
      dark: "Sombre",
      system: "Système",
      notifications: "Notifications",
      systemAnnouncements: "Annonces système",
      latestPlatformUpdates: "Dernières mises à jour et avis de la plateforme",
      notice: "Avis",
      timeline: "Chronologie",
      noAnnouncements: "Aucune annonce pour le moment",
      noSystemAnnouncements: "Aucune annonce système",
      loading: "Chargement...",
      close: "Fermer",
    },
    home: {
      title: "Une passerelle API pour les équipes IA en production",
      description:
        "flatkey.ai unifie l'accès aux modèles, le routage, la facturation, l'analyse d'usage et les contrôles opérationnels.",
      primary: "Voir les tarifs",
      secondary: "Lire le blog",
    },
  },
  pt: {
    nav: {
      pricing: "Preços",
      modelPricing: "Preços dos modelos",
      home: "Início",
      console: "Console",
      rankings: "Rankings",
      blog: "Blog",
      about: "Sobre",
      app: "Abrir app",
      signIn: "Entrar",
      toggle: "Alternar menu de navegação",
      toggleTheme: "Alternar tema",
      light: "Claro",
      dark: "Escuro",
      system: "Sistema",
      notifications: "Notificações",
      systemAnnouncements: "Anúncios do sistema",
      latestPlatformUpdates: "Últimas atualizações e avisos da plataforma",
      notice: "Aviso",
      timeline: "Linha do tempo",
      noAnnouncements: "Nenhum anúncio no momento",
      noSystemAnnouncements: "Nenhum anúncio do sistema",
      loading: "Carregando...",
      close: "Fechar",
    },
    home: {
      title: "Um gateway de API para equipes de IA em produção",
      description:
        "flatkey.ai unifica acesso a modelos, roteamento, cobrança, análise de uso e controles operacionais.",
      primary: "Ver preços",
      secondary: "Ler o blog",
    },
  },
  ru: {
    nav: {
      pricing: "Цены",
      modelPricing: "Цены моделей",
      home: "Главная",
      console: "Консоль",
      rankings: "Рейтинги",
      blog: "Блог",
      about: "О нас",
      app: "Открыть приложение",
      signIn: "Войти",
      toggle: "Переключить меню навигации",
      toggleTheme: "Переключить тему",
      light: "Светлая",
      dark: "Темная",
      system: "Системная",
      notifications: "Уведомления",
      systemAnnouncements: "Системные объявления",
      latestPlatformUpdates: "Последние обновления и уведомления платформы",
      notice: "Уведомление",
      timeline: "Хронология",
      noAnnouncements: "Сейчас нет объявлений",
      noSystemAnnouncements: "Нет системных объявлений",
      loading: "Загрузка...",
      close: "Закрыть",
    },
    home: {
      title: "Единый API-шлюз для AI-команд в продакшене",
      description:
        "flatkey.ai объединяет доступ к моделям, маршрутизацию, биллинг, аналитику использования и операционный контроль.",
      primary: "Смотреть цены",
      secondary: "Читать блог",
    },
  },
  ja: {
    nav: {
      pricing: "料金",
      modelPricing: "モデル料金",
      home: "ホーム",
      console: "コンソール",
      rankings: "ランキング",
      blog: "ブログ",
      about: "概要",
      app: "アプリを開く",
      signIn: "ログイン",
      toggle: "ナビゲーションメニューを切り替え",
      toggleTheme: "テーマを切り替え",
      light: "ライト",
      dark: "ダーク",
      system: "システム",
      notifications: "通知",
      systemAnnouncements: "システムのお知らせ",
      latestPlatformUpdates: "最新のプラットフォーム更新と通知",
      notice: "通知",
      timeline: "タイムライン",
      noAnnouncements: "現在お知らせはありません",
      noSystemAnnouncements: "システムのお知らせはありません",
      loading: "読み込み中...",
      close: "閉じる",
    },
    home: {
      title: "本番 AI チームのための API ゲートウェイ",
      description:
        "flatkey.ai はモデル接続、ルーティング、課金、利用分析、運用管理を一つにまとめます。",
      primary: "料金を見る",
      secondary: "ブログを読む",
    },
  },
  vi: {
    nav: {
      pricing: "Giá",
      modelPricing: "Giá mô hình",
      home: "Trang chủ",
      console: "Bảng điều khiển",
      rankings: "Xếp hạng",
      blog: "Blog",
      about: "Giới thiệu",
      app: "Mở ứng dụng",
      signIn: "Đăng nhập",
      toggle: "Bật/tắt menu điều hướng",
      toggleTheme: "Đổi giao diện",
      light: "Sáng",
      dark: "Tối",
      system: "Hệ thống",
      notifications: "Thông báo",
      systemAnnouncements: "Thông báo hệ thống",
      latestPlatformUpdates: "Cập nhật và thông báo mới nhất của nền tảng",
      notice: "Thông báo",
      timeline: "Dòng thời gian",
      noAnnouncements: "Hiện chưa có thông báo",
      noSystemAnnouncements: "Không có thông báo hệ thống",
      loading: "Đang tải...",
      close: "Đóng",
    },
    home: {
      title: "Một cổng API cho đội ngũ AI vận hành sản phẩm",
      description:
        "flatkey.ai hợp nhất truy cập mô hình, định tuyến, tính phí, phân tích sử dụng và kiểm soát vận hành.",
      primary: "Xem giá",
      secondary: "Đọc blog",
    },
  },
};

export function getCopy(locale: Locale): Copy {
  return copies[locale] ?? copies.en;
}
