import { Code2, Database, KeyRound, Palette, ShieldCheck, TicketCheck } from "lucide-react";
import type { AccessType } from "../types";

export function AccessIcon({ icon, size = 22 }: { icon: AccessType["icon"]; size?: number }) {
  const icons = {
    shield: ShieldCheck,
    code: Code2,
    palette: Palette,
    ticket: TicketCheck,
    database: Database,
    key: KeyRound,
  };
  const Icon = icons[icon];
  return <Icon size={size} />;
}

