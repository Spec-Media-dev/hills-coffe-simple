import type { Coffee } from "./types";

export const coffees: Coffee[] = [
  {
    id: "coffee-ethiopia-hambela",
    slug: "ethiopia-hambela-bookkisa",
    category: "specialty",
    origin: "Ethiopia",
    name: { en: "Hambela Bookkisa", ar: "هامبيلا بوكيسا" },
    region: { en: "Guji, Oromia", ar: "غوجي، أوروميا" },
    producer: { en: "Smallholder communities", ar: "مجتمعات صغار المزارعين" },
    varieties: ["74110", "74112"],
    process: "Natural",
    elevation: "2,000–2,200 masl",
    score: 87.5,
    sensory: [
      { en: "Blueberry", ar: "توت أزرق" },
      { en: "Jasmine", ar: "ياسمين" },
      { en: "Cacao nib", ar: "كاكاو" },
    ],
    certifications: ["Organic"],
    story: {
      en: "A high-elevation Guji lot with layered florals and a generous fruit character, selected for expressive filter and modern espresso profiles.",
      ar: "محصول مرتفع من غوجي بطبقات زهرية وفاكهية واضحة، مناسب للفلتر والإسبريسو العصري.",
    },
    cupNote: {
      en: "Aromatic and expansive, moving from blueberry sweetness into jasmine and a long cacao finish.",
      ar: "عطري وواسع، يبدأ بحلاوة التوت الأزرق وينتهي بالياسمين والكاكاو.",
    },
    color: "#A95642",
    offers: [
      {
        id: "off-ham-eg",
        reference: "EG-ETH-2411",
        warehouse: "Egypt",
        bagsAvailable: 42,
        bagWeightKg: 60,
        packaging: "GrainPro in jute",
        status: "Available",
        cropYear: "2025/26",
      },
      {
        id: "off-ham-du",
        reference: "DXB-ETH-2417",
        warehouse: "Dubai",
        bagsAvailable: 18,
        bagWeightKg: 60,
        packaging: "GrainPro in jute",
        status: "Limited",
        cropYear: "2025/26",
      },
    ],
  },
  {
    id: "coffee-brazil-diamond",
    slug: "brazil-diamond-cerrado",
    category: "commercial",
    origin: "Brazil",
    name: { en: "Diamond Cerrado", ar: "دايموند سيرادو" },
    region: { en: "Cerrado Mineiro", ar: "سيرادو مينيرو" },
    producer: {
      en: "Regional producer partners",
      ar: "شركاء منتجون من المنطقة",
    },
    varieties: ["Mundo Novo", "Catuai"],
    process: "Natural",
    elevation: "900–1,150 masl",
    score: 83,
    sensory: [
      { en: "Milk chocolate", ar: "شوكولاتة بالحليب" },
      { en: "Hazelnut", ar: "بندق" },
      { en: "Caramel", ar: "كراميل" },
    ],
    certifications: ["Rainforest Alliance"],
    story: {
      en: "A dependable, sweet Cerrado profile built for balance, consistency, and an approachable everyday espresso.",
      ar: "ملف سيرادو حلو ومتوازن صُمم للثبات وإسبريسو يومي سهل التذوق.",
    },
    cupNote: {
      en: "Round body, gentle acidity, and a familiar chocolate-hazelnut finish.",
      ar: "قوام مستدير وحموضة هادئة ونهاية مألوفة من الشوكولاتة والبندق.",
    },
    color: "#9B6C3B",
    offers: [
      {
        id: "off-dia-eg",
        reference: "EG-BR-2513",
        warehouse: "Egypt",
        bagsAvailable: 160,
        bagWeightKg: 60,
        packaging: "Jute",
        status: "Available",
        cropYear: "2025/26",
      },
      {
        id: "off-dia-du",
        reference: "DXB-BR-2508",
        warehouse: "Dubai",
        bagsAvailable: 210,
        bagWeightKg: 60,
        packaging: "Jute",
        status: "Available",
        cropYear: "2025/26",
      },
    ],
  },
  {
    id: "coffee-colombia-esperanza",
    slug: "colombia-huila-la-esperanza",
    category: "specialty",
    origin: "Colombia",
    name: { en: "La Esperanza", ar: "لا إسبيرانزا" },
    region: { en: "Huila", ar: "هويلا" },
    producer: {
      en: "La Esperanza community lots",
      ar: "محاصيل مجتمع لا إسبيرانزا",
    },
    varieties: ["Caturra", "Castillo"],
    process: "Washed",
    elevation: "1,650–1,900 masl",
    score: 85.75,
    sensory: [
      { en: "Red apple", ar: "تفاح أحمر" },
      { en: "Panela", ar: "بانيلا" },
      { en: "Mandarin", ar: "يوسفي" },
    ],
    certifications: [],
    story: {
      en: "A clean Huila selection that balances ripe fruit, cane sugar sweetness, and a structured citrus finish.",
      ar: "اختيار نظيف من هويلا يوازن الفاكهة الناضجة وحلاوة قصب السكر ونهاية حمضية متماسكة.",
    },
    cupNote: {
      en: "Juicy and structured with red-apple sweetness and a bright mandarin lift.",
      ar: "عصيري ومتوازن بحلاوة التفاح الأحمر ولمسة يوسفي مشرقة.",
    },
    color: "#BC5B3B",
    offers: [
      {
        id: "off-esp-eg",
        reference: "EG-CO-2504",
        warehouse: "Egypt",
        bagsAvailable: 27,
        bagWeightKg: 70,
        packaging: "GrainPro in jute",
        status: "Limited",
        cropYear: "2025",
      },
    ],
  },
  {
    id: "coffee-kenya-nyeri",
    slug: "kenya-nyeri-aa",
    category: "specialty",
    origin: "Kenya",
    name: { en: "Nyeri AA", ar: "نييري AA" },
    region: { en: "Nyeri County", ar: "مقاطعة نييري" },
    producer: { en: "Cooperative smallholders", ar: "تعاونية صغار المزارعين" },
    varieties: ["SL28", "SL34"],
    process: "Washed",
    elevation: "1,700–1,950 masl",
    score: 87,
    sensory: [
      { en: "Blackcurrant", ar: "كشمش أسود" },
      { en: "Grapefruit", ar: "جريب فروت" },
      { en: "Brown sugar", ar: "سكر بني" },
    ],
    certifications: ["Women-led lot"],
    story: {
      en: "Classic Nyeri structure with vivid fruit, elegant acidity, and the density roasters look for in a standout East African lot.",
      ar: "بنية نييري الكلاسيكية مع فاكهة واضحة وحموضة أنيقة وكثافة مميزة لمحصول شرق أفريقي.",
    },
    cupNote: {
      en: "Blackcurrant depth, grapefruit sparkle, and a syrupy brown-sugar finish.",
      ar: "عمق الكشمش الأسود ولمعة الجريب فروت ونهاية سكر بني كثيفة.",
    },
    color: "#713A4F",
    offers: [
      {
        id: "off-nye-du",
        reference: "DXB-KE-2519",
        warehouse: "Dubai",
        bagsAvailable: 35,
        bagWeightKg: 60,
        packaging: "Vacuum box",
        status: "Available",
        cropYear: "2025/26",
      },
    ],
  },
  {
    id: "coffee-rwanda-gicumbi",
    slug: "rwanda-gicumbi-honey",
    category: "specialty",
    origin: "Rwanda",
    name: { en: "Gicumbi Honey", ar: "غيكومبي هاني" },
    region: { en: "Northern Province", ar: "المقاطعة الشمالية" },
    producer: { en: "Gicumbi washing station", ar: "محطة غسيل غيكومبي" },
    varieties: ["Red Bourbon"],
    process: "Honey",
    elevation: "1,800–2,050 masl",
    score: 86.25,
    sensory: [
      { en: "Apricot", ar: "مشمش" },
      { en: "Rooibos", ar: "رويبوس" },
      { en: "Honey", ar: "عسل" },
    ],
    certifications: ["Organic", "Women-led lot"],
    story: {
      en: "A composed honey-process lot with stone-fruit sweetness and tea-like clarity, dried slowly for poise rather than ferment.",
      ar: "محصول بمعالجة العسل يجمع حلاوة الفاكهة ذات النواة ووضوح الشاي، جفف ببطء لاتزان أنيق.",
    },
    cupNote: {
      en: "Soft apricot, honeyed sweetness, and a calm rooibos finish.",
      ar: "مشمش ناعم وحلاوة عسل ونهاية هادئة من الرويبوس.",
    },
    color: "#D08A42",
    offers: [
      {
        id: "off-gic-eg",
        reference: "EG-RW-2502",
        warehouse: "Egypt",
        bagsAvailable: 54,
        bagWeightKg: 60,
        packaging: "Ecotact in jute",
        status: "Coming soon",
        cropYear: "2025/26",
      },
      {
        id: "off-gic-du",
        reference: "DXB-RW-2505",
        warehouse: "Dubai",
        bagsAvailable: 24,
        bagWeightKg: 60,
        packaging: "Ecotact in jute",
        status: "Available",
        cropYear: "2025/26",
      },
    ],
  },
  {
    id: "coffee-guatemala-huehue",
    slug: "guatemala-huehuetenango-reserva",
    category: "commercial",
    origin: "Guatemala",
    name: { en: "Huehue Reserva", ar: "هويهوي ريزيرفا" },
    region: { en: "Huehuetenango", ar: "هويهويتينانغو" },
    producer: { en: "Highland producer network", ar: "شبكة منتجي المرتفعات" },
    varieties: ["Bourbon", "Catuai", "Caturra"],
    process: "Washed",
    elevation: "1,400–1,750 masl",
    score: 84,
    sensory: [
      { en: "Cocoa", ar: "كاكاو" },
      { en: "Yellow plum", ar: "برقوق أصفر" },
      { en: "Almond", ar: "لوز" },
    ],
    certifications: [],
    story: {
      en: "A flexible highland coffee with cocoa depth, measured fruit, and reliable structure across espresso and batch brew.",
      ar: "قهوة مرتفعات مرنة بعمق الكاكاو وفاكهة متزنة وبنية موثوقة للإسبريسو والترشيح.",
    },
    cupNote: {
      en: "Cocoa-led and balanced, with yellow-plum brightness and a clean almond close.",
      ar: "متوازن يقوده الكاكاو مع إشراقة البرقوق الأصفر ونهاية لوز نظيفة.",
    },
    color: "#8A7046",
    offers: [
      {
        id: "off-hue-du",
        reference: "DXB-GT-2510",
        warehouse: "Dubai",
        bagsAvailable: 96,
        bagWeightKg: 69,
        packaging: "GrainPro in jute",
        status: "Available",
        cropYear: "2025/26",
      },
    ],
  },
];

export const origins = [...new Set(coffees.map((coffee) => coffee.origin))];
export const processes = [...new Set(coffees.map((coffee) => coffee.process))];
export const certifications = [
  ...new Set(coffees.flatMap((coffee) => coffee.certifications)),
];

export function getCoffeeBySlug(slug: string) {
  return coffees.find((coffee) => coffee.slug === slug);
}

export function getOfferById(id: string) {
  for (const coffee of coffees) {
    const offer = coffee.offers.find((item) => item.id === id);
    if (offer) return { coffee, offer };
  }
  return null;
}
