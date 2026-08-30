import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-2.5", className)}
      aria-label="Hills Coffee"
    >
      <svg viewBox="0 0 42 42" aria-hidden="true" className="size-9 text-gold">
        <path
          d="M5 31 15.7 13.5l5.1 7.6L26.1 11 37 31H5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M10 31h22M18.2 27.2c2.7-4 7.2-5.4 11.5-3.7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span className="leading-none">
        <span className="block font-heading text-[1.28rem] font-semibold tracking-[-.035em]">
          Hills
        </span>
        <span className="mt-0.5 block text-[.62rem] font-bold uppercase tracking-[.22em] text-current">
          Coffee
        </span>
      </span>
    </span>
  );
}
