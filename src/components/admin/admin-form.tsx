"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  fieldErrorsOf,
  idleActionState,
  settled,
  type ActionFormState,
  type ActionResult,
  type FieldErrors,
} from "@/lib/actions";

/**
 * Shared Admin form primitives with inline, per-field, bilingual validation.
 *
 * Three rules drive the design:
 *
 *  1. **The browser never validates.** The form is `noValidate`, so a required
 *     field can no longer produce "Please select an item in the list." — an
 *     unlocalized native popup that cannot be styled or read consistently by a
 *     screen reader. Validation is the application's, in both languages.
 *  2. **An error belongs to its field.** The server returns `fieldErrors`
 *     keyed by field name whose values are message *keys*; each field resolves
 *     its own key in the active locale and renders the text directly beneath
 *     itself. A form-level error is reserved for genuine whole-form failures.
 *  3. **A failure never costs the Admin their typing.** Every control is
 *     controlled from its own state, seeded once from `defaultValue`, so a
 *     rejected submit re-renders with everything the Admin entered intact.
 */

type FormContext = {
  errors: FieldErrors | undefined;
  /** Field names in DOM order, so "focus the first invalid field" is well defined. */
  register: (name: string, node: HTMLElement | null) => void;
};

const AdminFormContext = createContext<FormContext | null>(null);

const useAdminForm = () => useContext(AdminFormContext);

/** Resolves a server-issued message key against the active locale's catalog. */
function useAdminCopy() {
  const t = useTranslations("admin.responses");
  return (key: string) => t(key as Parameters<typeof t>[0]);
}

const control =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20";
const invalidControl =
  "border-destructive focus:border-destructive focus:ring-destructive/20";

function FieldError({ id, keys }: { id: string; keys?: string[] }) {
  const copy = useAdminCopy();
  if (!keys?.length) return null;
  return (
    <span
      id={id}
      className="flex items-start gap-1.5 text-xs font-medium text-destructive"
    >
      {/* A glyph as well as colour, so the error does not rely on colour alone. */}
      <span aria-hidden="true">⚠</span>
      <span>{copy(keys[0])}</span>
    </span>
  );
}

function useField(name: string) {
  const form = useAdminForm();
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const keys = form?.errors?.[name];
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    form?.register(name, ref.current);
    return () => form?.register(name, null);
    // `form` is stable for the life of the form element.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);
  return { id, errorId, hintId, keys, ref, invalid: Boolean(keys?.length) };
}

export function AdminField({
  name,
  label,
  type = "text",
  defaultValue,
  placeholder,
  hint,
  dir,
  min,
  step,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string | number | null;
  placeholder?: string;
  hint?: string;
  dir?: "ltr" | "rtl";
  min?: string;
  step?: string;
}) {
  const { id, errorId, hintId, keys, ref, invalid } = useField(name);
  const [value, setValue] = useState(
    defaultValue === null || defaultValue === undefined
      ? ""
      : String(defaultValue),
  );
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        dir={dir}
        min={min}
        step={step}
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={
          [invalid ? errorId : null, hint ? hintId : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        ref={(node) => {
          ref.current = node;
        }}
        className={`${control} ${invalid ? invalidControl : ""}`}
      />
      {hint ? (
        <span id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </span>
      ) : null}
      <FieldError id={errorId} keys={keys} />
    </div>
  );
}

export function AdminTextarea({
  name,
  label,
  defaultValue,
  hint,
  dir,
  rows,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  hint?: string;
  /** Set explicitly on a translation editor so Arabic typing reads correctly
   *  even inside the English Admin (Phase 8 §14). */
  dir?: "ltr" | "rtl";
  rows?: number;
}) {
  const { id, errorId, hintId, keys, ref, invalid } = useField(name);
  const [value, setValue] = useState(defaultValue ?? "");
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        dir={dir}
        rows={rows}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={
          [invalid ? errorId : null, hint ? hintId : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        ref={(node) => {
          ref.current = node;
        }}
        className={`${control} min-h-24 py-3 ${invalid ? invalidControl : ""}`}
      />
      {hint ? (
        <span id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </span>
      ) : null}
      <FieldError id={errorId} keys={keys} />
    </div>
  );
}

/**
 * File input that participates in the form's error context, so a rejected
 * upload reports underneath the control the Admin used rather than vanishing.
 */
export function AdminFileField({
  name,
  label,
  hint,
  accept,
  multiple,
  onFiles,
}: {
  name: string;
  label: string;
  hint?: string;
  accept?: string;
  multiple?: boolean;
  onFiles?: (files: File[]) => void;
}) {
  const { id, errorId, hintId, keys, ref, invalid } = useField(name);
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(event) => onFiles?.(Array.from(event.target.files ?? []))}
        aria-invalid={invalid || undefined}
        aria-describedby={
          [invalid ? errorId : null, hint ? hintId : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        ref={(node) => {
          ref.current = node;
        }}
        className={`rounded-lg border border-input bg-background p-2 text-sm ${
          invalid ? invalidControl : ""
        }`}
      />
      {hint ? (
        <span id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </span>
      ) : null}
      <FieldError id={errorId} keys={keys} />
    </div>
  );
}

export type AdminSelectOption = { id: string; label: string };

/**
 * A required select never sits on a bare "None". It shows a localized
 * "Select …" placeholder when options exist, and when the dependency table is
 * empty it says so and points at the page that fixes it, rather than
 * presenting an empty list the Admin cannot act on.
 */
export function AdminSelect({
  name,
  label,
  options,
  defaultValue,
  placeholder,
  emptyMessage,
  emptyHref,
  emptyCta,
  optional,
  optionalLabel,
  value: controlledValue,
  onValueChange,
}: {
  name: string;
  label: string;
  options: AdminSelectOption[];
  defaultValue?: string | null;
  placeholder: string;
  emptyMessage?: string;
  emptyHref?: string;
  emptyCta?: string;
  optional?: boolean;
  optionalLabel?: string;
  value?: string;
  onValueChange?: (next: string) => void;
}) {
  const { id, errorId, hintId, keys, ref, invalid } = useField(name);
  const [internal, setInternal] = useState(defaultValue ?? "");
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internal;
  const empty = options.length === 0;

  /*
   * React resets the form element once an action settles. For a text input it
   * then rewrites the value from the vdom, but for a `<select>` whose value did
   * not change it skips the DOM write — so the browser shows the reset option
   * while React still believes the old one is chosen, and the next submit sends
   * an empty value. The Admin sees a rejection with no visible cause
   * (finding N59).
   *
   * Restoring on the form's own `reset` event is what makes this reliable:
   * render-order guesses are not, because the reset happens after the effects
   * of the render that settled the action.
   */
  useEffect(() => {
    const node = ref.current as HTMLSelectElement | null;
    const owner = node?.form;
    if (!node || !owner) return;
    const restore = () => {
      queueMicrotask(() => {
        if (node.value !== value) node.value = value;
      });
    };
    owner.addEventListener("reset", restore);
    return () => owner.removeEventListener("reset", restore);
  }, [value, ref]);

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      <select
        id={id}
        name={name}
        value={value}
        disabled={empty}
        onChange={(event) => {
          if (!isControlled) setInternal(event.target.value);
          onValueChange?.(event.target.value);
        }}
        aria-invalid={invalid || undefined}
        aria-describedby={
          [invalid ? errorId : null, empty ? hintId : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        ref={(node) => {
          ref.current = node;
        }}
        className={`${control} ${invalid ? invalidControl : ""} ${
          empty ? "opacity-60" : ""
        }`}
      >
        <option value="">
          {optional ? (optionalLabel ?? placeholder) : placeholder}
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {empty && emptyMessage ? (
        <span id={hintId} className="text-xs text-muted-foreground">
          {emptyMessage}{" "}
          {emptyHref && emptyCta ? (
            <a
              href={emptyHref}
              className="font-bold underline underline-offset-2"
            >
              {emptyCta}
            </a>
          ) : null}
        </span>
      ) : null}
      <FieldError id={errorId} keys={keys} />
    </div>
  );
}

/** Multi-select for the many-to-many links (tags, certifications, notes). */
export function AdminCheckboxGroup({
  name,
  label,
  options,
  defaultValue = [],
  emptyMessage,
}: {
  name: string;
  label: string;
  options: AdminSelectOption[];
  defaultValue?: string[];
  emptyMessage?: string;
}) {
  const { errorId, keys } = useField(name);
  const [selected, setSelected] = useState<string[]>(defaultValue);
  return (
    <fieldset className="grid gap-1.5">
      <legend className="text-sm font-bold">{label}</legend>
      {options.length === 0 ? (
        <span className="text-xs text-muted-foreground">{emptyMessage}</span>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const checked = selected.includes(option.id);
            return (
              <label
                key={option.id}
                className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm transition ${
                  checked
                    ? "border-gold bg-gold/10 font-bold"
                    : "border-border bg-card"
                }`}
              >
                <input
                  type="checkbox"
                  name={name}
                  value={option.id}
                  checked={checked}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, option.id]
                        : current.filter((entry) => entry !== option.id),
                    )
                  }
                  className="size-4"
                />
                {option.label}
              </label>
            );
          })}
        </div>
      )}
      <FieldError id={errorId} keys={keys} />
    </fieldset>
  );
}

export function AdminForm({
  action,
  children,
  submitLabel,
  pendingLabel,
  className,
}: {
  action: (
    state: ActionFormState,
    formData: FormData,
  ) => Promise<ActionResult<unknown>>;
  children: React.ReactNode;
  submitLabel: string;
  pendingLabel: string;
  className?: string;
}) {
  const copy = useAdminCopy();
  const [state, formAction, pending] = useActionState(
    action as (
      state: ActionFormState,
      formData: FormData,
    ) => Promise<ActionResult>,
    idleActionState,
  );
  const fields = useRef(new Map<string, HTMLElement>());
  const register = (name: string, node: HTMLElement | null) => {
    if (node) fields.current.set(name, node);
    else fields.current.delete(name);
  };
  const errors = fieldErrorsOf(state);
  const result = settled(state);

  // Toast + focus are both reactions to a settled action, not render state.
  const handled = useRef<ActionFormState | null>(null);
  useEffect(() => {
    if (handled.current === state) return;
    handled.current = state;
    const outcome = settled(state);
    if (!outcome?.messageKey) return;
    const message = copy(outcome.messageKey);
    if (outcome.ok) {
      toast.success(message);
      return;
    }
    toast.error(message);
    // Move the Admin to the first field that actually failed, in DOM order.
    const invalidNames = Object.keys(fieldErrorsOf(state) ?? {});
    for (const [name, node] of fields.current) {
      if (invalidNames.includes(name)) {
        node.focus();
        node.scrollIntoView({ block: "center", behavior: "smooth" });
        break;
      }
    }
  }, [state, copy]);

  // A form-level error is only for failures no single field owns.
  const formError =
    result && !result.ok && !Object.keys(errors ?? {}).length
      ? copy(result.messageKey)
      : null;

  return (
    <AdminFormContext.Provider value={{ errors, register }}>
      {/* noValidate: the browser must never raise its own unlocalized popup. */}
      <form
        action={formAction}
        noValidate
        aria-busy={pending}
        className={className}
      >
        {children}
        {formError ? (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive md:col-span-2 xl:col-span-3"
          >
            {formError}
          </p>
        ) : null}
        {result?.ok && result.messageKey ? (
          <p
            role="status"
            className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 md:col-span-2 xl:col-span-3 dark:text-emerald-300"
          >
            {copy(result.messageKey)}
          </p>
        ) : null}
        <div className="md:col-span-2 xl:col-span-3">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground transition hover:bg-forest-light disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {pending ? pendingLabel : submitLabel}
          </button>
        </div>
      </form>
    </AdminFormContext.Provider>
  );
}
