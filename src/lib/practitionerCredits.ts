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
    name: "Starter Package",
    credits: 10,
    amountZar: 250,
    description: "A starter bundle for testing the marketplace with a solid response runway.",
  },
  {
    code: "professional",
    name: "Professional Package",
    credits: 25,
    amountZar: 600,
    description: "A balanced pack for practitioners responding to multiple leads each week.",
  },
  {
    code: "business",
    name: "Business Package",
    credits: 50,
    amountZar: 1100,
    description: "Best value for practitioners who respond to leads at scale.",
  },
  {
    code: "enterprise",
    name: "Enterprise Package",
    credits: 100,
    amountZar: 2000,
    description: "Enterprise volume for high-performing practitioners and teams.",
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
    name: "Starter Plan",
    priceZar: 299,
    creditsPerMonth: 15,
    features: ["Verified Badge", "Standard Listing"],
  },
  {
    code: "professional",
    name: "Professional Plan",
    priceZar: 499,
    creditsPerMonth: 25,
    features: ["Verified Badge", "Priority Listing", "Featured Profile"],
  },
  {
    code: "business",
    name: "Business Plan",
    priceZar: 899,
    creditsPerMonth: 50,
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
  const { data, error } = await supabase.functions.invoke("create-practitioner-credit-checkout", {
    body: { packageCode },
  });

  if (error) {
    throw error;
  }

  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    throw new Error(data.error);
  }

  return data as {
    success: boolean;
    mode: "fake" | "payfast_sandbox" | "payfast_live";
    purchaseId: string;
    credits?: number;
    balance?: number | null;
    paymentUrl?: string;
    fields?: Record<string, string>;
  };
}

export async function startPractitionerSubscription(planCode: string) {
  const { data, error } = await supabase.functions.invoke("create-practitioner-subscription-checkout", {
    body: { planCode },
  });

  if (error) {
    throw error;
  }

  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    throw new Error(data.error);
  }

  return data as {
    success: boolean;
    mode: "fake" | "payfast_sandbox" | "payfast_live";
    subscriptionId?: string;
    paymentUrl?: string;
    fields?: Record<string, string>;
  };
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
