import { boolean, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const shops = pgTable('shops', {
  id: text().primaryKey(), owner: text().notNull().unique(), name: text().notNull(), location: text().notNull(),
  description: text().notNull().default(''), contact: text().notNull().default(''), social: text().notNull().default(''),
  avatar: text().notNull().default(''), cover: text().notNull().default(''), pin: text().notNull().default(''),
  published: boolean().notNull().default(false), suspended: boolean().notNull().default(false),
  paidUntil: timestamp('paid_until', { withTimezone: true }).notNull(), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  tithe: jsonb().$type<{ enabled: boolean; rate: number; basis: string; adjustment: number; summary: boolean }>().notNull().default({ enabled: false, rate: 0, basis: 'net', adjustment: 0, summary: false }),
})

export const listings = pgTable('listings', {
  id: text().primaryKey(), shopId: text('shop_id').notNull().references(() => shops.id),
  name: text().notNull(), brand: text().notNull(), category: text().notNull(), condition: text().notNull(),
  type: text().notNull().default('Individual'), kind: text().notNull().default('Branded'), size: text().notNull().default(''),
  description: text().notNull().default(''), defects: text().notNull().default(''), tags: text().notNull().default(''),
  images: jsonb().$type<string[]>().notNull().default([]), price: integer().notNull(), cost: integer().notNull().default(0),
  quantity: integer().notNull(), purchased: integer().notNull(), status: text().notNull().default('Active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('listings_shop_idx').on(table.shopId)])

export const orders = pgTable('orders', {
  id: text().primaryKey(), customerId: text('customer_id').notNull(), customerName: text('customer_name').notNull(),
  method: text().notNull(), status: text().notNull(), delivery: jsonb().$type<{ address: string; phone: string }>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('orders_customer_idx').on(table.customerId)])

export const orderItems = pgTable('order_items', {
  id: text().primaryKey(), orderId: text('order_id').notNull().references(() => orders.id),
  listingId: text('listing_id').notNull(), shopId: text('shop_id').notNull(), name: text().notNull(), brand: text().notNull(),
  type: text().notNull(), price: integer().notNull(), cost: integer().notNull(), quantity: integer().notNull(),
}, table => [index('order_items_order_idx').on(table.orderId), index('order_items_shop_idx').on(table.shopId)])

export const expenses = pgTable('expenses', {
  id: text().primaryKey(), shopId: text('shop_id').notNull().references(() => shops.id), name: text().notNull(),
  listingId: text('listing_id'), amount: integer().notNull(), date: text().notNull(),
}, table => [index('expenses_shop_idx').on(table.shopId)])

export const media = pgTable('media', {
  id: text().primaryKey(), owner: text().notNull(), type: text().notNull(),
})
