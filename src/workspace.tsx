import { useEffect, useState, type ReactNode } from 'react'
import type { User } from '@netlify/identity'
import { Activity, ArrowLeft, ArrowRight, BarChart3, CalendarDays, CircleDollarSign, ClipboardList, CreditCard, Eye, LayoutDashboard, MapPin, Package, Plus, Settings, ShoppingBag, Store, TrendingUp, Users, Wallet } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, emptyTithe, localDay, money, shortDate, statusFor, titheTotal, totals, type Expense, type Navigate, type Product, type Sale, type SellerData, type Shop, type Tithe } from './model'
import { Asset, Avatar, Empty, Link, Logo, Modal, Pill, statusTone } from './ui'
import { ExpenseEditor, ListingEditor, SaleEditor, ShopEditor, type ManualSale } from './workspace-forms'
import { makeDemoAdmin, makeDemoSeller, type AdminData } from './workspace-data'

const sellerNav = [['overview', 'Overview', LayoutDashboard], ['products', 'Products & Inventory', Package], ['orders', 'Orders & Sales', ClipboardList], ['finances', 'Financial Management', Wallet], ['insights', 'Business Insights', BarChart3], ['customers', 'Customers', Users], ['customization', 'Shop Customization', Store], ['subscription', 'Subscription & Billing', CreditCard], ['settings', 'Settings', Settings]] as const
const adminNav = [['overview', 'Overview', LayoutDashboard], ['sellers', 'Sellers', Users], ['customers', 'Customers', Users], ['shops', 'Shops', Store], ['transactions', 'Transactions', ClipboardList], ['subscriptions', 'Subscriptions', CreditCard], ['reports', 'Reports', BarChart3], ['settings', 'Settings', Settings]] as const
type Notify = (message: string) => void
type WorkspaceProps = { page: string; demo: boolean; go: Navigate; user: User | null; loaded: boolean; auth: () => void; notify: Notify; refresh: () => void }
const pageCopy: Record<string, string> = { overview: 'A clear picture of how things are going.', products: 'Manage individual finds, bundles, and stock in one place.', orders: 'Track test orders and their payment status.', finances: 'See what you earned, what you spent, and what’s left.', insights: 'Compare sales, profitability, and the customers who keep coming back.', customers: 'A private view of the customers who purchased from this shop.', customization: 'Shape how shoppers see your business.', subscription: 'Manage your trial, billing, and storefront visibility.', settings: 'Manage access and workspace preferences.' }

function Shell({ role, page, demo, go, children }: { role: 'seller' | 'admin'; page: string; demo: boolean; go: Navigate; children: ReactNode }) {
  const entries = role === 'seller' ? sellerNav : adminNav
  const title = entries.find(entry => entry[0] === page)?.[1] || 'Overview'
  return <div className="workspace"><aside className="workspace-sidebar"><Logo go={go} /><span className="workspace-tag">{role === 'seller' ? 'SELLER STUDIO' : 'ADMIN CONSOLE'}</span><nav aria-label={`${role} navigation`}>{entries.map(([id, label, Icon]) => <Link key={id} to={`/${role}/${id}${demo ? '?demo=1' : ''}`} go={go} className={id === page ? 'active' : ''}><Icon size={18} /> {label}</Link>)}</nav><Link className="workspace-back" to="/" go={go}><ArrowLeft size={16} /> Back to marketplace</Link></aside><main className="workspace-main"><div className="workspace-top"><span><Link to="/" go={go}>UkayLoop</Link> <span className="crumb-divider">/</span> {title}</span><div className="cluster">{demo && <><Pill tone="warning">Demo workspace</Pill><Link className="text-btn" to={`/${role}/overview`} go={go}>Exit demo</Link></>}</div></div><div className="workspace-content">{children}</div></main></div>
}

function WorkspaceTitle({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return <div className="workspace-title"><div><span className="eyebrow"><Activity size={14} /> WORKSPACE</span><h1>{title}</h1><p>{description}</p></div>{actions}</div>
}

function Metrics({ items }: { items: { label: string; value: string | number; detail: string; icon?: typeof Wallet }[] }) {
  return <div className="metrics">{items.map(({ label, value, detail, icon: Icon = CircleDollarSign }) => <article className="metric" key={label}><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={17} /></span></div><strong>{value}</strong><small>{detail}</small></article>)}</div>
}

function Table({ headings, rows, empty }: { headings: string[]; rows: { key: string; cells: ReactNode[] }[]; empty: string }) {
  return rows.length ? <div className="table-scroll"><table><thead><tr>{headings.map((heading, index) => <th key={`${heading}-${index}`}>{heading}</th>)}</tr></thead><tbody>{rows.map(({ key, cells }) => <tr key={key}>{cells.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody></table></div> : <div className="table-empty"><Package size={20} /><span>{empty}</span></div>
}

type ChartRow = { date: string; Revenue: number; Expenses: number; Profit: number }

function chartRows(sales: Sale[], expenses: Expense[], range: { start: string; end: string }): ChartRow[] {
  const first = [...sales.map(sale => localDay(new Date(sale.order.createdAt))), ...expenses.map(expense => expense.date)].sort()[0]
  const start = new Date(`${range.start || first || localDay(new Date(Date.now() - 150 * 86400000))}T00:00:00Z`)
  const end = new Date(`${range.end || localDay()}T00:00:00Z`)
  const span = Math.round((end.getTime() - start.getTime()) / 86400000)
  if (span < 0 || Number.isNaN(span)) return []
  const step = Math.max(1, Math.ceil((span + 1) / 8))
  return Array.from({ length: Math.ceil((span + 1) / step) }, (_, index) => {
    const from = new Date(start.getTime() + index * step * 86400000).toISOString().slice(0, 10)
    const to = new Date(start.getTime() + (index + 1) * step * 86400000).toISOString().slice(0, 10)
    const summary = totals(sales.filter(sale => { const date = localDay(new Date(sale.order.createdAt)); return date >= from && date < to }), expenses.filter(expense => expense.date >= from && expense.date < to))
    return { date: from.slice(5).replace('-', '/'), Revenue: summary.revenue, Expenses: summary.cost + summary.additional, Profit: summary.net }
  })
}

function monthRows(sales: Sale[], expenses: Expense[], range: { end: string }): ChartRow[] {
  const limit = new Date(`${range.end || localDay()}T00:00:00Z`)
  if (!Number.isFinite(limit.getTime())) return []
  return Array.from({ length: 6 }, (_, index) => {
    const month = new Date(Date.UTC(limit.getUTCFullYear(), limit.getUTCMonth() - 5 + index, 1))
    const key = month.toISOString().slice(0, 7)
    const summary = totals(sales.filter(sale => localDay(new Date(sale.order.createdAt)).startsWith(key)), expenses.filter(expense => expense.date.startsWith(key)))
    return { date: new Intl.DateTimeFormat('en-PH', { month: 'short', timeZone: 'UTC' }).format(month), Revenue: summary.revenue, Expenses: summary.cost + summary.additional, Profit: summary.net }
  })
}

function Trend({ data, bars = false }: { data: ChartRow[]; bars?: boolean }) {
  const axis = { fontSize: 11, fill: '#697d74' }
  const tooltip = (value: number | string | readonly (number | string)[] | undefined) => money(Number(value ?? 0))
  return <div className="chart" role="img" aria-label="Revenue, expenses and profit in Philippine pesos by period start date"><ResponsiveContainer width="100%" height="100%" minWidth={0}>{bars ? <BarChart data={data} margin={{ left: 0, top: 12, right: 10, bottom: 5 }}><CartesianGrid stroke="#e8f0ec" vertical={false} /><XAxis dataKey="date" tick={axis} axisLine={false} tickLine={false} /><YAxis tick={axis} tickFormatter={value => `₱${value}`} width={57} axisLine={false} tickLine={false} /><Tooltip formatter={tooltip} /><Legend /><Bar dataKey="Revenue" fill="#286f5a" radius={[4, 4, 0, 0]} /><Bar dataKey="Expenses" fill="#d1ad78" radius={[4, 4, 0, 0]} /><Bar dataKey="Profit" fill="#80bca9" radius={[4, 4, 0, 0]} /></BarChart> : <AreaChart data={data} margin={{ left: 0, top: 12, right: 10, bottom: 5 }}><defs><linearGradient id="revenue-fade" x1="0" x2="0" y1="0" y2="1"><stop offset="8%" stopColor="#80bca9" stopOpacity={.32} /><stop offset="96%" stopColor="#80bca9" stopOpacity={.02} /></linearGradient></defs><CartesianGrid stroke="#e8f0ec" vertical={false} /><XAxis dataKey="date" tick={axis} axisLine={false} tickLine={false} /><YAxis tick={axis} tickFormatter={value => `₱${value}`} width={57} axisLine={false} tickLine={false} /><Tooltip formatter={tooltip} /><Legend /><Area type="monotone" dataKey="Revenue" stroke="#286f5a" strokeWidth={2.5} fill="url(#revenue-fade)" /><Area type="monotone" dataKey="Profit" stroke="#79aa99" strokeWidth={2} fill="transparent" /></AreaChart>}</ResponsiveContainer></div>
}

function rangeFor(period: string, start: string, end: string) {
  const today = localDay()
  const monday = new Date(`${today}T00:00:00Z`)
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
  return { start: period === 'Today' ? today : period === 'This week' ? monday.toISOString().slice(0, 10) : period === 'This month' ? `${today.slice(0, 7)}-01` : period === 'Custom range' ? start : '', end: period === 'Custom range' ? end : today }
}

function SalesTable({ sales, compact = false }: { sales: Sale[]; compact?: boolean }) {
  return <Table headings={['Order', 'Listing', 'Customer', 'Payment', 'Amount']} rows={sales.slice(0, compact ? 6 : undefined).map(({ order, item }, index) => ({ key: `${order.id}-${index}`, cells: [<><strong>#{order.id.slice(0, 8).toUpperCase()}</strong><small>{shortDate(order.createdAt)}</small></>, item.name, order.customerName, <><Pill tone={statusTone(order.status)}>{order.status}</Pill><small>{order.method === 'Offline' ? 'Recorded offline' : `${order.method} · simulated`}</small></>, money(item.price * item.quantity)] }))} empty="There are no orders in this date range." />
}

function ranking(sales: Sale[], field: 'brand' | 'name') {
  const records = new Map<string, { label: string; units: number; revenue: number; profit: number; type: string }>()
  for (const { item } of sales) {
    const label = item[field]
    const record = records.get(label) || { label, units: 0, revenue: 0, profit: 0, type: item.type }
    record.units += item.quantity; record.revenue += item.price * item.quantity; record.profit += (item.price - item.cost) * item.quantity
    records.set(label, record)
  }
  return [...records.values()]
}

function Ranking({ sales, field, title, kind = '' }: { sales: Sale[]; field: 'brand' | 'name'; title: string; kind?: string }) {
  const [sort, setSort] = useState<'units' | 'revenue' | 'profit'>('revenue')
  const rows = ranking(sales, field).filter(row => !kind || row.type === kind).sort((first, second) => second[sort] - first[sort])
  return <section className="panel"><div className="panel-head"><h2>{title}</h2><select aria-label={`Rank ${title.toLowerCase()} by`} value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="revenue">Revenue</option><option value="units">Units sold</option><option value="profit">Gross profit</option></select></div><Table headings={[field === 'brand' ? 'Brand' : 'Product', 'Units', 'Revenue', 'Gross profit']} rows={rows.map(row => ({ key: row.label, cells: [<strong>{row.label}</strong>, row.units, money(row.revenue), money(row.profit)] }))} empty="No completed sales to rank yet." /></section>
}

function Customers({ sales }: { sales: Sale[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  const customers = new Map<string, { name: string; date: string; revenue: number; units: number; orders: Set<string> }>()
  for (const { order, item } of sales) {
    if (order.status !== 'Successful') continue
    const details = customers.get(order.customerId) || { name: order.customerName, date: '', revenue: 0, units: 0, orders: new Set<string>() }
    details.orders.add(order.id); details.revenue += item.price * item.quantity; details.units += item.quantity
    if (order.createdAt > details.date) details.date = order.createdAt
    customers.set(order.customerId, details)
  }
  return <section className="panel"><h2>Customer activity</h2><p className="muted">Only completed purchases from this shop are included.</p><Table headings={['Customer', 'Orders', 'Items purchased', 'Total spent', 'Most recent purchase', '']} rows={[...customers].sort(([, first], [, second]) => second.orders.size - first.orders.size || second.revenue - first.revenue).map(([id, customer]) => ({ key: id, cells: [<strong>{customer.name}</strong>, customer.orders.size, customer.units, money(customer.revenue), shortDate(customer.date), <button className="text-btn" onClick={() => setSelected(id)}>View history</button>] }))} empty="Customers appear here after their first successful purchase." />{selected && <Modal title={`${customers.get(selected)?.name || 'Customer'} · order history`} close={() => setSelected(null)}><SalesTable sales={sales.filter(sale => sale.order.customerId === selected)} /></Modal>}</section>
}

function TithePanel({ value, summary, save }: { value: Tithe; summary: ReturnType<typeof totals>; save: (value: Tithe) => Promise<void> }) {
  const [tithe, setTithe] = useState(value)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <section className="panel"><div className="panel-head"><div><h2>Optional tithes</h2><p className="muted">Private to this seller workspace. Choose your own percentage and basis.</p></div><Pill>{tithe.enabled ? 'Enabled' : 'Disabled'}</Pill></div><form className="form-stack" onSubmit={async event => { event.preventDefault(); setBusy(true); setError(''); try { await save(tithe) } catch (problem) { setError(problem instanceof Error ? problem.message : 'Unable to save.') } finally { setBusy(false) } }}><label className="check"><input type="checkbox" checked={tithe.enabled} onChange={event => setTithe({ ...tithe, enabled: event.target.checked })} /> Enable tithes computation</label>{tithe.enabled && <><div className="form-grid three"><label>Percentage (%)<input type="number" min="0" max="100" step=".01" value={tithe.rate} onChange={event => setTithe({ ...tithe, rate: Number(event.target.value) })} /></label><label>Calculation basis<select value={tithe.basis} onChange={event => setTithe({ ...tithe, basis: event.target.value as Tithe['basis'] })}><option value="sales">Successful sales revenue</option><option value="gross">Estimated gross profit</option><option value="net">Estimated net profit</option></select></label><label>Manual adjustment (₱)<input type="number" step=".01" value={tithe.adjustment} onChange={event => setTithe({ ...tithe, adjustment: Number(event.target.value) })} /></label></div><label className="check"><input type="checkbox" checked={tithe.summary} onChange={event => setTithe({ ...tithe, summary: event.target.checked })} /> Include in my financial summary</label><div className="notice"><strong>Calculated for the selected dates: {money(titheTotal(tithe, summary))}</strong></div></>}{error && <p className="form-error">{error}</p>}<button className="btn secondary" disabled={busy}>{busy ? 'Saving…' : 'Save tithes preferences'}</button></form></section>
}

function Subscription({ shop, demo, save, notify }: { shop: Shop; demo: boolean; save: (shop: Shop) => void; notify: Notify }) {
  const [renew, setRenew] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const status = statusFor(shop)
  return <><Metrics items={[{ label: 'Subscription status', value: status.label, detail: 'First calendar month free', icon: CreditCard }, { label: 'Monthly renewal', value: '₱200', detail: 'After the free trial', icon: Wallet }, { label: 'Marketplace visibility', value: status.public ? 'Visible' : 'Hidden', detail: 'Requires publishing and a current plan', icon: Eye }]} /><section className="panel"><div className="panel-head"><div><h2>Plan and billing</h2><p className="muted">{shop.paidUntil ? `Current access ends ${shortDate(shop.paidUntil)}.` : 'Your first month starts when you create a shop.'}</p>{status.retention && <Pill tone="warning">{status.retention}</Pill>}</div><button className="btn primary" onClick={() => setRenew(true)}>Renew plan <ArrowRight size={16} /></button></div><div className="notice">Expired shops are hidden from the public marketplace. After three consecutive months without renewal, an account becomes eligible for retention review. No deletion is scheduled and no warning emails are sent until a retention, notification, and recovery process is in place.</div></section><section className="panel"><h2>Payment history</h2><Table headings={['Date', 'Description', 'Amount']} rows={history.map((date, index) => ({ key: `${date}-${index}`, cells: [shortDate(date), 'Simulated renewal', '₱200'] }))} empty="No subscription payments recorded." /></section>
    {renew && <Modal title="Renew subscription" close={() => setRenew(false)}><p>{demo ? 'Preview a ₱200 renewal. This extends sample access for the current demo session only.' : 'Online renewals are not connected yet. No payment can be taken, and this preview does not change your subscription or visibility.'}</p>{demo ? <button className="btn primary full" onClick={() => { const due = new Date(Math.max(Date.now(), new Date(shop.paidUntil || '').getTime() || 0)); const day = due.getUTCDate(); due.setUTCDate(1); due.setUTCMonth(due.getUTCMonth() + 1); due.setUTCDate(Math.min(day, new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0)).getUTCDate())); save({ ...shop, paidUntil: due.toISOString() }); setHistory(previous => [new Date().toISOString(), ...previous]); setRenew(false); notify('Demo subscription renewed. No payment was collected.') }}>Simulate renewal</button> : <button className="btn secondary full" onClick={() => setRenew(false)}>Got it</button>}</Modal>}</>
}

export function SellerWorkspace({ page, demo, go, user, loaded, auth, notify, refresh }: WorkspaceProps) {
  const [data, setData] = useState<SellerData | null>(() => demo ? makeDemoSeller() : null)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState(demo ? 'All time' : 'This month')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [editor, setEditor] = useState<Product | 'new' | null>(null)
  const [expense, setExpense] = useState<Expense | 'new' | null>(null)
  const [recordSale, setRecordSale] = useState(false)
  const [confirm, setConfirm] = useState<{ title: string; body: string; action: () => Promise<void> } | null>(null)
  const [confirmedBusy, setConfirmedBusy] = useState(false)
  const [inventoryFilter, setInventoryFilter] = useState('')
  useEffect(() => {
    if (demo || !user) return
    let live = true
    api<SellerData>('/seller').then(next => { if (live) setData(next) }).catch(problem => { if (live) setError(problem.message) })
    return () => { live = false }
  }, [demo, user])
  const range = rangeFor(period, start, end)
  const inRange = (entry: Sale) => { const day = localDay(new Date(entry.order.createdAt)); return (!range.start || day >= range.start) && (!range.end || day <= range.end) }
  const recognized = (entry: Sale) => demo || entry.order.method === 'Offline'
  const ordersInRange = (data?.sales || []).filter(inRange)
  const sales = ordersInRange.filter(recognized)
  const expenses = (data?.expenses || []).filter(entry => (!range.start || entry.date >= range.start) && (!range.end || entry.date <= range.end))
  const summary = totals(sales, expenses)
  const chart = chartRows(sales, expenses, range)
  const monthKey = `${localDay().slice(0, 7)}-01`
  const monthly = totals((data?.sales || []).filter(sale => recognized(sale) && localDay(new Date(sale.order.createdAt)) >= monthKey), (data?.expenses || []).filter(item => item.date >= monthKey))
  const monthlyChart = monthRows(sales, expenses, range)
  const currentRevenue = monthlyChart.at(-1)?.Revenue || 0
  const previousRevenue = monthlyChart.at(-2)?.Revenue || 0
  const growth = previousRevenue ? `${((currentRevenue / previousRevenue - 1) * 100).toFixed(1)}%` : '—'
  const shop = data?.shop
  const listingRows = data?.products || []
  const title = page === 'overview' ? 'Seller Overview' : sellerNav.find(entry => entry[0] === page)?.[1] || 'Seller Overview'
  const nav = (name: string) => `/seller/${name}${demo ? '?demo=1' : ''}`
  const dates = <div className="date-controls"><label><CalendarDays size={15} /><select value={period} onChange={event => setPeriod(event.target.value)} aria-label="Date range"><option>Today</option><option>This week</option><option>This month</option><option>All time</option><option>Custom range</option></select></label>{period === 'Custom range' && <><input type="date" aria-label="Start date" value={start} onChange={event => setStart(event.target.value)} /><input type="date" aria-label="End date" min={start || undefined} value={end} onChange={event => setEnd(event.target.value)} /></>}</div>
  async function saveShop(draft: Shop) {
    const updated = demo ? draft : await api<Shop>('/seller/shop', 'PUT', draft)
    setData(previous => previous && { ...previous, shop: updated }); refresh(); notify('Shop details saved.')
  }
  async function saveListing(product: Product) {
    const updated = demo ? { ...product, id: product.id === 'new' ? crypto.randomUUID() : product.id } : await api<Product>(`/seller/listings/${product.id}`, 'PUT', product)
    setData(previous => previous && { ...previous, products: previous.products.some(item => item.id === updated.id) ? previous.products.map(item => item.id === updated.id ? updated : item) : [updated, ...previous.products] }); refresh(); notify('Listing saved.')
  }
  async function saveExpense(item: Expense) {
    const updated = demo ? { ...item, id: item.id === 'new' ? crypto.randomUUID() : item.id } : await api<Expense>(`/seller/expenses/${item.id}`, 'PUT', item)
    setData(previous => previous && { ...previous, expenses: previous.expenses.some(value => value.id === updated.id) ? previous.expenses.map(value => value.id === updated.id ? updated : value) : [updated, ...previous.expenses] }); notify('Expense saved.')
  }
  async function saveSale(record: ManualSale) {
    const item = listingRows.find(product => product.id === record.listingId)
    if (!item || item.quantity < record.quantity) throw new Error('This listing does not have enough units available.')
    const result = demo ? { product: { ...item, quantity: item.quantity - record.quantity }, sale: { item: { listingId: item.id, name: item.name, brand: item.brand, type: item.type, price: record.price, cost: item.cost || 0, quantity: record.quantity }, order: { id: crypto.randomUUID(), customerId: 'offline:demo', customerName: 'Offline customer', status: 'Successful' as const, createdAt: `${record.date}T04:00:00Z`, method: 'Offline' } } } : await api<{ product: Product; sale: Sale }>('/seller/sales', 'POST', record)
    setData(previous => previous && { ...previous, products: previous.products.map(product => product.id === result.product.id ? result.product : product), sales: [result.sale, ...previous.sales] }); refresh(); notify('Sale recorded and inventory updated.')
  }
  async function saveTithe(tithe: Tithe) {
    const updated = demo ? tithe : await api<Tithe>('/seller/tithe', 'PUT', tithe)
    setData(previous => previous?.shop ? { ...previous, shop: { ...previous.shop, tithe: updated } } : previous); notify('Tithes preferences saved.')
  }
  return <Shell role="seller" page={page} demo={demo} go={go}>
    <WorkspaceTitle title={title} description={pageCopy[page] || pageCopy.overview} actions={['overview', 'orders', 'finances', 'insights', 'customers'].includes(page) && data ? dates : undefined} />
    {!demo && !loaded ? <div className="panel muted">Loading your workspace…</div> : !demo && !user ? <Empty icon={<Store size={26} />} title="Your shop starts here" body="Sign in to open a shop and manage listings, sales, and finances. Or look around with sample data first." action={<div className="cluster"><button className="btn primary" onClick={auth}>Log in / create account</button><Link className="btn secondary" to="/seller/overview?demo=1" go={go}>Explore demo <ArrowRight size={16} /></Link></div>} /> : error ? <div className="notice">{error}</div> : !data ? <div className="panel muted">Loading shop data…</div> : <>
    {demo && <div className="notice demo-notice"><strong>Seller demo</strong> · Sample shop, listings, and transactions. Edits last for this visit only.</div>}
    {!shop && page !== 'customization' && <Empty icon={<Store size={25} />} title="Create your shop" body="Add your shop details to open inventory, orders, and business insights. Your first month is free." action={<Link to={nav('customization')} go={go} className="btn primary">Set up shop <ArrowRight size={16} /></Link>} />}
    {page === 'customization' && <ShopEditor key={shop?.id || 'new'} shop={shop || null} demo={demo} save={saveShop} notify={notify} />}
    {shop && page === 'overview' && <>
      <div className="workspace-shop"><Avatar src={shop.avatar} name={shop.name} size={52} /><div><strong>{shop.name}</strong><small><MapPin size={13} /> {shop.location}</small></div><Pill tone={statusTone(statusFor(shop).label)}>{statusFor(shop).label}</Pill>{statusFor(shop).public && <Link to={`/shop/${shop.id}`} go={go} className="text-btn shop-view">View storefront <ArrowRight size={15} /></Link>}</div>
      <Metrics items={[{ label: 'Total revenue', value: money(summary.revenue), detail: demo ? 'Successful sample orders' : 'Recorded offline sales', icon: Wallet }, { label: 'Expenses / cost of goods', value: money(summary.cost + summary.additional), detail: 'Sold stock and operating expenses', icon: CircleDollarSign }, { label: 'Estimated net profit', value: money(summary.net), detail: 'Revenue less costs and expenses', icon: TrendingUp }, { label: 'Products sold', value: summary.units, detail: 'Units in recorded sales', icon: ShoppingBag }, { label: 'Active listings', value: listingRows.filter(item => item.status === 'Active' && item.quantity > 0).length, detail: 'Currently in stock', icon: Package }, { label: 'Pending orders', value: new Set(ordersInRange.filter(sale => sale.order.status === 'Pending').map(sale => sale.order.id)).size, detail: 'Simulated checkout only', icon: ClipboardList }, ...(shop.tithe?.enabled && shop.tithe.summary ? [{ label: 'Calculated tithes', value: money(titheTotal(shop.tithe, summary)), detail: 'Private estimate for selected dates' }] : [])]} />
      <div className="dashboard-split"><section className="panel"><div className="panel-head"><div><h2>Sales performance</h2><p className="muted">Recorded revenue and estimated profit.</p></div><Pill>{period}</Pill></div><Trend data={chart} /></section><section className="panel"><h2>Monthly financial summary</h2><div className="summary-lines">{[['Revenue', monthly.revenue], ['Cost of goods sold', monthly.cost], ['Additional expenses', monthly.additional], ['Net profit', monthly.net]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{money(Number(value))}</strong></div>)}</div><Link className="text-btn" to={nav('finances')} go={go}>View finances <ArrowRight size={14} /></Link></section></div>
      <section className="panel"><div className="panel-head"><h2>Recent orders</h2><Link className="text-btn" to={nav('orders')} go={go}>All orders <ArrowRight size={14} /></Link></div><SalesTable sales={ordersInRange} compact /></section>
      <Ranking sales={summary.paid} field="name" title="Best-selling products" />
    </>}
    {shop && page === 'products' && <section className="panel"><div className="panel-head"><input className="inventory-search" aria-label="Search inventory" placeholder="Search inventory…" value={inventoryFilter} onChange={event => setInventoryFilter(event.target.value)} /><button className="btn primary" onClick={() => setEditor('new')}><Plus size={17} /> New listing</button></div><Table headings={['Listing', 'Type', 'Price', 'Quantity', 'Status', 'Actions']} rows={listingRows.filter(product => `${product.name} ${product.brand} ${product.tags || ''}`.toLowerCase().includes(inventoryFilter.trim().toLowerCase())).map(product => ({ key: product.id, cells: [<div className="listing-cell"><Asset src={product.images[0]} alt="" width={95} /><div><strong>{product.name}</strong><small>{product.brand}</small></div></div>, product.type, money(product.price), product.quantity, <Pill tone={statusTone(product.quantity ? product.status || 'Active' : 'Sold')}>{product.quantity ? product.status || 'Active' : 'Sold out'}</Pill>, <div className="table-actions"><button className="text-btn" onClick={() => setEditor(product)}>Edit</button>{product.status !== 'Archived' && <button className="text-btn" onClick={() => saveListing({ ...product, status: 'Archived' }).catch(problem => notify(problem.message))}>Archive</button>}{product.quantity > 0 && product.status !== 'Sold' && <button className="text-btn" onClick={() => setConfirm({ title: 'Mark listing as sold?', body: 'This removes it from the public marketplace. It does not create an order or record any revenue.', action: () => saveListing({ ...product, status: 'Sold', quantity: 0 }) })}>Mark sold</button>}<button className="text-btn danger-text" onClick={() => setConfirm({ title: 'Delete this listing?', body: 'The listing will be deleted permanently. Existing order records are preserved.', action: async () => { if (!demo) await api(`/seller/listings/${product.id}`, 'DELETE'); setData(previous => previous && { ...previous, products: previous.products.filter(item => item.id !== product.id) }); refresh(); notify('Listing deleted.') } })}>Delete</button></div>] }))} empty="No listings match. Add a listing or change the search." /></section>}
    {shop && page === 'orders' && <section className="panel"><h2>Orders & payment status</h2><p className="muted">GCash and Maya statuses are simulations, not real payments.</p><SalesTable sales={ordersInRange} /></section>}
    {shop && page === 'finances' && <div className="finance-toolbar"><p className="muted">{demo ? 'Sample transactions are included in these demo totals.' : 'Only completed offline sales count toward revenue and sold units. Test checkout doesn’t affect your stock or books.'}</p><button className="btn primary" disabled={!listingRows.some(item => item.quantity > 0)} onClick={() => setRecordSale(true)}><Plus size={17} /> Record offline sale</button></div>}
    {shop && page === 'finances' && <><Metrics items={[{ label: 'Gross sales', value: money(summary.revenue), detail: 'Actual recorded successful orders' }, { label: 'Cost of goods sold', value: money(summary.cost), detail: 'Acquisition cost of sold units' }, { label: 'Estimated gross profit', value: money(summary.gross), detail: 'Gross sales minus cost of goods' }, { label: 'Additional expenses', value: money(summary.additional), detail: 'Recorded costs in this date range' }, { label: 'Estimated net profit', value: money(summary.net), detail: 'Gross profit minus additional expenses' }, { label: 'Net profit margin', value: `${summary.margin.toFixed(1)}%`, detail: 'Net profit as a share of revenue' }, ...(shop.tithe?.enabled && shop.tithe.summary ? [{ label: 'Calculated tithes', value: money(titheTotal(shop.tithe, summary)), detail: 'Private estimate for selected dates' }] : [])]} /><section className="panel"><h2>Item & bundle profitability</h2><p className="muted">Listing prices are asking prices. Unsold inventory and unpaid orders do not count as revenue.</p><Table headings={['Item or bundle', 'Asking price', 'Purchased', 'Sold', 'Gross sales', 'Cost of goods', 'Additional', 'Net profit']} rows={listingRows.map(item => { const result = totals(sales.filter(sale => sale.item.listingId === item.id), expenses.filter(cost => cost.listingId === item.id)); return { key: item.id, cells: [<><strong>{item.name}</strong><small>{item.type}</small></>, money(item.price), item.purchased || 0, result.units, money(result.revenue), money(result.cost), money(result.additional), money(result.net)] } })} empty="Create listings to see item-level performance." /></section><section className="panel"><div className="panel-head"><h2>Expense history</h2><button className="btn secondary" onClick={() => setExpense('new')}><Plus size={16} /> Add expense</button></div><Table headings={['Date', 'Expense', 'Linked listing', 'Amount', 'Actions']} rows={expenses.map(cost => ({ key: cost.id, cells: [cost.date, cost.name, listingRows.find(item => item.id === cost.listingId)?.name || '—', money(cost.amount), <div className="table-actions"><button className="text-btn" onClick={() => setExpense(cost)}>Edit</button><button className="text-btn danger-text" onClick={() => setConfirm({ title: 'Delete this expense?', body: 'This expense will be removed from your financial history.', action: async () => { if (!demo) await api(`/seller/expenses/${cost.id}`, 'DELETE'); setData(previous => previous && { ...previous, expenses: previous.expenses.filter(item => item.id !== cost.id) }); notify('Expense deleted.') } })}>Delete</button></div>] }))} empty="No expenses in this period." /></section><section className="panel"><h2>Sales transactions</h2><SalesTable sales={sales} /></section><TithePanel value={shop.tithe || emptyTithe} summary={summary} save={saveTithe} /></>}
    {shop && page === 'insights' && <>
      <Metrics items={[{ label: 'Recorded revenue', value: money(summary.revenue), detail: 'For the selected period', icon: Wallet }, { label: 'Estimated net profit', value: money(summary.net), detail: 'For the selected period', icon: CircleDollarSign }, { label: 'Monthly revenue change', value: growth, detail: previousRevenue ? 'Latest vs. preceding month shown' : 'No previous revenue in this range', icon: TrendingUp }]} />
      <section className="panel"><div className="panel-head"><div><h2>Monthly revenue, expenses & profit</h2><p className="muted">Six months ending in the selected period. Values include only the selected dates.</p></div><Pill>{period}</Pill></div><Trend data={monthlyChart} bars /></section>
      <div className="analytics-grid"><Ranking sales={summary.paid} field="brand" title="Brand performance" /><Ranking sales={summary.paid} field="name" title="Individual items" kind="Individual" /><Ranking sales={summary.paid} field="name" title="Bundle performance" kind="Bundle" /><section className="panel"><h2>Listings without completed sales</h2><Table headings={['Product', 'Stock']} rows={listingRows.filter(item => item.status === 'Active' && !summary.paid.some(sale => sale.item.listingId === item.id)).map(item => ({ key: item.id, cells: [item.name, item.quantity] }))} empty="All active listings have a completed sale for this period." /></section></div>
      <Customers sales={ordersInRange.filter(sale => sale.order.method !== 'Offline')} />
    </>}
    {shop && page === 'customers' && <Customers sales={ordersInRange.filter(sale => sale.order.method !== 'Offline')} />}
    {shop && page === 'subscription' && <Subscription shop={shop} demo={demo} save={updated => setData(previous => previous && { ...previous, shop: updated })} notify={notify} />}
    {shop && page === 'settings' && <section className="panel"><h2>Workspace preferences</h2><p className="muted">Manage your storefront and account details. Private financial records are not shown to shoppers.</p><div className="cluster"><Link to={nav('customization')} go={go} className="btn secondary">Shop settings</Link><Link to="/account/profile" go={go} className="btn secondary">Account settings</Link></div></section>}
    </>}
    {editor && <ListingEditor edit={editor === 'new' ? null : editor} demo={demo} notify={notify} close={() => setEditor(null)} save={saveListing} />}
    {expense && <ExpenseEditor edit={expense === 'new' ? null : expense} products={listingRows} close={() => setExpense(null)} save={saveExpense} />}
    {recordSale && <SaleEditor products={listingRows.filter(item => item.quantity > 0)} close={() => setRecordSale(false)} save={saveSale} />}
    {confirm && <Modal title={confirm.title} close={() => !confirmedBusy && setConfirm(null)}><p>{confirm.body}</p><div className="modal-actions"><button className="btn secondary" disabled={confirmedBusy} onClick={() => setConfirm(null)}>Cancel</button><button className="btn primary" disabled={confirmedBusy} onClick={async () => { setConfirmedBusy(true); try { await confirm.action(); setConfirm(null) } catch (problem) { notify(problem instanceof Error ? problem.message : 'Could not complete the action.') } finally { setConfirmedBusy(false) } }}>{confirmedBusy ? 'Working…' : 'Confirm'}</button></div></Modal>}
  </Shell>
}

export function AdminWorkspace({ page, demo, go, user, loaded, auth, notify, refresh }: WorkspaceProps) {
  const [data, setData] = useState<AdminData | null>(() => demo ? makeDemoAdmin() : null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Shop | null>(null)
  const [busy, setBusy] = useState(false)
  const [period, setPeriod] = useState('All time')
  const admin = user?.roles?.includes('admin')
  useEffect(() => {
    if (demo || !admin) return
    let live = true
    api<AdminData>('/admin/overview').then(next => { if (live) setData(next) }).catch(problem => { if (live) setError(problem.message) })
    return () => { live = false }
  }, [demo, admin])
  const title = page === 'overview' ? 'Platform Overview' : adminNav.find(entry => entry[0] === page)?.[1] || 'Platform Overview'
  const range = rangeFor(period, '', '')
  const liveShops = data?.shops.filter(shop => statusFor(shop).public).length || 0
  const expired = data?.shops.filter(shop => statusFor(shop).label === 'Expired').length || 0
  const orders = (data?.transactions || []).filter(order => !range.start || localDay(new Date(order.createdAt)) >= range.start)
  const displayTransactions = <Table headings={['Order', 'Date', 'Method', 'Status', 'Total']} rows={orders.map(order => ({ key: order.id, cells: [`#${order.id.slice(0, 8).toUpperCase()}`, shortDate(order.createdAt), order.method, <Pill tone={statusTone(order.status)}>{order.status}</Pill>, money(Number(order.total))] }))} empty="No transactions in this date range." />
  return <Shell role="admin" page={page} demo={demo} go={go}><WorkspaceTitle title={title} description="Monitor marketplace activity, shop visibility, and subscription access." actions={data && ['overview', 'transactions', 'reports'].includes(page) ? <label className="date-controls"><select aria-label="Report date range" value={period} onChange={event => setPeriod(event.target.value)}><option>All time</option><option>Today</option><option>This week</option><option>This month</option></select></label> : undefined} />
  {!demo && !loaded ? <div className="panel muted">Loading access…</div> : !demo && !admin ? <Empty icon={<Settings size={24} />} title="Administrator access required" body="Live platform controls are restricted to authorized administrators. The demo contains sample data only." action={<div className="cluster">{!user && <button className="btn primary" onClick={auth}>Log in</button>}<Link className="btn secondary" to="/admin/overview?demo=1" go={go}>Explore admin demo <ArrowRight size={16} /></Link></div>} /> : error ? <div className="notice">{error}</div> : !data ? <div className="panel muted">Loading platform data…</div> : <>
    {demo && <div className="notice demo-notice"><strong>Admin demo</strong> · Sample marketplace activity. Visibility changes do not affect live shops.</div>}
    {page === 'overview' && <><Metrics items={[{ label: 'Registered sellers', value: data.shops.length, detail: 'Seller accounts with a shop', icon: Users }, { label: 'Active public shops', value: liveShops, detail: 'Published and subscribed', icon: Store }, { label: 'Expired subscriptions', value: expired, detail: 'Hidden from the marketplace', icon: CreditCard }, { label: 'Customers with orders', value: data.customers, detail: 'Distinct ordering accounts', icon: Users }, { label: 'Marketplace transactions', value: orders.length, detail: 'Includes test activity', icon: ClipboardList }, { label: 'Subscription revenue', value: money(demo ? 800 : 0), detail: demo ? 'Sample billing activity' : 'Payment processing is not connected', icon: Wallet }]} /><section className="panel"><h2>Marketplace transactions</h2>{displayTransactions}</section></>}
    {['sellers', 'shops', 'subscriptions'].includes(page) && <section className="panel"><h2>{page === 'subscriptions' ? 'Subscription monitoring' : 'Seller shops'}</h2><Table headings={['Shop', 'Location', 'Subscription', 'Access ends', 'Visibility', 'Action']} rows={data.shops.map(shop => { const status = statusFor(shop); return { key: shop.id, cells: [<strong>{shop.name}</strong>, shop.location, <><Pill tone={statusTone(status.label)}>{status.label}</Pill>{status.retention && <small>{status.retention}</small>}</>, shop.paidUntil ? shortDate(shop.paidUntil) : '—', <Pill tone={status.public ? 'positive' : 'negative'}>{status.public ? 'Visible' : 'Hidden'}</Pill>, <button className="text-btn" onClick={() => setSelected(shop)}>{shop.suspended ? 'Remove hold' : 'Hide shop'}</button>] } })} empty="No seller shops are registered yet." /></section>}
    {page === 'transactions' && <section className="panel"><h2>Marketplace transactions</h2>{displayTransactions}</section>}
    {page === 'customers' && <section className="panel"><h2>Customer activity</h2><p><strong>{data.customers}</strong> unique customers have placed an order.</p><p className="muted">Customer contact and delivery data are not exposed in platform reports.</p></section>}
    {page === 'reports' && <><Metrics items={[{ label: 'Test order volume', value: orders.length, detail: period }, { label: 'Successful test value', value: money(orders.filter(order => order.status === 'Successful').reduce((sum, order) => sum + Number(order.total), 0)), detail: 'Simulated payments only' }, { label: 'Expired subscriptions', value: expired, detail: 'All seller shops' }]} /><section className="panel"><h2>Transaction activity</h2>{displayTransactions}</section></>}
    {page === 'settings' && <section className="panel"><h2>Marketplace policies</h2><div className="summary-lines"><div><span>Free trial</span><strong>One calendar month</strong></div><div><span>Renewal</span><strong>₱200 / month</strong></div><div><span>Retention review eligibility</span><strong>Three expired months</strong></div><div><span>Automatic deletion</span><strong>Disabled</strong></div><div><span>Daily deletion warnings</span><strong>Not scheduled</strong></div></div></section>}
  </>}{selected && <Modal title={selected.suspended ? 'Remove visibility hold?' : 'Hide this shop?'} close={() => !busy && setSelected(null)}><p>{selected.suspended ? 'The shop will only become public if it is published and has a current subscription.' : `${selected.name} will no longer appear in the public marketplace. No data is deleted.`}</p><div className="modal-actions"><button className="btn secondary" disabled={busy} onClick={() => setSelected(null)}>Cancel</button><button className="btn primary" disabled={busy} onClick={async () => { setBusy(true); try { if (!demo) await api(`/admin/shops/${selected.id}`, 'PATCH', { suspended: !selected.suspended }); setData(previous => previous && { ...previous, shops: previous.shops.map(shop => shop.id === selected.id ? { ...shop, suspended: !shop.suspended } : shop) }); refresh(); setSelected(null); notify('Visibility updated.') } catch (problem) { notify(problem instanceof Error ? problem.message : 'Unable to update visibility.') } finally { setBusy(false) } }}>{busy ? 'Saving…' : 'Confirm'}</button></div></Modal>}</Shell>
}
