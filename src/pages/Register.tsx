import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";
import { getAppBaseUrl } from "@/lib/siteUrl";

type AccountType = "client" | "practitioner";

const professionalBodies = ["SAIT", "SAICA", "SARS", "Other"];
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
  });
  const [practitionerForm, setPractitionerForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    idNumber: "",
    taxPractitionerNumber: "",
    registrationNumber: "",
    professionalBody: professionalBodies[0],
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
  const { dashboardPath, loading: authLoading, user } = useAuth();
  const passwordRules = useMemo(
    () => ({
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasNumber: /\d/.test(password),
    }),
    [password],
  );
  const isPasswordValid = passwordRules.minLength && passwordRules.hasUppercase && passwordRules.hasNumber;
  const canSubmit = acceptedTerms && acceptedPrivacy && isPasswordValid && !loading;

  useEffect(() => {
    if (!authLoading && user) {
      window.location.replace(dashboardPath);
    }
  }, [authLoading, dashboardPath, user]);

  const uploadPractitionerDocuments = async (userId: string) => {
    if (
      !practitionerDocuments.idCopy
      || !practitionerDocuments.certificate
      || !practitionerDocuments.proofOfAddress
      || !practitionerDocuments.bankConfirmation
    ) {
      throw new Error("Please upload all required verification documents.");
    }

    const uploads = [
      { file: practitionerDocuments.idCopy, key: "id-copy" },
      { file: practitionerDocuments.certificate, key: "practitioner-certificate" },
      { file: practitionerDocuments.proofOfAddress, key: "proof-of-address" },
      { file: practitionerDocuments.bankConfirmation, key: "bank-confirmation-letter" },
    ];

    const uploadResults = await Promise.all(
      uploads.map(async ({ file, key }) => {
        const filePath = `practitioner-verifications/${userId}/${key}-${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from("documents").upload(filePath, file, { upsert: false });

        if (error) {
          throw new Error(error.message);
        }

        return { key, filePath };
      }),
    );

    const updates: Record<string, string> = {};
    uploadResults.forEach((result) => {
      if (result.key === "id-copy") updates.id_document_path = result.filePath;
      if (result.key === "practitioner-certificate") updates.certificate_document_path = result.filePath;
      if (result.key === "proof-of-address") updates.proof_of_address_path = result.filePath;
      if (result.key === "bank-confirmation-letter") updates.bank_confirmation_document_path = result.filePath;
    });

    const { error } = await supabase
      .from("practitioner_profiles")
      .update({
        ...updates,
        verification_status: "pending",
        verification_submitted_at: new Date().toISOString(),
      })
      .eq("profile_id", userId);

    if (error) {
      throw new Error(error.message);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!acceptedTerms || !acceptedPrivacy) {
      toast.error("You must accept the Terms & Conditions and Privacy Policy.");
      return;
    }

    if (!isPasswordValid) {
      toast.error("Password must be at least 8 characters with 1 uppercase letter and 1 number.");
      return;
    }

    if (accountType === "client") {
      if (!clientForm.firstName.trim() || !clientForm.lastName.trim() || !clientForm.phone.trim() || !clientForm.province.trim()) {
        toast.error("Please complete all required client fields.");
        return;
      }
    }

    if (accountType === "practitioner") {
      if (
        !practitionerForm.firstName.trim()
        || !practitionerForm.lastName.trim()
        || !practitionerForm.phone.trim()
        || !practitionerForm.idNumber.trim()
        || !practitionerForm.taxPractitionerNumber.trim()
        || !practitionerForm.registrationNumber.trim()
        || !practitionerForm.professionalBody.trim()
        || !practitionerForm.yearsExperience.trim()
        || !practitionerForm.city.trim()
        || !practitionerForm.province.trim()
      ) {
        toast.error("Please complete all required practitioner fields.");
        return;
      }

      if (
        !practitionerDocuments.idCopy
        || !practitionerDocuments.certificate
        || !practitionerDocuments.proofOfAddress
        || !practitionerDocuments.bankConfirmation
      ) {
        toast.error("Please upload all required verification documents.");
        return;
      }
    }

    setLoading(true);
    try {
      const signupRole = accountType === "practitioner" ? "consultant" : "client";
      const signupRoleLabel = accountType === "practitioner" ? "practitioner" : "client";
      const fullName = accountType === "practitioner"
        ? `${practitionerForm.firstName.trim()} ${practitionerForm.lastName.trim()}`
        : `${clientForm.firstName.trim()} ${clientForm.lastName.trim()}`;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: signupRole,
            account_type: signupRoleLabel,
            first_name: accountType === "practitioner" ? practitionerForm.firstName.trim() : clientForm.firstName.trim(),
            last_name: accountType === "practitioner" ? practitionerForm.lastName.trim() : clientForm.lastName.trim(),
            phone: accountType === "practitioner" ? practitionerForm.phone.trim() : clientForm.phone.trim(),
            id_number: accountType === "practitioner" ? practitionerForm.idNumber.trim() : null,
            tax_practitioner_number: accountType === "practitioner" ? practitionerForm.taxPractitionerNumber.trim() : null,
            registration_number: accountType === "practitioner" ? practitionerForm.registrationNumber.trim() : null,
            professional_body: accountType === "practitioner" ? practitionerForm.professionalBody.trim() : null,
            years_of_experience: accountType === "practitioner" ? practitionerForm.yearsExperience.trim() : null,
            city: accountType === "practitioner" ? practitionerForm.city.trim() : null,
            province: accountType === "practitioner" ? practitionerForm.province.trim() : clientForm.province.trim(),
          },
          emailRedirectTo: `${getAppBaseUrl()}/login`,
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data.user?.id) {
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
            ? [supabase.functions.invoke("send-portal-email", {
              body: {
                type: "welcome_email",
                ...profilePayload,
              },
            })]
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

      if (accountType === "practitioner") {
        toast.success("Practitioner account created. Pending verification.");
      } else {
        toast.success("Account created successfully.");
      }

      if (data.session?.user?.id && accountType === "practitioner") {
        await uploadPractitionerDocuments(data.session.user.id);
      }

      if (!data.session && accountType === "practitioner") {
        toast.success("Verification email sent. After verifying, sign in to upload your practitioner documents.");
      }

      if (data.session) {
        await supabase.auth.signOut();
      }

      toast.success("Check your email to verify your account before signing in.");
      window.location.replace("/login");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sign up failed. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-gradient flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 font-body text-sm">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <div className="bg-card rounded-2xl shadow-elevated border border-border p-8">
          <AcapoliteLogo className="mb-6 h-14" />

          <h1 className="font-display text-2xl font-bold text-foreground mb-2">
            {accountType === "practitioner" ? "Join as a Verified Tax Practitioner" : "Create Your Client Account"}
          </h1>
          <p className="text-sm text-muted-foreground font-body mb-3">
            Already have an account?{" "}
            <Link to="/login" className="text-primary font-semibold hover:underline">Sign in</Link>
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
              Register as a Practitioner using your email and password to ensure your account is created with the correct access permissions.
            </div>
          ) : null}

          <form onSubmit={handleRegister} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="first-name" className="font-body">First Name</Label>
                <Input
                  id="first-name"
                  value={accountType === "practitioner" ? practitionerForm.firstName : clientForm.firstName}
                  onChange={(event) => accountType === "practitioner"
                    ? setPractitionerForm((current) => ({ ...current, firstName: event.target.value }))
                    : setClientForm((current) => ({ ...current, firstName: event.target.value }))}
                  required
                  className="mt-1.5"
                  placeholder="First name"
                />
              </div>
              <div>
                <Label htmlFor="last-name" className="font-body">Last Name</Label>
                <Input
                  id="last-name"
                  value={accountType === "practitioner" ? practitionerForm.lastName : clientForm.lastName}
                  onChange={(event) => accountType === "practitioner"
                    ? setPractitionerForm((current) => ({ ...current, lastName: event.target.value }))
                    : setClientForm((current) => ({ ...current, lastName: event.target.value }))}
                  required
                  className="mt-1.5"
                  placeholder="Last name"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email" className="font-body">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1.5" placeholder="you@example.com" />
            </div>
            <div>
              <Label htmlFor="phone" className="font-body">Phone Number</Label>
              <Input
                id="phone"
                value={accountType === "practitioner" ? practitionerForm.phone : clientForm.phone}
                onChange={(event) => accountType === "practitioner"
                  ? setPractitionerForm((current) => ({ ...current, phone: event.target.value }))
                  : setClientForm((current) => ({ ...current, phone: event.target.value }))}
                required
                className="mt-1.5"
                placeholder="+27 ..."
              />
            </div>
            {accountType === "client" ? (
              <div>
                <Label htmlFor="client-province" className="font-body">Province</Label>
                <Select
                  value={clientForm.province}
                  onValueChange={(value) => setClientForm((current) => ({ ...current, province: value }))}
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
            ) : null}
            {accountType === "practitioner" ? (
              <>
                <div>
                  <Label htmlFor="id-number" className="font-body">ID Number</Label>
                  <Input
                    id="id-number"
                    value={practitionerForm.idNumber}
                    onChange={(event) => setPractitionerForm((current) => ({ ...current, idNumber: event.target.value }))}
                    required
                    className="mt-1.5"
                    placeholder="ID Number"
                  />
                </div>
                <div>
                  <Label htmlFor="tax-practitioner-number" className="font-body">Tax Practitioner Number</Label>
                  <Input
                    id="tax-practitioner-number"
                    value={practitionerForm.taxPractitionerNumber}
                    onChange={(event) => setPractitionerForm((current) => ({ ...current, taxPractitionerNumber: event.target.value }))}
                    required
                    className="mt-1.5"
                    placeholder="Tax Practitioner Number"
                  />
                </div>
                <div>
                  <Label htmlFor="registration-number" className="font-body">Practitioner Registration Number</Label>
                  <Input
                    id="registration-number"
                    value={practitionerForm.registrationNumber}
                    onChange={(event) => setPractitionerForm((current) => ({ ...current, registrationNumber: event.target.value }))}
                    required
                    className="mt-1.5"
                    placeholder="Registration Number"
                  />
                </div>
                <div>
                  <Label htmlFor="professional-body" className="font-body">Professional Body</Label>
                  <Select
                    value={practitionerForm.professionalBody}
                    onValueChange={(value) => setPractitionerForm((current) => ({ ...current, professionalBody: value }))}
                  >
                    <SelectTrigger id="professional-body" className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {professionalBodies.map((body) => (
                        <SelectItem key={body} value={body}>{body}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="years-experience" className="font-body">Years of Experience</Label>
                  <Input
                    id="years-experience"
                    type="number"
                    min="0"
                    value={practitionerForm.yearsExperience}
                    onChange={(event) => setPractitionerForm((current) => ({ ...current, yearsExperience: event.target.value }))}
                    required
                    className="mt-1.5"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="city" className="font-body">City</Label>
                  <Input
                    id="city"
                    value={practitionerForm.city}
                    onChange={(event) => setPractitionerForm((current) => ({ ...current, city: event.target.value }))}
                    required
                    className="mt-1.5"
                    placeholder="City"
                  />
                </div>
                <div>
                  <Label htmlFor="province" className="font-body">Province</Label>
                  <Select
                    value={practitionerForm.province}
                    onValueChange={(value) => setPractitionerForm((current) => ({ ...current, province: value }))}
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
              <Label htmlFor="password" className="font-body">Password</Label>
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
                <p className={passwordRules.minLength ? "text-emerald-600" : ""}>Minimum 8 characters</p>
                <p className={passwordRules.hasUppercase ? "text-emerald-600" : ""}>At least 1 uppercase letter</p>
                <p className={passwordRules.hasNumber ? "text-emerald-600" : ""}>At least 1 number</p>
              </div>
            </div>
            {accountType === "practitioner" ? (
              <div className="space-y-4 rounded-2xl border border-border bg-muted/40 p-4">
                <p className="text-sm font-semibold text-foreground font-body">Verification Documents</p>
                <div>
                  <Label htmlFor="id-copy" className="font-body">ID Copy</Label>
                  <Input
                    id="id-copy"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    required
                    className="mt-1.5"
                    onChange={(event) => setPractitionerDocuments((current) => ({ ...current, idCopy: event.target.files?.[0] || null }))}
                  />
                </div>
                <div>
                  <Label htmlFor="certificate" className="font-body">Practitioner Certificate</Label>
                  <Input
                    id="certificate"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    required
                    className="mt-1.5"
                    onChange={(event) => setPractitionerDocuments((current) => ({ ...current, certificate: event.target.files?.[0] || null }))}
                  />
                </div>
                <div>
                  <Label htmlFor="proof-of-address" className="font-body">Proof of Address</Label>
                  <Input
                    id="proof-of-address"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    required
                    className="mt-1.5"
                    onChange={(event) => setPractitionerDocuments((current) => ({ ...current, proofOfAddress: event.target.files?.[0] || null }))}
                  />
                </div>
                <div>
                  <Label htmlFor="bank-confirmation" className="font-body">Bank Confirmation Letter</Label>
                  <Input
                    id="bank-confirmation"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    required
                    className="mt-1.5"
                    onChange={(event) => setPractitionerDocuments((current) => ({ ...current, bankConfirmation: event.target.files?.[0] || null }))}
                  />
                </div>
              </div>
            ) : null}
            <div className="space-y-3 rounded-2xl border border-border bg-muted/40 p-4">
              <label className="flex items-start gap-3 text-sm text-foreground font-body">
                <Checkbox checked={acceptedTerms} onCheckedChange={(checked) => setAcceptedTerms(checked === true)} />
                <span>
                  I agree to the{" "}
                  <Link to="/terms-and-conditions" className="text-primary font-semibold hover:underline">
                    Terms &amp; Conditions
                  </Link>
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm text-foreground font-body">
                <Checkbox checked={acceptedPrivacy} onCheckedChange={(checked) => setAcceptedPrivacy(checked === true)} />
                <span>
                  I agree to the{" "}
                  <Link to="/privacy-policy" className="text-primary font-semibold hover:underline">
                    Privacy Policy
                  </Link>
                </span>
              </label>
            </div>
            <Button type="submit" disabled={!canSubmit} className="w-full py-5 text-base font-semibold rounded-xl">
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
