import { useEffect, useState, type FormEvent } from 'react'
import { getSettings, login, logout, oauthLogin, requestPasswordRecovery, signup, updateUser, type User } from '@netlify/identity'
import { ArrowRight, Heart, Package, ReceiptText, ShoppingBag, Trash2, UserRound } from 'lucide-react'
import { api, money, shortDate, type Navigate, type Order, type Product, type Status } from './model'
import { Asset, Empty, Link, Modal, Pill, statusTone } from './ui'

export type Notice = (message: string) => void

export function AuthDialog({ close, notify, onLogin, recovery }: { close: () => void; notify: Notice; onLogin: (user: User) => void; recovery?: boolean }) {
  const [mode, setMode] = useState(recovery ? 'reset' : 'login')
  const [google, setGoogle] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { getSettings().then(settings => setGoogle(Boolean(settings.providers.google))).catch(() => {}) }, [])
  const title = mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : mode === 'reset' ? 'Set a new password' : 'Welcome back'
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') || '')
    const password = String(data.get('password') || '')
    try {
      if (mode === 'signup') { await signup(email, password, { full_name: String(data.get('name')) }); notify('Account created. Check your email for a confirmation link.'); setMode('login') }
      else if (mode === 'forgot') { await requestPasswordRecovery(email); notify('If an account exists, you’ll receive a password reset email.'); setMode('login') }
      else if (mode === 'reset') { const user = await updateUser({ password }); onLogin(user); notify('Password updated.'); close() }
      else { const user = await login(email, password); onLogin(user); notify(user.name ? `Welcome, ${user.name}!` : 'You’re signed in.'); close() }
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not sign you in.') } finally { setBusy(false) }
  }
  function change(next: string) { setMode(next); setError('') }
  return <Modal title={title} close={close}><p className="muted">{mode === 'forgot' ? 'Enter the email linked to your UkayLoop account.' : mode === 'reset' ? 'Choose a password you haven’t used before.' : 'Find something good and give it a second life.'}</p>
    {google && ['login', 'signup'].includes(mode) && <button className="btn secondary full google" onClick={() => oauthLogin('google')}><strong>G</strong> Continue with Google</button>}
    <form key={mode} onSubmit={submit} className="form-stack">
      {mode === 'signup' && <label>Full name<input required name="name" autoComplete="name" /></label>}
      {mode !== 'reset' && <label>Email address<input required name="email" type="email" autoComplete="email" /></label>}
      {mode !== 'forgot' && <label>Password<input required name="password" type="password" minLength={mode === 'login' ? 1 : 8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn primary full" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : mode === 'reset' ? 'Update password' : 'Log in'} <ArrowRight size={16} /></button>
    </form>
    {mode === 'login' ? <div className="modal-actions spread"><button className="text-btn" onClick={() => change('forgot')}>Forgot password?</button><button className="text-btn" onClick={() => change('signup')}>Create account</button></div> : mode !== 'reset' && <button className="text-btn modal-text" onClick={() => change('login')}>Back to log in</button>}
  </Modal>
}

export type BagLine = { product: Product; quantity: number }

export function BagDialog({ bag, close, go, update, checkout }: { bag: BagLine[]; close: () => void; go: Navigate; update: (product: Product, quantity: number) => void; checkout: () => void }) {
  const value = bag.reduce((total, { product, quantity }) => total + product.price * quantity, 0)
  return <Modal title="Your bag" drawer close={close}>{!bag.length ? <Empty icon={<ShoppingBag size={24} />} title="Your bag is empty" body="Your next favorite is waiting to be found." action={<button className="btn primary" onClick={() => { close(); go('/#discover') }}>Browse finds <ArrowRight size={16} /></button>} /> : <><div className="cart-lines">{bag.map(({ product, quantity }) => <div className="cart-line" key={product.id}><Asset src={product.images[0]} width={180} alt="" /><div><Link to={`/product/${product.id}`} go={path => { close(); go(path) }}><strong>{product.name}</strong></Link><small>{product.brand} · {product.condition}</small><strong>{money(product.price)}</strong><div className="quantity"><button aria-label={`Decrease ${product.name} quantity`} onClick={() => update(product, quantity - 1)}>−</button><span>{quantity}</span><button aria-label={`Increase ${product.name} quantity`} disabled={quantity >= product.quantity || quantity >= 25} onClick={() => update(product, quantity + 1)}>+</button></div></div><button className="icon-btn" aria-label={`Remove ${product.name}`} onClick={() => update(product, 0)}><Trash2 size={17} /></button></div>)}</div><div className="cart-total"><span>Subtotal</span><strong>{money(value)}</strong></div><p className="muted">This checkout uses simulated payments. No real money changes hands.</p><button className="btn primary full" onClick={checkout}>Continue to checkout <ArrowRight size={17} /></button></>}</Modal>
}

export function SavedDialog({ products, close, go, toggle }: { products: Product[]; close: () => void; go: Navigate; toggle: (id: string) => void }) {
  return <Modal title="Saved finds" drawer close={close}>{!products.length ? <Empty icon={<Heart size={24} />} title="Nothing saved yet" body="Tap the heart on any find to keep it here while you browse." /> : <div className="cart-lines">{products.map(product => <div className="cart-line" key={product.id}><Asset src={product.images[0]} width={160} alt="" /><div><Link to={`/product/${product.id}`} go={path => { close(); go(path) }}><strong>{product.name}</strong></Link><small>{product.brand}</small><strong>{money(product.price)}</strong></div><button className="icon-btn" aria-label={`Unsave ${product.name}`} onClick={() => toggle(product.id)}><Heart size={18} fill="currentColor" /></button></div>)}</div>}</Modal>
}

export function Checkout({ bag, user, close, complete }: { bag: BagLine[]; user: User; close: () => void; complete: (id: string, status: Status) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [method, setMethod] = useState('GCash')
  const value = bag.reduce((total, { product, quantity }) => total + product.price * quantity, 0)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const data = Object.fromEntries(new FormData(event.currentTarget))
    try { const order = await api<{ id: string; status: Status }>('/orders', 'POST', { ...data, method, items: bag.map(({ product, quantity }) => ({ id: product.id, quantity })) }); complete(order.id, order.status) }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Checkout failed.') } finally { setBusy(false) }
  }
  return <Modal title="Checkout" drawer close={close}><div className="notice"><strong>Test checkout</strong><div>Use fictional delivery details. Do not send money or enter wallet credentials. Select an outcome to preview the order states.</div></div><form className="form-stack" onSubmit={submit}>
    <h3>Delivery information</h3><label>Full name<input name="name" defaultValue={user.name} required maxLength={110} /></label><label>Mobile number<input name="phone" type="tel" required maxLength={30} placeholder="09XX XXX XXXX" /></label><label>Delivery address<textarea name="address" required maxLength={300} placeholder="Street, barangay, city, province" /></label>
    <h3>Payment method</h3><div className="payment-options">{['GCash', 'Maya'].map(wallet => <label key={wallet}><input type="radio" checked={method === wallet} onChange={() => setMethod(wallet)} name="wallet" /> {wallet}</label>)}</div><p className="muted">A live checkout would redirect to {method} for approval. Here the selected test outcome is recorded directly.</p>
    <label>Simulated outcome<select name="status" defaultValue="Successful"><option>Successful</option><option>Pending</option><option>Failed</option><option>Refunded</option></select></label>
    <div className="review-lines">{bag.map(({ product, quantity }) => <div key={product.id}><span>{product.name} × {quantity}</span><strong>{money(product.price * quantity)}</strong></div>)}</div><div className="cart-total"><span>Test order total</span><strong>{money(value)}</strong></div>
    {error && <p className="form-error" role="alert">{error}</p>}<button className="btn primary full" disabled={busy || !bag.length}>{busy ? 'Submitting…' : 'Confirm test order'} <ArrowRight size={16} /></button>
  </form></Modal>
}

export function Account({ user, page, receiptId, go, auth, notify, setUser }: { user: User | null; page: string; receiptId: string | null; go: Navigate; auth: () => void; notify: Notice; setUser: (user: User | null) => void }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [receipt, setReceipt] = useState<Order | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (!user || page !== 'orders') return
    let active = true
    setBusy(true); setMessage('')
    api<Order[]>('/orders').then(data => { if (active) { setOrders(data); if (receiptId) setReceipt(data.find(order => order.id === receiptId) || null) } }).catch(error => { if (active) setMessage(error.message) }).finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [user, page, receiptId])
  if (!user) return <main className="wrap inner-page"><Empty icon={<UserRound size={25} />} title="Log in to your account" body="Your profile, test orders, and receipts live here." action={<button className="btn primary" onClick={auth}>Log in</button>} /></main>
  return <main className="wrap inner-page account-page"><span className="eyebrow"><UserRound size={15} /> CUSTOMER ACCOUNT</span><h1>My account</h1><div className="account-nav"><Link to="/account/profile" className={page !== 'orders' ? 'category active' : 'category'} go={go}>Profile & settings</Link><Link to="/account/orders" className={page === 'orders' ? 'category active' : 'category'} go={go}>My orders</Link><Link to="/seller/overview" className="category" go={go}>Seller workspace <ArrowRight size={15} /></Link>{user.roles?.includes('admin') && <Link to="/admin/overview" className="category" go={go}>Admin console <ArrowRight size={15} /></Link>}</div>
  {page === 'orders' ? <section className="panel"><h2>Order history</h2><p className="muted">Test orders and receipts. No payments were collected.</p>{busy ? <p>Loading orders…</p> : message ? <p className="form-error">{message}</p> : !orders.length ? <Empty icon={<Package size={24} />} title="No orders yet" body="Your first UkayLoop order shows up here." action={<Link to="/#discover" go={go} className="btn secondary">Explore finds</Link>} /> : <div className="table-scroll"><table><thead><tr><th>Order</th><th>Date</th><th>Payment</th><th>Total</th><th></th></tr></thead><tbody>{orders.map(order => <tr key={order.id}><td>#{order.id.slice(0, 8).toUpperCase()}</td><td>{shortDate(order.createdAt)}</td><td><Pill tone={statusTone(order.status)}>{order.status}</Pill></td><td>{money(order.items.reduce((sum, item) => sum + item.price * item.quantity, 0))}</td><td><button className="text-btn" onClick={() => setReceipt(order)}><ReceiptText size={15} /> {order.status === 'Successful' ? 'Receipt' : 'Details'}</button></td></tr>)}</tbody></table></div>}</section> : <section className="panel account-form"><h2>Profile details</h2><form className="form-stack" onSubmit={async event => { event.preventDefault(); const form = new FormData(event.currentTarget); try { const updated = await updateUser({ data: { ...user.userMetadata, full_name: String(form.get('name')) } }); setUser(updated); notify('Profile updated.') } catch (error) { notify(error instanceof Error ? error.message : 'Could not save profile.') } }}><label>Display name<input name="name" required defaultValue={user.name || ''} /></label><label>Email<input value={user.email || ''} readOnly /></label><div className="modal-actions spread"><button type="submit" className="btn primary">Save profile</button><button type="button" className="btn secondary" onClick={async () => { try { await logout(); setUser(null); go('/'); notify('Signed out.') } catch { notify('Could not sign out. Try again.') } }}>Log out</button></div></form></section>}
  {receipt && <Modal title={receipt.status === 'Successful' ? 'Test order receipt' : 'Test order details'} close={() => setReceipt(null)}><p><strong>Order #{receipt.id.slice(0, 8).toUpperCase()}</strong> · {shortDate(receipt.createdAt)}</p><p><Pill tone={statusTone(receipt.status)}>{receipt.status}</Pill> · {receipt.method} simulation</p><div className="review-lines">{receipt.items.map(item => <div key={item.id}><span>{item.name} × {item.quantity}</span><strong>{money(item.price * item.quantity)}</strong></div>)}</div><div className="cart-total"><span>Order total</span><strong>{money(receipt.items.reduce((sum, item) => sum + item.price * item.quantity, 0))}</strong></div><h3>Delivery information</h3><p>{receipt.customerName}<br />{receipt.delivery.address}<br />{receipt.delivery.phone}</p><div className="notice">Test order only. No money was collected.</div><button className="btn secondary full print-action" onClick={() => window.print()}>Print / save as PDF</button></Modal>}
  </main>
}
