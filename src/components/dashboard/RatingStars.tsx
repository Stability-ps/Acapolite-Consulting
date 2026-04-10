import { Star } from "lucide-react";

type RatingStarsProps = {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  className?: string;
};

export function RatingStars({ value, onChange, readOnly = false, className = "" }: RatingStarsProps) {
  const filledStars = Math.round(value);

  return (
    <div className={`flex items-center gap-1 ${className}`.trim()}>
      {Array.from({ length: 5 }, (_, index) => {
        const starValue = index + 1;
        const isFilled = starValue <= filledStars;

        if (readOnly || !onChange) {
          return (
            <Star
              key={starValue}
              className={`h-5 w-5 ${isFilled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
            />
          );
        }

        return (
          <button
            key={starValue}
            type="button"
            onClick={() => onChange(starValue)}
            className="rounded-md transition-transform hover:scale-105"
            aria-label={`Rate ${starValue} star${starValue === 1 ? "" : "s"}`}
          >
            <Star className={`h-5 w-5 ${isFilled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} />
          </button>
        );
      })}
    </div>
  );
}
