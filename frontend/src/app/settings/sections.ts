import {
  Building2,
  Receipt,
  UsersRound,
  SlidersHorizontal,
  CreditCard,
  Globe,
  type LucideIcon,
} from "lucide-react";

export interface SettingsSection {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

export const settingsSections: SettingsSection[] = [
  {
    key: "general",
    label: "General",
    href: "/settings/general",
    icon: Building2,
  },
  {
    key: "invoicing",
    label: "Facturación y recibos",
    href: "/settings/invoicing",
    icon: Receipt,
  },
  {
    key: "team",
    label: "Equipo y acceso",
    href: "/settings/team",
    icon: UsersRound,
  },
  {
    key: "advanced",
    label: "Avanzado",
    href: "/settings/advanced",
    icon: SlidersHorizontal,
  },
  {
    key: "billing",
    label: "Facturación",
    href: "/settings/billing",
    icon: CreditCard,
  },
  {
    key: "locale",
    label: "Localización",
    href: "/settings/locale",
    icon: Globe,
  },
];
