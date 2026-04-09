import { cn } from '../../lib/utils'
import type { Priority, ProjectStatus, ProjectType, PhaseStatus, SourcingStatus } from '../../lib/types'

type BadgeVariant = ProjectType | ProjectStatus | Priority | PhaseStatus | SourcingStatus | 'neutral'

const STYLES: Partial<Record<BadgeVariant, string>> = {
  // project types
  sourcing:     'bg-blue-50 text-blue-700',
  development:  'bg-emerald-50 text-emerald-700',
  general:      'bg-violet-50 text-violet-700',
  // status
  planning:     'bg-sky-50 text-sky-700',
  active:       'bg-green-50 text-green-700',
  'on-hold':    'bg-amber-50 text-amber-700',
  completed:    'bg-gray-100 text-gray-500',
  // priority
  high:         'bg-red-50 text-red-600',
  medium:       'bg-amber-50 text-amber-600',
  low:          'bg-gray-100 text-gray-500',
  // phase status
  planned:      'bg-sky-50 text-sky-700',
  'in-progress':'bg-blue-50 text-blue-700',
  // sourcing status
  pending:      'bg-gray-100 text-gray-500',
  sampled:      'bg-yellow-50 text-yellow-700',
  approved:     'bg-green-50 text-green-700',
  sourced:      'bg-brand-50 text-brand-700',
  blocked:      'bg-red-50 text-red-600',
  // fallback
  neutral:      'bg-gray-100 text-gray-600',
}

interface Props {
  variant?: BadgeVariant
  className?: string
  children: React.ReactNode
}

export default function Badge({ variant = 'neutral', className, children }: Props) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
      STYLES[variant] ?? STYLES.neutral,
      className,
    )}>
      {children}
    </span>
  )
}

// Convenient label helpers
export const typeLabel = (t: ProjectType) => ({ sourcing: 'Sourcing', development: 'Development', general: 'General' }[t])
export const statusLabel = (s: ProjectStatus) => s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')
export const priorityLabel = (p: Priority) => p.charAt(0).toUpperCase() + p.slice(1)
