"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { settingsSections } from "./sections";
import { cn } from "@/lib/utils";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="animate-fade-in-up">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-1 h-7 rounded-full bg-primary shrink-0" />
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
              Configuración
            </h1>
          </div>
          <p className="text-sm text-muted-foreground ml-4">
            Ajusta la configuración del sistema
          </p>
        </div>

        <div className="flex flex-col lg:flex-row lg:gap-8">
          <nav
            aria-label="Secciones de configuración"
            className="lg:w-60 lg:shrink-0"
          >
            <ul className="flex items-center gap-2 overflow-x-auto scrollbar-hide lg:sticky lg:top-8 lg:flex-col lg:items-stretch lg:gap-1">
              {settingsSections.map((section) => {
                const isActive =
                  pathname === section.href ||
                  pathname.startsWith(`${section.href}/`);
                const Icon = section.icon;

                return (
                  <li key={section.key} className="shrink-0">
                    <Link
                      href={section.href}
                      scroll={false}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "inline-flex items-center gap-2.5 rounded-lg px-3.5 py-2 text-sm font-medium whitespace-nowrap",
                        "transition-all duration-200",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        isActive
                          ? "bg-primary/15 text-primary border border-primary/30"
                          : "text-muted-foreground border border-transparent hover:text-foreground hover:bg-muted"
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{section.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex-1 min-w-0 mt-4 lg:mt-0">{children}</div>
        </div>
      </div>
    </DashboardLayout>
  );
}
