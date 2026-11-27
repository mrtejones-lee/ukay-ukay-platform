# UkayLoop

UkayLoop is a Filipino marketplace for pre-loved clothing. Shoppers can browse shop profiles, compare finds in Philippine pesos, and try a signed-in checkout. Sellers can launch a shop, manage listings and multi-photo uploads, track expenses and offline sales, and review business insights. Administrators can monitor storefront access and test marketplace activity. The storefront includes example shops and products, and both workspaces offer a clearly labeled demo.

## Stack

React, TypeScript, Vite, Lucide icons, and Recharts power the interface. A Hono app on Netlify Server handles the API. Netlify Database (Postgres with Drizzle) stores shops, inventory, orders, and expenses; Netlify Blobs stores uploaded photos. Netlify Identity handles email sign-up, verification, login, and recovery. The Google login button appears only if the provider is enabled for the site.

## Local development

Use Node.js 24+ and run `npm ci`. With the Netlify CLI linked to the project, run `netlify dev --port 8889` and open `http://localhost:8889`. The public catalog and demo workspaces can be used without sign-in. Verify authenticated flows on a Netlify deploy with Identity enabled. Database migrations in `netlify/database/migrations/` are applied by Netlify at deploy time.

- `/seller/overview?demo=1` opens the sample seller workspace.
- `/admin/overview?demo=1` opens the sample admin console. Live admin access is limited to accounts with the Identity `admin` application role.
- A signed-in customer can open a seller workspace and create one shop. Published shops and their in-stock listings appear publicly only while their subscription is current and no administrative hold is in place.

## Test payments and billing

GCash and Maya checkout records simulated outcomes and generates printable test receipts. It does **not** charge a wallet, move inventory, fulfill an order, or contribute to seller profit. The live seller workspace recognizes offline sales the seller records after receiving payment, with cost and price snapshotted at the time of sale. Unpaid, failed, refunded, and unsold inventory do not generate profit. Sample seller analytics use sample transactions.

New shops receive a free calendar month. The ₱200 renewal and payment history can be previewed in the seller demo; live recurring billing is not connected. Expired shops are hidden automatically. Three months of inactivity make a shop eligible for retention review, not automatic deletion. There is no deletion scheduler or daily warning delivery until a retention, recovery, and notification policy is implemented. Shop pins use Google Maps embeds and manually entered or device-provided coordinates, without a Maps API key.
