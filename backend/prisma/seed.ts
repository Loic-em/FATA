import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function seed() {
  const categories: { name: string; slug: string; image: string; active?: boolean }[] = [
    { name: "Mode", slug: "mode", image: "/fata-mode.jpg" },
    { name: "Beauté", slug: "beaute", image: "/fata-photo.jpg" },
    { name: "Électronique", slug: "electronique", image: "/fata-photo.jpg" },
    { name: "Accessoires", slug: "accessoires", image: "/fata-accessories.jpg" },
    { name: "Artisanat", slug: "artisanat", image: "/fata-photo.jpg", active: false },
    { name: "Maison", slug: "maison", image: "/fata-photo.jpg", active: false },
  ];

  for (const category of categories) {
    const { active = true, ...data } = category;
    await prisma.category.upsert({
      where: { slug: data.slug },
      update: { ...data, active },
      create: { ...data, active },
    });
  }

  const stores: { id: string; name: string; slug: string; category: string; city: string; description: string; image: string }[] = [
    { id: "atelier-naya", name: "Atelier Naya", slug: "atelier-naya", category: "Mode & accessoires", city: "Abidjan", description: "Des essentiels du quotidien avec une touche singulière. Atelier Naya célèbre la créativité locale à travers des pièces faciles à porter et faites pour durer.", image: "/fata-photo.jpg" },
    { id: "maison-sonore", name: "Maison Sonore", slug: "maison-sonore", category: "Tech & lifestyle", city: "Abidjan", description: "Une sélection attentive d'objets qui rendent le quotidien plus simple, plus beau et plus agréable à écouter.", image: "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=1400&q=85" },
    { id: "les-mains-dor", name: "Les Mains d'Or", slug: "les-mains-dor", category: "Maison & artisanat", city: "Grand-Bassam", description: "Des objets façonnés à la main par des artisans passionnés, pour donner du caractère à votre intérieur.", image: "/fata-photo.jpg" },
    { id: "neroli-nature", name: "Néroli Nature", slug: "neroli-nature", category: "Beauté & bien-être", city: "Abidjan", description: "Des soins inspirés par les plantes et pensés pour une routine beauté simple et lumineuse.", image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=1400&q=85" },
  ];

  for (const store of stores) {
    await prisma.store.upsert({
      where: { slug: store.slug },
      update: { ...store, status: "APPROVED" },
      create: { ...store, status: "APPROVED" },
    });
  }

  const categoryIds = new Map(
    (await prisma.category.findMany({ select: { id: true, slug: true } }))
      .map(category => [category.slug, category.id]),
  );
  const demoProducts: {
    id: string;
    name: string;
    price: number;
    categorySlug: string;
    storeId: string;
    image: string;
    badge?: string;
    description: string;
    rating: number;
    reviews: number;
    stock: number;
    originalPrice?: number;
  }[] = [
    { id: "1", name: "Sneakers Kora", price: 32500, categorySlug: "mode", storeId: "atelier-naya", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85", badge: "Bestseller", description: "Une silhouette affirmée, des matières souples et un confort pensé pour vous accompagner toute la journée.", rating: 0, reviews: 0, stock: 18 },
    { id: "2", name: "Casque Studio sans fil", price: 48500, categorySlug: "electronique", storeId: "maison-sonore", image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85", badge: "Nouveau", description: "Un son riche et équilibré, une connexion sans fil simple et une autonomie généreuse pour vos journées actives.", rating: 0, reviews: 0, stock: 12 },
    { id: "3", name: "Sac Kente Mini", price: 28000, categorySlug: "mode", storeId: "atelier-naya", image: "/fata-mode.jpg", description: "Un sac compact confectionné avec soin, aux détails inspirés des tissus et savoir-faire d'Afrique de l'Ouest.", rating: 0, reviews: 0, stock: 9 },
    { id: "4", name: "Montre Solaire", price: 39500, categorySlug: "accessoires", storeId: "maison-sonore", image: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=900&q=85", badge: "Coup de cœur", description: "Une montre au cadran épuré qui apporte une touche élégante à toutes vos tenues.", rating: 0, reviews: 0, stock: 6 },
    { id: "5", name: "Vase Terre d'Abidjan", price: 18500, categorySlug: "artisanat", storeId: "les-mains-dor", image: "/fata-photo.jpg", description: "Chaque pièce est façonnée à la main. De légères variations de forme rendent votre vase unique.", rating: 0, reviews: 0, stock: 14 },
    { id: "6", name: "Huile botanique Néroli", price: 12000, categorySlug: "beaute", storeId: "neroli-nature", image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=900&q=85", badge: "Naturel", description: "Une huile légère aux extraits botaniques, conçue pour prendre soin de votre peau au quotidien.", rating: 0, reviews: 0, stock: 24 },
    { id: "7", name: "Lampe Nimba", price: 27000, categorySlug: "maison", storeId: "les-mains-dor", image: "/fata-photo.jpg", description: "Une lumière douce et chaleureuse pour créer un coin de calme dans votre intérieur.", rating: 0, reviews: 0, stock: 8 },
    { id: "8", name: "Lunettes Sable", price: 22000, categorySlug: "accessoires", storeId: "atelier-naya", image: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=900&q=85", originalPrice: 26000, description: "Une monture intemporelle et légère, idéale pour les journées ensoleillées.", rating: 0, reviews: 0, stock: 20 },
  ];

  for (const product of demoProducts) {
    const categoryId = categoryIds.get(product.categorySlug);
    if (!categoryId) throw new Error(`Seed category missing: ${product.categorySlug}`);
    const { categorySlug, ...data } = product;
    await prisma.product.upsert({
      where: { id: product.id },
      update: { ...data, categoryId },
      create: { ...data, categoryId },
    });
  }

  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!email && !password) return;
  if (!email || !password || password.length < 12) {
    throw new Error("Set both INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD (at least 12 characters).");
  }

  const passwordHash = await hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { role: UserRole.ADMIN, passwordHash },
    create: { name: "Administrateur FATA", email, passwordHash, role: UserRole.ADMIN },
  });
}

seed()
  .catch(error => {
    console.error("FATA seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
