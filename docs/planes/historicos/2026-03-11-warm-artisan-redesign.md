# Warm Artisan - Frontend Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the frontend from a cold indigo/neon AI aesthetic to a warm, pastel "Warm Artisan" theme inspired by boutique retail POS systems, prioritizing light mode with full dark mode support.

**Architecture:** CSS-variable-driven redesign. The majority of changes cascade automatically via Tailwind v4's `@theme inline` mapping. The 3 structural rewrites are `globals.css` (token foundation), `Sidebar.tsx` (dark→light sidebar), and `login/page.tsx` (complete redesign). All other files require targeted color class replacements.

**Tech Stack:** Next.js 16, React 19, TailwindCSS v4 (CSS-based config), Lucide React icons, Manrope + DM Sans + JetBrains Mono fonts.

---

## Reference: New Design Tokens

### Light Mode (Default)
```
--background:         #FAF8F5    (warm cream)
--foreground:         #2D2A26    (warm charcoal)
--primary:            #C17B5A    (soft terracotta)
--primary-dark:       #A8684A    (deep terracotta)
--accent:             #7BA08B    (sage green)
--accent-light:       #E8F0EC    (pale sage)
--card:               #FFFFFF
--border:             #E8E2DB    (warm light gray)
--muted:              #F2EFEB    (warm off-white)
--muted-foreground:   #8A8380    (warm medium gray)
--sidebar-bg:         #FFFFFF
--sidebar-fg:         #7A7572
--sidebar-active-bg:  #FDF0E8    (peach tint)
--sidebar-active-fg:  #B5694B    (dark terracotta)
```

### Dark Mode
```
--background:         #1A1917
--foreground:         #F0EDEA
--primary:            #D49470    (light terracotta)
--primary-dark:       #C17B5A
--accent:             #8BB59D    (light sage)
--accent-light:       #1E2D24    (dark sage)
--card:               #242220
--border:             #3A3735
--muted:              #2D2B28
--muted-foreground:   #9A9795
--sidebar-bg:         #1E1C1A
--sidebar-fg:         #9A9795
--sidebar-active-bg:  #3D2E25
--sidebar-active-fg:  #D49470
```

### Semantic Colors (Tailwind utility classes, not CSS variables)
```
Success:  sage-based     → emerald stays (already pastel-friendly)
Warning:  amber stays    → amber-50/amber-700 (already warm)
Danger:   red stays      → red-50/red-700 (standard, recognizable)
Info:     sky-600        → primary (terracotta)
```

### Font Change
```
Headings: Syne → Manrope (weights 400-800)
Body:     DM Sans (no change)
Mono:     JetBrains Mono (no change)
```

---

## Task 1: Update Design Tokens (`globals.css`)

**Files:**
- Modify: `frontend/src/app/globals.css` (entire file rewrite)

**Step 1: Replace the entire `globals.css` content**

Replace the full file with:

```css
@import "tailwindcss/theme" layer(base);
@import "tailwindcss/preflight" layer(base);
@import "tailwindcss/utilities" layer(utilities);

/* ─── Color Tokens ─────────────────────────────────────── */
:root {
    --background: #FAF8F5;
    --foreground: #2D2A26;
    --primary: #C17B5A;
    --primary-dark: #A8684A;
    --accent: #7BA08B;
    --accent-light: #E8F0EC;
    --card: #FFFFFF;
    --border: #E8E2DB;
    --muted: #F2EFEB;
    --muted-foreground: #8A8380;

    --sidebar-bg: #FFFFFF;
    --sidebar-fg: #7A7572;
    --sidebar-active-bg: #FDF0E8;
    --sidebar-active-fg: #B5694B;
}

.dark {
    --background: #1A1917;
    --foreground: #F0EDEA;
    --primary: #D49470;
    --primary-dark: #C17B5A;
    --accent: #8BB59D;
    --accent-light: #1E2D24;
    --card: #242220;
    --border: #3A3735;
    --muted: #2D2B28;
    --muted-foreground: #9A9795;

    --sidebar-bg: #1E1C1A;
    --sidebar-fg: #9A9795;
    --sidebar-active-bg: #3D2E25;
    --sidebar-active-fg: #D49470;
}

/* ─── Tailwind Theme ───────────────────────────────────── */
@theme inline {
    --color-background: var(--background);
    --color-foreground: var(--foreground);
    --color-primary: var(--primary);
    --color-primary-dark: var(--primary-dark);
    --color-accent: var(--accent);
    --color-accent-light: var(--accent-light);
    --color-card: var(--card);
    --color-border: var(--border);
    --color-muted: var(--muted);
    --color-muted-foreground: var(--muted-foreground);
    --font-sans: var(--font-dm-sans);
    --font-mono: var(--font-jetbrains-mono);
}

/* ─── Base ─────────────────────────────────────────────── */
* {
    box-sizing: border-box;
}

body {
    background-color: var(--background);
    color: var(--foreground);
    font-family: var(--font-dm-sans), "Segoe UI", system-ui, sans-serif;
    transition:
        background-color 0.3s ease,
        color 0.3s ease;
}

/* ─── Typography ───────────────────────────────────────── */
h1,
h2,
h3,
h4 {
    font-family: var(--font-manrope), var(--font-dm-sans), system-ui, sans-serif;
    letter-spacing: -0.025em;
    line-height: 1.2;
}

.stat-number {
    font-family:
        var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, Monaco,
        Consolas, monospace;
    font-variant-numeric: tabular-nums;
    font-feature-settings: "tnum" 1;
    letter-spacing: -0.02em;
}

/* ─── Animations ───────────────────────────────────────── */
@keyframes fade-in-up {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes fade-in {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

@keyframes slide-in-left {
    from {
        opacity: 0;
        transform: translateX(-12px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

@keyframes spin-slow {
    to {
        transform: rotate(360deg);
    }
}

.animate-fade-in-up {
    opacity: 0;
    animation: fade-in-up 0.4s ease-out forwards;
}

.animate-fade-in {
    opacity: 0;
    animation: fade-in 0.3s ease-out forwards;
}

.animate-slide-in-left {
    opacity: 0;
    animation: slide-in-left 0.3s ease-out forwards;
}

.stagger-children > * {
    opacity: 0;
    animation: fade-in-up 0.45s ease-out forwards;
}

.stagger-children > *:nth-child(1) {
    animation-delay: 0ms;
}
.stagger-children > *:nth-child(2) {
    animation-delay: 80ms;
}
.stagger-children > *:nth-child(3) {
    animation-delay: 160ms;
}
.stagger-children > *:nth-child(4) {
    animation-delay: 240ms;
}
.stagger-children > *:nth-child(5) {
    animation-delay: 320ms;
}
.stagger-children > *:nth-child(6) {
    animation-delay: 400ms;
}

/* ─── Sidebar Styles ───────────────────────────────────── */
.sidebar-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.875rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-fg);
    text-decoration: none;
    transition: all 0.18s ease;
    cursor: pointer;
    border: none;
    background: transparent;
    width: 100%;
    text-align: left;
    font-family: var(--font-dm-sans), system-ui, sans-serif;
}

.sidebar-item:hover {
    color: var(--foreground);
    background: var(--muted);
}

.sidebar-item.active {
    color: var(--sidebar-active-fg);
    background: var(--sidebar-active-bg);
}

.sidebar-item.active::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 55%;
    background: var(--primary);
    border-radius: 0 3px 3px 0;
}

/* ─── Scrollbars ───────────────────────────────────────── */
.scrollbar-hide::-webkit-scrollbar {
    display: none;
}
.scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
}

.scrollbar-app {
    scrollbar-width: thin;
    scrollbar-color: color-mix(in oklab, var(--primary) 40%, transparent)
        transparent;
}

.scrollbar-app::-webkit-scrollbar {
    width: 5px;
    height: 5px;
}
.scrollbar-app::-webkit-scrollbar-track {
    background: transparent;
}
.scrollbar-app::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: color-mix(in oklab, var(--primary) 40%, transparent);
}
.scrollbar-app::-webkit-scrollbar-thumb:hover {
    background: color-mix(in oklab, var(--primary) 65%, transparent);
}
```

**Key changes from current:**
- All color values updated to warm palette
- `--terracotta` / `--terracotta-light` renamed to `--accent` / `--accent-light`
- Body background gradients REMOVED (clean solid color)
- Dark mode dot-grid pattern REMOVED
- `--font-syne` → `--font-manrope` in typography rule
- Sidebar hover: `rgba(255,255,255,0.85)` → `var(--foreground)` + `var(--muted)`
- Sidebar active `box-shadow: 0 0 10px var(--primary)` REMOVED (no glow)
- `.glass` utility REMOVED (not used in new design)

**Step 2: Verify globals.css compiles**

Run: `npm run build` from `frontend/`
Expected: Build succeeds (Tailwind classes using `terracotta` will break until Task 4)

**Step 3: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "feat(design): replace color tokens with Warm Artisan palette"
```

---

## Task 2: Update Fonts (`layout.tsx`)

**Files:**
- Modify: `frontend/src/app/layout.tsx`

**Step 1: Replace Syne import with Manrope**

Replace:
```tsx
import { Syne, DM_Sans, JetBrains_Mono } from "next/font/google";
```
With:
```tsx
import { Manrope, DM_Sans, JetBrains_Mono } from "next/font/google";
```

Replace:
```tsx
const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});
```
With:
```tsx
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});
```

Replace in body className:
```tsx
className={`${syne.variable} ${dmSans.variable} ${jetbrainsMono.variable} antialiased`}
```
With:
```tsx
className={`${manrope.variable} ${dmSans.variable} ${jetbrainsMono.variable} antialiased`}
```

**Step 2: Commit**

```bash
git add frontend/src/app/layout.tsx
git commit -m "feat(design): replace Syne with Manrope for headings"
```

---

## Task 3: Change Default Theme to Light (`ThemeContext.tsx`)

**Files:**
- Modify: `frontend/src/contexts/ThemeContext.tsx`

**Step 1: Change default from "dark" to "light"**

Line 19: Replace `return saved || "dark";` with `return saved || "light";`
Line 21: Replace `return "dark";` with `return "light";`

**Step 2: Commit**

```bash
git add frontend/src/contexts/ThemeContext.tsx
git commit -m "feat(design): set light mode as default theme"
```

---

## Task 4: Global Rename `terracotta` → `accent` (Tailwind Classes)

**Files (13 files affected):**
- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/app/pos/page.tsx`
- `frontend/src/app/reports/page.tsx`
- `frontend/src/app/settings/page.tsx`
- `frontend/src/app/profile/page.tsx`
- `frontend/src/app/customers/page.tsx`
- `frontend/src/app/categories/page.tsx`
- `frontend/src/app/register/page.tsx`
- `frontend/src/app/inventory/page.tsx`
- `frontend/src/components/products/ProductCard.tsx`
- `frontend/src/components/pos/PaymentConfirmationModal.tsx`
- `frontend/src/components/reports/ImportSection.tsx`

**Step 1: Global find-and-replace across all files**

Perform these replacements across the entire `frontend/src/` directory:

| Find | Replace |
|------|---------|
| `bg-terracotta` | `bg-accent` |
| `text-terracotta` | `text-accent` |
| `border-terracotta` | `border-accent` |
| `from-terracotta` | `from-accent` |
| `to-terracotta` | `to-accent` |
| `via-terracotta` | `via-accent` |
| `shadow-terracotta` | `shadow-accent` |

**IMPORTANT:** Also replace string literals in dashboard/reports that set `accent: "terracotta"` config objects. These are display logic strings, NOT CSS classes. Find:
```tsx
accent: "terracotta"
```
Replace with:
```tsx
accent: "accent"
```

Then update the conditional rendering that uses this value. Search for patterns like:
```tsx
stat.accent === "terracotta" ? "from-terracotta" : "from-primary"
```
And replace with:
```tsx
stat.accent === "accent" ? "from-accent" : "from-primary"
```

**Step 2: Handle register/page.tsx special case**

In `frontend/src/app/register/page.tsx`, replace:
```tsx
from-primary to-terracotta
```
With:
```tsx
from-primary to-accent
```

**Step 3: Verify no remaining `terracotta` references**

Run: Search for `terracotta` across `frontend/src/`. Expected: 0 results.

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor(design): rename terracotta → accent across all files"
```

---

## Task 5: Restyle Sidebar (`Sidebar.tsx`)

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`

**Step 1: Replace the entire Sidebar component**

The current sidebar is dark-themed with hardcoded white/rgba colors. Replace with a warm light sidebar that uses CSS variables:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  ShoppingBasket,
  Package,
  Users,
  TrendingUp,
  FolderTree,
  Receipt,
  Settings,
  LogOut,
  Moon,
  Sun,
  User as UserIcon,
  Menu,
  X,
  Boxes,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { useState, useCallback } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles?: string[];
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard className="w-4 h-4" />,
    roles: ["ADMIN", "INVENTORY_USER"],
  },
  {
    label: "POS",
    href: "/pos",
    icon: <ShoppingBasket className="w-4 h-4" />,
    roles: ["ADMIN", "CASHIER"],
  },
  {
    label: "Inventario",
    href: "/inventory",
    icon: <Package className="w-4 h-4" />,
    roles: ["ADMIN", "CASHIER", "INVENTORY_USER"],
  },
  {
    label: "Ventas",
    href: "/sales",
    icon: <Receipt className="w-4 h-4" />,
    roles: ["ADMIN"],
  },
  {
    label: "Clientes",
    href: "/customers",
    icon: <Users className="w-4 h-4" />,
    roles: ["ADMIN", "CASHIER"],
  },
  {
    label: "Reportes",
    href: "/reports",
    icon: <TrendingUp className="w-4 h-4" />,
    roles: ["ADMIN"],
  },
  {
    label: "Categorias",
    href: "/categories",
    icon: <FolderTree className="w-4 h-4" />,
    roles: ["ADMIN", "INVENTORY_USER"],
  },
  {
    label: "Mi Perfil",
    href: "/profile",
    icon: <UserIcon className="w-4 h-4" />,
  },
  {
    label: "Configuracion",
    href: "/settings",
    icon: <Settings className="w-4 h-4" />,
    roles: ["ADMIN"],
  },
];

const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  CASHIER: "Cajero",
  INVENTORY_USER: "Inventario",
};

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const filteredItems = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  const toggleMobileMenu = useCallback(() => setIsMobileMenuOpen((p) => !p), []);
  const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="px-5 py-5 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Boxes className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground truncate leading-tight"
               style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>
              Inventario
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-tight">
              Sistema de Gestion
            </p>
          </div>
        </div>
      </div>

      {/* User */}
      {user ? (
        <div className="px-5 py-3.5 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-primary"
                    style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>
                {initials}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground/80 truncate leading-tight">
                {user.name}
              </p>
              <p className="text-[10px] text-muted-foreground truncate leading-tight">
                {roleLabels[user.role] ?? user.role}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 scrollbar-hide">
        <ul className="space-y-0.5">
          {filteredItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={closeMobileMenu}
                  className={cn("sidebar-item", isActive && "active")}
                >
                  <span className={cn(
                    "shrink-0 transition-colors duration-200",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-border/50 space-y-0.5">
        <button
          onClick={toggleTheme}
          className="sidebar-item w-full"
        >
          <span className="text-muted-foreground shrink-0">
            {theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </span>
          <span>{theme === "dark" ? "Modo Claro" : "Modo Oscuro"}</span>
        </button>
        <button
          onClick={logout}
          className="sidebar-item w-full !text-red-400/70 hover:!text-red-500 hover:!bg-red-50 dark:hover:!bg-red-500/10"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Cerrar Sesion</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Header */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 h-14 z-50 flex items-center justify-between px-4 bg-card border-b border-border/50"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Boxes className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-foreground"
                style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>
            Inventario
          </span>
        </div>
        <button
          onClick={toggleMobileMenu}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label={isMobileMenuOpen ? "Cerrar menu" : "Abrir menu"}
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Overlay */}
      {isMobileMenuOpen ? (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={closeMobileMenu}
        />
      ) : null}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-screen flex flex-col z-50 w-64",
          "bg-card border-r border-border/50",
          "transition-transform duration-300 ease-in-out",
          "lg:translate-x-0",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
          "lg:mt-0 mt-14"
        )}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {sidebarContent}
        </div>
      </aside>
    </>
  );
}
```

**Key changes:**
- All `text-white` → `text-foreground` or `text-muted-foreground` (theme-aware)
- All `border-white/[0.06]` → `border-border/50`
- `shadow-primary/30` (glow) → removed
- `font-syne` → `font-manrope`
- Mobile header: inline styles → Tailwind classes (`bg-card border-b border-border/50`)
- Aside: inline `backgroundColor` style → `bg-card border-r border-border/50`
- Logout hover: `!bg-red-500/10` → `hover:!bg-red-50 dark:hover:!bg-red-500/10`
- Hamburger button: `text-white/50` → `text-muted-foreground`

**Step 2: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(design): restyle sidebar from dark to warm light theme"
```

---

## Task 6: Update UI Components

**Files:**
- Modify: `frontend/src/components/ui/Button.tsx`
- Modify: `frontend/src/components/ui/Badge.tsx`
- Modify: `frontend/src/components/ui/ConfirmDialog.tsx`

### Button.tsx

Replace the `variants` object (lines 23-36):

```tsx
const variants = {
  primary:
    "bg-primary text-white shadow-md shadow-primary/15 hover:bg-primary-dark hover:shadow-primary/25",
  secondary:
    "bg-card text-foreground border border-border hover:border-primary/40 hover:bg-muted",
  danger:
    "bg-red-600 text-white shadow-md shadow-red-600/15 hover:bg-red-700 hover:shadow-red-600/20",
  ghost:
    "text-muted-foreground hover:text-foreground hover:bg-muted",
  outline:
    "border border-primary/60 text-primary hover:bg-primary hover:text-white hover:border-primary",
  success:
    "bg-emerald-600 text-white shadow-md shadow-emerald-600/15 hover:bg-emerald-700",
};
```

**Changes:** Reduced shadow intensity from `shadow-lg shadow-*/25` to `shadow-md shadow-*/15` (softer, less "neon").

### Badge.tsx

Replace the `variants` object (lines 9-22):

```tsx
const variants = {
  default:
    "bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground",
  success:
    "bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  warning:
    "bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  danger:
    "bg-red-50 text-red-700 border border-red-200/60 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
  primary:
    "bg-primary/10 text-primary border border-primary/20",
  secondary:
    "bg-muted text-muted-foreground border border-border/60",
};
```

**Change:** Default variant from `bg-slate-100 text-slate-700 dark:bg-slate-800/70 dark:text-slate-300` to `bg-muted text-muted-foreground` (uses CSS variables, auto-adapts to theme).

### ConfirmDialog.tsx

Replace backdrop color:
- Line 42: `bg-slate-900/55` → `bg-black/40`

Replace icon circle:
- Line 48: `bg-red-500/10` → `bg-red-50 dark:bg-red-500/10`

**Step: Commit**

```bash
git add frontend/src/components/ui/Button.tsx frontend/src/components/ui/Badge.tsx frontend/src/components/ui/ConfirmDialog.tsx
git commit -m "feat(design): update UI components for Warm Artisan palette"
```

---

## Task 7: Update Toast Context

**Files:**
- Modify: `frontend/src/contexts/ToastContext.tsx`

Replace info color references:
- `text-sky-600` → `text-primary`
- `border-l-sky-500` → `border-l-primary`

The emerald (success) and red (error) colors remain unchanged -- they are standard semantic colors.

**Step: Commit**

```bash
git add frontend/src/contexts/ToastContext.tsx
git commit -m "feat(design): update toast info color to primary"
```

---

## Task 8: Redesign Login Page (`login/page.tsx`)

**Files:**
- Modify: `frontend/src/app/login/page.tsx`

**Step 1: Replace entire file**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Boxes, ChevronRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login, loading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
    } catch {
      setError("Credenciales incorrectas. Verifica tu correo y contrasena.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Card */}
      <div className="relative z-10 w-full max-w-[420px] animate-fade-in-up">
        <div className="rounded-2xl p-8 bg-card border border-border/70 shadow-xl shadow-black/5">
          {/* Logo */}
          <div className="mb-7">
            <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center mb-5 shadow-md shadow-primary/20">
              <Boxes className="w-5 h-5 text-white" />
            </div>
            <h1
              className="text-2xl font-bold text-foreground mb-1"
              style={{ fontFamily: "var(--font-manrope, sans-serif)", letterSpacing: "-0.03em" }}
            >
              Bienvenido de nuevo
            </h1>
            <p className="text-sm text-muted-foreground">
              MeperPOS
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="px-4 py-3 rounded-lg text-sm bg-red-50 border border-red-200/60 text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Correo Electronico
              </label>
              <input
                type="email"
                placeholder="usuario@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-lg px-4 py-2.5 text-sm transition-all duration-200 outline-none bg-muted border border-border text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Contrasena
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-lg px-4 py-2.5 text-sm transition-all duration-200 outline-none bg-muted border border-border text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary-dark transition-all duration-200 mt-2 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30"
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <>
                  <span>Iniciar Sesion</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Register link */}
          <p className="text-center mt-5 text-xs text-muted-foreground">
            No tienes cuenta?{" "}
            <button
              type="button"
              onClick={() => router.push("/register")}
              className="font-semibold text-primary hover:text-primary-dark transition-colors"
            >
              Registrarse
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
```

**Key changes:**
- Removed ALL inline `style={}` attributes (25+ occurrences)
- Removed background blobs, dot grid, glassmorphism
- All colors via Tailwind classes using CSS variables
- Inputs: `bg-muted border-border` instead of rgba dark bg
- Error box: Tailwind classes with dark mode variants
- Button: Tailwind `bg-primary hover:bg-primary-dark shadow-md`
- Register link: `text-primary hover:text-primary-dark`
- Fully responsive to light/dark mode via CSS variables

**Step 2: Commit**

```bash
git add frontend/src/app/login/page.tsx
git commit -m "feat(design): redesign login page with Warm Artisan theme"
```

---

## Task 9: Update Register Page

**Files:**
- Modify: `frontend/src/app/register/page.tsx`

**Step 1: Replace `from-primary to-terracotta`**

Already handled by Task 4 global rename → `from-primary to-accent`

**Step 2: Update amber warning box colors**

Replace:
```tsx
bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200
```
With (keep as-is -- amber is a standard warning color and already warm):
No change needed.

**Step 3: Commit if any changes**

```bash
git add frontend/src/app/register/page.tsx
git commit -m "feat(design): update register page for Warm Artisan theme"
```

---

## Task 10: Update Dashboard Page

**Files:**
- Modify: `frontend/src/app/dashboard/page.tsx`

**Step 1: Update `font-syne` references**

Search and replace all instances of:
```tsx
fontFamily: "var(--font-syne, sans-serif)"
```
With:
```tsx
fontFamily: "var(--font-manrope, sans-serif)"
```

**Step 2: Update low stock alert inline styles**

Replace the low stock alert inline rgba colors:
- `rgba(245,158,11,0.06)` → use Tailwind `bg-amber-50 dark:bg-amber-500/5`
- `rgba(245,158,11,0.22)` → use Tailwind `border-amber-200 dark:border-amber-500/20`
- `rgba(245,158,11,0.12)` → use Tailwind `bg-amber-100 dark:bg-amber-500/10`

Convert from inline styles to Tailwind classes where possible.

**Step 3: Commit**

```bash
git add frontend/src/app/dashboard/page.tsx
git commit -m "feat(design): update dashboard page for Warm Artisan theme"
```

---

## Task 11: Update POS Page

**Files:**
- Modify: `frontend/src/app/pos/page.tsx`

**Step 1: Font references**

Replace all `font-syne` → `font-manrope` (if any).

**Step 2: Emerald colors**

Keep emerald-600/emerald-400 for success indicators (discount, savings) -- these are semantic and already warm-friendly.

**Step 3: Verify accent rename**

After Task 4, all `terracotta` references should already be `accent`. Verify.

**Step 4: Commit**

```bash
git add frontend/src/app/pos/page.tsx
git commit -m "feat(design): update POS page for Warm Artisan theme"
```

---

## Task 12: Update Remaining Pages (Batch)

**Files:**
- Modify: `frontend/src/app/inventory/page.tsx`
- Modify: `frontend/src/app/sales/page.tsx`
- Modify: `frontend/src/app/customers/page.tsx`
- Modify: `frontend/src/app/categories/page.tsx`
- Modify: `frontend/src/app/profile/page.tsx`
- Modify: `frontend/src/app/settings/page.tsx`
- Modify: `frontend/src/app/reports/page.tsx`

**For ALL files, apply these changes:**

### 12a: Font references
Replace ALL occurrences across all files:
```
fontFamily: "var(--font-syne, sans-serif)"
```
→
```
fontFamily: "var(--font-manrope, sans-serif)"
```

**Files with `font-syne`:** `customers/page.tsx`, `settings/page.tsx`, `profile/page.tsx`

### 12b: Hardcoded amber hex in customers/page.tsx

Line 31: Replace:
```tsx
color: "#f59e0b"
```
With:
```tsx
color: "var(--accent)"
```

**Note:** This is for the FREQUENT customer tier color. Using the accent variable (sage green) works semantically. Alternatively, keep amber for customer tiers since they represent business segments:
- VIP: emerald (keep)
- FREQUENT: amber (keep - recognizable)
- OCCASIONAL: slate (keep)
- INACTIVE: red (keep)

**Decision:** Keep `color: "#f59e0b"` for the FREQUENT tier -- amber is a universal "gold/frequent" color and not related to the primary palette.

### 12c: shadow-primary references

In files that use `hover:shadow-primary/5` for card hover effects:
- `dashboard/page.tsx`
- `customers/page.tsx`
- `categories/page.tsx`
- `reports/page.tsx`

These already work correctly via the CSS variable. **No change needed.**

### 12d: Inline rgba styles in inventory/page.tsx

Lines 434-445 are inside a comment block. **No action needed** (dead code).

### 12e: Commit

```bash
git add frontend/src/app/inventory/page.tsx frontend/src/app/sales/page.tsx frontend/src/app/customers/page.tsx frontend/src/app/categories/page.tsx frontend/src/app/profile/page.tsx frontend/src/app/settings/page.tsx frontend/src/app/reports/page.tsx
git commit -m "feat(design): update all remaining pages for Warm Artisan theme"
```

---

## Task 13: Update Feature Components

**Files:**
- Modify: `frontend/src/components/products/ProductCard.tsx`
- Modify: `frontend/src/components/pos/PaymentConfirmationModal.tsx`
- Modify: `frontend/src/components/reports/ImportSection.tsx`

### ProductCard.tsx
- `from-primary/10 to-terracotta/10` already became `from-primary/10 to-accent/10` in Task 4. ✓

### PaymentConfirmationModal.tsx
- Same gradient rename already handled. ✓
- `text-red-600` for delete icon -- keep (semantic danger color).

### ImportSection.tsx
- All `terracotta` → `accent` already handled in Task 4. ✓
- `text-emerald-500`, `text-red-500`, `text-amber-500` for import result icons -- keep (semantic colors).
- `border-amber-300/50 bg-amber-50/70 text-amber-800` for warning box -- keep (standard warning).

**Step: Verify and commit**

```bash
git add frontend/src/components/products/ProductCard.tsx frontend/src/components/pos/PaymentConfirmationModal.tsx frontend/src/components/reports/ImportSection.tsx
git commit -m "feat(design): verify feature components use Warm Artisan tokens"
```

---

## Task 14: Build Verification & Final Review

**Step 1: Run the build**

```bash
cd frontend && npm run build
```

Expected: Build succeeds with 0 errors.

**Step 2: If build fails, fix issues**

Common issues to expect:
- Missing Tailwind class: `accent` not recognized → Check `@theme inline` block has `--color-accent`
- TypeScript errors from removed props → Fix imports

**Step 3: Run lint**

```bash
cd frontend && npm run lint
```

Expected: 0 errors (warnings acceptable).

**Step 4: Visual verification**

Start dev server: `npm run dev`

Check these pages in BOTH light and dark mode:
- [ ] `/login` -- Clean card, terracotta button, no blobs/gradients
- [ ] `/dashboard` -- Warm cream bg, stat cards with accent colors
- [ ] `/pos` -- Cart section with accent dividers
- [ ] `/inventory` -- Product cards, filter badges
- [ ] `/customers` -- Tier badges, filter tabs
- [ ] `/settings` -- Sidebar light theme, icon colors
- [ ] Toggle dark mode -- All elements adapt correctly

**Step 5: Commit any final fixes**

```bash
git add -A
git commit -m "fix(design): resolve build issues from Warm Artisan redesign"
```

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat(design): complete Warm Artisan frontend redesign"
```

---

## Execution Checklist

| # | Task | Files | Est. Time |
|---|------|-------|-----------|
| 1 | Design tokens (globals.css) | 1 | 5 min |
| 2 | Font swap (layout.tsx) | 1 | 2 min |
| 3 | Default theme (ThemeContext.tsx) | 1 | 1 min |
| 4 | Global rename terracotta→accent | 13 | 10 min |
| 5 | Sidebar restyle | 1 | 5 min |
| 6 | UI Components (Button, Badge, ConfirmDialog) | 3 | 5 min |
| 7 | Toast context | 1 | 2 min |
| 8 | Login redesign | 1 | 5 min |
| 9 | Register page | 1 | 2 min |
| 10 | Dashboard page | 1 | 5 min |
| 11 | POS page | 1 | 3 min |
| 12 | Remaining pages batch | 7 | 10 min |
| 13 | Feature components | 3 | 3 min |
| 14 | Build verification | - | 5 min |
| **Total** | | **~28 files** | **~63 min** |
