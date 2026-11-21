"use client";

import { useId, useState } from "react";
import type { ChangeEvent, ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Field } from "./Field";

export type SliderProps = Omit<
  ComponentPropsWithoutRef<"input">,
  "type" | "value" | "defaultValue" | "onChange" | "className" | "min" | "max" | "step"
> & {
  label: ReactNode;
  hint?: ReactNode;
  min?: number;
  max?: number;
  step?: number;
  /** Controlled value. */
  value?: number;
  /** Initial value when uncontrolled. Defaults to `min`. */
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  /** Text appended to the value output, e.g. "%" or " ms". */
  unit?: string;
  /** Custom formatter for the value output (also used for aria-valuetext). */
  formatValue?: (value: number) => string;
  className?: string;
};

/** Native range input with a label and a live `<output>` of the current value. */
export function Slider({
  label,
  hint,
  min = 0,
  max = 100,
  step = 1,
  value,
  defaultValue,
  onValueChange,
  unit = "",
  formatValue,
  id,
  className,
  ...rest
}: SliderProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const [internal, setInternal] = useState(defaultValue ?? min);
  const current = value ?? internal;
  const text = formatValue ? formatValue(current) : `${current}${unit}`;

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value);
    if (value === undefined) setInternal(next);
    onValueChange?.(next);
  };

  return (
    <Field
      label={label}
      htmlFor={fieldId}
      hint={hint}
      className={className}
      labelAside={
        <output htmlFor={fieldId} className="font-mono text-caption font-medium text-ink">
          {text}
        </output>
      }
    >
      <input
        id={fieldId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={onChange}
        aria-valuetext={text}
        aria-describedby={hint ? `${fieldId}-hint` : undefined}
        className={cn("h-11 w-full cursor-pointer accent-ink disabled:cursor-not-allowed disabled:opacity-50")}
        {...rest}
      />
    </Field>
  );
}
