import { supabase } from "@/integrations/supabase/client";

export type PractitionerCreditPackage = {
  code: "starter" | "professional" | "business";
  name: string;
  credits: number;
  amountZar: number;
  description: string;
};

export const practitionerCreditPackages: PractitionerCreditPackage[] = [
  {
    code: "starter",
    name: "Starter Package",
    credits: 5,
    amountZar: 100,
    description: "A light top-up for testing the marketplace or answering a few fresh leads.",
  },
  {
    code: "professional",
    name: "Professional Package",
    credits: 15,
    amountZar: 250,
    description: "A balanced package for practitioners responding to leads consistently each week.",
  },
  {
    code: "business",
    name: "Business Package",
    credits: 40,
    amountZar: 500,
    description: "Best value for practitioners actively competing for leads at scale.",
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
