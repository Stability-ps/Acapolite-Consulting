import { motion } from "framer-motion";
import {
  Briefcase,
  Building2,
  HeartHandshake,
  Lock,
  MapPin,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ENTITY_OPTIONS,
  SOUTH_AFRICAN_PROVINCES,
  saveWizardStep,
  type WizardEntityType,
} from "@/lib/requestWizard";

const trustItems = [
  { label: "Qualified Practitioners", icon: ShieldCheck },
  { label: "Secure Documents", icon: Lock },
  { label: "Nationwide Support", icon: MapPin },
  { label: "Professional Service", icon: Briefcase },
];

const entityIcons: Record<WizardEntityType, typeof User> = {
  individual: User,
  company: Building2,
  trust: Users,
  npo_organisation: HeartHandshake,
};

export function Hero() {
  const navigate = useNavigate();
  const [selectedEntity, setSelectedEntity] = useState<WizardEntityType | "">("");
  const [selectedLocation, setSelectedLocation] = useState("");

  const entityCards = useMemo(
    () =>
      ENTITY_OPTIONS.map((option) => ({
        ...option,
        icon: entityIcons[option.value],
      })),
    [],
  );

  const handleContinue = () => {
    if (!selectedEntity || !selectedLocation) {
      return;
    }

    saveWizardStep("who", {
      entityType: selectedEntity,
      province: selectedLocation,
      city: "",
    });

    saveWizardStep("contact", {
      fullName: "",
      email: "",
      phoneCountryCode: "+27",
      phoneNumber: "",
      province: selectedLocation,
      city: "",
      contactPreference: "",
      marketingConsent: true,
    });

    navigate("/request-tax-assistance?step=1");
  };

  return (
    <section
      id="top"
      className="relative overflow-hidden bg-[#0f2f22] pb-24 pt-24 text-white md:pb-32 md:pt-28"
    >
      <div className="absolute inset-0">
        <img
          src="/oui.png"
          alt="Professional office workspace"
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,25,18,0.88)_0%,rgba(9,25,18,0.82)_42%,rgba(9,25,18,0.55)_65%,rgba(9,25,18,0.35)_100%)]" />
      </div>

      <div className="relative container mx-auto grid items-center gap-10 px-6 lg:grid-cols-[1.04fr_0.96fr]">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75 }}
          className="max-w-3xl"
        >
          <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-[#F0D37A]">
            ACAPOLITE CONSULTING
          </span>

          <h1 className="mt-6 text-4xl font-black leading-tight tracking-[-0.03em] text-white sm:text-5xl md:text-6xl">
            Professional Tax, SARS &amp; Business Assistance Across South Africa
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/85">
            Access qualified tax practitioners and accounting professionals for
            SARS matters, tax returns, bookkeeping, company compliance and
            business support across South Africa.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            {trustItems.map((item) => (
              <div
                key={item.label}
                className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white/95 backdrop-blur"
              >
                <item.icon className="h-4 w-4 text-[#F0D37A]" />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.08 }}
          className="relative"
        >
          <div className="rounded-[2rem] border border-white/60 bg-white p-6 text-slate-900 shadow-[0_30px_80px_-26px_rgba(15,23,42,0.45)] sm:p-7">
            <span className="text-xs font-bold uppercase tracking-[0.26em] text-[#C49A22]">
              Step 1 of 5
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-[-0.02em] text-[#102B46]">
              What do you need help with?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Tell us a bit about your request so we can match you with the
              right professionals.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {entityCards.map((option) => {
                const isActive = selectedEntity === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelectedEntity(option.value)}
                    className={`flex min-h-[116px] flex-col items-start justify-between rounded-2xl border p-4 text-left transition ${
                      isActive
                        ? "border-[#C49A22] bg-[#FFF8E4] shadow-sm"
                        : "border-slate-200 bg-white hover:border-[#C49A22]/45 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F7E9BC] text-[#A97A00]">
                      <option.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#102B46]">
                        {option.label}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {option.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6">
              <label className="mb-2 block text-sm font-semibold text-[#102B46]">
                Your location
              </label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger className="h-12 rounded-2xl border-slate-200">
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
            </div>

            <Button
              type="button"
              onClick={handleContinue}
              disabled={!selectedEntity || !selectedLocation}
              className="mt-6 h-12 w-full rounded-2xl bg-[#C49A22] text-base font-semibold text-white hover:bg-[#b68e1f]"
            >
              Continue Request →
            </Button>

            <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <Lock className="h-3.5 w-3.5 text-[#1A4731]" />
              Your information is secure and will only be shared with verified
              professionals.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
