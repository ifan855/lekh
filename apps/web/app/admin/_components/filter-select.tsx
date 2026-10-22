"use client";

import { usePathname, useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FilterOption = { value: string; label: string };

/**
 * A Radix select that writes its value into the current query string.
 * `current` carries the other active filters so they are preserved.
 */
export function FilterSelect({
  name,
  value,
  options,
  current,
  label,
  className,
}: {
  name: string;
  value: string;
  options: FilterOption[];
  current: Record<string, string>;
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Select
      value={value || "all"}
      onValueChange={(next) => {
        const params = new URLSearchParams(current);
        if (!next || next === "all") params.delete(name);
        else params.set(name, next);
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname);
      }}
    >
      <SelectTrigger className={className} aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
