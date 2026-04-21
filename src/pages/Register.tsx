import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";
import { getAppBaseUrl } from "@/lib/siteUrl";

type AccountType = "client" | "practitioner";

const professionalBodies = [
  "SAIT",
  "SAICA",
  "SAIPA",
  "ACCA",
  "CIMA",
  "CIBA",
  "IAC",
  "CGISA",
  "FPI",
  "Other",
];
const provinces = [
  "Gauteng",
  "Western Cape",
  "KwaZulu-Natal",
  "Eastern Cape",
  "Free State",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
];

export default function Register() {
  const [accountType, setAccountType] = useState<AccountType>("client");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [clientForm, setClientForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    province: "",
    idNumber: "",
  });
  const [practitionerForm, setPractitionerForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    idNumber: "",
    taxPractitionerNumber: "",
    professionalBody: professionalBodies[0],
    professionalBodyOther: "",
    yearsExperience: "",
    city: "",
    province: "",
  });
  const [practitionerDocuments, setPractitionerDocuments] = useState({
    idCopy: null as File | null,
    certificate: null as File | null,
    proofOfAddress: null as File | null,
    bankConfirmation: null as File | null,
  });
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Creating account...");
  const [pendingPractitionerUserId, setPendingPractitionerUserId] = useState<
    string | null
  >(null);
  const { dashboardPath, loading: authLoading, user } = useAuth();
  const location = useLocation();
  const [prefillApplied, setPrefillApplied] = useState(false);
  const passwordRules = useMemo(
    () => ({
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasNumber: /\d/.test(password),
    }),
    [password],
  );
  const isPasswordValid =
    passwordRules.minLength &&
    passwordRules.hasUppercase &&
    passwordRules.hasNumber;
  const canSubmit =
    acceptedTerms && acceptedPrivacy && isPasswordValid && !loading;

  useEffect(() => {
    if (!authLoading && user) {
      window.location.replace(dashboardPath);
    }
  }, [authLoading, dashboardPath, user]);

  useEffect(() => {
    if (prefillApplied) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const roleParam = params.get("role")?.trim().toLowerCase();
    const fullName = params.get("full_name")?.trim() ?? "";
    const emailParam = params.get("email")?.trim() ?? "";
    const phoneParam = params.get("phone")?.trim() ?? "";
    const provinceParam = params.get("province")?.trim() ?? "";
    const idNumberParam = params.get("id_number")?.trim() ?? "";

    if (roleParam === "consultant" || roleParam === "practitioner") {
      setAccountType("practitioner");
    }

    if (
      !fullName &&
      !emailParam &&
      !phoneParam &&
      !provinceParam &&
      !idNumberParam
    ) {
      setPrefillApplied(true);
      return;
    }

    const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean);
    const lastName = rest.join(" ");

    if (emailParam) {
      setEmail((current) => current || emailParam);
    }
    setClientForm((current) => ({
      ...current,
      firstName: current.firstName || firstName || current.firstName,
      lastName: current.lastName || lastName || current.lastName,
      phone: current.phone || phoneParam || current.phone,
      province: current.province || provinceParam || current.province,
      idNumber: current.idNumber || idNumberParam || current.idNumber,
    }));

    setPrefillApplied(true);
  }, [location.search, prefillApplied]);

  const practitionerSignupFunctionUrl =
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/complete-practitioner-signup`;
  const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const ensurePractitionerSignupFunctionReady = async () => {
    const response = await fetch(practitionerSignupFunctionUrl, {
      method: "OPTIONS",
      headers: {
        apikey: supabasePublishableKey,
        Authorization: `Bearer ${supabasePublishableKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(
        "Practitioner document upload service is not available. Please deploy the complete-practitioner-signup function before creating practitioner accounts.",
      );
    }
  };

  const completePractitionerSignup = async (userId?: string) => {
    if (
      !practitionerDocuments.idCopy ||
      !practitionerDocuments.certificate ||
      !practitionerDocuments.proofOfAddress ||
      !practitionerDocuments.bankConfirmation
    ) {
      throw new Error("Please upload all required verification documents.");
    }

    const formData = new FormData();
    if (userId) {
      formData.append("userId", userId);
    }
    formData.append("email", email.trim());
    formData.append("password", password);
    formData.append("fullName", `${practitionerForm.firstName.trim()} ${practitionerForm.lastName.trim()}`.trim());
    formData.append("phone", practitionerForm.phone.trim());
    formData.append("idNumber", practitionerForm.idNumber.trim());
    formData.append(
      "taxPractitionerNumber",
      practitionerForm.taxPractitionerNumber.trim(),
    );
    formData.append(
      "professionalBody",
      practitionerForm.professionalBody === "Other"
        ? practitionerForm.professionalBodyOther.trim()
        : practitionerForm.professionalBody.trim(),
    );
    formData.append("yearsExperience", practitionerForm.yearsExperience.trim());
    formData.append("city", practitionerForm.city.trim());
    formData.append("province", practitionerForm.province.trim());
    formData.append("idCopy", practitionerDocuments.idCopy);
    formData.append("certificate", practitionerDocuments.certificate);
    formData.append("proofOfAddress", practitionerDocuments.proofOfAddress);
    formData.append("bankConfirmation", practitionerDocuments.bankConfirmation);

    const response = await fetch(
      practitionerSignupFunctionUrl,
      {
        method: "POST",
        headers: {
          apikey: supabasePublishableKey,
          Authorization: `Bearer ${supabasePublishableKey}`,
        },
        body: formData,
      },
    );

    const result = (await response.json().catch(() => null)) as
      | { error?: string; savedDocuments?: number }
      | null;

    if (!response.ok) {
      throw new Error(
        result?.error ||
          "Practitioner verification documents could not be saved.",
      );
    }

    if ((result?.savedDocuments ?? 0) < 4) {
      throw new Error(
        "Practitioner signup did not save all required documents. Please try again before leaving this page.",
      );
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!acceptedTerms || !acceptedPrivacy) {
      toast.error("You must accept the Terms & Conditions and Privacy Policy.");
      return;
    }

    if (!isPasswordValid) {
      toast.error(
        "Password must be at least 8 characters with 1 uppercase letter and 1 number.",
      );
      return;
    }

    if (accountType === "client") {
      if (
        !clientForm.firstName.trim() ||
        !clientForm.lastName.trim() ||
        !clientForm.phone.trim() ||
        !clientForm.province.trim() ||
        !clientForm.idNumber.trim()
      ) {
        toast.error("Please complete all required client fields.");
        return;
      }
    }

    if (accountType === "practitioner") {
      if (
        !practitionerForm.firstName.trim() ||
        !practitionerForm.lastName.trim() ||
        !practitionerForm.phone.trim() ||
        !practitionerForm.idNumber.trim() ||
        !practitionerForm.taxPractitionerNumber.trim() ||
        !practitionerForm.professionalBody.trim() ||
        (practitionerForm.professionalBody === "Other" &&
          !practitionerForm.professionalBodyOther.trim()) ||
        !practitionerForm.yearsExperience.trim() ||
        !practitionerForm.city.trim() ||
        !practitionerForm.province.trim()
      ) {
        toast.error("Please complete all required practitioner fields.");
        return;
      }

      if (
        !practitionerDocuments.idCopy ||
        !practitionerDocuments.certificate ||
        !practitionerDocuments.proofOfAddress ||
        !practitionerDocuments.bankConfirmation
      ) {
        toast.error("Please upload all required verification documents.");
        return;
      }
    }

    setLoading(true);
    setLoadingMessage("Creating account...");
    try {
      if (accountType === "practitioner") {
        const fullName =
          `${practitionerForm.firstName.trim()} ${practitionerForm.lastName.trim()}`.trim();

        setLoadingMessage("Checking practitioner upload service...");
        await ensurePractitionerSignupFunctionReady();
        setLoadingMessage("Creating practitioner account and uploading documents...");
        await completePractitionerSignup();

        toast.success("Practitioner account created and documents submitted for admin review.");
        window.location.replace("/login");
        return;
      }

      const signupRole =
        accountType === "practitioner" ? "consultant" : "client";
      const signupRoleLabel =
        accountType === "practitioner" ? "practitioner" : "client";
      const fullName =
        accountType === "practitioner"
          ? `${practitionerForm.firstName.trim()} ${practitionerForm.lastName.trim()}`
          : `${clientForm.firstName.trim()} ${clientForm.lastName.trim()}`;
      const resolvedProfessionalBody =
        accountType === "practitioner" &&
        practitionerForm.professionalBody === "Other"
          ? practitionerForm.professionalBodyOther.trim()
          : practitionerForm.professionalBody.trim();

      let data:
        | Awaited<ReturnType<typeof supabase.auth.signUp>>["data"]
        | null = null;

      if (!pendingPractitionerUserId) {
        if (accountType === "practitioner") {
          setLoadingMessage("Checking practitioner upload service...");
          await ensurePractitionerSignupFunctionReady();
          setLoadingMessage("Creating account...");
        }

        const signUpResult = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: signupRole,
              account_type: signupRoleLabel,
              first_name:
                accountType === "practitioner"
                  ? practitionerForm.firstName.trim()
                  : clientForm.firstName.trim(),
              last_name:
                accountType === "practitioner"
                  ? practitionerForm.lastName.trim()
                  : clientForm.lastName.trim(),
              phone:
                accountType === "practitioner"
                  ? practitionerForm.phone.trim()
                  : clientForm.phone.trim(),
              id_number:
                accountType === "practitioner"
                  ? practitionerForm.idNumber.trim()
                  : clientForm.idNumber.trim(),
              tax_practitioner_number:
                accountType === "practitioner"
                  ? practitionerForm.taxPractitionerNumber.trim()
                  : null,
              registration_number: null,
              professional_body:
                accountType === "practitioner"
                  ? resolvedProfessionalBody
                  : null,
              years_of_experience:
                accountType === "practitioner"
                  ? practitionerForm.yearsExperience.trim()
                  : null,
              city:
                accountType === "practitioner"
                  ? practitionerForm.city.trim()
                  : null,
              province:
                accountType === "practitioner"
                  ? practitionerForm.province.trim()
                  : clientForm.province.trim(),
            },
            emailRedirectTo: `${getAppBaseUrl()}/login`,
          },
        });

        data = signUpResult.data;

        if (signUpResult.error) {
          toast.error(signUpResult.error.message);
          return;
        }
      }
      const createdUserId =
        pendingPractitionerUserId ??
        data?.user?.id ??
        data?.session?.user?.id ??
        null;

      if (!pendingPractitionerUserId && data?.user?.id) {
        const profilePayload = {
          profileId: data.user.id,
          email,
          fullName,
        };

        const emailResults = await Promise.allSettled([
          supabase.functions.invoke("send-portal-email", {
            body: {
              type: "signup_notification",
              ...profilePayload,
              role: signupRoleLabel,
              provider: "email",
            },
          }),
          ...(accountType === "client"
            ? [
                supabase.functions.invoke("send-portal-email", {
                  body: {
                    type: "welcome_email",
                    ...profilePayload,
                  },
                }),
              ]
            : []),
        ]);

        emailResults.forEach((result) => {
          if (result.status === "rejected") {
            console.error("Signup email request failed:", result.reason);
            return;
          }

          if (result.value.error) {
            console.error("Signup email function error:", result.value.error);
          }
        });
      }

      if (createdUserId && accountType === "practitioner") {
        setPendingPractitionerUserId(createdUserId);
        setLoadingMessage("Saving practitioner profile and uploading documents...");
        await completePractitionerSignup(createdUserId);
        setPendingPractitionerUserId(null);
      }

      if (accountType === "practitioner") {
        toast.success("Practitioner account created and documents submitted.");
      } else {
        toast.success("Account created successfully.");
      }

      if (!data?.session && accountType === "practitioner") {
        toast.success(
          "Verification email sent. Check your inbox to confirm your account.",
        );
      }

      if (data?.session) {
        await supabase.auth.signOut();
      }

      toast.success(
        "Check your email to verify your account before signing in.",
      );
      window.location.replace("/login");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Sign up failed. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-gradient flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 font-body text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <div className="bg-card rounded-2xl shadow-elevated border border-border p-8">
          <AcapoliteLogo className="mb-6 h-14" />

          <h1 className="font-display text-2xl font-bold text-foreground mb-2">
            {accountType === "practitioner"
              ? "Join as a Verified Tax Practitioner"
              : "Create Your Client Account"}
          </h1>
          <p className="text-sm text-muted-foreground font-body mb-3">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-primary font-semibold hover:underline"
            >
              Sign in
            </Link>
          </p>
          <p className="text-muted-foreground font-body text-sm mb-6">
            {accountType === "practitioner"
              ? "Help clients and grow your practice using the Acapolite platform."
              : "Submit tax requests, track cases, and communicate securely."}
          </p>

          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              variant={accountType === "client" ? "default" : "outline"}
              className="rounded-xl"
              onClick={() => setAccountType("client")}
            >
              Create Client Account
            </Button>
            <Button
              type="button"
              variant={accountType === "practitioner" ? "default" : "outline"}
              className="rounded-xl"
              onClick={() => setAccountType("practitioner")}
            >
              Join as Practitioner
            </Button>
          </div>

          {accountType === "practitioner" ? (
            <div className="mb-6 rounded-2xl border border-border/70 bg-muted/35 px-4 py-3 text-sm font-body text-muted-foreground">
              Register as a Practitioner using your email and password to ensure
              your account is created with the correct access permissions.
            </div>
          ) : null}

          <form onSubmit={handleRegister} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="first-name" className="font-body">
                  First Name
                </Label>
                <Input
                  id="first-name"
                  value={
                    accountType === "practitioner"
                      ? practitionerForm.firstName
                      : clientForm.firstName
                  }
                  onChange={(event) =>
                    accountType === "practitioner"
                      ? setPractitionerForm((current) => ({
                          ...current,
                          firstName: event.target.value,
                        }))
                      : setClientForm((current) => ({
                          ...current,
                          firstName: event.target.value,
                        }))
                  }
                  required
                  className="mt-1.5"
                  placeholder="First name"
                />
              </div>
              <div>
                <Label htmlFor="last-name" className="font-body">
                  Last Name
                </Label>
                <Input
                  id="last-name"
                  value={
                    accountType === "practitioner"
                      ? practitionerForm.lastName
                      : clientForm.lastName
                  }
                  onChange={(event) =>
                    accountType === "practitioner"
                      ? setPractitionerForm((current) => ({
                          ...current,
                          lastName: event.target.value,
                        }))
                      : setClientForm((current) => ({
                          ...current,
                          lastName: event.target.value,
                        }))
                  }
                  required
                  className="mt-1.5"
                  placeholder="Last name"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email" className="font-body">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1.5"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <Label htmlFor="phone" className="font-body">
                Phone Number
              </Label>
              <Input
                id="phone"
                value={
                  accountType === "practitioner"
                    ? practitionerForm.phone
                    : clientForm.phone
                }
                onChange={(event) =>
                  accountType === "practitioner"
                    ? setPractitionerForm((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    : setClientForm((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                }
                required
                className="mt-1.5"
                placeholder="+27 ..."
              />
            </div>
            {accountType === "client" ? (
              <>
                <div>
                  <Label htmlFor="client-id-number" className="font-body">
                    ID Number
                  </Label>
                  <Input
                    id="client-id-number"
                    value={clientForm.idNumber}
                    onChange={(event) =>
                      setClientForm((current) => ({
                        ...current,
                        idNumber: event.target.value,
                      }))
                    }
                    required
                    className="mt-1.5"
                    placeholder="ID Number"
                  />
                </div>
                <div>
                  <Label htmlFor="client-province" className="font-body">
                    Province
                  </Label>
                  <Select
                    value={clientForm.province}
                    onValueChange={(value) =>
                      setClientForm((current) => ({
                        ...current,
                        province: value,
                      }))
                    }
                  >
                    <SelectTrigger id="client-province" className="mt-1.5">
                      <SelectValue placeholder="Select province" />
                    </SelectTrigger>
                    <SelectContent>
                      {provinces.map((province) => (
                        <SelectItem key={province} value={province}>
                          {province}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}
            {accountType === "practitioner" ? (
              <>
                <div>
                  <Label htmlFor="id-number" className="font-body">
                    ID Number
                  </Label>
                  <Input
                    id="id-number"
                    value={practitionerForm.idNumber}
                    onChange={(event) =>
                      setPractitionerForm((current) => ({
                        ...current,
                        idNumber: event.target.value,
                      }))
                    }
                    required
                    className="mt-1.5"
                    placeholder="ID Number"
                  />
                </div>
                <div>
                  <Label
                    htmlFor="tax-practitioner-number"
                    className="font-body"
                  >
                    Tax Practitioner Number
                  </Label>
                  <Input
                    id="tax-practitioner-number"
                    value={practitionerForm.taxPractitionerNumber}
                    onChange={(event) =>
                      setPractitionerForm((current) => ({
                        ...current,
                        taxPractitionerNumber: event.target.value,
                      }))
                    }
                    required
                    className="mt-1.5"
                    placeholder="Tax Practitioner Number"
                  />
                </div>
                <div>
                  <Label htmlFor="professional-body" className="font-body">
                    Professional Body
                  </Label>
                  <Select
                    value={practitionerForm.professionalBody}
                    onValueChange={(value) =>
                      setPractitionerForm((current) => ({
                        ...current,
                        professionalBody: value,
                      }))
                    }
                  >
                    <SelectTrigger id="professional-body" className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {professionalBodies.map((body) => (
                        <SelectItem key={body} value={body}>
                          {body}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {practitionerForm.professionalBody === "Other" ? (
                  <div>
                    <Label
                      htmlFor="professional-body-other"
                      className="font-body"
                    >
                      Specify Professional Body
                    </Label>
                    <Input
                      id="professional-body-other"
                      value={practitionerForm.professionalBodyOther}
                      onChange={(event) =>
                        setPractitionerForm((current) => ({
                          ...current,
                          professionalBodyOther: event.target.value,
                        }))
                      }
                      required
                      className="mt-1.5"
                      placeholder="Enter professional body"
                    />
                  </div>
                ) : null}
                <div>
                  <Label htmlFor="years-experience" className="font-body">
                    Years of Experience
                  </Label>
                  <Input
                    id="years-experience"
                    type="number"
                    min="0"
                    value={practitionerForm.yearsExperience}
                    onChange={(event) =>
                      setPractitionerForm((current) => ({
                        ...current,
                        yearsExperience: event.target.value,
                      }))
                    }
                    required
                    className="mt-1.5"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="city" className="font-body">
                    City
                  </Label>
                  <Input
                    id="city"
                    value={practitionerForm.city}
                    onChange={(event) =>
                      setPractitionerForm((current) => ({
                        ...current,
                        city: event.target.value,
                      }))
                    }
                    required
                    className="mt-1.5"
                    placeholder="City"
                  />
                </div>
                <div>
                  <Label htmlFor="province" className="font-body">
                    Province
                  </Label>
                  <Select
                    value={practitionerForm.province}
                    onValueChange={(value) =>
                      setPractitionerForm((current) => ({
                        ...current,
                        province: value,
                      }))
                    }
                  >
                    <SelectTrigger id="province" className="mt-1.5">
                      <SelectValue placeholder="Select province" />
                    </SelectTrigger>
                    <SelectContent>
                      {provinces.map((province) => (
                        <SelectItem key={province} value={province}>
                          {province}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}
            <div>
              <Label htmlFor="password" className="font-body">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1.5"
                placeholder="Min. 8 characters"
                minLength={8}
              />
              <div className="mt-2 text-xs text-muted-foreground font-body space-y-1">
                <p
                  className={passwordRules.minLength ? "text-emerald-600" : ""}
                >
                  Minimum 8 characters
                </p>
                <p
                  className={
                    passwordRules.hasUppercase ? "text-emerald-600" : ""
                  }
                >
                  At least 1 uppercase letter
                </p>
                <p
                  className={passwordRules.hasNumber ? "text-emerald-600" : ""}
                >
                  At least 1 number
                </p>
              </div>
            </div>
            {accountType === "practitioner" ? (
              <div className="space-y-4 rounded-2xl border border-border bg-muted/40 p-4">
                <p className="text-sm font-semibold text-foreground font-body">
                  Verification Documents
                </p>
                <div>
                  <Label htmlFor="id-copy" className="font-body">
                    ID Copy
                  </Label>
                  <Input
                    id="id-copy"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    required
                    className="mt-1.5"
                    onChange={(event) =>
                      setPractitionerDocuments((current) => ({
                        ...current,
                        idCopy: event.target.files?.[0] || null,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="certificate" className="font-body">
                    Practitioner Certificate
                  </Label>
                  <Input
                    id="certificate"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    required
                    className="mt-1.5"
                    onChange={(event) =>
                      setPractitionerDocuments((current) => ({
                        ...current,
                        certificate: event.target.files?.[0] || null,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="proof-of-address" className="font-body">
                    Proof of Address
                  </Label>
                  <Input
                    id="proof-of-address"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    required
                    className="mt-1.5"
                    onChange={(event) =>
                      setPractitionerDocuments((current) => ({
                        ...current,
                        proofOfAddress: event.target.files?.[0] || null,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="bank-confirmation" className="font-body">
                    Bank Confirmation Letter
                  </Label>
                  <Input
                    id="bank-confirmation"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    required
                    className="mt-1.5"
                    onChange={(event) =>
                      setPractitionerDocuments((current) => ({
                        ...current,
                        bankConfirmation: event.target.files?.[0] || null,
                      }))
                    }
                  />
                </div>
              </div>
            ) : null}
            <div className="space-y-3 rounded-2xl border border-border bg-muted/40 p-4">
              <label className="flex items-start gap-3 text-sm text-foreground font-body">
                <Checkbox
                  checked={acceptedTerms}
                  onCheckedChange={(checked) =>
                    setAcceptedTerms(checked === true)
                  }
                />
                <span>
                  I agree to the{" "}
                  <Link
                    to="/terms-and-conditions"
                    className="text-primary font-semibold hover:underline"
                  >
                    Terms &amp; Conditions
                  </Link>
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm text-foreground font-body">
                <Checkbox
                  checked={acceptedPrivacy}
                  onCheckedChange={(checked) =>
                    setAcceptedPrivacy(checked === true)
                  }
                />
                <span>
                  I agree to the{" "}
                  <Link
                    to="/privacy-policy"
                    className="text-primary font-semibold hover:underline"
                  >
                    Privacy Policy
                  </Link>
                </span>
              </label>
            </div>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="min-h-12 w-full rounded-xl px-4 py-3 text-sm font-semibold sm:text-base"
            >
              {loading ? (
                <span className="flex w-full items-center justify-center gap-2 leading-snug">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  <span className="max-w-[16rem] truncate">
                    {loadingMessage}
                  </span>
                </span>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
