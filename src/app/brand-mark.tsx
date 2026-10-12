import Link from "next/link";

type BrandMarkProps = {
  className?: string;
};

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <Link
      aria-label="STILLME 홈"
      className={className ? `brand-mark ${className}` : "brand-mark"}
      href="/"
    >
      <span>STILLME</span>
    </Link>
  );
}
