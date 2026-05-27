import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  FileText,
  HeartHandshake,
  Loader2,
  Lock,
  Send,
  Shield,
  Star,
  User,
  Users,
} from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";
import { SummaryCard } from "@/components/request-wizard/SummaryCard";
import { RequestWizardProgress } from "@/components/request-wizard/RequestWizardProgress";
import { TrustSidebar } from "@/components/request-wizard/TrustSidebar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Enums, TablesInsert } from "@/integrations/supabase/types";
import { getAppBaseUrl } from "@/lib/siteUrl";
import {
  buildIntakePayload,
  buildRegisterQueryFromContact,
  buildRequestDescription,
  CONTACT_PREFERENCE_OPTIONS,
  DETAIL_QUESTIONS_BY_ENTITY,
  ENTITY_OPTIONS,
  getCategoryForService,
  getDetailSummaryRows,
  getEntityLabel,
  getGroupedSelectedServices,
  clearWizardDraft,
  getInitialWizardDraft,
  getPrimaryCategoryForSelection,
  getPrimaryServiceForSelection,
  getStepFromSearchParam,
  isNationwideSelection,
  loadWizardDraft,
  PHONE_COUNTRY_OPTIONS,
  REQUEST_WIZARD_QUERY_KEY,
  saveWizardStep,
  SERVICE_CATEGORIES_BY_ENTITY,
  SOUTH_AFRICAN_PROVINCES,
  TAX_YEAR_OPTIONS,
  type WizardContactData,
  type WizardDraft,
  type WizardEntityType,
  type WizardService,
  type WizardServiceCategory,
  type WizardStep,
} from "@/lib/requestWizard";
import { formatServiceRequestLabel } from "@/lib/serviceRequests";

type ServiceRequestInsert = TablesInsert<"service_requests">;
type SubmissionMode = "guest" | "account";
type SubmissionResult = {
  requestId: string;
  mode: SubmissionMode;
  linkedToAccount: boolean;
  requiresLogin: boolean;
  emailSent: boolean;
  existingAccount?: boolean;
};

type ErrorMap = Record<string, string>;

const contactProvinceOptions = SOUTH_AFRICAN_PROVINCES;

const entityIcons: Record<WizardEntityType, typeof User> = {
  individual: User,
  company: Building2,
  trust: Users,
  npo_organisation: HeartHandshake,
};

const categoryIcons = {
  individual_tax: FileText,
  business_tax: Briefcase,
  accounting: BarChart3,
  business_support: Building2,
  trust_services: Users,
  npo_organisation_services: HeartHandshake,
} as const;

function normalizePhoneNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 12);
}

function getInlineFieldError(errors: ErrorMap, key: string) {
  return errors[key] ? "border-red-300 focus-visible:ring-red-300" : "";
}

function getValidationErrorsForWho(draft: WizardDraft): ErrorMap {
  const nextErrors: ErrorMap = {};
  const isNationwide = isNationwideSelection(draft.who.province);

  if (!draft.who.entityType) {
    nextErrors.entityType = "Select who this request is for.";
  }
  if (!draft.who.province) {
    nextErrors.province = "Select a province or nationwide option.";
  }
  if (!isNationwide && !draft.who.city.trim()) {
    nextErrors.city = "Enter your city or town.";
  }

  return nextErrors;
}

function getValidationErrorsForWhat(draft: WizardDraft): ErrorMap {
  const nextErrors: ErrorMap = {};

  if (draft.what.selectedServices.length === 0) {
    nextErrors.selectedServices = "Select at least one service so we can match your request.";
  }

  Object.entries(draft.what.otherDetails).forEach(([categoryKey, value]) => {
    if (draft.what.selectedServices.some((service) => getCategoryForService(service) === categoryKey) && !value?.trim()) {
      nextErrors[`otherDetails.${categoryKey}`] = "Please briefly describe the assistance you require.";
    }
  });

  if (draft.what.selectedServices.length > 5) {
    nextErrors.selectedServices = "You can select a maximum of 5 services per request.";
  }

  return nextErrors;
}

function getValidationErrorsForDetails(draft: WizardDraft): ErrorMap {
  const nextErrors: ErrorMap = {};
  if (!draft.who.entityType) {
    return { entityType: "Complete Step 1 first." };
  }

  for (const question of DETAIL_QUESTIONS_BY_ENTITY[draft.who.entityType]) {
    if (question.type === "year-range" && question.dependsOnKey && !draft.details.answers[question.dependsOnKey]) {
      continue;
    }

    if (question.type === "radio") {
      if (!draft.details.answers[question.key]) {
        nextErrors[question.key] = "Choose one option.";
      }
      continue;
    }

    if (question.type === "year-range") {
      const fromYear = draft.details.answers[question.fromKey];
      const toYear = draft.details.answers[question.toKey];

      if (!fromYear) {
        nextErrors[question.fromKey] = "Select a starting tax year.";
      }
      if (!toYear) {
        nextErrors[question.toKey] = "Select an ending tax year.";
      }
      if (fromYear && toYear && Number(fromYear) > Number(toYear)) {
        nextErrors[question.toKey] = "The ending tax year must be the same or later.";
      }
    }
  }

  if (draft.details.additionalNotes.length > 500) {
    nextErrors.additionalNotes = "Keep additional notes within 500 characters.";
  }

  return nextErrors;
}

function getValidationErrorsForContact(draft: WizardDraft): ErrorMap {
  const nextErrors: ErrorMap = {};
  const email = draft.contact.email.trim();
  const phoneDigits = normalizePhoneNumber(draft.contact.phoneNumber);
  const isNationwide = isNationwideSelection(draft.contact.province);

  if (!draft.contact.fullName.trim()) {
    nextErrors.fullName = "Enter your full name.";
  }
  if (!email) {
    nextErrors.email = "Enter your email address.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    nextErrors.email = "Enter a valid email address.";
  }
  if (!phoneDigits) {
    nextErrors.phoneNumber = "Enter your phone number.";
  } else if (phoneDigits.length < 7) {
    nextErrors.phoneNumber = "Enter a valid phone number.";
  }
  if (!draft.contact.province) {
    nextErrors.contactProvince = "Select your province.";
  }
  if (!isNationwide && !draft.contact.city.trim()) {
    nextErrors.contactCity = "Enter your city or town.";
  }
  if (!draft.contact.contactPreference) {
    nextErrors.contactPreference = "Select how professionals should reach you.";
  }

  return nextErrors;
}

function getPriorityLevel(draft: WizardDraft): Enums<"service_request_priority"> {
  const urgency = draft.details.answers.urgency ?? "";
  const services = new Set(draft.what.selectedServices);

  if (
    services.has("business_sars_audits_support") ||
    services.has("individual_objections_and_disputes") ||
    services.has("trust_sars_disputes_objections") ||
    urgency === "Urgent / Immediate"
  ) {
    return "urgent";
  }

  if (
    services.has("individual_sars_debt_assistance") ||
    services.has("business_sars_debt_arrangements") ||
    services.has("business_tax_debt_compromise") ||
    draft.details.answers.yearsNeeded === "More than 7 years" ||
    urgency === "Within a few days"
  ) {
    return "high";
  }

  if (draft.what.selectedServices.length >= 3) {
    return "high";
  }

  return "medium";
}

function getRequestSignals(draft: WizardDraft) {
  const services = new Set(draft.what.selectedServices);
  const categories = new Set(draft.what.selectedServices.map(getCategoryForService));
  const urgency = draft.details.answers.urgency ?? "";

  const hasDebtFlag =
    services.has("individual_sars_debt_assistance") ||
    services.has("business_sars_debt_arrangements") ||
    services.has("business_tax_debt_compromise") ||
    services.has("trust_sars_assistance");
  const missingReturnsFlag =
    services.has("individual_late_return_submissions") ||
    services.has("individual_personal_income_tax_returns") ||
    services.has("business_company_income_tax");
  const hasSarsAudit =
    services.has("business_sars_audits_support");
  const hasAdr =
    services.has("individual_objections_and_disputes") ||
    services.has("business_vat_objections_disputes") ||
    services.has("trust_sars_disputes_objections");
  const hasVatInvestigation =
    services.has("business_vat_registration") ||
    services.has("business_vat_returns") ||
    services.has("business_vat_paye_corrections") ||
    services.has("business_vat_objections_disputes");
  const hasPayrollDispute =
    services.has("business_paye_registration") ||
    services.has("business_paye_compliance") ||
    services.has("accounting_payroll_services");
  const hasMultipleTaxTypes = categories.size > 1 || draft.what.selectedServices.length >= 3;
  const hasLegalComplexity =
    hasAdr ||
    hasSarsAudit ||
    services.has("individual_tax_compliance_issues") ||
    services.has("trust_representative_assistance") ||
    urgency === "Urgent / Immediate";

  let riskIndicator: Enums<"service_request_risk_indicator"> = "low";
  if (hasDebtFlag || hasMultipleTaxTypes || missingReturnsFlag) {
    riskIndicator = "medium";
  }
  if (hasSarsAudit || hasLegalComplexity) {
    riskIndicator = "high";
  }

  return {
    hasDebtFlag,
    missingReturnsFlag,
    missingDocumentsFlag: false,
    hasSarsAudit,
    hasAdr,
    hasVatInvestigation,
    hasPayrollDispute,
    hasMultipleTaxTypes,
    hasLegalComplexity,
    returnsFiled: !missingReturnsFlag,
    riskIndicator,
  };
}

async function sendRequestEmails(
  requestId: string,
  request: ServiceRequestInsert,
  selectedServiceLabels: string,
  priorityLevel: Enums<"service_request_priority">,
) {
  const province = request.province ?? "South Africa";
  const serviceType = selectedServiceLabels || "Tax assistance";

  await Promise.allSettled([
    supabase.functions.invoke("send-portal-email", {
      body: {
        type: "service_request_received",
        requestId,
        clientName: request.full_name,
        clientEmail: request.email,
        clientPhone: request.phone,
        serviceType,
        province,
      },
    }),
    supabase.functions.invoke("send-portal-email", {
      body: {
        type: "service_request_received_admin",
        requestId,
        clientName: request.full_name,
        clientEmail: request.email,
        serviceType,
        province,
        status: "Open",
        priority: formatServiceRequestLabel(priorityLevel),
        submittedAt: new Date().toLocaleDateString("en-ZA", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        summary: request.description,
      },
    }),
    supabase.functions.invoke("send-portal-email", {
      body: {
        type: "service_request_received_practitioner",
        requestId,
        clientName: request.full_name,
        clientEmail: request.email,
        serviceType,
        province,
        status: "Open",
        priority: formatServiceRequestLabel(priorityLevel),
        submittedAt: new Date().toLocaleDateString("en-ZA", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        summary: request.description,
      },
    }),
  ]);
}

export default function RequestTaxAssistance() {
  const { user, profile, dashboardPath } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [draft, setDraft] = useState<WizardDraft>(() => loadWizardDraft());
  const [errors, setErrors] = useState<ErrorMap>({});
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [showAllServices, setShowAllServices] = useState<Record<string, boolean>>({});
  const [submittingMode, setSubmittingMode] = useState<SubmissionMode | null>(null);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);

  const currentStep = getStepFromSearchParam(searchParams.get(REQUEST_WIZARD_QUERY_KEY));
  const entityType = draft.who.entityType;
  const categories = entityType ? SERVICE_CATEGORIES_BY_ENTITY[entityType] : [];
  const groupedSelectedServices = entityType
    ? getGroupedSelectedServices(entityType, draft.what.selectedServices)
    : [];
  const detailRows = entityType ? getDetailSummaryRows(entityType, draft.details) : [];
  const registerQuery = useMemo(
    () => buildRegisterQueryFromContact(draft.contact),
    [draft.contact],
  );

  useEffect(() => {
    saveWizardStep("who", draft.who);
  }, [draft.who]);

  useEffect(() => {
    saveWizardStep("what", draft.what);
  }, [draft.what]);

  useEffect(() => {
    saveWizardStep("details", draft.details);
  }, [draft.details]);

  useEffect(() => {
    saveWizardStep("contact", draft.contact);
  }, [draft.contact]);

  useEffect(() => {
    const fullName =
      profile?.full_name ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      "";
    const phone = normalizePhoneNumber(profile?.phone ?? "");

    setDraft((current) => ({
      ...current,
      contact: {
        ...current.contact,
        fullName: current.contact.fullName || fullName,
        email: current.contact.email || user?.email || "",
        phoneNumber: current.contact.phoneNumber || phone,
      },
    }));
  }, [profile?.full_name, profile?.phone, user?.email, user?.user_metadata]);

  useEffect(() => {
    setDraft((current) => {
      const nextProvince = current.who.province;
      const nextCity = current.who.city;

      if (
        nextProvince === current.contact.province &&
        nextCity === current.contact.city
      ) {
        return current;
      }

      return {
        ...current,
        contact: {
          ...current.contact,
          province: nextProvince,
          city: nextCity,
        },
      };
    });
  }, [draft.who.city, draft.who.province]);

  useEffect(() => {
    if (categories.length === 0) {
      setExpandedCategories([]);
      return;
    }

    setExpandedCategories((current) => {
      const validCurrent = current.filter((key) =>
        categories.some((category) => category.key === key),
      );
      if (validCurrent.length > 0) {
        return validCurrent;
      }
      return [categories[0].key];
    });
  }, [categories]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentStep]);

  const isSubmitting = submittingMode !== null;

  const portalNavigationState = location.state as {
    fromPortal?: boolean;
    fromPath?: string;
  } | null;

  const leaveWizardForPortal = () => {
    navigate(portalNavigationState?.fromPath || dashboardPath, { replace: true });
  };

  const hardRedirect = (path: string) => {
    clearWizardDraft();
    window.location.replace(path);
  };

  const goHome = () => {
    hardRedirect("/");
  };

  const goLogin = () => {
    hardRedirect("/login");
  };

  const goRegister = () => {
    hardRedirect(`/register?${registerQuery}`);
  };

  const goDashboard = () => {
    hardRedirect(dashboardPath);
  };

  const renderBackControl = (homeLabel = "Back to home") => {
    if (portalNavigationState?.fromPortal && user) {
      return (
        <Button
          type="button"
          variant="ghost"
          className="rounded-full px-0 text-slate-600"
          onClick={leaveWizardForPortal}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      );
    }

    if (user) {
      return (
        <Button
          type="button"
          variant="ghost"
          className="rounded-full px-0 text-slate-600"
          onClick={() => navigate(dashboardPath, { replace: true })}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      );
    }

    return (
      <Button
        type="button"
        variant="ghost"
        className="rounded-full px-0 text-slate-600"
        onClick={goHome}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {homeLabel}
      </Button>
    );
  };

  const goToStep = (step: WizardStep) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set(REQUEST_WIZARD_QUERY_KEY, String(step));
    setSearchParams(nextParams, { replace: true });
  };

  const updateWho = (patch: Partial<WizardDraft["who"]>) => {
    setDraft((current) => ({ ...current, who: { ...current.who, ...patch } }));
  };

  const updateContact = (patch: Partial<WizardContactData>) => {
    setDraft((current) => ({
      ...current,
      contact: { ...current.contact, ...patch },
    }));
  };

  const updateLocation = (patch: Pick<WizardContactData, "province" | "city">) => {
    setDraft((current) => ({
      ...current,
      who: {
        ...current.who,
        province: patch.province,
        city: patch.city,
      },
      contact: {
        ...current.contact,
        province: patch.province,
        city: patch.city,
      },
    }));
  };

  const toggleService = (service: WizardService) => {
    setDraft((current) => {
      const isSelected = current.what.selectedServices.includes(service);
      if (!isSelected && current.what.selectedServices.length >= 5) {
        toast.error("You can select up to 5 services per request.");
        return current;
      }

      const nextSelectedServices = isSelected
        ? current.what.selectedServices.filter((item) => item !== service)
        : [...current.what.selectedServices, service];

      const removedCategory = isSelected ? getCategoryForService(service) : null;
      const stillHasOtherInCategory = removedCategory
        ? nextSelectedServices.some((item) => getCategoryForService(item) === removedCategory && item.toLowerCase().endsWith("_other"))
        : false;

      const nextOtherDetails = { ...current.what.otherDetails };
      if (removedCategory && !stillHasOtherInCategory) {
        delete nextOtherDetails[removedCategory];
      }

      return {
        ...current,
        what: {
          selectedServices: nextSelectedServices,
          otherDetails: nextOtherDetails,
        },
      };
    });
  };

  const updateOtherDetails = (categoryKey: WizardServiceCategory, value: string) => {
    setDraft((current) => ({
      ...current,
      what: {
        ...current.what,
        otherDetails: {
          ...current.what.otherDetails,
          [categoryKey]: value.slice(0, 500),
        },
      },
    }));
  };

  const validateCurrentStep = (step: WizardStep) => {
    let nextErrors: ErrorMap = {};
    if (step === 1) nextErrors = getValidationErrorsForWho(draft);
    if (step === 2) nextErrors = getValidationErrorsForWhat(draft);
    if (step === 3) nextErrors = getValidationErrorsForDetails(draft);
    if (step === 4) nextErrors = getValidationErrorsForContact(draft);
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const continueToNextStep = () => {
    if (!validateCurrentStep(currentStep)) {
      return;
    }

    if (currentStep === 4) {
      goToStep(5);
      return;
    }

    goToStep((currentStep + 1) as WizardStep);
  };

  const buildIdentityFields = (
    entityType: WizardEntityType,
    contactName: string,
  ): Pick<
    ServiceRequestInsert,
    "identity_document_type" | "id_number" | "company_name" | "company_registration_number"
  > => {
    if (entityType === "individual") {
      return {
        identity_document_type: null,
        id_number: null,
        company_name: null,
        company_registration_number: null,
      };
    }

    const organisationName = contactName.trim() || null;

    return {
      identity_document_type: null,
      id_number: null,
      company_name: organisationName,
      company_registration_number: null,
    };
  };

  const createLeadRequestPayload = (linkedProfileId: string | null, mode: SubmissionMode) => {
    const resolvedEntityType = draft.who.entityType as WizardEntityType;
    const priorityLevel = getPriorityLevel(draft);
    const signals = getRequestSignals(draft);
    const selectedCategoryKeys = Array.from(
      new Set(draft.what.selectedServices.map(getCategoryForService)),
    );
    const identityFields = buildIdentityFields(
      resolvedEntityType,
      draft.contact.fullName,
    );
    const requestPayload: ServiceRequestInsert = {
      full_name: draft.contact.fullName.trim(),
      email: draft.contact.email.trim().toLowerCase(),
      phone: `${draft.contact.phoneCountryCode} ${normalizePhoneNumber(draft.contact.phoneNumber)}`.trim(),
      province: draft.contact.province.trim(),
      city: draft.contact.city.trim() || null,
      contact_preference: draft.contact.contactPreference,
      marketing_consent: draft.contact.marketingConsent,
      submitted_with_account: mode === "account",
      client_profile_id: linkedProfileId,
      client_type: resolvedEntityType,
      ...identityFields,
      service_category: getPrimaryCategoryForSelection(resolvedEntityType, draft.what.selectedServices),
      service_categories: selectedCategoryKeys,
      service_needed: getPrimaryServiceForSelection(draft.what.selectedServices),
      service_needed_list: draft.what.selectedServices,
      priority_level: priorityLevel,
      description: buildRequestDescription(draft),
      sars_debt_amount: 0,
      returns_filed: signals.returnsFiled,
      has_debt_flag: signals.hasDebtFlag,
      missing_returns_flag: signals.missingReturnsFlag,
      missing_documents_flag: signals.missingDocumentsFlag,
      has_sars_audit: signals.hasSarsAudit,
      has_adr: signals.hasAdr,
      has_vat_investigation: signals.hasVatInvestigation,
      has_payroll_dispute: signals.hasPayrollDispute,
      has_multiple_tax_types: signals.hasMultipleTaxTypes,
      has_legal_complexity: signals.hasLegalComplexity,
      risk_indicator: signals.riskIndicator,
      intake_payload: buildIntakePayload(draft),
    };

    return { priorityLevel, requestPayload };
  };

  const ensureAccountForSubmission = async () => {
    if (user?.id) {
      return {
        linkedProfileId: user.id,
        requiresLogin: false,
        emailSent: false,
      };
    }

    const email = draft.contact.email.trim().toLowerCase();
    const temporaryPassword = `${crypto.randomUUID()}Aa1!`;
    const fullName = draft.contact.fullName.trim();

    const signUpResult = await supabase.auth.signUp({
      email,
      password: temporaryPassword,
      options: {
        data: {
          full_name: fullName,
          role: "client",
          account_type: "client",
          phone: `${draft.contact.phoneCountryCode} ${normalizePhoneNumber(draft.contact.phoneNumber)}`.trim(),
          province: draft.contact.province.trim(),
          city: draft.contact.city.trim(),
          client_type: draft.who.entityType,
        },
        emailRedirectTo: `${getAppBaseUrl()}/login`,
      },
    });

    if (signUpResult.error) {
      const normalizedMessage = signUpResult.error.message.toLowerCase();
      if (
        normalizedMessage.includes("already registered") ||
        normalizedMessage.includes("already exists") ||
        normalizedMessage.includes("user exists")
      ) {
        return {
          linkedProfileId: null,
          requiresLogin: true,
          emailSent: false,
          existingAccount: true,
        };
      }

      throw new Error(signUpResult.error.message);
    }

    let emailSent = false;
    if (!signUpResult.data.session) {
      const resetResult = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getAppBaseUrl()}/reset-password`,
      });
      if (resetResult.error) {
        console.error("Reset password email error:", resetResult.error);
      } else {
        emailSent = true;
      }
    }

    return {
      linkedProfileId:
        signUpResult.data.user?.id ?? signUpResult.data.session?.user?.id ?? null,
      requiresLogin: !signUpResult.data.session,
      emailSent,
      existingAccount: false,
    };
  };

  const handleSubmit = async (mode: SubmissionMode) => {
    const reviewStepValid = [1, 2, 3, 4].every((step) =>
      Object.keys(
        step === 1
          ? getValidationErrorsForWho(draft)
          : step === 2
            ? getValidationErrorsForWhat(draft)
            : step === 3
              ? getValidationErrorsForDetails(draft)
              : getValidationErrorsForContact(draft),
      ).length === 0,
    );

    if (!reviewStepValid || !draft.who.entityType) {
      toast.error("Complete all required steps before submitting your request.");
      return;
    }

    setSubmittingMode(mode);
    try {
      const accountResult =
        mode === "account"
          ? await ensureAccountForSubmission()
          : { linkedProfileId: null, requiresLogin: false, emailSent: false, existingAccount: false };

      let { priorityLevel, requestPayload } = createLeadRequestPayload(
        accountResult.linkedProfileId,
        mode,
      );

      let insertResult = await supabase
        .from("service_requests")
        .insert(requestPayload)
        .select("id")
        .single();

      if (insertResult.error && requestPayload.client_profile_id) {
        requestPayload = { ...requestPayload, client_profile_id: null };
        insertResult = await supabase
          .from("service_requests")
          .insert(requestPayload)
          .select("id")
          .single();
      }

      if (insertResult.error || !insertResult.data) {
        throw new Error(insertResult.error?.message || "Unable to submit your request.");
      }

      const selectedServiceLabels = groupedSelectedServices
        .flatMap((group) => group.selectedServices.map((service) => service.label))
        .join(", ");
      await sendRequestEmails(
        insertResult.data.id,
        requestPayload,
        selectedServiceLabels,
        priorityLevel,
      );

      clearWizardDraft();
      setDraft(getInitialWizardDraft());
      setSubmissionResult({
        requestId: insertResult.data.id,
        mode,
        linkedToAccount: Boolean(accountResult.linkedProfileId),
        requiresLogin: accountResult.requiresLogin,
        emailSent: accountResult.emailSent,
        existingAccount: accountResult.existingAccount,
      });
      toast.success(
        accountResult.existingAccount
          ? "An account already exists with this email. Your request was still submitted successfully."
          : "Your request has been submitted successfully.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to submit your request.",
      );
    } finally {
      setSubmittingMode(null);
    }
  };

  const renderError = (key: string) =>
    errors[key] ? <p className="mt-2 text-sm text-red-600">{errors[key]}</p> : null;

  const renderRadioGroup = (key: string, label: string, options: string[]) => (
    <div key={key} className="rounded-[1.5rem] border border-[#E7E7E7] bg-white p-5 shadow-sm">
      <Label className="text-base font-semibold text-[#102B46]">{label}</Label>
      <RadioGroup
        value={draft.details.answers[key] || ""}
        onValueChange={(value) => {
          setDraft((current) => ({
            ...current,
            details: {
              ...current.details,
              answers: { ...current.details.answers, [key]: value },
            },
          }));
        }}
        className="mt-4 space-y-3"
      >
        {options.map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3 transition hover:border-[#C49A22]"
          >
            <RadioGroupItem value={option} className="mt-1 border-[#C49A22] text-[#C49A22]" />
            <span className="text-sm text-slate-700">{option}</span>
          </label>
        ))}
      </RadioGroup>
      {renderError(key)}
    </div>
  );

  if (submissionResult) {
    return (
      <div className="min-h-screen bg-[#FAFAF6] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          {user ? (
            <Button
              type="button"
              variant="ghost"
              className="mb-6 rounded-full px-0 text-slate-600"
              onClick={goDashboard}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to dashboard
            </Button>
          ) : (
            <div className="mb-6">{renderBackControl("Back to home")}</div>
          )}

          <div className="rounded-[2.5rem] border border-[#E7E7E7] bg-white p-8 shadow-sm sm:p-10">
            <AcapoliteLogo className="h-12" />
            <div className="mt-8 flex h-20 w-20 items-center justify-center rounded-full bg-[#FFF6DB] text-[#C49A22]">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h1 className="mt-6 text-3xl font-black tracking-[-0.03em] text-[#102B46]">
              Request Submitted Successfully
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              Your request has been submitted and will be reviewed by qualified professionals. You will be contacted shortly.
            </p>

            <div className="mt-8 rounded-[1.75rem] border border-[#E7E7E7] bg-[#F8F9F7] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Reference</p>
              <p className="mt-2 font-mono text-sm text-slate-700">{submissionResult.requestId}</p>
            </div>

            {submissionResult.mode === "guest" ? (
              <div className="mt-8 rounded-[2rem] border border-[#E7E7E7] bg-[#FFFDF7] p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF1C8] text-[#C49A22]">
                    <Star className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-[#102B46]">Create a free account to track your request</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Create your account to track progress, upload documents and message professionals securely.
                    </p>
                    <Button
                      type="button"
                      className="mt-5 rounded-full bg-[#C49A22] text-white hover:bg-[#b48a1c]"
                      onClick={goRegister}
                    >
                      Create Free Account
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-8 rounded-[2rem] border border-[#E8D9B0] bg-[#FFF8E4] p-6 text-[#1A4731]">
                <p className="text-lg font-bold">
                  {submissionResult.existingAccount
                    ? "An account already exists with this email."
                    : "Your free account is ready."}
                </p>
                <p className="mt-2 text-sm leading-6">
                  {submissionResult.existingAccount
                    ? "Your request has still been submitted successfully. Please log in to access your existing account and track this request."
                    : submissionResult.emailSent
                      ? "We sent a secure email so you can set your password and access your request."
                      : "Use your account to track your request, upload documents and message professionals."}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {submissionResult.requiresLogin || submissionResult.existingAccount ? (
                    <Button
                      type="button"
                      className="rounded-full bg-[#C49A22] text-white hover:bg-[#b48a1c]"
                      onClick={goLogin}
                    >
                      Go to Login
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      className="rounded-full bg-[#C49A22] text-white hover:bg-[#b48a1c]"
                      onClick={goDashboard}
                    >
                      Go to Dashboard
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF6] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {renderBackControl()}
          <AcapoliteLogo className="h-11" />
        </div>

        <div className="mt-8">
          <RequestWizardProgress currentStep={currentStep} />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="space-y-6">
            {currentStep === 1 ? (
              <section className="rounded-[2rem] border border-[#E7E7E7] bg-white p-5 shadow-sm sm:rounded-[2.5rem] sm:p-8">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C49A22]">Step 1</p>
                <h1 className="mt-3 text-2xl font-black tracking-[-0.03em] text-[#102B46] sm:text-3xl">Who is this request for?</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
                  This helps us match you with the right type of professional.
                </p>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {ENTITY_OPTIONS.map((option) => {
                    const Icon = entityIcons[option.value];
                    const isActive = draft.who.entityType === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateWho({ entityType: option.value })}
                        className={`relative rounded-[1.75rem] border p-5 text-left transition ${
                          isActive
                            ? "border-[#C49A22] bg-[#FFF8E4] shadow-sm"
                            : "border-slate-200 bg-white hover:border-[#C49A22]/50"
                        }`}
                      >
                        {isActive ? (
                          <span className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-[#C49A22] text-white">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        ) : null}

                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#E7D6A6] bg-[#FFF1C8] text-[#C49A22]">
                          <Icon className="h-5 w-5" />
                        </div>
                        <p className="mt-4 text-base font-bold text-[#102B46] sm:text-lg">{option.label}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{option.description}</p>
                      </button>
                    );
                  })}
                </div>
                {renderError("entityType")}

                <div className="mt-8 grid gap-5 md:grid-cols-2">
                  <div>
                    <Label className="text-sm font-semibold text-[#102B46]">Your location</Label>
                    <Select value={draft.who.province} onValueChange={(value) => updateWho({ province: value })}>
                      <SelectTrigger className={`mt-2 h-12 rounded-2xl ${getInlineFieldError(errors, "province")}`}>
                        <SelectValue placeholder="Select your province or city" />
                      </SelectTrigger>
                      <SelectContent>
                        {SOUTH_AFRICAN_PROVINCES.map((province) => (
                          <SelectItem key={province} value={province}>
                            {province}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {renderError("province")}
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-[#102B46]">
                      City / Town {isNationwideSelection(draft.who.province) ? "(optional)" : ""}
                    </Label>
                    <Input
                      value={draft.who.city}
                      onChange={(event) => updateWho({ city: event.target.value })}
                      placeholder={isNationwideSelection(draft.who.province) ? "Optional for nationwide requests" : "Pretoria"}
                      className={`mt-2 h-12 rounded-2xl ${getInlineFieldError(errors, "city")}`}
                    />
                    {renderError("city")}
                  </div>
                </div>

                <Button onClick={continueToNextStep} className="mt-8 h-12 w-full rounded-2xl bg-[#C49A22] text-base font-semibold text-white hover:bg-[#b48a1c] sm:w-auto sm:px-8">
                  Continue Request
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                  <Lock className="h-4 w-4 text-[#1A4731]" />
                  Your information is secure and will only be shared with verified professionals.
                </p>

                <TrustSidebar className="mt-6 lg:hidden" />
              </section>
            ) : null}

            {currentStep === 2 ? (
              <section className="rounded-[2rem] border border-[#E7E7E7] bg-white p-5 shadow-sm sm:rounded-[2.5rem] sm:p-8">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C49A22]">Step 2</p>
                <h1 className="mt-3 text-2xl font-black tracking-[-0.03em] text-[#102B46] sm:text-3xl">What do you need help with?</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
                  Select all that apply so we can match you with the right professionals.
                </p>
                <p className="mt-3 text-sm font-medium text-slate-500">
                  Select up to 5 services. We only charge based on the highest-value service, with +1 credit when 3 or more services are selected.
                </p>

                <div className="mt-8 space-y-4">
                  {categories.map((category) => {
                    const Icon = categoryIcons[category.key as keyof typeof categoryIcons] ?? FileText;
                    const isExpanded = expandedCategories.includes(category.key);
                    const showAll = Boolean(showAllServices[category.key]);
                    const visibleServices = showAll ? category.services : category.services.slice(0, 5);

                    return (
                      <div key={category.key} className="overflow-hidden rounded-[1.75rem] border border-[#E7E7E7] bg-[#FBFBF8]">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedCategories((current) =>
                              current.includes(category.key)
                                ? current.filter((item) => item !== category.key)
                                : [...current, category.key],
                            )
                          }
                          className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left"
                        >
                          <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#C49A22] shadow-sm">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-lg font-bold text-[#102B46]">{category.title}</p>
                              <p className="mt-1 text-sm leading-6 text-slate-600">{category.description}</p>
                            </div>
                          </div>
                          <ChevronDown className={`h-5 w-5 shrink-0 text-slate-500 transition ${isExpanded ? "rotate-180" : ""}`} />
                        </button>

                        {isExpanded ? (
                          <div className="border-t border-[#E7E7E7] bg-white px-5 py-5">
                            <div className="space-y-3">
                              {visibleServices.map((service) => {
                                const isChecked = draft.what.selectedServices.includes(service.value);
                                return (
                                  <div key={service.value}>
                                    <label
                                      className={`relative flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                                        isChecked
                                          ? "border-[#C49A22] bg-[#FFF8E4] shadow-sm"
                                          : "border-slate-200 bg-white hover:border-[#C49A22]/60"
                                      }`}
                                    >
                                      <Checkbox
                                        checked={isChecked}
                                        onCheckedChange={() => toggleService(service.value)}
                                        className="mt-1 shrink-0 border-[#C49A22] data-[state=checked]:border-[#C49A22] data-[state=checked]:bg-[#C49A22]"
                                      />
                                      <div className="flex-1">
                                        <span className="text-sm leading-6 text-slate-700">{service.label}</span>
                                      </div>
                                    </label>
                                    {service.isOther && isChecked ? (
                                      <div className="mt-3 rounded-2xl border border-[#E8D9B0] bg-[#FFFDF6] p-4">
                                        <Label className="text-sm font-semibold text-[#102B46]">
                                          Describe your matter / problem
                                        </Label>
                                        <Textarea
                                          value={draft.what.otherDetails[category.key] ?? ""}
                                          onChange={(event) => updateOtherDetails(category.key, event.target.value)}
                                          placeholder="Please briefly describe the assistance you require."
                                          className={`mt-3 min-h-[120px] rounded-2xl ${getInlineFieldError(errors, `otherDetails.${category.key}`)}`}
                                        />
                                        {renderError(`otherDetails.${category.key}`)}
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>

                            {category.services.length > 5 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setShowAllServices((current) => ({
                                    ...current,
                                    [category.key]: !current[category.key],
                                  }))
                                }
                                className="mt-4 text-sm font-semibold text-[#1A4731]"
                              >
                                {showAll ? "Show less" : "Show more"}
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                {renderError("selectedServices")}

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button type="button" variant="outline" className="h-12 rounded-2xl border-[#D7D7D7] px-7" onClick={() => goToStep(1)}>
                    Back
                  </Button>
                  <Button type="button" className="h-12 rounded-2xl bg-[#C49A22] px-7 text-white hover:bg-[#b48a1c]" onClick={continueToNextStep}>
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </section>
            ) : null}

            {currentStep === 3 && entityType ? (
              <section className="rounded-[2rem] border border-[#E7E7E7] bg-white p-5 shadow-sm sm:rounded-[2.5rem] sm:p-8">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C49A22]">Step 3</p>
                <h1 className="mt-3 text-2xl font-black tracking-[-0.03em] text-[#102B46] sm:text-3xl">Tell us more about your request</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
                  This helps us match you with the right professionals who can assist you.
                </p>

                <div className="mt-6 rounded-[1.75rem] border border-[#E8D9B0] bg-[#FFF8E4] p-5 text-[#1A4731]">
                  <p className="text-sm font-semibold">
                    You selected: <span className="text-[#C49A22]">{getEntityLabel(entityType)}</span>
                  </p>
                  <p className="mt-1 text-sm">Let&apos;s gather a few more details about your request.</p>
                </div>

                <div className="mt-8 space-y-5">
                  {DETAIL_QUESTIONS_BY_ENTITY[entityType].map((question) => {
                    if (question.type === "radio") {
                      return renderRadioGroup(question.key, question.label, question.options);
                    }

                    if (question.type === "year-range") {
                      if (question.dependsOnKey && !draft.details.answers[question.dependsOnKey]) {
                        return null;
                      }

                      return (
                        <div key={question.key} className="rounded-[1.5rem] border border-[#E7E7E7] bg-white p-5 shadow-sm">
                          <Label className="text-base font-semibold text-[#102B46]">{question.label}</Label>
                          {question.helperText ? <p className="mt-2 text-sm text-slate-500">{question.helperText}</p> : null}
                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div>
                              <Label className="text-sm text-slate-600">From tax year</Label>
                              <Select
                                value={draft.details.answers[question.fromKey] || ""}
                                onValueChange={(value) =>
                                  setDraft((current) => ({
                                    ...current,
                                    details: {
                                      ...current.details,
                                      answers: { ...current.details.answers, [question.fromKey]: value },
                                    },
                                  }))
                                }
                              >
                                <SelectTrigger className={`mt-2 h-12 rounded-2xl ${getInlineFieldError(errors, question.fromKey)}`}>
                                  <SelectValue placeholder="Select year" />
                                </SelectTrigger>
                                <SelectContent>
                                  {TAX_YEAR_OPTIONS.map((year) => (
                                    <SelectItem key={year} value={year}>{year}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {renderError(question.fromKey)}
                            </div>
                            <div>
                              <Label className="text-sm text-slate-600">To tax year</Label>
                              <Select
                                value={draft.details.answers[question.toKey] || ""}
                                onValueChange={(value) =>
                                  setDraft((current) => ({
                                    ...current,
                                    details: {
                                      ...current.details,
                                      answers: { ...current.details.answers, [question.toKey]: value },
                                    },
                                  }))
                                }
                              >
                                <SelectTrigger className={`mt-2 h-12 rounded-2xl ${getInlineFieldError(errors, question.toKey)}`}>
                                  <SelectValue placeholder="Select year" />
                                </SelectTrigger>
                                <SelectContent>
                                  {TAX_YEAR_OPTIONS.map((year) => (
                                    <SelectItem key={year} value={year}>{year}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {renderError(question.toKey)}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={question.key} className="rounded-[1.5rem] border border-[#E7E7E7] bg-white p-5 shadow-sm">
                        <Label className="text-base font-semibold text-[#102B46]">{question.label}</Label>
                        <Textarea
                          value={draft.details.additionalNotes}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              details: {
                                ...current.details,
                                additionalNotes: event.target.value.slice(0, question.maxLength),
                              },
                            }))
                          }
                          placeholder="Add any context that will help the right professional respond quickly."
                          className={`mt-4 min-h-[160px] rounded-[1.5rem] ${getInlineFieldError(errors, "additionalNotes")}`}
                        />
                        <div className="mt-2 flex items-center justify-between text-sm text-slate-500">
                          {renderError("additionalNotes") || <span>Optional</span>}
                          <span>{draft.details.additionalNotes.length}/{question.maxLength}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button type="button" variant="outline" className="h-12 rounded-2xl border-[#D7D7D7] px-7" onClick={() => goToStep(2)}>
                    Back
                  </Button>
                  <Button type="button" className="h-12 rounded-2xl bg-[#C49A22] px-7 text-white hover:bg-[#b48a1c]" onClick={continueToNextStep}>
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </section>
            ) : null}

            {currentStep === 4 ? (
              <section className="rounded-[2rem] border border-[#E7E7E7] bg-white p-5 shadow-sm sm:rounded-[2.5rem] sm:p-8">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C49A22]">Step 4</p>
                <h1 className="mt-3 text-2xl font-black tracking-[-0.03em] text-[#102B46] sm:text-3xl">Your contact information</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
                  Please provide your details so we can connect you with the right professionals.
                </p>

                <div className="mt-6 flex items-center gap-3 rounded-[1.75rem] border border-[#DCE8E1] bg-[#F6FBF8] p-4 text-sm text-[#1A4731]">
                  <Shield className="h-5 w-5 text-[#1A4731]" />
                  Your information is secure — we only share your details with relevant, verified professionals.
                </div>

                <div className="mt-8 space-y-8">
                  <div>
                    <h2 className="text-xl font-bold text-[#102B46]">Your details</h2>
                    <div className="mt-4 grid gap-5 md:grid-cols-2">
                      <div>
                        <Label className="text-sm font-semibold text-[#102B46]">Full name *</Label>
                        <Input value={draft.contact.fullName} onChange={(event) => updateContact({ fullName: event.target.value })} className={`mt-2 h-12 rounded-2xl ${getInlineFieldError(errors, "fullName")}`} />
                        {renderError("fullName")}
                      </div>
                      <div>
                        <Label className="text-sm font-semibold text-[#102B46]">Email address *</Label>
                        <Input type="email" value={draft.contact.email} onChange={(event) => updateContact({ email: event.target.value })} className={`mt-2 h-12 rounded-2xl ${getInlineFieldError(errors, "email")}`} />
                        {renderError("email")}
                      </div>
                    </div>
                    <div className="mt-5 grid gap-5 md:grid-cols-[150px_minmax(0,1fr)]">
                      <div>
                        <Label className="text-sm font-semibold text-[#102B46]">Code</Label>
                        <Select value={draft.contact.phoneCountryCode} onValueChange={(value) => updateContact({ phoneCountryCode: value })}>
                          <SelectTrigger className="mt-2 h-12 rounded-2xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PHONE_COUNTRY_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm font-semibold text-[#102B46]">Phone number *</Label>
                        <Input value={draft.contact.phoneNumber} onChange={(event) => updateContact({ phoneNumber: normalizePhoneNumber(event.target.value) })} placeholder="82 123 4567" className={`mt-2 h-12 rounded-2xl ${getInlineFieldError(errors, "phoneNumber")}`} />
                        {renderError("phoneNumber")}
                        <p className="mt-2 text-sm text-slate-500">We&apos;ll use this to contact you about your request.</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-[#102B46]">Where are you based?</h2>
                    <div className="mt-4 grid gap-5 md:grid-cols-2">
                      <div>
                        <Label className="text-sm font-semibold text-[#102B46]">Province *</Label>
                        <Select value={draft.contact.province} onValueChange={(value) => updateLocation({ province: value, city: draft.contact.city })}>
                          <SelectTrigger className={`mt-2 h-12 rounded-2xl ${getInlineFieldError(errors, "contactProvince")}`}>
                            <SelectValue placeholder="Select province" />
                          </SelectTrigger>
                          <SelectContent>
                            {contactProvinceOptions.map((province) => (
                              <SelectItem key={province} value={province}>{province}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {renderError("contactProvince")}
                      </div>
                      <div>
                        <Label className="text-sm font-semibold text-[#102B46]">
                          City / Town {isNationwideSelection(draft.contact.province) ? "(optional)" : "*"}
                        </Label>
                        <Input value={draft.contact.city} onChange={(event) => updateLocation({ province: draft.contact.province, city: event.target.value })} className={`mt-2 h-12 rounded-2xl ${getInlineFieldError(errors, "contactCity")}`} placeholder="Pretoria" />
                        {renderError("contactCity")}
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">This helps us match you with professionals in your area.</p>
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-[#102B46]">Best way to reach you</h2>
                    <p className="mt-1 text-sm text-slate-500">How would you prefer professionals to contact you?</p>
                    <RadioGroup value={draft.contact.contactPreference} onValueChange={(value) => updateContact({ contactPreference: value as WizardContactData["contactPreference"] })} className="mt-4 grid gap-3 md:grid-cols-2">
                      {CONTACT_PREFERENCE_OPTIONS.map((option) => (
                        <label key={`contact-preference-${option}`} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3 transition hover:border-[#C49A22]">
                          <RadioGroupItem value={option} className="mt-1 border-[#C49A22] text-[#C49A22]" />
                          <span className="text-sm text-slate-700">{option}</span>
                        </label>
                      ))}
                    </RadioGroup>
                    {renderError("contactPreference")}
                  </div>

                  <label className="flex items-start gap-3 rounded-2xl border border-[#E7E7E7] bg-[#FBFBF8] p-4">
                    <Checkbox checked={draft.contact.marketingConsent} onCheckedChange={(checked) => updateContact({ marketingConsent: Boolean(checked) })} className="mt-1 border-[#C49A22] data-[state=checked]:border-[#C49A22] data-[state=checked]:bg-[#C49A22]" />
                    <span className="text-sm leading-6 text-slate-700">It&apos;s okay to send me useful tips, updates and offers from Acapolite. You can opt out at any time.</span>
                  </label>
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button type="button" variant="outline" className="h-12 rounded-2xl border-[#D7D7D7] px-7" onClick={() => goToStep(3)}>
                    Back
                  </Button>
                  <Button type="button" className="h-12 rounded-2xl bg-[#C49A22] px-7 text-white hover:bg-[#b48a1c]" onClick={continueToNextStep}>
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </section>
            ) : null}

            {currentStep === 5 ? (
              <section className="rounded-[2.5rem] border border-[#E7E7E7] bg-white p-6 shadow-sm sm:p-8">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C49A22]">Step 5</p>
                <h1 className="mt-3 text-3xl font-black tracking-[-0.03em] text-[#102B46]">Review your request</h1>
                <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
                  Please review your details below before submitting your request.
                </p>

                <div className="mt-8 grid gap-5 xl:grid-cols-2">
                  <SummaryCard title="Who is this for?" onEdit={() => goToStep(1)}>
                    <p className="font-semibold text-[#102B46]">{entityType ? getEntityLabel(entityType) : "Not selected"}</p>
                    <p className="mt-2 text-slate-600">{[draft.who.city, draft.who.province].filter(Boolean).join(", ") || "Location not provided"}</p>
                  </SummaryCard>

                  <SummaryCard title="Services you need help with" onEdit={() => goToStep(2)}>
                    {groupedSelectedServices.length > 0 ? (
                      <div className="space-y-3">
                        {groupedSelectedServices.map((group) => (
                          <div key={group.key}>
                            <p className="font-semibold text-[#102B46]">{group.title}</p>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600">
                              {group.selectedServices.map((service) => (
                                <li key={service.value}>
                                  {service.label}
                                  {draft.what.otherDetails[group.key]
                                    && service.value.toLowerCase().endsWith("_other")
                                    ? ` — ${draft.what.otherDetails[group.key]}`
                                    : ""}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-600">No services selected.</p>
                    )}
                  </SummaryCard>

                  <SummaryCard title="Request details" onEdit={() => goToStep(3)}>
                    {detailRows.length > 0 ? (
                      <div className="space-y-3">
                        {detailRows.map((row) => (
                          <div key={row.label} className="rounded-2xl bg-[#F8F9F7] px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{row.label}</p>
                            <p className="mt-1 text-sm text-slate-700">{row.value}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-600">No details provided.</p>
                    )}
                  </SummaryCard>

                  <SummaryCard title="Your contact information" onEdit={() => goToStep(4)}>
                    <div className="space-y-2 text-slate-700">
                      <p><span className="font-semibold text-[#102B46]">Name:</span> {draft.contact.fullName}</p>
                      <p><span className="font-semibold text-[#102B46]">Email:</span> {draft.contact.email}</p>
                      <p><span className="font-semibold text-[#102B46]">Phone:</span> {draft.contact.phoneCountryCode} {draft.contact.phoneNumber}</p>
                      <p><span className="font-semibold text-[#102B46]">Location:</span> {[draft.contact.city, draft.contact.province].filter(Boolean).join(", ")}</p>
                      <p><span className="font-semibold text-[#102B46]">Contact preference:</span> {draft.contact.contactPreference || "Not selected"}</p>
                    </div>
                  </SummaryCard>
                </div>

                <div className="mt-8 rounded-[1.75rem] border border-[#E7E7E7] bg-[#F8F9F7] p-5">
                  <h2 className="text-xl font-bold text-[#102B46]">You&apos;re almost done!</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    You can submit your request now as a guest or create a free account to track progress, upload documents and message professionals.
                  </p>
                </div>

                <div className="mt-8 grid gap-5 xl:grid-cols-2">
                  <div className="rounded-[2rem] border-2 border-[#C49A22] bg-[#FFFDF6] p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF1C8] text-[#C49A22]">
                        <Star className="h-5 w-5" />
                      </div>
                      <span className="rounded-full bg-[#C49A22] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-white">Recommended</span>
                    </div>
                    <h3 className="mt-5 text-2xl font-bold text-[#102B46]">Submit &amp; Create a Free Account</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">Track your request, upload documents and message professionals.</p>
                    <Button className="mt-6 h-12 w-full rounded-2xl bg-[#C49A22] text-white hover:bg-[#b48a1c]" onClick={() => handleSubmit("account")} disabled={isSubmitting}>
                      {submittingMode === "account" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Submit &amp; Create Account
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>

                  <div className="rounded-[2rem] border border-[#E7E7E7] bg-white p-6 shadow-sm">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F3F4F6] text-slate-600">
                      <Send className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 text-2xl font-bold text-[#102B46]">Submit Without an Account</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">We&apos;ll send professionals your details. Limited tracking features may apply.</p>
                    <Button variant="outline" className="mt-6 h-12 w-full rounded-2xl border-[#D7D7D7]" onClick={() => handleSubmit("guest")} disabled={isSubmitting}>
                      {submittingMode === "guest" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Submit Without Account
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <p className="mt-5 flex items-center gap-2 text-sm text-slate-500">
                  <Lock className="h-4 w-4 text-[#1A4731]" />
                  Your information is secure and will only be shared with verified professionals.
                </p>

                <div className="mt-8 flex">
                  <Button type="button" variant="outline" className="h-12 rounded-2xl border-[#D7D7D7] px-7" onClick={() => goToStep(4)} disabled={isSubmitting}>
                    Back
                  </Button>
                </div>
              </section>
            ) : null}
          </div>

          {currentStep >= 1 && currentStep <= 4 ? <TrustSidebar className="hidden lg:block" /> : null}
        </div>
      </div>
    </div>
  );
}
