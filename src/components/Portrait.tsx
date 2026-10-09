import Image from "next/image";
import type { Philosopher } from "@/lib/philosophers";

/** Round portrait for headers and the chat opening. The images are AI-generated interpretations. */
export function Portrait({
  philosopher,
  size,
  preload = false,
  className = "",
}: {
  philosopher: Philosopher;
  size: number;
  preload?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={philosopher.portrait}
      alt={`AI-generated portrait of ${philosopher.name} (artistic interpretation)`}
      width={size}
      height={size}
      preload={preload}
      className={`shrink-0 rounded-full object-cover ring-1 ring-gold/40 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
