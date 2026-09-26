// Pure parsing helpers for the National Treasury eTenders OCDS feed.
//
// Important data-quality rule: in this feed a supplier party's
// `contactPoint` (name / email / telephone / url) holds the *procuring
// entity's* contact person (e.g. an @raf.co.za or @justice.gov.za address),
// not the supplier's. Those fields are therefore never used as the
// supplier's contact details. Supplier contacts come only from later
// website enrichment.

export const ETENDERS_API = "https://ocds-api.etenders.gov.za/api/OCDSReleases";

export type AwardedSupplier = {
  companyName: string;
  csdNumber: string | null;
  supplierId: string | null;
  supplierSize: string | null;
  sector: string | null;
  province: string | null;
  ocid: string;
  sourceRecordId: string;
  sourceUrl: string;
  tenderReference: string | null;
  tenderTitle: string | null;
  tenderDescription: string | null;
  tenderCategory: string | null;
  tenderStatus: string | null;
  buyerName: string | null;
  awardStatus: string | null;
  awardValue: number | null;
  awardCurrency: string | null;
  awardDate: string | null;
};

const PROVINCES = ["Gauteng", "Western Cape", "Eastern Cape", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "North West", "Free State", "Northern Cape"];

// Category phrases (ISIC-style labels used by eTenders) checked first.
const CATEGORY_RULES: Array<[RegExp, string]> = [
  [/security and investigation/i, "Security"],
  [/construction|civil engineering/i, "Construction"],
  [/computer|information service|information and communication|telecommunication|software/i, "IT"],
  [/food and beverage|catering/i, "Catering"],
  [/repair and installation|maintenance/i, "Maintenance"],
  [/land transport|transportation|passenger|air transport|water transport/i, "Transport"],
  [/warehousing|postal and courier|logistics/i, "Logistics"],
  [/architectural and engineering|engineering/i, "Engineering"],
];

// Keywords in the tender title/description, used when the category is
// generic ("Services: General", "Services: Professional", "Other service
// activities", "Supplies: General", "Services: Functional ...").
const KEYWORD_RULES: Array<[RegExp, string]> = [
  [/\b(security|guarding|guards?|patrol|access control)\b/i, "Security"],
  [/\b(cleaning|hygiene|janitorial|ablution|pest control|fumigation)\b/i, "Cleaning"],
  [/\b(construction|building works?|renovations?|refurbish\w*|civil works|paving|roads?|structural works|plumbing|houses)\b/i, "Construction"],
  [/\b(catering|caterers?|meals|food)\b/i, "Catering"],
  [/\b(maintenance|repairs?|overhaul|servicing|grass cutting|landscap\w*)\b/i, "Maintenance"],
  [/\b(laptops?|desktops?|computers?|servers?|software|ict|network|cctv|toners?|sap|sage|licen[cs]es?)\b/i, "IT"],
  [/\b(transport|bus(es)?|shuttle|vehicle hire|fleet|honey sucker|truck)\b/i, "Transport"],
  [/\b(logistics|freight|courier|warehous\w*|removals?)\b/i, "Logistics"],
  [/\b(engineering|engineers?|electrical|mechanical)\b/i, "Engineering"],
];

export function classifySector(category: string | null, title: string | null, description: string | null): string | null {
  const cat = category ?? "";
  const generic = /^(services:|supplies:|other service|administrative and support|professional, scientific)/i.test(cat) || !cat;
  if (!generic) {
    for (const [re, sector] of CATEGORY_RULES) if (re.test(cat)) return sector;
  }
  const text = [cat, title, description].filter(Boolean).join(" ");
  for (const [re, sector] of KEYWORD_RULES) if (re.test(text)) return sector;
  if (generic) {
    for (const [re, sector] of CATEGORY_RULES) if (re.test(cat)) return sector;
  }
  return null;
}

export function normalizeProvince(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const n = value.toLowerCase().replace(/[^a-z]+/g, "");
  return PROVINCES.find((p) => p.toLowerCase().replace(/[^a-z]+/g, "") === n) ?? null;
}

/** Strips CSD supplier numbers (MAAA…) that eTenders sometimes appends to names. */
export function cleanSupplierName(raw: string): { name: string; csdNumber: string | null } {
  const csd = raw.match(/\bMAAA\d{5,}\b/i)?.[0]?.toUpperCase() ?? null;
  const name = raw
    .replace(/\s*(?:and|&|,|-)?\s*\bMAAA\d{5,}\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { name, csdNumber: csd };
}

function text(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function releaseUrl(ocid: string) {
  return `${ETENDERS_API}/release/${encodeURIComponent(ocid)}`;
}

/** Returns one entry per awarded supplier in a release. Cancelled tenders are ignored. */
export function awardedSuppliers(release: any): AwardedSupplier[] {
  const ocid = text(release?.ocid);
  if (!ocid) return [];
  const tender = release?.tender ?? {};
  const tenderStatus = text(tender.status);
  if (tenderStatus && /cancel|unsuccessful|withdrawn/i.test(tenderStatus)) return [];
  const category = text(tender.category);
  const title = text(tender.title);
  const description = text(tender.description);
  const sector = classifySector(category, title, description);
  const province = normalizeProvince(tender.province);
  const out: AwardedSupplier[] = [];
  const seen = new Set<string>();

  for (const award of Array.isArray(release?.awards) ? release.awards : []) {
    const awardStatus = text(award?.status);
    if (awardStatus && /cancel|unsuccessful/i.test(awardStatus)) continue;
    const size = text(award?.description)?.toUpperCase() ?? null;
    for (const supplier of Array.isArray(award?.suppliers) ? award.suppliers : []) {
      const rawName = text(supplier?.name);
      if (!rawName) continue;
      const { name, csdNumber } = cleanSupplierName(rawName);
      if (!name || name.length < 2) continue;
      const supplierId = supplier?.id != null ? String(supplier.id) : null;
      const key = `${ocid}:${supplierId ?? name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const amount = Number(award?.value?.amount);
      out.push({
        companyName: name,
        csdNumber,
        supplierId,
        supplierSize: size && ["EME", "QSE", "GEN"].includes(size) ? size : null,
        sector,
        province,
        ocid,
        sourceRecordId: key,
        sourceUrl: releaseUrl(ocid),
        tenderReference: title,
        tenderTitle: description ? description.slice(0, 300) : title,
        tenderDescription: description,
        tenderCategory: category,
        tenderStatus,
        buyerName: text(release?.buyer?.name) ?? text(tender?.procuringEntity?.name),
        awardStatus,
        awardValue: Number.isFinite(amount) && amount > 0 ? amount : null,
        awardCurrency: text(award?.value?.currency),
        awardDate: text(award?.date) ?? text(release?.date),
      });
    }
  }
  return out;
}

/** Day windows [from, to) to scan, oldest first, never past `today`. */
export function dayWindows(cursor: string, today: string, count: number): Array<{ from: string; to: string }> {
  const out: Array<{ from: string; to: string }> = [];
  let d = new Date(cursor + "T00:00:00Z");
  const end = new Date(today + "T00:00:00Z");
  while (out.length < count && d < end) {
    const next = new Date(d.getTime() + 86_400_000);
    out.push({ from: d.toISOString().slice(0, 10), to: next.toISOString().slice(0, 10) });
    d = next;
  }
  return out;
}

export function addDays(date: string, days: number) {
  return new Date(new Date(date + "T00:00:00Z").getTime() + days * 86_400_000).toISOString().slice(0, 10);
}
