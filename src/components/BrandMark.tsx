export function BrandMark({ className = "h-[34px] w-[34px] shrink-0" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="15" cy="16" r="11" fill="#2851E3" opacity="0.9" />
      <circle cx="25" cy="16" r="11" fill="#E5484D" opacity="0.85" />
      <circle cx="20" cy="25" r="11" fill="#F6B93B" opacity="0.85" />
    </svg>
  );
}
