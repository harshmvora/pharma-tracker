import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import type { Project, DevPhase, Task, SourcingItem } from './types'

// Tailwind class helper
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Date helpers ──────────────────────────────────────────────
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try { return format(parseISO(iso), 'd MMM yyyy') } catch { return iso }
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  try { return differenceInCalendarDays(parseISO(iso), new Date()) } catch { return null }
}

export function dueDateLabel(iso: string | null | undefined): { label: string; cls: string } {
  const d = daysUntil(iso)
  if (d === null) return { label: 'No due date', cls: 'text-gray-400' }
  if (d < 0)  return { label: `${Math.abs(d)}d overdue`, cls: 'text-red-600 font-medium' }
  if (d === 0) return { label: 'Due today',               cls: 'text-orange-500 font-medium' }
  if (d <= 7)  return { label: `${d}d left`,              cls: 'text-amber-500 font-medium' }
  return { label: formatDate(iso), cls: 'text-gray-500' }
}

// ── Progress calculation ───────────────────────────────────────
export function calcProgress(
  project: Project & {
    sourcing_items?: SourcingItem[]
    dev_phases?: DevPhase[]
    tasks?: Task[]
  }
): number {
  if (project.type === 'sourcing') {
    const items = project.sourcing_items ?? []
    if (!items.length) return 0
    const done = items.filter(i => i.status === 'sourced').length
    return Math.round((done / items.length) * 100)
  }
  if (project.type === 'development') {
    const allTasks = (project.dev_phases ?? []).flatMap(p => p.tasks ?? [])
    if (!allTasks.length) return 0
    return Math.round((allTasks.filter(t => t.done).length / allTasks.length) * 100)
  }
  if (project.type === 'general') {
    const tasks = project.tasks ?? []
    if (!tasks.length) return 0
    return Math.round((tasks.filter(t => t.done).length / tasks.length) * 100)
  }
  return 0
}

// ── Currency formatting ────────────────────────────────────────
const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED ',
  CNY: '¥', JPY: '¥', SGD: 'S$', AUD: 'A$', CAD: 'C$',
}

export function formatPrice(price: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency.toUpperCase()] ?? `${currency} `
  return `${sym}${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
}

// ── Misc ───────────────────────────────────────────────────────
export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'CNY', 'SGD', 'AUD', 'CAD']

export const DOSAGE_FORMS = [
  'Tablet', 'Capsule', 'Syrup', 'Suspension', 'Injection', 'Cream',
  'Ointment', 'Gel', 'Drops', 'Inhaler', 'Patch', 'Powder', 'Granules', 'Other',
]

export const CATEGORIES = [
  'Human Pharma', 'Veterinary', 'Protein / Nutraceutical', 'OTC', 'Cosmetics', 'Other',
]
