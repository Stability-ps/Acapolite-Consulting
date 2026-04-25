export {
  BILLING_CREDIT_PACKAGES as practitionerCreditPackages,
  BILLING_SUBSCRIPTION_PLANS as practitionerSubscriptionPlans,
  calculateServiceRequestCreditCost,
  formatStorageLimitFromMb,
  formatStorageValue,
  formatZarCurrency,
  getBaseServiceRequestCreditCost as getServiceRequestCreditCost,
  submitHostedPayment,
} from "@/lib/practitionerBilling";

export async function purchasePractitionerCredits(packageCode: string) {
  void packageCode;
  throw new Error("Legacy PayFast credit checkout has been retired. Use the Paystack billing flow.");
}

export async function startPractitionerSubscription(planCode: string) {
  void planCode;
  throw new Error("Legacy PayFast subscription checkout has been retired. Use the Paystack billing flow.");
}
