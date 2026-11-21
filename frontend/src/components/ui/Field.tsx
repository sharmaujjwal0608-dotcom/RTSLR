import { ChevronDown } from "lucide-react";
import { useId } from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ Field */

export type FieldProps = {
  /** Visible label. Every control has one. */
  label: ReactNode;
  /** id of the control this label is for. */
  htmlFor: string;
  /** Helper text under the control. Its id is `${htmlFor}-hint`. */
  hint?: ReactNode;
  /** Error text; replaces the hint. Its id is `${htmlFor}-error`. Say what is wrong and how to fix it. */
  error?: ReactNode;
  /** Shown beside the label, e.g. "Optional" or a live value. */
  labelAside?: ReactNode;
  className?: string;
  children: ReactNode;
};

/**
 * Label + control + hint/error. `Input`, `Select` and `Slider` already wrap
 * themselves in a Field; use this directly only for a custom control.
 */
export function Field({ label, htmlFor, hint, error, labelAside, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={htmlFor} className="text-small font-semibold text-ink">
          {label}
        </label>
        {labelAside ? <span className="text-caption text-muted">{labelAside}</span> : null}
      </div>
      {children}
      {hint && !error ? (
        <p id={`${htmlFor}-hint`} className="text-caption text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-caption font-semibold text-danger-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint: ReactNode, error: ReactNode, extra?: string) {
  const ids = [extra, error ? `${id}-error` : hint ? `${id}-hint` : undefined].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

const controlBase =
  "h-12 w-full rounded-field border border-line-strong bg-surface px-4 text-body text-ink " +
  "transition-[border-color,box-shadow] duration-200 ease-calm placeholder:text-muted " +
  "hover:border-ink focus-visible:border-ink disabled:cursor-not-allowed disabled:bg-background-secondary disabled:opacity-60 " +
  "aria-invalid:border-danger-ink";

type FieldOwnProps = Pick<FieldProps, "label" | "hint" | "error" | "labelAside">;

/* ------------------------------------------------------------------ Input */

export type InputProps = Omit<ComponentPropsWithoutRef<"input">, "className"> &
  FieldOwnProps & { className?: string; inputClassName?: string };

export function Input({ label, hint, error, labelAside, id, className, inputClassName, ...rest }: InputProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <Field label={label} htmlFor={fieldId} hint={hint} error={error} labelAside={labelAside} className={className}>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error, rest["aria-describedby"])}
        className={cn(controlBase, inputClassName)}
        {...rest}
      />
    </Field>
  );
}

/* ----------------------------------------------------------------- Select */

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectProps = Omit<ComponentPropsWithoutRef<"select">, "className" | "children"> &
  FieldOwnProps & {
    /** Options to render. Alternatively pass `<option>` children. */
    options?: SelectOption[];
    children?: ReactNode;
    className?: string;
  };

/** Native `<select>`: the platform picker is the most accessible one on mobile. */
export function Select({ label, hint, error, labelAside, id, options, children, className, ...rest }: SelectProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <Field label={label} htmlFor={fieldId} hint={hint} error={error} labelAside={labelAside} className={className}>
      <div className="relative">
        <select
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(fieldId, hint, error, rest["aria-describedby"])}
          className={cn(controlBase, "appearance-none pr-11")}
          {...rest}
        >
          {options
            ? options.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))
            : children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted"
        />
      </div>
    </Field>
  );
}

/* ----------------------------------------------------------------- Switch */

export type SwitchProps = Omit<ComponentPropsWithoutRef<"input">, "type" | "role" | "className"> & {
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
};

/**
 * On/off setting that applies immediately. A native checkbox with
 * role="switch", so it works in forms and without scripts. Controlled
 * (`checked` + `onChange`) or uncontrolled (`defaultChecked`).
 */
export function Switch({ label, hint, id, className, ...rest }: SwitchProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={cn("flex min-h-11 items-start justify-between gap-6", className)}>
      <div className="flex flex-col gap-1 pt-0.5">
        <label htmlFor={fieldId} className="text-small font-semibold text-ink">
          {label}
        </label>
        {hint ? (
          <p id={`${fieldId}-hint`} className="text-caption text-muted">
            {hint}
          </p>
        ) : null}
      </div>
      <span className="relative inline-flex h-7 w-12 shrink-0">
        <input
          id={fieldId}
          type="checkbox"
          role="switch"
          aria-describedby={hint ? `${fieldId}-hint` : undefined}
          className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-control border border-line-strong bg-surface transition-colors duration-200 ease-calm checked:border-ink checked:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
          {...rest}
        />
        {/* Thumb: position (not colour) carries the state. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1 left-1 size-5 rounded-full bg-ink transition-transform duration-200 ease-calm peer-checked:translate-x-5 peer-checked:bg-on-ink"
        />
      </span>
    </div>
  );
}
