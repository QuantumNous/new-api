import {
  Zap,
  Shield,
  Globe,
  Code,
  Gauge,
  DollarSign,
  Users,
  HeartHandshake,
  type LucideIcon,
} from 'lucide-react'

/**
 * Map of icon names to Lucide icon components
 */
const ICON_MAP: Record<string, LucideIcon> = {
  Zap,
  Shield,
  Globe,
  Code,
  Gauge,
  DollarSign,
  Users,
  HeartHandshake,
}

/**
 * Get a Lucide icon component by name
 */
export function getFeatureIcon(
  iconName: string,
  className?: string
): React.ReactNode {
  const Icon = ICON_MAP[iconName]
  if (!Icon) {
    // eslint-disable-next-line no-console
    console.warn(`Icon "${iconName}" not found in icon map`)
    return null
  }
  return <Icon className={className} />
}
