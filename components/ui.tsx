// Small shared building blocks for forms: large, high-contrast and accessible.

import { useId } from "react";

export const inputClass =
  "w-full min-h-14 rounded-xl border-2 border-slate-400 bg-white px-4 text-xl text-slate-900 placeholder:text-slate-500 focus:border-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-200 aria-[invalid=true]:border-red-700";

const focusRing = "focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300";

// A labelled form field. The input is passed as a render function so it gets the right ids.
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid": boolean }) => React.ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-xl font-semibold text-slate-900">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-base text-slate-700">
          {hint}
        </p>
      )}
      {children({ id, "aria-describedby": describedBy, "aria-invalid": Boolean(error) })}
      {error && (
        <p id={errorId} className="text-lg font-medium text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}

export function PrimaryButton({
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`min-h-14 rounded-full bg-teal-700 px-8 text-xl font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400 ${focusRing} ${className}`}
    />
  );
}

export function SecondaryButton({
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`min-h-14 rounded-full border-2 border-teal-700 bg-white px-6 text-xl font-semibold text-teal-800 hover:bg-teal-50 disabled:cursor-not-allowed disabled:border-slate-400 disabled:text-slate-500 ${focusRing} ${className}`}
    />
  );
}

// Friendly red message box for problems.
export function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="rounded-xl border-2 border-red-700 bg-red-50 p-4 text-lg text-red-900">
      {children}
    </div>
  );
}

// White rounded panel used for each section.
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border-2 border-slate-200 bg-white p-6 ${className}`}>
      {children}
    </section>
  );
}
