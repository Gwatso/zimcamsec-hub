/** Inline SVG mark (no image request): an open book under a gold sun. */
export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden focusable="false">
      <rect width="40" height="40" rx="9" fill="#4F7942" />
      <circle cx="20" cy="15" r="6" fill="#D4AF37" />
      <path d="M8 26c4-2 8-2 12 0v7c-4-2-8-2-12 0z" fill="#fff" />
      <path d="M32 26c-4-2-8-2-12 0v7c4-2 8-2 12 0z" fill="#f3f7f1" />
    </svg>
  );
}
