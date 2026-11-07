import { useUi } from "../store/ui";

/** Runs `fn` when signed in; otherwise opens the sign-in sheet with a reason. */
export function useRequireAuth() {
  const user = useUi((s) => s.user);
  const open = useUi((s) => s.open);
  return (reason: string, fn: () => void) => {
    if (user) fn();
    else open({ type: "auth", reason });
  };
}
