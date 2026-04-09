import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react'
import { cn } from '../../lib/utils'

const BASE = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition'

// ── Input ─────────────────────────────────────────────────────
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(BASE, className)} {...props} />
  )
)
Input.displayName = 'Input'

// ── Select ────────────────────────────────────────────────────
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(BASE, 'cursor-pointer', className)} {...props}>
      {children}
    </select>
  )
)
Select.displayName = 'Select'

// ── Textarea ──────────────────────────────────────────────────
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} rows={3} className={cn(BASE, 'resize-y', className)} {...props} />
  )
)
Textarea.displayName = 'Textarea'

// ── FormGroup ─────────────────────────────────────────────────
interface FormGroupProps {
  label:    string
  required?: boolean
  children: React.ReactNode
  className?: string
}
export function FormGroup({ label, required, children, className }: FormGroupProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label className="text-sm font-medium text-gray-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

// ── FormRow (2-column) ────────────────────────────────────────
export function FormRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-2 gap-3', className)}>{children}</div>
}
