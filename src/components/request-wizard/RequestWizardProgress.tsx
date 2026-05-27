import { Check, Shield } from "lucide-react";
import {
  REQUEST_WIZARD_STEPS,
  type WizardStep,
} from "@/lib/requestWizard";

export function RequestWizardProgress({
  currentStep,
}: {
  currentStep: WizardStep;
}) {
  return (
    <div className="rounded-[2rem] border border-[#E7E7E7] bg-white p-3 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="w-full">
          <div className="flex items-start gap-1.5 sm:gap-2.5">
            {REQUEST_WIZARD_STEPS.map((item, index) => {
              const isCompleted = item.step < currentStep;
              const isActive = item.step === currentStep;

              return (
                <div
                  key={item.step}
                  className="flex min-w-0 flex-1 items-start gap-1.5 sm:gap-2.5"
                >
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold sm:h-10 sm:w-10 sm:text-sm ${
                        isCompleted
                          ? "border-[#1A4731] bg-[#1A4731] text-white"
                          : isActive
                            ? "border-[#C49A22] bg-[#C49A22] text-white"
                            : "border-slate-300 bg-white text-slate-400"
                      }`}
                    >
                      {isCompleted ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : item.step}
                    </div>
                    <p className="mt-1.5 text-[10px] font-semibold text-[#102B46] sm:mt-2.5 sm:text-sm">
                      {item.title}
                    </p>
                    <p className="hidden text-[10px] uppercase tracking-[0.16em] text-slate-400 sm:block sm:text-xs">
                      {item.shortLabel}
                    </p>
                  </div>
                  {index < REQUEST_WIZARD_STEPS.length - 1 ? (
                    <div
                      className={`mt-3.5 h-[2px] flex-1 sm:mt-5 ${
                        item.step < currentStep ? "bg-[#1A4731]" : "bg-slate-200"
                      }`}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-[#DCE8E1] bg-[#F6FBF8] px-3 py-2 text-[10px] font-semibold text-[#1A4731] sm:px-4 sm:text-xs">
          <Shield className="h-4 w-4" />
          Secure &amp; Confidential — Your information is safe and protected
        </div>
      </div>
    </div>
  );
}
