import { Shield } from "lucide-react";

export function TrustSidebar() {
  return (
    <aside className="hidden rounded-[2rem] border border-[#E8D9B0] bg-[#FFF8E4] p-6 lg:block">
      <div className="flex items-center gap-3 text-[#1A4731]">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#C49A22] shadow-sm">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#C49A22]">
            Secure &amp; Confidential
          </p>
          <p className="mt-1 text-sm font-medium text-[#1A4731]">
            Your information is protected.
          </p>
        </div>
      </div>
      <div className="mt-5 space-y-3 text-sm leading-6 text-[#355848]">
        <p>We only share your details with verified professionals.</p>
        <p>Your information is never sold or shared.</p>
        <p>You are in control of your information.</p>
      </div>
    </aside>
  );
}
