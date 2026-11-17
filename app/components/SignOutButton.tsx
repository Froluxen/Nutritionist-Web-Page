import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions/auth";

export default function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-full border border-line bg-sheet px-4 py-2 text-sm font-medium text-muted transition hover:bg-mint/50 hover:text-ink"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        Cerrar sesión
      </button>
    </form>
  );
}
