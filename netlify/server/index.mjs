import { getStore } from '@netlify/blobs'
import { getDatabase } from '@netlify/database'
import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/netlify-db'
import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import * as schema from '../../db/schema.ts'
import { categories, conditions, demoProducts } from '../../shared/catalog.mjs'

const { shops, listings, orders, orderItems, expenses, media } = schema
const app = new Hono().basePath('/api')
let database
const db = () => database ??= drizzle({ client: getDatabase(), schema })
const blobStore = () => getStore({ name: 'listing-images', consistency: 'strong' })
const text = (value, max = 180) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const integer = (value, min = 0, max = 10_000_000) => Number.isSafeInteger(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : min
const publicRules = () => and(eq(shops.published, true), eq(shops.suspended, false), gt(shops.paidUntil, new Date()))
const publicShop = ({ owner, tithe, paidUntil, suspended, ...shop }) => shop
const publicProduct = ({ cost, purchased, status, ...product }) => product
const isAdmin = user => Array.isArray(user?.app_metadata?.roles) && user.app_metadata.roles.includes('admin')
const calendarMonths = (date, months) => {
  const result = new Date(date)
  const day = result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + months)
  result.setUTCDate(Math.min(day, new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()))
  return result
}
const fail = (status, message) => Object.assign(new Error(message), { status })
const externalLink = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : '' } catch { return '' } }

app.use('*', async (context, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(context.req.method) && context.req.header('sec-fetch-site') === 'cross-site') return context.json({ error: 'Invalid request origin.' }, 403)
  await next()
  context.header('X-Content-Type-Options', 'nosniff')
  if (!context.res.headers.has('Cache-Control')) context.header('Cache-Control', 'private, no-store')
})

app.onError((error, context) => {
  if ([400, 401, 403, 404, 409, 413, 415, 422].includes(error.status)) return context.json({ error: error.message }, error.status)
  return context.json({ error: 'UkayLoop could not complete that request. Please try again.' }, 503)
})

async function readUser(context) {
  const jwt = getCookie(context, 'nf_jwt')
  if (!jwt) return null
  const identity = new URL('/.netlify/identity/user', process.env.URL || 'https://ukay-ukay-platform.netlify.app')
  const response = await fetch(identity, { headers: { Authorization: `Bearer ${jwt}` }, signal: AbortSignal.timeout(6000) })
  if (response.status === 401 || response.status === 403) return null
  if (!response.ok) throw new Error('Identity unavailable')
  const user = await response.json()
  return user.id ? user : null
}

async function requireUser(context, next) {
  const user = await readUser(context)
  if (!user) throw fail(401, 'Sign in to continue.')
  context.set('user', user)
  return next()
}

async function sellerShop(context) {
  const [shop] = await db().select().from(shops).where(eq(shops.owner, context.get('user').id))
  if (!shop) throw fail(404, 'Create a shop before adding listings or expenses.')
  return shop
}

async function uploadedImages(user, urls) {
  if (!Array.isArray(urls)) return []
  const ids = [...new Set(urls.filter(url => typeof url === 'string' && /^\/api\/media\/[0-9a-f-]{36}$/.test(url)).map(url => url.split('/').at(-1)))].slice(0, 6)
  if (!ids.length) return []
  const assets = await db().select({ id: media.id }).from(media).where(and(eq(media.owner, user.id), inArray(media.id, ids)))
  const allowed = new Set(assets.map(asset => asset.id))
  return ids.filter(id => allowed.has(id)).map(id => `/api/media/${id}`)
}

app.get('/catalog', async context => {
  const visible = await db().select().from(shops).where(publicRules())
  const products = visible.length ? await db().select().from(listings).where(and(inArray(listings.shopId, visible.map(shop => shop.id)), eq(listings.status, 'Active'), gt(listings.quantity, 0))).orderBy(desc(listings.createdAt)) : []
  const counts = products.length ? await db().select({ id: orderItems.listingId, units: sql`sum(${orderItems.quantity})` }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).where(and(eq(orders.method, 'Offline'), eq(orders.status, 'Successful'), inArray(orderItems.listingId, products.map(product => product.id)))).groupBy(orderItems.listingId) : []
  const popular = new Map(counts.map(count => [count.id, Number(count.units)]))
  return context.json({ shops: visible.map(publicShop), products: products.map(product => ({ ...publicProduct(product), popularity: popular.get(product.id) || 0 })) })
})

app.post('/media', requireUser, async context => {
  const limit = 4 * 1024 * 1024
  if (Number(context.req.header('content-length')) > limit) throw fail(413, 'Each image must be smaller than 4 MB.')
  const image = await context.req.arrayBuffer()
  if (image.byteLength > limit) throw fail(413, 'Each image must be smaller than 4 MB.')
  const bytes = new Uint8Array(image)
  const stamp = Buffer.from(bytes.subarray(0, 12))
  const type = stamp.subarray(0, 3).toString('hex') === 'ffd8ff' ? 'image/jpeg'
    : stamp.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' ? 'image/png'
    : stamp.toString('ascii', 0, 4) === 'RIFF' && stamp.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : ''
  if (!type) throw fail(415, 'Use JPG, PNG, or WebP images.')
  const id = crypto.randomUUID()
  await blobStore().set(id, image)
  await db().insert(media).values({ id, owner: context.get('user').id, type })
  return context.json({ url: `/api/media/${id}` }, 201)
})

app.get('/media/:id', async context => {
  const id = context.req.param('id')
  if (!/^[0-9a-f-]{36}$/.test(id)) throw fail(404, 'Image not found.')
  const [asset] = await db().select().from(media).where(eq(media.id, id))
  if (!asset) throw fail(404, 'Image not found.')
  const path = `/api/media/${id}`
  const [visible] = await db().select({ id: shops.id }).from(shops).where(and(eq(shops.owner, asset.owner), publicRules(), sql`(${shops.avatar} = ${path} OR ${shops.cover} = ${path} OR EXISTS (SELECT 1 FROM ${listings} WHERE ${listings.shopId} = ${shops.id} AND ${listings.status} = 'Active' AND ${listings.quantity} > 0 AND ${listings.images} ? ${path}))`)).limit(1)
  if (!visible && (await readUser(context))?.id !== asset.owner) throw fail(404, 'Image not found.')
  const image = await blobStore().get(id, { type: 'arrayBuffer' })
  if (!image) throw fail(404, 'Image not found.')
  return new Response(image, { headers: { 'Content-Type': asset.type, 'Cache-Control': visible ? 'public, max-age=300' : 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
})

app.get('/seller', requireUser, async context => {
  const [shop] = await db().select().from(shops).where(eq(shops.owner, context.get('user').id))
  if (!shop) return context.json({ shop: null, products: [], sales: [], expenses: [] })
  const [products, sales, costs] = await Promise.all([
    db().select().from(listings).where(eq(listings.shopId, shop.id)).orderBy(desc(listings.createdAt)),
    db().select({ item: orderItems, order: { id: orders.id, customerId: orders.customerId, customerName: orders.customerName, status: orders.status, createdAt: orders.createdAt, method: orders.method } }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).where(eq(orderItems.shopId, shop.id)).orderBy(desc(orders.createdAt)),
    db().select().from(expenses).where(eq(expenses.shopId, shop.id)).orderBy(desc(expenses.date)),
  ])
  return context.json({ shop, products, sales, expenses: costs })
})

app.put('/seller/shop', requireUser, async context => {
  const user = context.get('user')
  const data = await context.req.json()
  const name = text(data.name, 80)
  const location = text(data.location, 100)
  if (!name || !location) throw fail(422, 'Shop name and location are required.')
  const images = await uploadedImages(user, [data.avatar, data.cover])
  const pin = text(data.pin, 70)
  const coords = pin.split(',').map(value => Number(value.trim()))
  if (pin && (coords.length !== 2 || coords.some(value => !Number.isFinite(value)) || Math.abs(coords[0]) > 90 || Math.abs(coords[1]) > 180)) throw fail(422, 'Enter a valid latitude and longitude, separated by a comma.')
  const changes = { name, location, description: text(data.description, 1500), contact: text(data.contact), social: externalLink(data.social), pin, published: data.published === true,
    avatar: images.includes(data.avatar) ? data.avatar : '', cover: images.includes(data.cover) ? data.cover : '' }
  const [shop] = await db().insert(shops).values({ id: crypto.randomUUID(), owner: user.id, paidUntil: calendarMonths(new Date(), 1), ...changes }).onConflictDoUpdate({ target: shops.owner, set: changes }).returning()
  return context.json(shop)
})

app.put('/seller/tithe', requireUser, async context => {
  const shop = await sellerShop(context)
  const data = await context.req.json()
  const rate = Number(data.rate)
  const adjustment = Number(data.adjustment)
  const tithe = { enabled: data.enabled === true, rate: Number.isFinite(rate) ? Math.max(0, Math.min(100, rate)) : 0,
    adjustment: Number.isFinite(adjustment) ? Math.max(-10_000_000, Math.min(10_000_000, adjustment)) : 0,
    basis: ['sales', 'gross', 'net'].includes(data.basis) ? data.basis : 'net', summary: data.summary === true }
  await db().update(shops).set({ tithe }).where(eq(shops.id, shop.id))
  return context.json(tithe)
})

app.put('/seller/listings/:id', requireUser, async context => {
  const shop = await sellerShop(context)
  const id = context.req.param('id')
  const data = await context.req.json()
  const name = text(data.name, 110)
  if (!name || !categories.includes(data.category) || !conditions.includes(data.condition) || integer(data.price) < 1) throw fail(422, 'Name, category, condition, and a positive price are required.')
  const quantity = integer(data.quantity, 0, 100000)
  const changes = { name, brand: text(data.brand, 70) || 'Mixed', category: data.category, condition: data.condition,
    size: text(data.size, 25), description: text(data.description, 2000), defects: text(data.defects, 1000), tags: text(data.tags, 200),
    type: data.type === 'Bundle' ? 'Bundle' : 'Individual', kind: data.kind === 'Mixed Ukay' ? 'Mixed Ukay' : 'Branded',
    images: await uploadedImages(context.get('user'), data.images), price: integer(data.price), cost: integer(data.cost), quantity,
    purchased: Math.max(quantity, integer(data.purchased, 0, 100000)), status: ['Active', 'Sold', 'Archived'].includes(data.status) ? data.status : 'Active' }
  if (id === 'new') {
    const [product] = await db().insert(listings).values({ id: crypto.randomUUID(), shopId: shop.id, ...changes }).returning()
    return context.json(product, 201)
  }
  const [product] = await db().update(listings).set(changes).where(and(eq(listings.id, id), eq(listings.shopId, shop.id))).returning()
  if (!product) throw fail(404, 'Listing not found.')
  return context.json(product)
})

app.delete('/seller/listings/:id', requireUser, async context => {
  const shop = await sellerShop(context)
  const [product] = await db().delete(listings).where(and(eq(listings.id, context.req.param('id')), eq(listings.shopId, shop.id))).returning()
  if (!product) throw fail(404, 'Listing not found.')
  return context.json({ ok: true })
})

app.put('/seller/expenses/:id', requireUser, async context => {
  const shop = await sellerShop(context)
  const id = context.req.param('id')
  const data = await context.req.json()
  const changes = { name: text(data.name, 140), date: text(data.date, 10), amount: integer(data.amount), listingId: null }
  if (!changes.name || !changes.amount || !/^\d{4}-\d{2}-\d{2}$/.test(changes.date)) throw fail(422, 'Enter an expense name, date, and positive amount.')
  if (data.listingId) {
    const [listing] = await db().select({ id: listings.id }).from(listings).where(and(eq(listings.id, data.listingId), eq(listings.shopId, shop.id)))
    if (!listing) throw fail(422, 'Select an item from your shop.')
    changes.listingId = listing.id
  }
  const [expense] = id === 'new' ? await db().insert(expenses).values({ id: crypto.randomUUID(), shopId: shop.id, ...changes }).returning()
    : await db().update(expenses).set(changes).where(and(eq(expenses.id, id), eq(expenses.shopId, shop.id))).returning()
  if (!expense) throw fail(404, 'Expense not found.')
  return context.json(expense)
})

app.delete('/seller/expenses/:id', requireUser, async context => {
  const shop = await sellerShop(context)
  await db().delete(expenses).where(and(eq(expenses.id, context.req.param('id')), eq(expenses.shopId, shop.id)))
  return context.json({ ok: true })
})

app.post('/seller/sales', requireUser, async context => {
  const shop = await sellerShop(context)
  const data = await context.req.json()
  const listingId = text(data.listingId, 100)
  const price = integer(data.price)
  const quantity = integer(data.quantity, 0, 100000)
  const day = text(data.date, 10)
  const createdAt = new Date(`${day}T12:00:00+08:00`)
  const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
  if (!listingId || !price || !quantity || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(createdAt.getTime()) || createdAt.toISOString().slice(0, 10) !== day || day > today) throw fail(422, 'Choose a listing and provide a valid sale date, quantity, and price.')
  const result = await db().transaction(async transaction => {
    const [product] = await transaction.update(listings).set({ quantity: sql`${listings.quantity} - ${quantity}` }).where(and(eq(listings.id, listingId), eq(listings.shopId, shop.id), sql`${listings.quantity} >= ${quantity}`)).returning()
    if (!product) throw fail(409, 'This listing does not have enough units available.')
    const order = { id: crypto.randomUUID(), customerId: `offline:${shop.id}`, customerName: 'Offline customer', status: 'Successful', method: 'Offline', createdAt }
    await transaction.insert(orders).values({ ...order, delivery: { address: '', phone: '' } })
    const item = { listingId, shopId: shop.id, name: product.name, brand: product.brand, type: product.type, price, cost: product.cost, quantity }
    await transaction.insert(orderItems).values({ ...item, id: crypto.randomUUID(), orderId: order.id })
    return { product, sale: { item, order } }
  })
  return context.json(result, 201)
})

app.get('/orders', requireUser, async context => {
  const mine = await db().select().from(orders).where(eq(orders.customerId, context.get('user').id)).orderBy(desc(orders.createdAt))
  const items = mine.length ? await db().select({ id: orderItems.id, orderId: orderItems.orderId, name: orderItems.name, price: orderItems.price, quantity: orderItems.quantity }).from(orderItems).where(inArray(orderItems.orderId, mine.map(order => order.id))) : []
  return context.json(mine.map(order => ({ ...order, items: items.filter(item => item.orderId === order.id) })))
})

app.post('/orders', requireUser, async context => {
  const user = context.get('user')
  const data = await context.req.json()
  const customerName = text(data.name, 110)
  const delivery = { address: text(data.address, 300), phone: text(data.phone, 30) }
  const methods = ['GCash', 'Maya']
  const outcomes = ['Pending', 'Successful', 'Failed', 'Refunded']
  if (!customerName || !delivery.address || !delivery.phone || !methods.includes(data.method) || !outcomes.includes(data.status) || !Array.isArray(data.items) || !data.items.length || data.items.length > 24) throw fail(422, 'Complete your delivery details and select a test payment method.')
  const requested = new Map()
  for (const item of data.items) {
    if (!item || !text(item.id, 90) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 25 || requested.has(item.id)) throw fail(422, 'The bag contains an invalid item.')
    requested.set(item.id, item.quantity)
  }
  const id = crypto.randomUUID()
  await db().transaction(async transaction => {
    const live = await transaction.select({ product: listings }).from(listings).innerJoin(shops, eq(listings.shopId, shops.id))
      .where(and(inArray(listings.id, [...requested.keys()]), eq(listings.status, 'Active'), publicRules()))
    const products = new Map([...demoProducts, ...live.map(entry => entry.product)].map(product => [product.id, product]))
    await transaction.insert(orders).values({ id, customerId: user.id, customerName, method: data.method, status: data.status, delivery })
    for (const [listingId, quantity] of [...requested].sort(([first], [second]) => first.localeCompare(second))) {
      const product = products.get(listingId)
      if (!product || product.quantity < quantity) throw fail(409, 'An item is no longer available in the requested quantity.')
      await transaction.insert(orderItems).values({ id: crypto.randomUUID(), orderId: id, listingId, shopId: product.shopId, name: product.name, brand: product.brand, type: product.type, price: product.price, cost: product.cost, quantity })
    }
  })
  return context.json({ id, status: data.status }, 201)
})

app.use('/admin/*', requireUser, async (context, next) => {
  if (!isAdmin(context.get('user'))) throw fail(403, 'Administrator access is required.')
  return next()
})

app.get('/admin/overview', async context => {
  const [allShops, allOrders] = await Promise.all([db().select().from(shops), db().select({ id: orders.id, customerId: orders.customerId, status: orders.status, method: orders.method, createdAt: orders.createdAt, total: sql`coalesce(sum(${orderItems.price}::bigint * ${orderItems.quantity}), 0)` }).from(orders).leftJoin(orderItems, eq(orderItems.orderId, orders.id)).where(sql`${orders.method} <> 'Offline'`).groupBy(orders.id).orderBy(desc(orders.createdAt))])
  return context.json({ shops: allShops.map(({ owner, tithe, contact, ...shop }) => shop), transactions: allOrders.map(({ customerId, ...order }) => order), customers: new Set(allOrders.map(order => order.customerId)).size })
})

app.patch('/admin/shops/:id', async context => {
  const { suspended } = await context.req.json()
  if (typeof suspended !== 'boolean') throw fail(422, 'Choose a shop visibility status.')
  const [shop] = await db().update(shops).set({ suspended }).where(eq(shops.id, context.req.param('id'))).returning({ id: shops.id })
  if (!shop) throw fail(404, 'Shop not found.')
  return context.json(shop)
})

export default app
