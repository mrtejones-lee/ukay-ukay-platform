import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, Box, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Columns2, Footprints, Heart, Leaf, MapPin, Menu, Search, Shirt, ShoppingBag, SlidersHorizontal, Sparkles, Store, Tag, UserRound, X } from 'lucide-react'
import { categories, conditions } from '../shared/catalog.mjs'
import { money, type Navigate, type Product, type Shop } from './model'
import { Asset, Avatar, Empty, Link, Logo, Modal, Pill } from './ui'

type MarketProps = { shops: Shop[]; products: Product[]; go: Navigate; favorites: Set<string>; favorite: (id: string) => void }
const categoryIcons = { Tops: Shirt, Bottoms: Columns2, Outerwear: Shirt, Dresses: Sparkles, Footwear: Footprints, Accessories: ShoppingBag, Bundles: Box }

export function Header({ go, query, find, bagCount, savedCount, open, signedIn }: { go: Navigate; query: string; find: (query: string) => void; bagCount: number; savedCount: number; open: (which: 'bag' | 'saved' | 'auth') => void; signedIn: boolean }) {
  const [menu, setMenu] = useState(false)
  const [value, setValue] = useState(query)
  useEffect(() => { setValue(query) }, [query])
  const navigate = (path: string) => { setMenu(false); go(path) }
  return <header className="site-header"><div className="wrap header-inner">
    <Logo go={navigate} />
    <nav className={menu ? 'main-nav is-open' : 'main-nav'} aria-label="Main navigation">
      <Link to="/" go={navigate} className="nav-home">Home</Link><Link to="/#shops" go={navigate}>Explore Shops</Link><Link to="/#discover" go={navigate}>Categories <ChevronDown size={13} /></Link><Link to="/#about" go={navigate}>About</Link>
    </nav>
    <div className="header-actions">
      <form className="nav-search" role="search" onSubmit={event => { event.preventDefault(); find(value) }}><Search size={17} /><input aria-label="Search marketplace" value={value} onChange={event => setValue(event.target.value)} placeholder="Search the marketplace" /></form>
      <button className="icon-btn saved-header" onClick={() => open('saved')} aria-label={`Saved items (${savedCount})`}><Heart size={21} />{savedCount > 0 && <span className="count">{savedCount}</span>}</button>
      <button className="icon-btn" onClick={() => open('bag')} aria-label={`Shopping bag (${bagCount})`}><ShoppingBag size={21} />{bagCount > 0 && <span className="count">{bagCount}</span>}</button>
      <button className="btn primary small account-btn" onClick={() => signedIn ? navigate('/account/profile') : open('auth')}><UserRound size={16} /> <span>{signedIn ? 'Account' : 'Log in'}</span></button>
      <button className="icon-btn menu-btn" aria-expanded={menu} onClick={() => setMenu(!menu)} aria-label="Toggle navigation">{menu ? <X size={22} /> : <Menu size={22} />}</button>
    </div>
  </div></header>
}

export function Footer({ go }: { go: Navigate }) {
  return <footer id="about" className="site-footer"><div className="wrap footer-inner">
    <div><Logo go={go} /><p>Good clothes deserve another go.<br />A marketplace for Filipino thrift finds.</p></div>
    <div className="footer-links"><strong>Marketplace</strong><Link to="/#discover" go={go}>Browse finds</Link><Link to="/#shops" go={go}>Explore shops</Link></div>
    <div className="footer-links"><strong>Workspaces</strong><Link to="/seller/overview" go={go}>Seller dashboard</Link><Link to="/admin/overview" go={go}>Admin dashboard</Link></div>
    <div className="footer-note"><Leaf size={17} /> Made for a more circular closet.</div>
  </div></footer>
}

export function Home({ shops, products, go, favorites, favorite, query, find }: MarketProps & { query: string; find: (query: string) => void }) {
  const [hero, setHero] = useState(query)
  useEffect(() => setHero(query), [query])
  return <main className="wrap market-home">
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy"><span className="hero-kicker"><Sparkles size={14} /> THE FILIPINO THRIFT MARKETPLACE</span>
        <h1 id="hero-title">Good finds.<br /><em>Second time around.</em></h1>
        <p>Discover standout pre-loved pieces from Filipino ukay-ukay shops. Good for your style, better for the planet.</p>
        <form className="hero-search" role="search" onSubmit={(event: FormEvent) => { event.preventDefault(); find(hero) }}><Search size={20} /><input value={hero} onChange={event => setHero(event.target.value)} aria-label="Find pre-loved clothing" placeholder="Try “vintage denim” or “Uniqlo”" /><button className="btn primary" type="submit">Search</button></form>
        <Link to="/#shops" go={go} className="hero-link">Explore Shops <ArrowRight size={17} /></Link>
      </div>
      <div className="hero-image"><Asset src="/img/hero.jpg" width={1100} alt="A Filipino shopper browsing a rack of carefully curated secondhand clothes" fetchPriority="high" /><div className="hero-note"><div className="hero-note-icon"><Leaf size={18} /></div><div><strong>Wear it again.</strong><span>Make good clothes last.</span></div></div></div>
    </section>
    <ShopShowcase shops={shops} go={go} />
    <Discovery products={products} shops={shops} go={go} favorites={favorites} favorite={favorite} query={query} />
  </main>
}

function ShopShowcase({ shops, go }: { shops: Shop[]; go: Navigate }) {
  const rail = useRef<HTMLDivElement>(null)
  const pauseUntil = useRef(0)
  const hovering = useRef(false)
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    pauseUntil.current = performance.now() + 3500
    let frame = 0, last = 0, offset = 0
    const scroll = (time: number) => {
      const node = rail.current
      if (node && last && !reduced.matches && !hovering.current && time > pauseUntil.current && node.scrollWidth > node.clientWidth) {
        offset += Math.min(time - last, 40) * .012
        if (offset >= 1) {
          const boundary = (node.children[shops.length] as HTMLElement | undefined)?.offsetLeft ?? node.scrollWidth - node.clientWidth
          node.scrollLeft = node.scrollLeft >= boundary ? 0 : node.scrollLeft + Math.floor(offset)
          offset %= 1
        }
      }
      last = time
      frame = requestAnimationFrame(scroll)
    }
    frame = requestAnimationFrame(scroll)
    return () => cancelAnimationFrame(frame)
  }, [shops.length])
  function move(amount: number) { pauseUntil.current = performance.now() + 6500; const node = rail.current; if (!node) return; node.scrollTo({ left: amount < 0 && node.scrollLeft < 1 ? (node.children[shops.length] as HTMLElement | undefined)?.offsetLeft || 0 : node.scrollLeft + amount, behavior: 'smooth' }) }
  return <section id="shops" className="shop-section"><div className="section-head"><div><span className="eyebrow"><Store size={14} /> THE LOCAL LOOP</span><h2>Featured Shops</h2><p>Meet the independent sellers behind the good finds.</p></div><div className="rail-nav"><button className="icon-btn outlined" aria-label="Previous shops" onClick={() => move(-300)}><ChevronLeft size={18} /></button><button className="icon-btn outlined" aria-label="Next shops" onClick={() => move(300)}><ChevronRight size={18} /></button></div></div>
    <div className="shop-rail" ref={rail} onMouseEnter={() => { hovering.current = true }} onMouseLeave={() => { hovering.current = false }} onFocus={() => { hovering.current = true }} onBlur={() => { hovering.current = false }} onTouchStart={() => { pauseUntil.current = performance.now() + 6500 }} onWheel={() => { pauseUntil.current = performance.now() + 6500 }}>
      {[...shops, ...shops].map((shop, index) => <a key={`${shop.id}-${index}`} href={`/shop/${shop.id}`} aria-hidden={index >= shops.length ? true : undefined} tabIndex={index >= shops.length ? -1 : 0} className="shop-tile" onClick={event => { if (!event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) { event.preventDefault(); go(`/shop/${shop.id}`) } }}><Avatar src={shop.avatar} name={shop.name} size={62} /><strong>{shop.name}</strong><span><MapPin size={12} /> {shop.location}</span></a>)}
    </div>
  </section>
}

const clean = { search: '', brand: '', min: '', max: '', location: '', shop: '', condition: '', kind: '', category: '' }
type Filters = typeof clean
const searchText = (value: string) => value.toLowerCase().replace(/[’‘']/g, '')

export function Discovery({ products, shops, go, favorites, favorite, query = '', shopMode = false }: MarketProps & { query?: string; shopMode?: boolean }) {
  const [filters, setFilters] = useState<Filters>({ ...clean, search: query })
  const [sort, setSort] = useState('recommended')
  const [mobileFilters, setMobileFilters] = useState(false)
  const [limit, setLimit] = useState(12)
  useEffect(() => { setFilters(previous => ({ ...previous, search: query })); setLimit(12) }, [query])
  const update = (name: keyof Filters, value: string) => { setFilters(previous => ({ ...previous, [name]: value })); setLimit(12) }
  const byShop = useMemo(() => new Map(shops.map(shop => [shop.id, shop])), [shops])
  const visible = useMemo(() => {
    const terms = searchText(filters.search.trim()).split(/\s+/).filter(Boolean)
    const result = products.filter(product => {
      const shop = byShop.get(product.shopId)
      const combined = searchText(`${product.name} ${product.brand} ${product.category} ${product.description} ${product.tags || ''} ${shop?.name || ''}`)
      return terms.every(term => combined.includes(term)) && (!filters.category || product.category === filters.category || (filters.category === 'Bundles' && product.type === 'Bundle')) && (!filters.brand || product.brand === filters.brand) && (!filters.min || product.price >= Number(filters.min)) && (!filters.max || product.price <= Number(filters.max)) && (!filters.location || shop?.location === filters.location) && (!filters.shop || shop?.id === filters.shop) && (!filters.condition || product.condition === filters.condition) && (!filters.kind || product.kind === filters.kind)
    })
    if (sort === 'low') result.sort((first, second) => first.price - second.price)
    if (sort === 'high') result.sort((first, second) => second.price - first.price)
    if (sort === 'new') result.sort((first, second) => (second.createdAt || '').localeCompare(first.createdAt || ''))
    if (sort === 'popular') result.sort((first, second) => (second.popularity || 0) - (first.popularity || 0))
    return result
  }, [filters, products, sort, byShop])
  const fields = <>
    <label>Search products<div className="field-icon"><Search size={16} /><input value={filters.search} onChange={event => update('search', event.target.value)} placeholder="Search finds…" /></div></label>
    <label>Category<select value={filters.category} onChange={event => update('category', event.target.value)}><option value="">All categories</option>{categories.map(name => <option key={name}>{name}</option>)}</select></label>
    <label>Brand<select value={filters.brand} onChange={event => update('brand', event.target.value)}><option value="">All brands</option>{[...new Set(products.map(product => product.brand))].sort().map(brand => <option key={brand}>{brand}</option>)}</select></label>
    <div className="filter-price"><span>Price range</span><div><input type="number" min="0" value={filters.min} aria-label="Minimum price (PHP)" placeholder="₱ Min" onChange={event => update('min', event.target.value)} /><i>–</i><input type="number" min="0" value={filters.max} aria-label="Maximum price (PHP)" placeholder="₱ Max" onChange={event => update('max', event.target.value)} /></div></div>
    {!shopMode && <><label>Location<select value={filters.location} onChange={event => update('location', event.target.value)}><option value="">All locations</option>{[...new Set(shops.map(shop => shop.location))].sort().map(location => <option key={location}>{location}</option>)}</select></label><label>Shop<select value={filters.shop} onChange={event => update('shop', event.target.value)}><option value="">All shops</option>{shops.map(shop => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select></label></>}
    <label>Condition<select value={filters.condition} onChange={event => update('condition', event.target.value)}><option value="">Any condition</option>{conditions.map(condition => <option key={condition}>{condition}</option>)}</select></label>
    <label>Ukay type<select value={filters.kind} onChange={event => update('kind', event.target.value)}><option value="">All types</option><option>Branded</option><option>Mixed Ukay</option></select></label>
  </>
  return <section id="discover" className="discover">
    <div className="section-head"><div><span className="eyebrow"><Sparkles size={14} /> {shopMode ? 'THE COLLECTION' : 'FIND YOUR NEXT FAVORITE'}</span><h2>{shopMode ? 'Shop inventory' : 'Discover Finds'}</h2><p>{shopMode ? 'Search and filter pieces from this shop.' : 'One-of-a-kind pieces, ready for their next chapter.'}</p></div><label className="sort"><span>Sort by</span><select aria-label="Sort products" value={sort} onChange={event => setSort(event.target.value)}><option value="recommended">Recommended</option><option value="new">Newest</option><option value="low">Lowest price</option><option value="high">Highest price</option><option value="popular">Most popular</option></select></label></div>
    <div className="category-strip" aria-label="Product categories"><button className={!filters.category ? 'category active' : 'category'} aria-pressed={!filters.category} onClick={() => update('category', '')}><Sparkles size={15} /> All Finds</button>{categories.map(category => { const Icon = categoryIcons[category as keyof typeof categoryIcons]; return <button key={category} className={filters.category === category ? 'category active' : 'category'} aria-pressed={filters.category === category} onClick={() => update('category', category)}><Icon size={15} />{category}</button> })}</div>
    <button className="btn secondary filter-toggle" onClick={() => setMobileFilters(true)}><SlidersHorizontal size={16} /> Filters</button>
    <div className="discovery-grid"><aside className="filters" aria-label="Product filters"><div className="filter-head"><h3><SlidersHorizontal size={17} /> Filters</h3><button className="text-btn" onClick={() => setFilters(clean)}>Reset</button></div><div className="filter-fields">{fields}</div></aside>
      <div><div className="product-grid">{visible.slice(0, limit).map(product => <ProductCard key={product.id} product={product} shop={byShop.get(product.shopId)} go={go} saved={favorites.has(product.id)} onSave={() => favorite(product.id)} />)}</div>{!visible.length && <Empty icon={<Search size={23} />} title="No finds match just yet" body="Try a different search or loosen your filters to see more pieces." action={<button className="btn secondary" onClick={() => setFilters(clean)}>Clear filters</button>} />}{visible.length > limit && <div className="load-more"><button className="btn secondary" onClick={() => setLimit(limit + 12)}>Show more finds <ArrowDown size={16} /></button></div>}</div>
    </div>
    {mobileFilters && <Modal title="Filter finds" drawer close={() => setMobileFilters(false)}><div className="filter-fields">{fields}</div><div className="modal-actions"><button className="btn secondary" onClick={() => setFilters(clean)}>Reset</button><button className="btn primary" onClick={() => setMobileFilters(false)}>Show {visible.length} finds</button></div></Modal>}
  </section>
}

export function ProductCard({ product, shop, go, saved, onSave }: { product: Product; shop?: Shop; go: Navigate; saved: boolean; onSave: () => void }) {
  return <article className="product-card"><div className="product-media">
    <Link to={`/product/${product.id}`} go={go} className="product-image-link" label={`View ${product.name}`}><Asset src={product.images[0]} width={550} alt={product.name} loading="lazy" /></Link>
    {product.badge && <span className={`product-badge ${product.badge === 'Featured' ? 'is-featured' : ''}`}>{product.badge === 'Featured' && <Sparkles size={12} />}{product.badge}</span>}
    <button className={`save-btn ${saved ? 'is-saved' : ''}`} aria-pressed={saved} aria-label={saved ? `Unsave ${product.name}` : `Save ${product.name}`} onClick={onSave}><Heart size={17} fill={saved ? 'currentColor' : 'none'} /></button>
    </div><div className="product-copy"><div className="product-brand">{product.brand}{product.size && <span> · {product.size}</span>}</div><Link className="product-title" to={`/product/${product.id}`} go={go}>{product.name}</Link>
    <div className="product-price"><strong>{money(product.price)}</strong>{product.oldPrice ? <del>{money(product.oldPrice)}</del> : null}<Pill>{product.condition}</Pill></div>
    {shop && <div className="product-shop"><Link to={`/shop/${shop.id}`} go={go}><Store size={13} /> {shop.name}</Link><span><MapPin size={13} /> {shop.location}</span></div>}
  </div></article>
}

export function ProductDetail({ product, shop, go, add, saved, save }: { product: Product; shop?: Shop; go: Navigate; add: () => void; saved: boolean; save: () => void }) {
  const [active, setActive] = useState(0)
  return <main className="wrap inner-page"><Link to="/#discover" go={go} className="back-link"><ArrowLeft size={17} /> Back to finds</Link><div className="detail-grid">
    <div className="detail-gallery"><Asset src={product.images[active]} width={850} alt={product.name} />{product.images.length > 1 && <div className="image-thumbs">{product.images.map((image, index) => <button className={index === active ? 'selected' : ''} onClick={() => setActive(index)} key={image} aria-label={`Show photo ${index + 1}`}><Asset src={image} width={160} alt="" /></button>)}</div>}</div>
    <div className="detail-info"><span className="eyebrow"><Tag size={15} /> {product.brand} / {product.category}</span><h1>{product.name}</h1><div className="detail-price"><strong>{money(product.price)}</strong>{product.oldPrice ? <del>{money(product.oldPrice)}</del> : null}<Pill tone="positive">{product.condition}</Pill></div><p>{product.description || 'A pre-loved find from a local UkayLoop seller.'}</p>
    <dl className="detail-specs"><div><dt>Size</dt><dd>{product.size || 'Not specified'}</dd></div><div><dt>Availability</dt><dd>{product.quantity > 0 ? `${product.quantity} in stock` : 'Sold out'}</dd></div><div><dt>Type</dt><dd>{product.type}</dd></div><div><dt>Defects or signs of wear</dt><dd>{product.defects || 'None disclosed'}</dd></div></dl>
    <div className="detail-actions"><button className="btn primary" disabled={product.quantity <= 0} onClick={add}><ShoppingBag size={17} /> Add to Bag</button><button className="btn secondary" aria-pressed={saved} onClick={save}><Heart size={17} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved' : 'Save'}</button></div>
    {shop && <Link className="shop-preview-link" to={`/shop/${shop.id}`} go={go}><Avatar src={shop.avatar} name={shop.name} size={46} /><span><strong>{shop.name}</strong><small><MapPin size={12} />{shop.location}</small></span><ArrowRight size={17} /></Link>}
  </div></div></main>
}

export function ShopProfile({ shop, products, go, favorites, favorite }: Omit<MarketProps, 'shops'> & { shop: Shop }) {
  const mapLocation = encodeURIComponent(shop.pin || `${shop.location}, Philippines`)
  return <main className="wrap inner-page"><Link className="back-link" to="/#shops" go={go}><ArrowLeft size={17} /> Explore shops</Link><section className="shop-profile"><div className="shop-cover">{shop.cover && <Asset src={shop.cover} width={1200} alt="" />}</div><div className="shop-profile-body"><Avatar src={shop.avatar} name={shop.name} size={105} /><span className="eyebrow"><CheckCircle2 size={15} /> UKAYLOOP SHOP</span><h1>{shop.name}</h1><div className="profile-location"><MapPin size={16} /> {shop.location}</div><p>{shop.description}</p><div className="profile-stats"><Pill tone="positive">{products.length} listings</Pill><Pill>{products.filter(product => product.type === 'Bundle').length} bundles</Pill>{shop.contact && <Pill>{shop.contact}</Pill>}{shop.social && <a href={shop.social} target="_blank" rel="noreferrer" className="text-btn">Shop social page <ArrowRight size={13} /></a>}</div></div></section><Discovery shops={[shop]} products={products} go={go} favorites={favorites} favorite={favorite} shopMode /><section className="shop-map"><div><span className="eyebrow"><MapPin size={14} /> FIND THE SHOP</span><h2>{shop.location}</h2><a className="btn secondary" href={`https://www.google.com/maps/search/?api=1&query=${mapLocation}`} target="_blank" rel="noreferrer">Open Google Maps <ArrowRight size={15} /></a></div><iframe title={`Map of ${shop.location}`} src={`https://maps.google.com/maps?q=${mapLocation}&z=13&output=embed`} loading="lazy" referrerPolicy="no-referrer" /></section></main>
}
