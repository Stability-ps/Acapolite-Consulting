import type { Enums } from "@/integrations/supabase/types";

export type BillingCreditPackage = {
  code: "trial" | "starter" | "growth" | "pro";
  name: string;
  credits: number;
  priceZar: number;
  description: string;
};

export type BillingSubscriptionPlan = {
  code: "starter" | "professional" | "business";
  name: string;
  priceZar: number;
  creditsPerMonth: number;
  storageLimitMb: number;
  listingPriorityLevel: number;
  paystackPlanCode: string;
  features: string[];
};

export type BillingStorageAddon = {
  code: "plus_5gb" | "plus_10gb" | "plus_25gb";
  name: string;
  storageMb: number;
  priceZar: number;
  description: string;
};

export const BILLING_CREDIT_PACKAGES: BillingCreditPackage[] = [
  {
    code: "trial",
    name: "Trial Pack",
    credits: 5,
    priceZar: 179,
    description: "A small top-up to test the marketplace and unlock a few targeted leads.",
  },
  {
    code: "starter",
    name: "Starter Pack",
    credits: 10,
    priceZar: 329,
    description: "A practical starter bundle for practitioners beginning to respond consistently.",
  },
  {
    code: "growth",
    name: "Growth Pack",
    credits: 25,
    priceZar: 749,
    description: "A balanced package for steady weekly lead activity and follow-up work.",
  },
  {
    code: "pro",
    name: "Pro Pack",
    credits: 50,
    priceZar: 1399,
    description: "A high-volume package built for practitioners scaling their pipeline.",
  },
];

export const BILLING_SUBSCRIPTION_PLANS: BillingSubscriptionPlan[] = [
  {
    code: "starter",
    name: "Starter",
    priceZar: 299,
    creditsPerMonth: 10,
    storageLimitMb: 2048,
    listingPriorityLevel: 1,
    paystackPlanCode: "PLN_itawkcig6c30q77",
    features: ["Verified badge", "Standard listing", "Upgrade support", "2 GB storage"],
  },
  {
    code: "professional",
    name: "Professional",
    priceZar: 499,
    creditsPerMonth: 20,
    storageLimitMb: 8192,
    listingPriorityLevel: 2,
    paystackPlanCode: "PLN_9deli5oghu3lt2h",
    features: ["Verified badge", "Priority listing", "Upgrade support", "8 GB storage"],
  },
  {
    code: "business",
    name: "Business",
    priceZar: 899,
    creditsPerMonth: 40,
    storageLimitMb: 20480,
    listingPriorityLevel: 3,
    paystackPlanCode: "PLN_6qfph5xvmtzgpag",
    features: ["Verified badge", "Highest listing priority", "Upgrade support", "20 GB storage"],
  },
];

export const BILLING_STORAGE_ADDONS: BillingStorageAddon[] = [
  {
    code: "plus_5gb",
    name: "+5 GB Storage",
    storageMb: 5 * 1024,
    priceZar: 99,
    description: "Add a compact storage boost for growing client files and working documents.",
  },
  {
    code: "plus_10gb",
    name: "+10 GB Storage",
    storageMb: 10 * 1024,
    priceZar: 179,
    description: "A solid mid-tier upgrade for practitioners with active document workflows.",
  },
  {
    code: "plus_25gb",
    name: "+25 GB Storage",
    storageMb: 25 * 1024,
    priceZar: 299,
    description: "A large storage expansion for high-volume practices and larger files.",
  },
];

const SERVICE_CREDIT_COSTS: Record<Enums<"service_request_service_needed">, number> = {
  individual_personal_income_tax_returns: 2,
  individual_sars_debt_assistance: 5,
  individual_tax_compliance_issues: 3,
  individual_tax_clearance_certificates: 3,
  individual_objections_and_disputes: 7,
  individual_late_return_submissions: 2,
  individual_tax_number_registration: 2,
  individual_tax_status_corrections: 2,
  business_company_income_tax: 5,
  business_vat_registration: 3,
  business_vat_returns: 4,
  business_paye_registration: 3,
  business_paye_compliance: 5,
  business_sars_debt_arrangements: 6,
  business_tax_clearance_certificates: 3,
  business_sars_audits_support: 7,
  accounting_bookkeeping: 5,
  accounting_financial_statements: 6,
  accounting_management_accounts: 6,
  accounting_payroll_services: 5,
  accounting_monthly_accounting_services: 5,
  accounting_annual_financial_reporting: 6,
  support_company_registration: 4,
  support_business_compliance: 5,
  support_cipc_services: 4,
  support_business_advisory: 6,
  support_financial_compliance: 6,
};

export function formatZarCurrency(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatStorageValue(bytes: number) {
  if (!bytes || bytes <= 0) {
    return "0 GB";
  }

  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
  }

  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

export function formatStorageLimitFromMb(storageLimitMb: number) {
  return formatStorageValue(storageLimitMb * 1024 * 1024);
}

export function getBaseServiceRequestCreditCost(serviceNeeded?: Enums<"service_request_service_needed"> | null) {
  if (!serviceNeeded) {
    return 4;
  }

  return SERVICE_CREDIT_COSTS[serviceNeeded] ?? 4;
}

export function calculateServiceRequestCreditCost(
  services: Enums<"service_request_service_needed">[],
) {
  if (!services.length) {
    return 4;
  }

  const highestCost = services.reduce((max, service) => Math.max(max, getBaseServiceRequestCreditCost(service)), 0);
  const extraCredit = services.length >= 3 ? 1 : 0;
  return Math.min(highestCost + extraCredit, 10);
}

export function submitHostedPayment(paymentUrl: string, fields: Record<string, string>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = paymentUrl;
  form.style.display = "none";

  Object.entries(fields).forEach(([key, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}
