import { colorHex } from "@/lib/medicine-options";

// A simple drawing of a medicine in its real shape and colour.
// A dark outline keeps white pills visible on a white background.
export default function PillIcon({
  shape,
  color,
  size = 64,
  label,
}: {
  shape: string | null;
  color: string | null;
  size?: number;
  label?: string; // e.g. "White round tablet"; leave empty if the name is shown next to it
}) {
  const fill = colorHex(color);
  const outline = "#1e293b";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="shrink-0"
    >
      {shape === "oval" && (
        <>
          <ellipse cx="50" cy="50" rx="44" ry="28" fill={fill} stroke={outline} strokeWidth="4" />
          <line x1="50" y1="26" x2="50" y2="74" stroke={outline} strokeWidth="3" opacity="0.4" />
        </>
      )}

      {shape === "capsule" && (
        <g transform="rotate(-35 50 50)">
          {/* Left half in the medicine colour, right half white */}
          <path d="M50 30 H30 a20 20 0 0 0 0 40 H50 Z" fill={fill} />
          <path d="M50 30 H70 a20 20 0 0 1 0 40 H50 Z" fill="#ffffff" />
          <rect x="10" y="30" width="80" height="40" rx="20" fill="none" stroke={outline} strokeWidth="4" />
          <line x1="50" y1="30" x2="50" y2="70" stroke={outline} strokeWidth="3" />
        </g>
      )}

      {shape === "liquid" && (
        <>
          {/* A small medicine bottle with coloured liquid */}
          <rect x="38" y="8" width="24" height="14" rx="3" fill="#475569" />
          <path d="M30 26 H70 V86 a8 8 0 0 1 -8 8 H38 a8 8 0 0 1 -8 -8 Z" fill="#ffffff" />
          <path d="M30 50 H70 V86 a8 8 0 0 1 -8 8 H38 a8 8 0 0 1 -8 -8 Z" fill={fill} />
          <path
            d="M30 26 H70 V86 a8 8 0 0 1 -8 8 H38 a8 8 0 0 1 -8 -8 Z"
            fill="none"
            stroke={outline}
            strokeWidth="4"
          />
        </>
      )}

      {/* Round tablet is the default */}
      {(shape === "round" || !["oval", "capsule", "liquid"].includes(shape ?? "")) && (
        <>
          <circle cx="50" cy="50" r="38" fill={fill} stroke={outline} strokeWidth="4" />
          <line x1="50" y1="18" x2="50" y2="82" stroke={outline} strokeWidth="3" opacity="0.4" />
        </>
      )}
    </svg>
  );
}
