/** Stroked line icons sized by className (default 1rem square). */
function Glyph({
  className = "h-4 w-4",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      className={`shrink-0 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

type IconProps = { className?: string };

export const PencilIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M4 20h4l10.5-10.5a2.83 2.83 0 1 0-4-4L4 16v4z" />
    <path d="M13.5 6.5l4 4" />
  </Glyph>
);

export const TrashIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M4 7h16M10 11v6M14 11v6" />
    <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Glyph>
);

export const EyeOffIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M10.6 6.2A9.4 9.4 0 0 1 12 6c5 0 9 6 9 6a15.6 15.6 0 0 1-2.8 3.3M6.6 6.8A15.4 15.4 0 0 0 3 12s4 6 9 6a9.3 9.3 0 0 0 4.2-1" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="M4 4l16 16" />
  </Glyph>
);

export const PlusIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M12 5v14M5 12h14" />
  </Glyph>
);

export const CheckIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M20 6L9 17l-5-5" />
  </Glyph>
);

export const XIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Glyph>
);

export const SearchIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Glyph>
);

export const UsersIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M18 14.4a6.5 6.5 0 0 1 3.5 5.6" />
  </Glyph>
);

export const InboxIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M3 13h4l1.5 3h7L17 13h4" />
    <path d="M5.5 5h13l2.5 8v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5l2.5-8z" />
  </Glyph>
);

export const TagIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M3 11.5V4h7.5l9.5 9.5-7.5 7.5L3 11.5z" />
    <circle cx="7.5" cy="8" r="1.4" />
  </Glyph>
);

export const MailIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3.5 7l8.5 6 8.5-6" />
  </Glyph>
);

export const ShieldIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6l7-3z" />
    <path d="M9 12l2 2 4-4" />
  </Glyph>
);

export const CopyIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h8" />
  </Glyph>
);

export const AlertIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M12 4l9 16H3l9-16z" />
    <path d="M12 10v4M12 17.2v.2" />
  </Glyph>
);

export const SparkIcon = ({ className }: IconProps) => (
  <Glyph className={className}>
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
  </Glyph>
);

export const Icons = {
  calendar: (
    <svg className="inline h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  clock: (
    <svg className="inline h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  pin: (
    <svg className="inline h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  ),
  link: (
    <svg className="inline h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 5.93" />
      <path d="M14 11a5 5 0 0 0-7.07 0L5.52 12.4a5 5 0 0 0 7.07 7.07L14 18.07" />
    </svg>
  ),
};
