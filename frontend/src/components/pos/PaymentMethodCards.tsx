"use client";

import { CreditCard, DollarSign, Smartphone, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentMethodCardProps {
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}

export function PaymentMethodCard({
  label,
  icon,
  selected,
  onClick,
}: PaymentMethodCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 hover:scale-[1.02] shadow-xs",
        selected
          ? "border-primary bg-primary-light text-primary shadow-md shadow-primary/10 font-bold"
          : "border-border/80 bg-card hover:border-primary/40 text-foreground"
      )}
    >
      <div className="flex flex-col items-center justify-center gap-2.5">
        <div
          className={cn(
            "p-3.5 rounded-xl flex items-center justify-center transition-colors",
            selected
              ? "bg-primary text-white shadow-xs"
              : "bg-muted text-muted-foreground"
          )}
        >
          {icon}
        </div>
        <h4 className="font-bold text-xs tracking-tight">
          {label}
        </h4>
      </div>
      {selected && (
        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center shadow-xs">
          <Check className="w-3 h-3 stroke-[3]" />
        </div>
      )}
    </div>
  );
}

interface PaymentMethodCardsProps {
  selectedMethod: "CASH" | "CARD" | "TRANSFER";
  onMethodChange: (method: "CASH" | "CARD" | "TRANSFER") => void;
}

export function PaymentMethodCards({ selectedMethod, onMethodChange }: PaymentMethodCardsProps) {
  const methods = [
    {
      type: "CASH" as const,
      label: "Efectivo",
      icon: <DollarSign className="w-6 h-6" />,
    },
    {
      type: "CARD" as const,
      label: "Tarjeta",
      icon: <CreditCard className="w-6 h-6" />,
    },
    {
      type: "TRANSFER" as const,
      label: "Transferencia",
      icon: <Smartphone className="w-6 h-6" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {methods.map((method) => (
        <PaymentMethodCard
          key={method.type}
          label={method.label}
          icon={method.icon}
          selected={selectedMethod === method.type}
          onClick={() => onMethodChange(method.type)}
        />
      ))}
    </div>
  );
}
