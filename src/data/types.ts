export type LocalizedText = { en: string; ar: string };
export type CoffeeCategory = "specialty" | "commercial";
export type Warehouse = "Egypt" | "Dubai";
export type Availability = "Available" | "Limited" | "Coming soon";

export interface CoffeeOffer {
  id: string;
  reference: string;
  warehouse: Warehouse;
  bagsAvailable: number;
  bagWeightKg: number;
  packaging: string;
  status: Availability;
  cropYear: string;
}

export interface Coffee {
  id: string;
  slug: string;
  name: LocalizedText;
  category: CoffeeCategory;
  origin: string;
  region: LocalizedText;
  producer: LocalizedText;
  varieties: string[];
  process: string;
  elevation: string;
  score?: number;
  sensory: LocalizedText[];
  certifications: string[];
  story: LocalizedText;
  cupNote: LocalizedText;
  color: string;
  offers: CoffeeOffer[];
}

export interface Viewer {
  id: string;
  email: string;
  name?: string;
  company?: string;
  role: "USER" | "ADMIN";
}

export interface CatalogOffer extends CoffeeOffer {
  price: string | null;
}

export interface CatalogCoffee extends Omit<Coffee, "offers"> {
  offers: CatalogOffer[];
}
