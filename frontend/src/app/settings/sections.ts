import {
  Building2,
  Receipt,
  Globe2,
  CreditCard,
  SlidersHorizontal,
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
    label: "Facturación y Recibos",
    href: "/settings/invoicing",
    icon: Receipt,
  },
  {
    key: "locale",
    label: "Moneda y Región",
    href: "/settings/locale",
    icon: Globe2,
  },
  {
    key: "billing",
    label: "Suscripción",
    href: "/settings/billing",
    icon: CreditCard,
  },
  {
    key: "advanced",
    label: "Avanzado",
    href: "/settings/advanced",
    icon: SlidersHorizontal,
  },
];
