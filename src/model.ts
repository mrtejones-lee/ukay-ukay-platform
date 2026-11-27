import { demoProducts, demoShops } from '../shared/catalog.mjs'

export type Tithe = { enabled: boolean; rate: number; basis: 'net' | 'gross' | 'sales'; adjustment: number; summary: boolean }
export type Shop = { id: string; name: string; location: string; description: string; avatar: string; cover: string; contact?: string; social?: string; pin?: string; published: boolean; suspended?: boolean; paidUntil?: string; createdAt?: string; tithe?: Tithe; demo?: boolean }
export type Product = { id: string; name: string; brand: string; price: number; oldPrice?: number; category: string; condition: string; shopId: string; size: string; badge?: string; description: string; images: string[]; defects: string; tags?: string; type: string; kind: string; quantity: number; purchased?: number; cost?: number; status?: string; popularity?: number; demo?: boolean; createdAt?: string }
export type Status = 'Pending' | 'Successful' | 'Failed' | 'Refunded'
export type Sale = { item: { listingId: string; shopId?: string; name: string; brand: string; type: string; price: number; cost: number; quantity: number }; order: { id: string; customerId: string; customerName: string; status: Status; createdAt: string; method: string } }
export type Expense = { id: string; name: string; amount: number; date: string; listingId?: string | null }
export type Order = { id: string; customerName: string; status: Status; method: string; createdAt: string; delivery: { address: string; phone: string }; items: { id: string; name: string; price: number; quantity: number }[] }
export type SellerData = { shop: Shop | null; products: Product[]; sales: Sale[]; expenses: Expense[] }
export type Navigate = (path: string) => void

export const sampleShops = demoShops
export const sampleProducts = demoProducts
export const money = (value: number) => `₱${value.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`
export const shortDate = (date: string) => new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }).format(new Date(date))
const manilaDay = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' })
export const localDay = (value: Date = new Date()) => manilaDay.format(value)
export const photo = (path: string, width = 640) => path?.startsWith('/img/') ? `/.netlify/images?url=${encodeURIComponent(path)}&w=${width}&fm=webp` : path
export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase()
export const emptyTithe: Tithe = { enabled: false, rate: 0, basis: 'net', adjustment: 0, summary: false }

export async function api<Value>(path: string, method = 'GET', body?: unknown): Promise<Value> {
  const response = await fetch(`/api${path}`, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': body instanceof File ? body.type : 'application/json' } : undefined, body: body instanceof File ? body : body ? JSON.stringify(body) : undefined })
  const data = await response.json().catch(() => null)
  if (!response.ok || data === null) throw new Error(data?.error || 'That request could not be completed. Please try again.')
  return data as Value
}

export function statusFor(shop: Shop) {
  if (!shop.paidUntil) return { label: 'Free Trial', public: shop.published, retention: '' }
  const due = new Date(shop.paidUntil)
  const now = Date.now()
  const days = Math.ceil((due.getTime() - now) / 86400000)
  const eligible = new Date(due)
  const originalDay = eligible.getUTCDate()
  eligible.setUTCDate(1)
  eligible.setUTCMonth(eligible.getUTCMonth() + 3)
  eligible.setUTCDate(Math.min(originalDay, new Date(Date.UTC(eligible.getUTCFullYear(), eligible.getUTCMonth() + 1, 0)).getUTCDate()))
  const retention = due.getTime() <= now ? (eligible.getTime() <= now ? 'Eligible for retention review' : `Eligible for retention review on ${shortDate(eligible.toISOString())}`) : ''
  const trial = shop.createdAt && due.getTime() - new Date(shop.createdAt).getTime() < 33 * 86400000
  return { label: days <= 0 && due.getTime() <= now ? 'Expired' : days <= 7 ? 'Payment Due' : trial ? 'Free Trial' : 'Active', public: shop.published && !shop.suspended && due.getTime() > now, retention }
}

export function totals(sales: Sale[], expenses: Expense[]) {
  const paid = sales.filter(({ order }) => order.status === 'Successful')
  const revenue = paid.reduce((total, { item }) => total + item.price * item.quantity, 0)
  const cost = paid.reduce((total, { item }) => total + item.cost * item.quantity, 0)
  const units = paid.reduce((total, { item }) => total + item.quantity, 0)
  const additional = expenses.reduce((total, expense) => total + expense.amount, 0)
  const gross = revenue - cost
  const net = gross - additional
  return { paid, revenue, cost, units, additional, gross, net, margin: revenue ? net / revenue * 100 : 0 }
}

export function titheTotal(tithe: Tithe, summary: ReturnType<typeof totals>) {
  const base = tithe.basis === 'sales' ? summary.revenue : tithe.basis === 'gross' ? summary.gross : summary.net
  return Math.max(0, Math.round((Math.max(0, base) * tithe.rate / 100 + tithe.adjustment) * 100) / 100)
}
