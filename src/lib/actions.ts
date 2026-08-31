export type FieldErrors = Record<string, string[] | undefined>;
export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message: string }
  | { ok: false; code: string; message: string; fieldErrors?: FieldErrors };

export const idleActionResult: ActionResult = {
  ok: false,
  code: "idle",
  message: "",
};
