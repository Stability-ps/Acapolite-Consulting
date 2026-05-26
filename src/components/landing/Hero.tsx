import {
  Building2,
  Check,
  Headphones,
  HeartHandshake,
  Lock,
  MapPin,
  Shield,
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
import { cn } from "@/lib/utils";

const trustItems = [
  { title: "Qualified", subtitle: "Practitioners", icon: Shield },
  { title: "Secure", subtitle: "Documents", icon: ShieldCheck },
  { title: "Nationwide", subtitle: "Support", icon: MapPin },
  { title: "Professional", subtitle: "Service", icon: Headphones },
] as const;

const entityIcons: Record<WizardEntityType, typeof User> = {
  individual: User,
  company: Building2,
  trust: Users,
  npo_organisation: HeartHandshake,
};

const entityTileStyles: Record<
  WizardEntityType,
  { iconWrap: string; icon: string; activeBorder: string; activeBg: string }
> = {
  individual: {
    iconWrap: "border-[#E8D9B0] bg-[#FFFBF0]",
    icon: "text-[#C49A22]",
    activeBorder: "border-[#C49A22]",
    activeBg: "bg-[#FFF8E4]",
  },
  company: {
    iconWrap: "border-violet-200 bg-violet-50",
    icon: "text-violet-600",
    activeBorder: "border-violet-400",
    activeBg: "bg-violet-50",
  },
  trust: {
    iconWrap: "border-[#E8D9B0] bg-[#FFFBF0]",
    icon: "text-[#C49A22]",
    activeBorder: "border-[#C49A22]",
    activeBg: "bg-[#FFF8E4]",
  },
  npo_organisation: {
    iconWrap: "border-rose-200 bg-rose-50",
    icon: "text-rose-500",
    activeBorder: "border-rose-400",
    activeBg: "bg-rose-50",
  },
};

function EntityLabel({ value }: { value: WizardEntityType }) {
  if (value === "company") {
    return (
      <p className="text-center text-sm font-semibold leading-tight text-[#102B46]">
        Company /<br />
        Business
      </p>
    );
  }

  if (value === "npo_organisation") {
    return (
      <p className="text-center text-sm font-semibold leading-tight text-[#102B46]">
        NPO /<br />
        Organisation
      </p>
    );
  }

  const label = ENTITY_OPTIONS.find((option) => option.value === value)?.label ?? value;
  return <p className="text-center text-sm font-semibold text-[#102B46]">{label}</p>;
}

export function Hero() {
  const navigate = useNavigate();
  const [selectedEntity, setSelectedEntity] = useState<WizardEntityType | "">("individual");
  const [selectedLocation, setSelectedLocation] = useState("");

  const entityCards = useMemo(
    () =>
      ENTITY_OPTIONS.map((option) => ({
        ...option,
        icon: entityIcons[option.value],
        styles: entityTileStyles[option.value],
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
    <section id="top" className="bg-[#F5F4F0]">
      <div className="container mx-auto px-4 py-10 md:px-6 md:py-14 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-stretch lg:gap-6 xl:gap-8">
          {/* Left — headline & trust */}
          <div className="lg:col-span-4 lg:self-center xl:col-span-4">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#C49A22]">
              ACAPOLITE CONSULTING
            </p>

            <h1 className="mt-4 text-4xl font-black leading-[1.08] tracking-[-0.03em] text-[#102B46] sm:text-[2.65rem] xl:text-[3rem]">
              Professional Tax, SARS &amp; Business Assistance Across South Africa
            </h1>

            <p className="mt-5 text-base leading-7 text-[#5F6C7B]">
              Access qualified tax practitioners and accounting professionals for SARS matters,
              tax returns, bookkeeping, company compliance and business support across South Africa.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-5">
              {trustItems.map((item) => (
                <div key={item.title} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D7D7D7] bg-white">
                    <item.icon className="h-4 w-4 text-[#6E7480]" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight text-[#102B46]">{item.title}</p>
                    <p className="text-xs text-[#6E7480]">{item.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form + photo — equal height on desktop */}
          <div className="grid gap-6 lg:col-span-8 lg:grid-cols-2 lg:items-stretch xl:col-span-8">
            <div className="flex h-full min-h-0 flex-col">
              <div className="mx-auto flex h-full w-full max-w-md flex-col rounded-[1.75rem] border border-[#E7E7E7] bg-white p-6 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.28)] sm:p-7 lg:mx-0 lg:max-w-none">
              <span className="inline-flex rounded-full bg-[#F1F1EF] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#6E7480]">
                Step 1 of 5
              </span>

              <h2 className="mt-4 text-lg font-bold text-[#102B46]">What do you need help with?</h2>
              <p className="mt-2 text-sm leading-6 text-[#6E7480]">
                Tell us a bit about your request so we can match you with the right professionals.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                {entityCards.map((option) => {
                  const isActive = selectedEntity === option.value;
                  const Icon = option.icon;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSelectedEntity(option.value)}
                      className={cn(
                        "relative flex min-h-[100px] flex-col items-center justify-center gap-2.5 rounded-2xl border bg-white px-2 py-3 transition",
                        isActive
                          ? cn(option.styles.activeBorder, option.styles.activeBg, "shadow-sm")
                          : "border-[#E7E7E7] hover:border-[#C49A22]/40",
                      )}
                    >
                      {isActive ? (
                        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#C49A22] text-white">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      ) : null}

                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl border",
                          option.styles.iconWrap,
                        )}
                      >
                        <Icon className={cn("h-5 w-5", option.styles.icon)} strokeWidth={1.75} />
                      </div>

                      <EntityLabel value={option.value} />
                    </button>
                  );
                })}
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-sm font-semibold text-[#102B46]">Your location</label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#6E7480]" />
                  <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                    <SelectTrigger className="h-12 rounded-xl border-[#E7E7E7] bg-white pl-10">
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
              </div>

              <Button
                type="button"
                onClick={handleContinue}
                disabled={!selectedEntity || !selectedLocation}
                className="mt-5 h-12 w-full rounded-xl bg-[#C49A22] text-base font-semibold text-white hover:bg-[#b48a1c]"
              >
                Continue Request →
              </Button>

              <p className="mt-auto flex items-start gap-2 pt-4 text-xs leading-5 text-[#6E7480]">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1A4731]" />
                Your information is secure and will only be shared with verified professionals.
              </p>
              </div>
            </div>

            <div className="flex h-full min-h-[300px] flex-col sm:min-h-[360px] lg:min-h-0">
              <div className="relative h-full min-h-[300px] overflow-hidden rounded-[1.75rem] border border-[#E7E7E7] bg-[#EAE9E4] shadow-[0_20px_50px_-24px_rgba(15,23,42,0.28)] sm:min-h-[360px] lg:min-h-full">
                <img
                  src="/oui.png"
                  alt="Professional tax consultant ready to assist"
                  className="absolute inset-0 h-full w-full object-cover object-[center_22%]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
