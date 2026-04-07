import { cn } from "@/lib/utils";

interface AcapoliteLogoProps {
  className?: string;
  alt?: string;
}

export function AcapoliteLogo({
  className,
  alt = "Acapolite Consulting",
}: AcapoliteLogoProps) {
  return (
    <img
      src="/acapolite-logo.png"
      alt={alt}
      className={cn("h-10 w-auto object-contain", className)}
    />
  );
}
