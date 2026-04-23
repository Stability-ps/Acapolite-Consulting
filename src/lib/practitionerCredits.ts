import { supabase } from "@/integrations/supabase/client";

export type PractitionerCreditPackage = {
  code: "starter" | "professional" | "business" | "enterprise";
  name: string;
  credits: number;
  amountZar: number;
  description: string;
};

export const practitionerCreditPackages: PractitionerCreditPackage[] = [
  {
    code: "starter",
    name: "Starter Pack",
    credits: 5,
    amountZar: 149,
    description: "A lightweight top-up for unlocking and responding to new leads.",
  },
  {
    code: "professional",
    name: "Growth Pack",
    credits: 15,
    amountZar: 349,
    description: "A balanced package for practitioners actively responding each week.",
  },
  {
    code: "business",
    name: "Pro Pack",
    credits: 35,
    amountZar: 699,
    description: "High-volume credits for practitioners working the marketplace consistently.",
  },
  {
    code: "enterprise",
    name: "Enterprise Pack",
    credits: 100,
    amountZar: 2000,
    description: "Reserved for future enterprise billing workflows.",
  },
];

export type PractitionerSubscriptionPlan = {
  code: "starter" | "professional" | "business";
  name: string;
  priceZar: number;
  creditsPerMonth: number;
  features: string[];
};

export const practitionerSubscriptionPlans: PractitionerSubscriptionPlan[] = [
  {
    code: "starter",
    name: "Basic",
    priceZar: 299,
    creditsPerMonth: 10,
    features: ["Verified Badge", "Standard Listing"],
  },
  {
    code: "professional",
    name: "Standard",
    priceZar: 599,
    creditsPerMonth: 25,
    features: ["Verified Badge", "Priority Listing", "Featured Profile"],
  },
  {
    code: "business",
    name: "Premium",
    priceZar: 999,
    creditsPerMonth: 60,
    features: ["Verified Badge", "Priority Listing", "Featured Profile", "Highlighted Profile"],
  },
];

export function formatZarCurrency(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(value);
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

export async function purchasePractitionerCredits(packageCode: string) {
  void packageCode;
  throw new Error("Legacy PayFast credit checkout has been retired. Use the Paystack billing flow.");
}

export async function startPractitionerSubscription(planCode: string) {
  void planCode;
  throw new Error("Legacy PayFast subscription checkout has been retired. Use the Paystack billing flow.");
}

export function getServiceRequestCreditCost(serviceNeeded: string) {
  switch (serviceNeeded) {
    case "individual_personal_income_tax_returns":
      return 2;
    case "individual_sars_debt_assistance":
      return 5;
    case "individual_tax_compliance_issues":
      return 4;
    case "individual_tax_clearance_certificates":
      return 4;
    case "individual_objections_and_disputes":
      return 6;
    case "individual_late_return_submissions":
      return 4;
    case "individual_tax_number_registration":
      return 4;
    case "individual_tax_status_corrections":
      return 4;
    case "business_company_income_tax":
      return 4;
    case "business_vat_registration":
      return 3;
    case "business_vat_returns":
      return 3;
    case "business_paye_registration":
      return 4;
    case "business_paye_compliance":
      return 4;
    case "business_sars_debt_arrangements":
      return 5;
    case "business_tax_clearance_certificates":
      return 4;
    case "business_sars_audits_support":
      return 4;
    case "accounting_bookkeeping":
      return 5;
    case "accounting_financial_statements":
      return 4;
    case "accounting_management_accounts":
      return 4;
    case "accounting_payroll_services":
      return 4;
    case "accounting_monthly_accounting_services":
      return 5;
    case "accounting_annual_financial_reporting":
      return 4;
    case "support_company_registration":
      return 4;
    case "support_business_compliance":
      return 4;
    case "support_cipc_services":
      return 4;
    case "support_business_advisory":
      return 4;
    case "support_financial_compliance":
      return 4;
    default:
      return 4;
  }
}
