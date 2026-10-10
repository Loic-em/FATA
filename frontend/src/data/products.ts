export type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  parentCategory?: string;
  seller: string;
  storeId: string;
  image: string;
  badge?: string;
  description: string;
  rating: number;
  reviews: number;
  stock: number;
  originalPrice?: number;
};

export const categories = [
  { name: "Mode", image: "/fata-mode.jpg" },
  { name: "Beauté", image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=900&q=85" },
  { name: "Électronique", image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85" },
  { name: "Accessoires", image: "/fata-accessories.jpg" },
];

export const products: Product[] = [
  { id: "1", name: "Sneakers Kora", price: 32500, category: "Mode", seller: "Atelier Naya", storeId: "atelier-naya", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85", badge: "Bestseller", description: "Une silhouette affirmée, des matières souples et un confort pensé pour vous accompagner toute la journée.", rating: 4.9, reviews: 28, stock: 18 },
  { id: "2", name: "Casque Studio sans fil", price: 48500, category: "Électronique", seller: "Maison Sonore", storeId: "maison-sonore", image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85", badge: "Nouveau", description: "Un son riche et équilibré, une connexion sans fil simple et une autonomie généreuse pour vos journées actives.", rating: 4.8, reviews: 16, stock: 12 },
  { id: "3", name: "Sac Kente Mini", price: 28000, category: "Mode", seller: "Atelier Naya", storeId: "atelier-naya", image: "/fata-photo.jpg", description: "Un sac compact confectionné avec soin, aux détails inspirés des tissus et savoir-faire d'Afrique de l'Ouest.", rating: 4.7, reviews: 11, stock: 9 },
  { id: "4", name: "Montre Solaire", price: 39500, category: "Accessoires", seller: "Maison Sonore", storeId: "maison-sonore", image: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=900&q=85", badge: "Coup de cœur", description: "Une montre au cadran épuré qui apporte une touche élégante à toutes vos tenues.", rating: 4.6, reviews: 9, stock: 6 },
  { id: "5", name: "Vase Terre d'Abidjan", price: 18500, category: "Artisanat", seller: "Les Mains d'Or", storeId: "les-mains-dor", image: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=900&q=85", description: "Chaque pièce est façonnée à la main. De légères variations de forme rendent votre vase unique.", rating: 5, reviews: 7, stock: 14 },
  { id: "6", name: "Huile botanique Néroli", price: 12000, category: "Beauté", seller: "Néroli Nature", storeId: "neroli-nature", image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=900&q=85", badge: "Naturel", description: "Une huile légère aux extraits botaniques, conçue pour prendre soin de votre peau au quotidien.", rating: 4.8, reviews: 32, stock: 24 },
  { id: "7", name: "Lampe Nimba", price: 27000, category: "Maison", seller: "Les Mains d'Or", storeId: "les-mains-dor", image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=85", description: "Une lumière douce et chaleureuse pour créer un coin de calme dans votre intérieur.", rating: 4.7, reviews: 13, stock: 8 },
  { id: "8", name: "Lunettes Sable", price: 22000, category: "Accessoires", seller: "Atelier Naya", storeId: "atelier-naya", image: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=900&q=85", originalPrice: 26000, description: "Une monture intemporelle et légère, idéale pour les journées ensoleillées.", rating: 4.5, reviews: 14, stock: 20 },
];

export const stores = [
  { id: "atelier-naya", name: "Atelier Naya", category: "Mode & accessoires", city: "Abidjan", description: "Des essentiels du quotidien avec une touche singulière. Atelier Naya célèbre la créativité locale à travers des pièces faciles à porter et faites pour durer.", image: "/fata-photo.jpg" },
  { id: "maison-sonore", name: "Maison Sonore", category: "Tech & lifestyle", city: "Abidjan", description: "Une sélection attentive d'objets qui rendent le quotidien plus simple, plus beau et plus agréable à écouter.", image: "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=1400&q=85" },
  { id: "les-mains-dor", name: "Les Mains d'Or", category: "Maison & artisanat", city: "Grand-Bassam", description: "Des objets façonnés à la main par des artisans passionnés, pour donner du caractère à votre intérieur.", image: "/fata-photo.jpg" },
  { id: "neroli-nature", name: "Néroli Nature", category: "Beauté & bien-être", city: "Abidjan", description: "Des soins inspirés par les plantes et pensés pour une routine beauté simple et lumineuse.", image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=1400&q=85" },
];
