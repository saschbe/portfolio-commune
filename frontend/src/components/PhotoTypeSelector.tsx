"use client";

import { PHOTO_TYPES, parsePhotoTypes, togglePhotoType } from "@/lib/photoTypes";

type Props = {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
};

export default function PhotoTypeSelector({ value, onChange, compact }: Props) {
  const selected = parsePhotoTypes(value);

  return (
    <div className="flex flex-wrap gap-2">
      {PHOTO_TYPES.map((type) => {
        const active = selected.includes(type);
        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(togglePhotoType(value, type))}
            className={`rounded-full border transition-all duration-200 ${
              compact
                ? "px-2.5 py-1 text-[9px] uppercase tracking-[0.16em]"
                : "px-3 py-1.5 text-[10px] uppercase tracking-[0.18em]"
            } ${
              active
                ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-300"
                : "border-white/10 bg-white/5 text-white/45 hover:border-white/25 hover:text-white/75"
            }`}
          >
            {type}
          </button>
        );
      })}
    </div>
  );
}
