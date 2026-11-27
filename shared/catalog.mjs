export const categories = ['Tops', 'Bottoms', 'Outerwear', 'Dresses', 'Footwear', 'Accessories', 'Bundles']
export const conditions = ['Like New', 'Excellent', 'Very Good', 'Good', 'Fair']

export const demoShops = [
  ['manila-thrift', 'Manila Thrift Co.', 'Manila', 'Everyday classics and streetwear sourced from around the Metro.'],
  ['denim-district', 'Denim District', 'Quezon City', 'Vintage denim and workwear with plenty of life left.'],
  ['the-daily-ukay', 'The Daily Ukay', 'Pasig', 'A small rotation of easy, well-made pieces for everyday wear.'],
  ['old-soul', 'Old Soul Finds', 'Baguio', 'Slowly sourced sweaters, keepsakes, and cool-weather staples.'],
  ['retro-republic', 'Retro Republic', 'Cebu City', 'Sporty throwbacks, classic sneakers, and the occasional rare find.'],
  ['thread-story', 'Thread Story', 'Makati', 'Textural fabrics, thoughtful silhouettes, and soft colors.'],
  ['second-sunday', 'Second Sunday', 'Davao City', 'Smart bundles and small-batch drops for relaxed weekends.'],
  ['cebu-closet', 'Cebu Closet', 'Lapu-Lapu', 'Coastal layers, natural fabrics, and sunny secondhand finds.'],
].map(([id, name, location, description], index) => ({ id, name, location, description, avatar: `/img/shop-${index + 1}.jpg`, cover: '/img/hero.jpg', demo: true, published: true }))

export const demoProducts = [
  ['vintage-denim', 'Vintage Denim Jacket', "Levi’s", 790, 990, 'Outerwear', 'Excellent', 1, 'M', 'Featured', 'Classic medium-wash trucker jacket with a relaxed vintage fit and copper-toned buttons.'],
  ['nike-crewneck', 'Forest Green Crewneck', 'Nike', 650, 0, 'Tops', 'Like New', 0, 'L', '', 'An easy, heavyweight pullover in forest green with an embroidered logo.'],
  ['straight-jeans', 'Vintage Straight-Leg Jeans', "Levi’s", 580, 0, 'Bottoms', 'Very Good', 2, 'W28', '', 'Soft light-wash denim with a high rise and a classic straight leg.'],
  ['linen-shirt', 'Relaxed Linen Shirt', 'Uniqlo', 450, 0, 'Tops', 'Excellent', 5, 'M', 'New In', 'Airy ivory linen, a relaxed collar, and a slightly oversized silhouette.'],
  ['leather-bag', 'Cognac Shoulder Bag', 'Vintage', 720, 0, 'Accessories', 'Very Good', 3, 'One size', '', 'A curved vintage leather shoulder bag with a warm cognac finish.'],
  ['canvas-sneakers', 'Classic Canvas Low Tops', 'Converse', 790, 0, 'Footwear', 'Good', 4, 'EU 39', '', 'Broken-in canvas sneakers with contrast trim and original laces.'],
  ['weekend-tees', 'Weekend Tee Bundle', 'Mixed', 380, 0, 'Bundles', 'Excellent', 6, 'M–L', 'Bundle', 'Two breathable cotton tees in wear-everywhere neutral colors.'],
  ['garden-dress', 'Garden Midi Dress', 'Mixed', 530, 0, 'Dresses', 'Like New', 7, 'S–M', '', 'An easy sleeveless midi with a tiny floral print and a softly gathered waist.'],
].map(([id, name, brand, price, oldPrice, category, condition, shopIndex, size, badge, description], index) => ({
  id, name, brand, price, oldPrice, category, condition, shopId: demoShops[shopIndex].id, size, badge, description,
  images: [`/img/item-${index + 1}.jpg`], defects: index === 5 ? 'Light scuffing at the toe caps.' : 'No major defects noted.',
  type: category === 'Bundles' ? 'Bundle' : 'Individual', kind: brand === 'Mixed' ? 'Mixed Ukay' : 'Branded',
  quantity: 1, purchased: 1, cost: Math.round(price * .44), status: 'Active', popularity: 90 - index * 3, demo: true,
  createdAt: new Date(Date.UTC(2026, 3, 22 - index)).toISOString(),
}))
