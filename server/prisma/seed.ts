import "dotenv/config";
import { Prisma, PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

function pub(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

/** Unsplash static image URLs (phones & accessories). */
const U = {
  phone1:
    "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=900&q=80",
  phone2:
    "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=900&q=80",
  phone3:
    "https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=900&q=80",
  phone4:
    "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=900&q=80",
  phone5:
    "https://images.unsplash.com/photo-1580910051074-3eb694886505?w=900&q=80",
  buds:
    "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=900&q=80",
  case1:
    "https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=900&q=80",
  charger:
    "https://images.unsplash.com/photo-1583863785174-e59266318d92?w=900&q=80",
  watch:
    "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=900&q=80",
  tablet:
    "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=900&q=80",
  power:
    "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=900&q=80",
  cable:
    "https://images.unsplash.com/photo-1625948515291-69613efd103f?w=900&q=80",
  stand:
    "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=900&q=80",
  lens:
    "https://images.unsplash.com/photo-1516035069371-29a1b244ccff?w=900&q=80",
  game:
    "https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=900&q=80",
};

async function main() {
  const adminEmail = "admin@example.com";
  const adminPass = "Admin12345678!";
  const hash = await bcrypt.hash(adminPass, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      publicId: pub("usr"),
      email: adminEmail,
      passwordHash: hash,
      role: Role.ADMIN,
      firstName: "Store",
      lastName: "Admin",
      phone: "+8801999999999",
      phoneVerifiedAt: new Date(),
      consentAt: new Date(),
    },
    update: {
      role: Role.ADMIN,
      phone: "+8801999999999",
      phoneVerifiedAt: new Date(),
    },
  });

  const catPhones = await prisma.category.upsert({
    where: { slug: "phones" },
    create: {
      publicId: pub("cat"),
      slug: "phones",
      name: "Phones",
      nameBn: "ফোন",
      sortOrder: 1,
    },
    update: {},
  });

  const catSmartphones = await prisma.category.upsert({
    where: { slug: "smartphones" },
    create: {
      publicId: pub("cat"),
      slug: "smartphones",
      name: "Smartphones",
      parentId: catPhones.id,
      sortOrder: 1,
    },
    update: { parentId: catPhones.id },
  });

  const catFeature = await prisma.category.upsert({
    where: { slug: "feature-phones" },
    create: {
      publicId: pub("cat"),
      slug: "feature-phones",
      name: "Feature phones",
      parentId: catPhones.id,
      sortOrder: 2,
    },
    update: { parentId: catPhones.id },
  });

  const catAcc = await prisma.category.upsert({
    where: { slug: "accessories" },
    create: {
      publicId: pub("cat"),
      slug: "accessories",
      name: "Accessories",
      sortOrder: 2,
    },
    update: {},
  });

  const catCases = await prisma.category.upsert({
    where: { slug: "cases-covers" },
    create: {
      publicId: pub("cat"),
      slug: "cases-covers",
      name: "Cases & covers",
      parentId: catAcc.id,
      sortOrder: 1,
    },
    update: { parentId: catAcc.id },
  });

  const catCharge = await prisma.category.upsert({
    where: { slug: "chargers-cables" },
    create: {
      publicId: pub("cat"),
      slug: "chargers-cables",
      name: "Chargers & cables",
      parentId: catAcc.id,
      sortOrder: 2,
    },
    update: { parentId: catAcc.id },
  });

  const catAudio = await prisma.category.upsert({
    where: { slug: "audio" },
    create: {
      publicId: pub("cat"),
      slug: "audio",
      name: "Audio",
      parentId: catAcc.id,
      sortOrder: 3,
    },
    update: { parentId: catAcc.id },
  });

  type SeedP = {
    sku: string;
    name: string;
    description: string;
    shortDesc: string;
    brand: string;
    price: number;
    comparePrice?: number;
    stock: number;
    categoryId: string;
    featured?: boolean;
    badgeNew?: boolean;
    badgeBestseller?: boolean;
    mainImageUrl: string;
    galleryUrls: string[];
    specs?: Prisma.InputJsonValue;
  };

  const products: SeedP[] = [
    {
      sku: "PHONE-X1",
      name: "Aurora X1",
      description:
        "Premium smartphone with OLED display, all-day battery, and pro-grade camera. Includes 3 years of OS updates and IP68 water resistance.\n\nBox contents: handset, USB-C cable, SIM tool, quick-start guide.",
      shortDesc: "Flagship performance, minimal design.",
      brand: "Aurora",
      price: 89999,
      comparePrice: 94999,
      stock: 24,
      categoryId: catSmartphones.id,
      featured: true,
      badgeNew: true,
      badgeBestseller: true,
      mainImageUrl: U.phone1,
      galleryUrls: [U.phone1, U.phone2, U.phone3],
      specs: {
        Display: "6.7″ OLED 120Hz",
        Chipset: "Aurora A18",
        Storage: "256GB",
        Camera: "50MP main + 12MP ultra-wide",
      },
    },
    {
      sku: "PHONE-NEXUS-9",
      name: "Nexus 9 Pro",
      description:
        "Android flagship with advanced computational photography and 80W fast charging. Glass sandwich design with aluminium frame.",
      shortDesc: "Pro cameras, all-day battery.",
      brand: "Nexus Labs",
      price: 75999,
      stock: 12,
      categoryId: catSmartphones.id,
      badgeNew: true,
      mainImageUrl: U.phone2,
      galleryUrls: [U.phone2, U.phone4, U.phone1],
      specs: {
        Display: "6.5″ LTPO AMOLED",
        OS: "Android 15",
        Charging: "80W wired / 50W wireless",
      },
    },
    {
      sku: "PHONE-PULSE-12",
      name: "Pulse 12 5G",
      description:
        "Balanced mid-range with 5G, stereo speakers, and a 108MP main sensor. Great for content creators on a budget.",
      shortDesc: "5G ready, 108MP camera.",
      brand: "Pulse",
      price: 42999,
      comparePrice: 46999,
      stock: 40,
      categoryId: catSmartphones.id,
      featured: true,
      badgeBestseller: true,
      mainImageUrl: U.phone3,
      galleryUrls: [U.phone3, U.phone5, U.phone2],
    },
    {
      sku: "PHONE-VOLT-S",
      name: "Volt S Compact",
      description:
        "Small-footprint flagship with one-hand friendly 6.1″ display. Full IP rating and wireless charging in a pocketable body.",
      shortDesc: "Compact flagship.",
      brand: "Volt",
      price: 68999,
      stock: 18,
      categoryId: catSmartphones.id,
      mainImageUrl: U.phone4,
      galleryUrls: [U.phone4, U.phone3],
    },
    {
      sku: "PHONE-ORBIT-MAX",
      name: "Orbit Max Ultra",
      description:
        "Huge 6.9″ display for streaming and gaming. Vapour-chamber cooling and 6000mAh battery with reverse wireless charging.",
      shortDesc: "Gaming & media beast.",
      brand: "Orbit",
      price: 92999,
      stock: 9,
      categoryId: catSmartphones.id,
      featured: true,
      mainImageUrl: U.phone5,
      galleryUrls: [U.phone5, U.phone1, U.tablet],
    },
    {
      sku: "PHONE-LITE-AIR",
      name: "Lite Air",
      description:
        "Featherweight daily driver with clean software and two-day battery. Perfect first smartphone or backup device.",
      shortDesc: "Light, simple, reliable.",
      brand: "Lite",
      price: 18999,
      stock: 55,
      categoryId: catSmartphones.id,
      badgeNew: true,
      mainImageUrl: U.phone1,
      galleryUrls: [U.phone1, U.phone4],
    },
    {
      sku: "FEAT-COMET",
      name: "Comet F2",
      description:
        "Durable keypad phone with week-long standby, torch, and FM radio. Dual SIM for work and personal lines.",
      shortDesc: "Classic keypad, huge battery.",
      brand: "Comet",
      price: 3499,
      stock: 100,
      categoryId: catFeature.id,
      mainImageUrl: U.phone3,
      galleryUrls: [U.phone3],
    },
    {
      sku: "FEAT-RUGGED-R1",
      name: "Rugged R1",
      description:
        "IP68 rugged feature phone for outdoor jobsites. Loud speaker, glove-friendly keys, and programmable SOS button.",
      shortDesc: "Built for tough environments.",
      brand: "Shield",
      price: 5999,
      stock: 45,
      categoryId: catFeature.id,
      mainImageUrl: U.phone5,
      galleryUrls: [U.phone5, U.phone2],
    },
    {
      sku: "CASE-SHELL-CLR",
      name: "Shell Clear MagSafe Case",
      description:
        "Crystal clear hardshell with yellowing-resistant coating. Compatible with magnetic wallets and chargers.",
      shortDesc: "Clear protection, MagSafe ready.",
      brand: "Shell",
      price: 1299,
      stock: 200,
      categoryId: catCases.id,
      featured: true,
      mainImageUrl: U.case1,
      galleryUrls: [U.case1, U.phone1],
    },
    {
      sku: "CASE-ARMOR-X",
      name: "Armor X Bumper",
      description:
        "Dual-layer TPU + polycarbonate bumper with raised lip for screen and camera protection.",
      shortDesc: "Heavy-duty bumper case.",
      brand: "Armor",
      price: 1599,
      stock: 120,
      categoryId: catCases.id,
      mainImageUrl: U.case1,
      galleryUrls: [U.case1],
    },
    {
      sku: "CHG-GAN-65",
      name: "GaN 65W 3-Port Charger",
      description:
        "Compact gallium nitride charger with two USB-C and one USB-A. Foldable prongs for travel.",
      shortDesc: "65W fast charge, travel friendly.",
      brand: "ChargePro",
      price: 2499,
      comparePrice: 2999,
      stock: 80,
      categoryId: catCharge.id,
      badgeBestseller: true,
      mainImageUrl: U.charger,
      galleryUrls: [U.charger, U.cable, U.power],
    },
    {
      sku: "CHG-CABLE-USB-C",
      name: "Braided USB-C Cable 2m",
      description:
        "100W e-marked USB 2.0 cable with reinforced strain relief. Tested for 10,000 bends.",
      shortDesc: "Durable 2m USB-C cable.",
      brand: "Link",
      price: 799,
      stock: 300,
      categoryId: catCharge.id,
      mainImageUrl: U.cable,
      galleryUrls: [U.cable, U.charger],
    },
    {
      sku: "CHG-PAD-15W",
      name: "Alloy Wireless Pad 15W",
      description:
        "Slim aluminium wireless charging pad with silicone ring to prevent slip. LED status indicator.",
      shortDesc: "15W Qi wireless pad.",
      brand: "ChargePro",
      price: 1899,
      stock: 60,
      categoryId: catCharge.id,
      mainImageUrl: U.power,
      galleryUrls: [U.power, U.charger],
    },
    {
      sku: "AUD-BUDS-FLOW",
      name: "Flow ANC Earbuds",
      description:
        "Hybrid active noise cancellation with transparency mode. 8h buds + 28h case, multipoint Bluetooth.",
      shortDesc: "ANC earbuds, multipoint.",
      brand: "Flow Audio",
      price: 8999,
      comparePrice: 9999,
      stock: 70,
      categoryId: catAudio.id,
      featured: true,
      badgeNew: true,
      mainImageUrl: U.buds,
      galleryUrls: [U.buds, U.phone2],
    },
    {
      sku: "AUD-OPEN-AIR",
      name: "Open Air Conduction",
      description:
        "Open-ear sport headphones that keep you aware of traffic. IP55 sweat resistance and 10h playtime.",
      shortDesc: "Open-ear sports audio.",
      brand: "OpenRun",
      price: 11299,
      stock: 35,
      categoryId: catAudio.id,
      mainImageUrl: U.buds,
      galleryUrls: [U.buds],
    },
    {
      sku: "WATCH-PULSE-BAND",
      name: "Pulse Band Fitness",
      description:
        "AMOLED fitness band with SpO2, sleep staging, and 14-day battery. Swim-proof 5ATM.",
      shortDesc: "AMOLED fitness band.",
      brand: "Pulse",
      price: 5999,
      stock: 50,
      categoryId: catAudio.id,
      mainImageUrl: U.watch,
      galleryUrls: [U.watch, U.phone4],
    },
    {
      sku: "TAB-SLATE-MINI",
      name: "Slate Mini Tablet 8″",
      description:
        "8″ LCD tablet for reading and streaming. Stereo speakers and expandable storage.",
      shortDesc: "Portable 8″ tablet.",
      brand: "Slate",
      price: 15999,
      stock: 25,
      categoryId: catSmartphones.id,
      mainImageUrl: U.tablet,
      galleryUrls: [U.tablet, U.phone1, U.stand],
    },
    {
      sku: "ACC-DESK-STAND",
      name: "Aluminium Desk Stand",
      description:
        "Adjustable angle phone/tablet stand with silicone pads. Folds flat for bags.",
      shortDesc: "Adjustable metal stand.",
      brand: "Deskio",
      price: 1299,
      stock: 90,
      categoryId: catCases.id,
      mainImageUrl: U.stand,
      galleryUrls: [U.stand, U.tablet],
    },
    {
      sku: "ACC-LENS-KIT",
      name: "Clip Macro Lens Kit",
      description:
        "Phone clip with macro and wide-angle glass lenses. Carry pouch included.",
      shortDesc: "Clip-on lens kit.",
      brand: "Optix",
      price: 2199,
      stock: 40,
      categoryId: catAcc.id,
      mainImageUrl: U.lens,
      galleryUrls: [U.lens, U.phone3],
    },
    {
      sku: "ACC-GAME-PAD",
      name: "Mobile Game Controller",
      description:
        "Bluetooth controller with phone mount. Low-latency mode for competitive titles.",
      shortDesc: "BT controller + phone clip.",
      brand: "GameFlex",
      price: 4499,
      stock: 30,
      categoryId: catAcc.id,
      featured: true,
      mainImageUrl: U.game,
      galleryUrls: [U.game, U.phone5],
    },
    {
      sku: "CHG-CAR-48W",
      name: "Car Charger 48W Dual USB-C",
      description:
        "Metal body car adapter with two independent USB-C ports. Supports PPS for Samsung and PD for iPhone.",
      shortDesc: "48W dual USB-C car charger.",
      brand: "ChargePro",
      price: 1699,
      stock: 150,
      categoryId: catCharge.id,
      mainImageUrl: U.charger,
      galleryUrls: [U.charger],
    },
    {
      sku: "CASE-WALLET-FLIP",
      name: "Wallet Flip Folio",
      description:
        "Vegan leather folio with card slots and stand mode. Magnetic clasp closure.",
      shortDesc: "Folio with card slots.",
      brand: "Shell",
      price: 1999,
      stock: 65,
      categoryId: catCases.id,
      mainImageUrl: U.case1,
      galleryUrls: [U.case1, U.phone2],
    },
  ];

  for (const pr of products) {
    await prisma.product.upsert({
      where: { sku: pr.sku },
      create: {
        publicId: pub("prod"),
        sku: pr.sku,
        name: pr.name,
        description: pr.description,
        shortDesc: pr.shortDesc,
        brand: pr.brand,
        price: pr.price,
        comparePrice: pr.comparePrice,
        stock: pr.stock,
        readyToShip: true,
        categoryId: pr.categoryId,
        featured: pr.featured ?? false,
        badgeNew: pr.badgeNew ?? false,
        badgeBestseller: pr.badgeBestseller ?? false,
        mainImageUrl: pr.mainImageUrl,
        galleryUrls: pr.galleryUrls as Prisma.InputJsonValue,
        ...(pr.specs !== undefined ? { specs: pr.specs } : {}),
      },
      update: {
        name: pr.name,
        description: pr.description,
        shortDesc: pr.shortDesc,
        brand: pr.brand,
        price: pr.price,
        comparePrice: pr.comparePrice ?? null,
        stock: pr.stock,
        categoryId: pr.categoryId,
        featured: pr.featured ?? false,
        badgeNew: pr.badgeNew ?? false,
        badgeBestseller: pr.badgeBestseller ?? false,
        mainImageUrl: pr.mainImageUrl,
        galleryUrls: pr.galleryUrls as Prisma.InputJsonValue,
        ...(pr.specs !== undefined ? { specs: pr.specs } : {}),
      },
    });
  }

  const heroPhones = await prisma.product.findFirst({
    where: { sku: "PHONE-PULSE-12" },
    select: { publicId: true },
  });
  const heroAcc = await prisma.category.findUnique({
    where: { slug: "accessories" },
    select: { publicId: true },
  });

  const seedAdTitles = ["Spring phone sale", "Accessory bundle week"];
  for (let i = 0; i < seedAdTitles.length; i++) {
    const title = seedAdTitles[i]!;
    const exists = await prisma.advertisement.findFirst({ where: { title } });
    if (!exists) {
      await prisma.advertisement.create({
        data: {
          publicId: pub("ad"),
          title,
          imageUrl: i === 0 ? U.phone1 : U.buds,
          placement: "home_hero",
          sortOrder: i,
          linkProductPublicId: i === 0 ? heroPhones?.publicId : undefined,
          linkCategoryPublicId: i === 1 ? heroAcc?.publicId : undefined,
        },
      });
    }
  }

  console.log(
    "Seed complete. Admin:",
    adminEmail,
    "/",
    adminPass,
    "| Products:",
    products.length
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    void prisma.$disconnect();
    process.exit(1);
  });
