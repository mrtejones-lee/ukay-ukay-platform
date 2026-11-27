import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { getUser, handleAuthCallback, onAuthChange, type User } from '@netlify/identity'
import { CheckCircle2, Package, X } from 'lucide-react'
import { Account, AuthDialog, BagDialog, Checkout, SavedDialog, type BagLine } from './account'
import { Footer, Header, Home, ProductDetail, ShopProfile } from './market'
import { api, sampleProducts, sampleShops, type Product, type Shop } from './model'
import { Empty, Link } from './ui'
import './styles.css'

const SellerWorkspace = lazy(() => import('./workspace').then(module => ({ default: module.SellerWorkspace })))
const AdminWorkspace = lazy(() => import('./workspace').then(module => ({ default: module.AdminWorkspace })))
const address = () => `${location.pathname}${location.search}${location.hash}`
type Dialog = 'auth' | 'bag' | 'saved' | 'checkout' | null

function App() {
  const [route, setRoute] = useState(address)
  const [user, setUser] = useState<User | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [checkoutAfterLogin, setCheckoutAfterLogin] = useState(false)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [live, setLive] = useState<{ shops: Shop[]; products: Product[] }>({ shops: [], products: [] })
  const [catalogReady, setCatalogReady] = useState(false)
  const [favorites, setFavorites] = useState(new Set<string>())
  const [bag, setBag] = useState<BagLine[]>([])
  const [message, setMessage] = useState<{ text: string; key: number } | null>(null)
  const notify = useCallback((text: string) => setMessage({ text, key: Date.now() }), [])
  const refresh = useCallback(() => { api<{ shops: Shop[]; products: Product[] }>('/catalog').then(setLive).catch(() => {}).finally(() => setCatalogReady(true)) }, [])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    const sync = () => setRoute(address())
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])
  useEffect(() => {
    const unsubscribe = onAuthChange((event, account) => { if (event !== 'recovery') setUser(account) })
    handleAuthCallback().then(async callback => {
      if (callback?.type === 'recovery') { setRecovering(true); setDialog('auth'); return }
      setUser(await getUser())
      if (callback?.type === 'confirmation') notify('Email confirmed. Welcome to UkayLoop.')
    }).catch(() => { getUser().then(setUser); notify('That account link could not be completed.') }).finally(() => setLoaded(true))
    return unsubscribe
  }, [notify])
  useEffect(() => {
    if (!message) return
    const timeout = window.setTimeout(() => setMessage(null), 4100)
    return () => window.clearTimeout(timeout)
  }, [message])
  useEffect(() => { if (user && checkoutAfterLogin && dialog === null) { setCheckoutAfterLogin(false); setDialog('checkout') } }, [user, checkoutAfterLogin, dialog])

  const active = new URL(route, location.origin)
  const [, section, detail] = active.pathname.split('/')
  const query = active.searchParams.get('q') || ''
  const demo = active.searchParams.get('demo') === '1'
  const scroll = (hash: string) => requestAnimationFrame(() => { if (['#shops', '#discover', '#about'].includes(hash)) document.getElementById(hash.slice(1))?.scrollIntoView(); else window.scrollTo(0, 0) })
  useEffect(() => { if (['#shops', '#discover', '#about'].includes(location.hash)) scroll(location.hash) }, [])
  const go = useCallback((path: string) => {
    if (address() !== path) window.history.pushState({}, '', path)
    setRoute(address())
    scroll(location.hash)
  }, [])
  const find = (value: string) => go(value.trim() ? `/?q=${encodeURIComponent(value.trim())}#discover` : '/#discover')
  const shops = [...sampleShops, ...live.shops]
  const products = [...sampleProducts, ...live.products]
  const product = products.find(item => item.id === detail)
  const shop = shops.find(item => item.id === detail)
  const inWorkspace = section === 'seller' || section === 'admin'
  const toggle = (id: string) => {
    setFavorites(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  function updateBag(item: Product, quantity: number) {
    setBag(current => quantity <= 0 ? current.filter(line => line.product.id !== item.id) : current.some(line => line.product.id === item.id) ? current.map(line => line.product.id === item.id ? { product: item, quantity: Math.min(quantity, item.quantity, 25) } : line) : [...current, { product: item, quantity: Math.min(quantity, item.quantity, 25) }])
  }
  function openCheckout() {
    if (user) setDialog('checkout')
    else { setCheckoutAfterLogin(true); setDialog('auth'); notify('Sign in to continue to checkout.') }
  }
  const missing = <main className="wrap inner-page"><Empty icon={<Package size={27} />} title={catalogReady ? 'This find is no longer here' : 'Looking for this find…'} body={catalogReady ? 'It may have sold or the shop may no longer be public.' : 'Checking the marketplace for the latest availability.'} action={<Link to="/#discover" go={go} className="btn secondary">Browse other finds</Link>} /></main>
  const workspaceProps = { page: detail || 'overview', demo, go, user, loaded, auth: () => setDialog('auth'), notify, refresh }
  return <>
    <a href="#main-content" className="skip-link">Skip to content</a>
    {!inWorkspace && <Header go={go} query={query} find={find} bagCount={bag.reduce((count, line) => count + line.quantity, 0)} savedCount={favorites.size} open={setDialog} signedIn={Boolean(user)} />}
    <div id="main-content" tabIndex={-1}>
      {section === 'seller' ? <Suspense fallback={<div className="workspace-loading">Loading seller workspace…</div>}><SellerWorkspace key={`seller-${demo}-${user?.id || 'guest'}`} {...workspaceProps} /></Suspense>
        : section === 'admin' ? <Suspense fallback={<div className="workspace-loading">Loading admin console…</div>}><AdminWorkspace key={`admin-${demo}-${user?.id || 'guest'}`} {...workspaceProps} /></Suspense>
        : section === 'account' ? <Account key={user?.id || 'guest'} user={user} page={detail} receiptId={active.searchParams.get('receipt')} go={go} auth={() => setDialog('auth')} notify={notify} setUser={setUser} />
        : section === 'product' ? product ? <ProductDetail key={product.id} product={product} shop={shops.find(entry => entry.id === product.shopId)} go={go} saved={favorites.has(product.id)} save={() => toggle(product.id)} add={() => { const existing = bag.find(line => line.product.id === product.id)?.quantity || 0; if (existing < product.quantity) { updateBag(product, existing + 1); notify('Added to your bag.') }; setDialog('bag') }} /> : missing
        : section === 'shop' ? shop ? <ShopProfile key={shop.id} shop={shop} products={products.filter(item => item.shopId === shop.id)} go={go} favorites={favorites} favorite={toggle} /> : missing
        : <Home shops={shops} products={products} go={go} favorites={favorites} favorite={toggle} query={query} find={find} />}
    </div>
    {!inWorkspace && <Footer go={go} />}
    {dialog === 'auth' && <AuthDialog recovery={recovering} onLogin={setUser} notify={notify} close={() => { setDialog(null); if (recovering) setRecovering(false) }} />}
    {dialog === 'bag' && <BagDialog bag={bag} close={() => setDialog(null)} go={go} update={updateBag} checkout={openCheckout} />}
    {dialog === 'saved' && <SavedDialog products={products.filter(item => favorites.has(item.id))} close={() => setDialog(null)} go={go} toggle={toggle} />}
    {dialog === 'checkout' && user && <Checkout bag={bag} user={user} close={() => setDialog('bag')} complete={(id, status) => { if (status === 'Successful' || status === 'Pending') setBag([]); setDialog(null); notify(`Test order recorded: ${status.toLowerCase()}.`); go(`/account/orders?receipt=${encodeURIComponent(id)}`); refresh() }} />}
    {message && <div className="toast" role="status"><CheckCircle2 size={19} /><span>{message.text}</span><button className="icon-btn" onClick={() => setMessage(null)} aria-label="Dismiss message"><X size={16} /></button></div>}
  </>
}

createRoot(document.getElementById('root')!).render(<App />)
