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
import {
  AlertTriangle,
  Activity,
  Bell,
  Bolt,
  Bookmark,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CirclePlus,
  Clock3,
  Code2,
  Copy,
  CreditCard,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  File,
  Filter,
  Github,
  Globe,
  HelpCircle,
  Info,
  Key,
  Layers,
  Link2,
  Lock,
  Mail,
  Menu,
  Minus,
  MoreHorizontal,
  Play,
  Plus,
  Power,
  RefreshCw,
  Save,
  Search,
  Tag as TagIcon,
  Send,
  Server,
  Settings,
  Shield,
  SquareChevronDown,
  Trash2,
  User,
  UserCog,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';

// Semi UI icons accepted string size keywords ("small" | "default" | "large"
// | "extra-large"). lucide-react expects a number — passing the string makes
// it serialize as the literal width/height attribute, blowing the icon up
// to render at e.g. 600+ pixels. Map keywords to sensible pixel sizes.
const ICON_SIZE_MAP = {
  small: 14,
  default: 16,
  middle: 16,
  medium: 18,
  large: 20,
  'extra-large': 24,
  xl: 24,
};

const resolveIconSize = (size) => {
  if (typeof size === 'number') return size;
  if (typeof size === 'string') {
    return ICON_SIZE_MAP[size] ?? 16;
  }
  return 16;
};

const withIcon = (Component) =>
  function SemiIcon({ size = 16, style, ...props }) {
    return <Component size={resolveIconSize(size)} style={style} {...props} />;
  };

export const IconSearch = withIcon(Search);
export const IconDelete = withIcon(Trash2);
export const IconPlus = withIcon(Plus);
export const IconClose = withIcon(X);
export const IconCopy = withIcon(Copy);
export const IconSave = withIcon(Save);
export const IconSaveStroked = withIcon(Save);
export const IconMail = withIcon(Mail);
export const IconKey = withIcon(Key);
export const IconAlertTriangle = withIcon(AlertTriangle);
export const IconChevronDown = withIcon(ChevronDown);
export const IconChevronUp = withIcon(ChevronUp);
export const IconRefresh = withIcon(RefreshCw);
export const IconLink = withIcon(Link2);
export const IconLock = withIcon(Lock);
export const IconGithubLogo = withIcon(Github);
export const IconUser = withIcon(User);
export const IconCreditCard = withIcon(CreditCard);
export const IconEdit = withIcon(Edit3);
export const IconHelpCircle = withIcon(HelpCircle);
export const IconEyeOpened = withIcon(Eye);
export const IconEyeClosed = withIcon(EyeOff);
export const IconMore = withIcon(MoreHorizontal);
export const IconCode = withIcon(Code2);
export const IconInfoCircle = withIcon(Info);
export const IconMinus = withIcon(Minus);
export const IconMenu = withIcon(Menu);
export const IconFile = withIcon(File);
export const IconShield = withIcon(Shield);
export const IconTreeTriangleDown = withIcon(SquareChevronDown);
export const IconSetting = withIcon(Settings);
export const IconBolt = withIcon(Bolt);
export const IconDownload = withIcon(Download);
export const IconCoinMoneyStroked = withIcon(Wallet);
export const IconMoneyExchangeStroked = withIcon(Wallet);
export const IconPriceTag = withIcon(TagIcon);
export const IconLayers = withIcon(Layers);
export const IconGift = withIcon(CirclePlus);
export const IconExternalOpen = withIcon(ExternalLink);
export const IconUserAdd = withIcon(UserPlus);
export const IconExit = withIcon(Power);
export const IconUserSetting = withIcon(UserCog);
export const IconBell = withIcon(Bell);
export const IconCheckCircleStroked = withIcon(CheckCircle2);
export const IconServer = withIcon(Server);
export const IconGlobe = withIcon(Globe);
export const IconBookmark = withIcon(Bookmark);
export const IconFilter = withIcon(Filter);
export const IconCalendarClock = withIcon(CalendarClock);
export const IconUserGroup = withIcon(Users);
export const IconPlusCircle = withIcon(CirclePlus);
export const IconHistogram = withIcon(Activity);
export const IconTextStroked = withIcon(File);
export const IconPulse = withIcon(Activity);
export const IconStopwatchStroked = withIcon(Clock3);
export const IconTypograph = withIcon(File);
export const IconSend = withIcon(Send);
export const IconPlay = withIcon(Play);
