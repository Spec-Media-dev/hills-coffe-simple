export type AdminActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export const idleAdminActionState: AdminActionState = {
  status: "idle",
  message: "",
};
