import { ReactNode } from 'react'

interface Props {
  title:    string
  subtitle?: string
  actions?: ReactNode
}

export default function TopBar({ title, subtitle, actions }: Props) {
  return (
    <div className="h-14 bg-white border-b border-gray-200 flex items-center px-6 gap-4 flex-shrink-0">
      <div className="flex-1 min-w-0">
        <h1 className="text-base font-semibold text-gray-900 truncate">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
