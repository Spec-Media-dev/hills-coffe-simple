import { cn } from "@/lib/utils";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
};

/**
 * Native, progressively enhanced reveals for the homepage. The complete
 * content stays in the server-rendered document; supporting browsers animate
 * it with CSS view timelines and everyone else sees the settled layout.
 */
export function PageReveal({ children, className }: RevealProps) {
  return <div className={cn("home-page-reveal", className)}>{children}</div>;
}

export function SectionReveal({ children, className }: RevealProps) {
  return <div className={cn("home-section-reveal", className)}>{children}</div>;
}

export function ImageReveal({ children, className }: RevealProps) {
  return (
    <div
      className={cn("home-image-reveal relative overflow-hidden", className)}
    >
      {children}
    </div>
  );
}
