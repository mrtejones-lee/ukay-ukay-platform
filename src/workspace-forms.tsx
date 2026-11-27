import { useRef, useState, type FormEvent } from 'react'
import { ArrowRight, Eye, MapPin, Plus, Upload, X } from 'lucide-react'
import { categories, conditions } from '../shared/catalog.mjs'
import { api, localDay, type Expense, type Product, type Shop } from './model'
import { Asset, Avatar, Modal, Pill } from './ui'

type Notify = (message: string) => void
const initialListing: Product = { id: 'new', shopId: '', name: '', brand: '', category: 'Tops', type: 'Individual', kind: 'Branded', condition: 'Excellent', description: '', defects: '', tags: '', images: [], price: 0, cost: 0, purchased: 1, quantity: 1, size: '', status: 'Active' }

export function ImageInput({ images, change, demo, notify, limit = 6 }: { images: string[]; change: (urls: string[]) => void; demo: boolean; notify: Notify; limit?: number }) {
  const file = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  return <div className="upload"><div className="upload-preview">{images.map(image => <div key={image}><Asset src={image} width={240} alt="Upload preview" /><button className="icon-btn" type="button" onClick={() => change(images.filter(value => value !== image))} aria-label="Remove photo"><X size={14} /></button></div>)}
    {images.length < limit && <button type="button" className="upload-tile" onClick={() => file.current?.click()} disabled={busy}><Upload size={20} /><span>{busy ? 'Uploading…' : 'Add photo'}</span></button>}</div>
    <small>JPG, PNG or WebP, up to 4 MB per photo.</small><input ref={file} type="file" accept="image/jpeg,image/png,image/webp" multiple={limit > 1} hidden onChange={async event => {
      const selected = Array.from(event.target.files || []).slice(0, limit - images.length)
      event.target.value = ''; setBusy(true)
      const next = [...images]
      try {
        for (const asset of selected) {
          if (!/^image\/(jpeg|png|webp)$/.test(asset.type) || asset.size > 4 * 1024 * 1024) throw new Error('Choose a JPG, PNG or WebP below 4 MB.')
          next.push(demo ? URL.createObjectURL(asset) : (await api<{ url: string }>('/media', 'POST', asset)).url)
        }
      } catch (error) { notify(error instanceof Error ? error.message : 'Upload failed.') } finally { change(next); setBusy(false) }
    }} /></div>
}

export function ListingEditor({ edit, demo, notify, close, save }: { edit: Product | null; demo: boolean; notify: Notify; close: () => void; save: (product: Product) => Promise<void> }) {
  const product = edit || initialListing
  const [images, setImages] = useState(product.images)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const data = new FormData(event.currentTarget)
    const field = (name: string) => String(data.get(name) || '')
    try { await save({ ...product, name: field('name'), brand: field('brand') || 'Mixed', category: field('category'), type: field('type'), condition: field('condition'), kind: field('kind'), size: field('size'), tags: field('tags'), description: field('description'), defects: field('defects'), price: Number(field('price')), cost: Number(field('cost')), quantity: Number(field('quantity')), purchased: Number(field('purchased')), status: field('status'), images }); close() }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not save listing.') } finally { setBusy(false) }
  }
  return <Modal title={edit ? 'Edit listing' : 'Add a listing'} drawer close={close}><form className="form-stack" onSubmit={submit}>
    <div><h3>Listing photos</h3><ImageInput images={images} change={setImages} demo={demo} notify={notify} /></div>
    <label>Product name<input required name="name" maxLength={110} defaultValue={product.name} placeholder="e.g. Vintage denim jacket" /></label>
    <div className="form-grid"><label>Brand<input name="brand" defaultValue={product.brand} placeholder="e.g. Uniqlo or Mixed" /></label><label>Size<input name="size" defaultValue={product.size} placeholder="e.g. M" /></label><label>Category<select name="category" defaultValue={product.category}>{categories.map(name => <option key={name}>{name}</option>)}</select></label><label>Product type<select name="type" defaultValue={product.type}><option>Individual</option><option>Bundle</option></select></label><label>Condition<select name="condition" defaultValue={product.condition}>{conditions.map(name => <option key={name}>{name}</option>)}</select></label><label>Ukay type<select name="kind" defaultValue={product.kind}><option>Branded</option><option>Mixed Ukay</option></select></label></div>
    <label>Description<textarea name="description" defaultValue={product.description} maxLength={2000} /></label><label>Issues or defects<textarea name="defects" defaultValue={product.defects} maxLength={1000} /></label><label>Tags<input name="tags" defaultValue={product.tags} placeholder="vintage, workwear, cotton" /></label>
    <div className="form-grid"><label>Selling price (₱)<input type="number" name="price" min="1" max="10000000" required defaultValue={product.price || ''} /></label><label>Acquisition cost per unit (₱)<input type="number" name="cost" min="0" max="10000000" required defaultValue={product.cost || 0} /></label><label>Quantity purchased<input type="number" name="purchased" min="0" max="100000" required defaultValue={product.purchased || product.quantity} /></label><label>Quantity available<input type="number" name="quantity" min="0" max="100000" required defaultValue={product.quantity} /></label></div>
    <label>Listing status<select name="status" defaultValue={product.status || 'Active'}><option>Active</option><option>Archived</option><option>Sold</option></select></label>
    {error && <p className="form-error" role="alert">{error}</p>}<button className="btn primary full" disabled={busy}>{busy ? 'Saving…' : 'Save listing'} <ArrowRight size={16} /></button>
  </form></Modal>
}

export function ExpenseEditor({ edit, products, close, save }: { edit: Expense | null; products: Product[]; close: () => void; save: (expense: Expense) => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <Modal title={edit ? 'Edit expense' : 'Add an expense'} close={close}><form className="form-stack" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError(''); const values = new FormData(event.currentTarget)
    try { await save({ id: edit?.id || 'new', name: String(values.get('name')), amount: Number(values.get('amount')), date: String(values.get('date')), listingId: String(values.get('listingId') || '') || null }); close() }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not save expense.') } finally { setBusy(false) }
  }}><label>Expense name<input required name="name" defaultValue={edit?.name} placeholder="e.g. Packaging supplies" /></label><label>Amount (₱)<input name="amount" type="number" required min="1" max="10000000" defaultValue={edit?.amount} /></label><label>Date<input name="date" type="date" required defaultValue={edit?.date || localDay()} /></label><label>Related listing (optional)<select defaultValue={edit?.listingId || ''} name="listingId"><option value="">General shop expense</option>{products.map(product => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label>{error && <p className="form-error">{error}</p>}<button className="btn primary full" disabled={busy}>{busy ? 'Saving…' : 'Save expense'}</button></form></Modal>
}

export type ManualSale = { listingId: string; price: number; quantity: number; date: string }

export function SaleEditor({ products, close, save }: { products: Product[]; close: () => void; save: (sale: ManualSale) => Promise<void> }) {
  const [id, setId] = useState(products[0]?.id || '')
  const product = products.find(item => item.id === id)
  const [price, setPrice] = useState(product?.price || 0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <Modal title="Record a completed sale" close={close}><p>Use this for a payment you’ve already received outside UkayLoop. Recording it reduces available stock and adds to your financial summary.</p><form className="form-stack" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError(''); const values = new FormData(event.currentTarget)
    try { await save({ listingId: id, price, quantity: Number(values.get('quantity')), date: String(values.get('date')) }); close() }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not record sale.') } finally { setBusy(false) }
  }}><label>Listing<select value={id} required onChange={event => { setId(event.target.value); setPrice(products.find(item => item.id === event.target.value)?.price || 0) }}>{products.map(item => <option value={item.id} key={item.id}>{item.name} ({item.quantity} available)</option>)}</select></label><div className="form-grid"><label>Actual price per unit (₱)<input type="number" required min="1" max="10000000" value={price || ''} onChange={event => setPrice(Number(event.target.value))} /></label><label>Quantity sold<input name="quantity" type="number" required min="1" max={product?.quantity || 1} defaultValue="1" /></label></div><label>Sale date<input name="date" type="date" required max={localDay()} defaultValue={localDay()} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="btn primary full" disabled={busy || !id}>{busy ? 'Recording…' : 'Record sale'}</button></form></Modal>
}

export function ShopEditor({ shop, demo, save, notify }: { shop: Shop | null; demo: boolean; save: (shop: Shop) => Promise<void>; notify: Notify }) {
  const [draft, setDraft] = useState<Shop>(shop || { id: '', name: '', location: '', description: '', avatar: '', cover: '', published: false, pin: '' })
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  function update<Key extends keyof Shop>(name: Key, value: Shop[Key]) { setDraft(current => ({ ...current, [name]: value })) }
  const mapQuery = encodeURIComponent(draft.pin || `${draft.location || 'Philippines'}`)
  return <div className="shop-editor-grid"><section className="panel"><h2>Shop identity</h2><p className="muted">Tell shoppers what makes your collection yours.</p><form className="form-stack" onSubmit={async event => { event.preventDefault(); setBusy(true); setError(''); try { await save(draft) } catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not save shop.') } finally { setBusy(false) } }}>
    <div className="form-grid"><div><h3>Profile photo</h3><ImageInput images={draft.avatar ? [draft.avatar] : []} change={urls => update('avatar', urls[0] || '')} demo={demo} notify={notify} limit={1} /></div><div><h3>Cover photo</h3><ImageInput images={draft.cover ? [draft.cover] : []} change={urls => update('cover', urls[0] || '')} demo={demo} notify={notify} limit={1} /></div></div>
    <label>Shop name<input value={draft.name} onChange={event => update('name', event.target.value)} maxLength={80} required /></label><label>Shop description<textarea value={draft.description} onChange={event => update('description', event.target.value)} maxLength={1500} /></label>
    <label>Business location<input value={draft.location} onChange={event => update('location', event.target.value)} required placeholder="e.g. Baguio City, Benguet" /></label>
    <label>Map coordinates (optional)<input value={draft.pin || ''} onChange={event => update('pin', event.target.value)} placeholder="Latitude, longitude" /></label><div className="cluster"><button type="button" className="btn secondary small" onClick={() => navigator.geolocation ? navigator.geolocation.getCurrentPosition(position => update('pin', `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`), () => notify('Location is unavailable. Enter coordinates manually.')) : notify('Location is unavailable. Enter coordinates manually.')}><MapPin size={15} /> Use current location</button><a className="text-btn" href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noreferrer">Find coordinates on Google Maps <ArrowRight size={14} /></a></div>
    <div className="form-grid"><label>Public contact details<input value={draft.contact || ''} onChange={event => update('contact', event.target.value)} /></label><label>Social media URL<input type="url" value={draft.social || ''} onChange={event => update('social', event.target.value)} placeholder="https://" /></label></div>
    <label className="check"><input type="checkbox" checked={draft.published} onChange={event => update('published', event.target.checked)} /> Publish when my subscription is current</label>
    {error && <p className="form-error">{error}</p>}<div className="cluster"><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : shop ? 'Save changes' : 'Create shop'}</button><button type="button" className="btn secondary" onClick={() => setPreview(true)}><Eye size={16} /> Preview</button></div>
  </form></section><section className="panel"><h2>Storefront preview</h2><div className="mini-cover">{draft.cover && <Asset src={draft.cover} width={640} alt="" />}</div><div className="mini-shop"><Avatar src={draft.avatar} name={draft.name || 'New Shop'} size={72} /><h3>{draft.name || 'Your shop name'}</h3><p className="muted"><MapPin size={13} /> {draft.location || 'Shop location'}</p><p>{draft.description || 'Your shop introduction appears here.'}</p></div><iframe className="map-preview" title="Shop pin preview" loading="lazy" src={`https://maps.google.com/maps?q=${mapQuery}&z=13&output=embed`} /></section>
  {preview && <Modal title="Public storefront preview" close={() => setPreview(false)}><div className="mini-cover">{draft.cover && <Asset src={draft.cover} width={720} alt="" />}</div><div className="mini-shop"><Avatar src={draft.avatar} name={draft.name || 'Your shop'} size={72} /><h2>{draft.name || 'Your shop name'}</h2><p className="muted">{draft.location || 'Your location'}</p><p>{draft.description}</p>{draft.contact && <Pill>{draft.contact}</Pill>}</div></Modal>}</div>
}
