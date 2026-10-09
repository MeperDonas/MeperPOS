"use client";

import Link from "next/link";
import Image from "next/image";
import { APP_NAME } from "@/lib/constants";

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: { text: string; linkText: string; href: string };
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 md:p-6">
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="rounded-3xl p-8 md:p-10 bg-card border border-border/80 shadow-2xl shadow-black/10 space-y-6">
          {/* Logo & Header */}
          <div className="text-center space-y-2">
            <Image
              src="/brand/meperpos-logo-128.png"
              alt={`${APP_NAME} logo`}
              width={56}
              height={56}
              className="mx-auto mb-4 block h-14 w-14 rounded-2xl ring-1 ring-border/60 shadow-lg shadow-black/10"
            />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>

          {/* Content / Form */}
          <div>{children}</div>

          {/* Footer */}
          {footer && (
            <p className="text-center pt-4 border-t border-border/60 text-xs text-muted-foreground">
              {footer.text}{" "}
              <Link
                href={footer.href}
                className="font-bold text-primary hover:text-primary-dark transition-colors ml-1"
              >
                {footer.linkText}
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
