import type { LucideIcon } from "lucide-react";
import { useUi } from "../store/ui";
import { Button } from "../components/ui";

export function SignInPrompt({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  const open = useUi((s) => s.open);
  return (
    <div className="pt-10 text-center">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-accent-soft text-accent"><Icon size={34} /></div>
      <h1 className="font-display mt-5 text-[28px] font-semibold">{title}</h1>
      <p className="mx-auto mt-2 max-w-[290px] text-[14px] text-muted">{body}</p>
      <Button className="mt-6" onClick={() => open({ type: "auth" })}>Sign in or create an account</Button>
    </div>
  );
}
