CREATE TABLE "expenses" (
	"id" text PRIMARY KEY,
	"shop_id" text NOT NULL,
	"name" text NOT NULL,
	"listing_id" text,
	"amount" integer NOT NULL,
	"date" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" text PRIMARY KEY,
	"shop_id" text NOT NULL,
	"name" text NOT NULL,
	"brand" text NOT NULL,
	"category" text NOT NULL,
	"condition" text NOT NULL,
	"type" text DEFAULT 'Individual' NOT NULL,
	"kind" text DEFAULT 'Branded' NOT NULL,
	"size" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"defects" text DEFAULT '' NOT NULL,
	"tags" text DEFAULT '' NOT NULL,
	"images" jsonb DEFAULT '[]' NOT NULL,
	"price" integer NOT NULL,
	"cost" integer DEFAULT 0 NOT NULL,
	"quantity" integer NOT NULL,
	"purchased" integer NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" text PRIMARY KEY,
	"owner" text NOT NULL,
	"type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" text PRIMARY KEY,
	"order_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"shop_id" text NOT NULL,
	"name" text NOT NULL,
	"brand" text NOT NULL,
	"type" text NOT NULL,
	"price" integer NOT NULL,
	"cost" integer NOT NULL,
	"quantity" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY,
	"customer_id" text NOT NULL,
	"customer_name" text NOT NULL,
	"method" text NOT NULL,
	"status" text NOT NULL,
	"delivery" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" text PRIMARY KEY,
	"owner" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"location" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"contact" text DEFAULT '' NOT NULL,
	"social" text DEFAULT '' NOT NULL,
	"avatar" text DEFAULT '' NOT NULL,
	"cover" text DEFAULT '' NOT NULL,
	"pin" text DEFAULT '' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"suspended" boolean DEFAULT false NOT NULL,
	"paid_until" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tithe" jsonb DEFAULT '{"enabled":false,"rate":0,"basis":"net","adjustment":0,"summary":false}' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "expenses_shop_idx" ON "expenses" ("shop_id");--> statement-breakpoint
CREATE INDEX "listings_shop_idx" ON "listings" ("shop_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_shop_idx" ON "order_items" ("shop_id");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" ("customer_id");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_shop_id_shops_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id");--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_shop_id_shops_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id");