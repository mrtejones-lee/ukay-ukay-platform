import { emptyTithe, localDay, sampleProducts, sampleShops, type SellerData, type Sale, type Status } from './model'

export function makeDemoSeller(): SellerData {
  const shop = { ...sampleShops[0], paidUntil: new Date(Date.now() + 18 * 86400000).toISOString(), createdAt: new Date(Date.now() - 12 * 86400000).toISOString(), tithe: { ...emptyTithe } }
  const products = sampleProducts.map((product, index) => ({ ...product, shopId: shop.id, quantity: 2 + index % 3, purchased: 22 + index }))
  const names = ['Mika Reyes', 'Paolo Santos', 'Kaye Mendoza', 'Jules Aquino', 'Andi Flores', 'Sam Villanueva']
  const sales: Sale[] = Array.from({ length: 40 }, (_, index) => {
    const product = products[index % products.length]
    const date = new Date()
    date.setDate(date.getDate() - Math.floor(index ** 1.34))
    const order = { id: `UL-${1052 - index}`, customerId: `sample-${index % names.length}`, customerName: names[index % names.length], status: (index === 1 || index === 4 ? 'Pending' : index === 7 ? 'Refunded' : index === 14 ? 'Failed' : 'Successful') as Status, createdAt: date.toISOString(), method: index % 2 ? 'Maya' : 'GCash' }
    return { order, item: { listingId: product.id, shopId: shop.id, name: product.name, brand: product.brand, type: product.type, price: product.price, cost: product.cost || 0, quantity: 1 + (index % 5 === 3 ? 1 : 0) } }
  })
  const daysAgo = (days: number) => localDay(new Date(Date.now() - days * 86400000))
  return { shop, products, sales, expenses: [{ id: 'exp-1', name: 'Packaging supplies', amount: 195, date: daysAgo(1) }, { id: 'exp-2', name: 'Denim repair', listingId: products[0].id, amount: 85, date: daysAgo(3) }, { id: 'exp-3', name: 'Sourcing transport', amount: 230, date: daysAgo(33) }] }
}

export type AdminData = { shops: NonNullable<SellerData['shop']>[]; transactions: { id: string; status: Status; method: string; createdAt: string; total: number | string }[]; customers: number }
export function makeDemoAdmin(): AdminData {
  const days = 86400000
  return { shops: sampleShops.map((shop, index) => ({ ...shop, paidUntil: new Date(Date.now() + (index < 5 ? 24 : index === 7 ? -112 : -11) * days).toISOString(), createdAt: new Date(Date.now() - (index === 1 ? 6 : 145) * days).toISOString() })),
    transactions: makeDemoSeller().sales.map(({ order, item }) => ({ id: order.id, status: order.status, method: order.method, createdAt: order.createdAt, total: item.price * item.quantity })), customers: 26 }
}
