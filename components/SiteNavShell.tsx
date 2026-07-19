"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Menu, X } from "lucide-react"

import { cn } from "@/lib/utils"

type NavigationItem = {
  href: string
  label: string
}

type SiteNavShellProps = {
  children: React.ReactNode
  navigationItems: NavigationItem[]
  todayHref: string
}

function isActivePath(pathname: string, href: string, todayHref: string) {
  if (href === "/") {
    return pathname === "/"
  }

  if (href === todayHref) {
    return pathname === todayHref || pathname.startsWith("/daily/")
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

function navLinkClassName(active: boolean) {
  return cn(
    "rounded-full border-2 px-4 py-2 text-sm font-bold transition-[transform,background-color] duration-150",
    active
      ? "border-[#241c15] bg-[#ffe01b] text-[#241c15] shadow-[0_3px_0_rgba(36,28,21,0.22)]"
      : "border-transparent bg-transparent text-foreground hover:-translate-y-0.5 hover:border-[#241c15] hover:bg-[#fbefe3] dark:hover:border-[#fffaf1]"
  )
}

export function SiteNavShell({
  children,
  navigationItems,
  todayHref,
}: SiteNavShellProps) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  const allItems = [
    ...navigationItems.slice(0, 1),
    { href: todayHref, label: "Today's Challenge" },
    ...navigationItems.slice(1),
  ]

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-50 border-b-2 border-[#241c15] bg-[#fffdf8]/95 backdrop-blur-xl dark:border-[#fffaf1] dark:bg-[#241c15]/95">
        <div className="mx-auto w-full max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <Link className="flex min-w-0 items-center gap-3" href="/">
              <Image alt="Name 100 logo" className="h-11 w-11 rounded-lg" height={44} src="/logo.png" width={44} />
              <div className="min-w-0">
                <p className="text-base font-black text-foreground">
                  Name 100
                </p>
                <p className="truncate text-xs font-medium text-muted-foreground">
                  One name at a time.
                </p>
              </div>
            </Link>

            <div className="hidden items-center gap-3 md:flex">
              <nav className="flex flex-wrap gap-2">
                {allItems.map((item) => (
                  <Link
                    className={navLinkClassName(isActivePath(pathname, item.href, todayHref))}
                    href={item.href}
                    key={item.href}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <Link
                className="rounded-full border-2 border-[#241c15] bg-[#241c15] px-5 py-2.5 text-sm font-bold text-white shadow-[0_3px_0_rgba(36,28,21,0.24)] transition hover:-translate-y-0.5 dark:border-[#ffe01b] dark:bg-[#ffe01b] dark:text-[#241c15]"
                href={todayHref}
                onClick={() => setMenuOpen(false)}
              >
                Play today
              </Link>
            </div>

            <button
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#241c15] bg-[#ffe01b] text-[#241c15] transition hover:-translate-y-0.5 md:hidden dark:border-[#fffaf1]"
              onClick={() => setMenuOpen((current) => !current)}
              type="button"
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>

          {menuOpen ? (
            <div className="mt-4 rounded-lg border-2 border-[#241c15] bg-[#fbefe3] p-4 shadow-[4px_4px_0_#241c15] md:hidden dark:border-[#fffaf1] dark:bg-[#30261e] dark:shadow-[4px_4px_0_#fffaf1]">
              <nav className="flex flex-col gap-2">
                {allItems.map((item) => (
                  <Link
                    className={navLinkClassName(isActivePath(pathname, item.href, todayHref))}
                    href={item.href}
                    key={`mobile-${item.href}`}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <Link
                className="mt-3 inline-flex rounded-full border-2 border-[#241c15] bg-[#241c15] px-5 py-2.5 text-sm font-bold text-white transition dark:border-[#ffe01b] dark:bg-[#ffe01b] dark:text-[#241c15]"
                href={todayHref}
                onClick={() => setMenuOpen(false)}
              >
                Play today
              </Link>
            </div>
          ) : null}
        </div>
      </header>

      {children}

      <footer className="border-t-2 border-[#241c15] bg-[#ffe01b] dark:border-[#fffaf1] dark:bg-[#30261e]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold text-[#241c15] dark:text-[#fffaf1]">
            Finished here? There is always another name waiting.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {allItems.map((item) => (
                <Link
                  className={navLinkClassName(isActivePath(pathname, item.href, todayHref))}
                  href={item.href}
                  key={`footer-${item.href}`}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <a
              aria-label="Featured on Findly.tools"
              className="inline-flex w-fit rounded-lg transition hover:opacity-85"
              href="https://findly.tools/100names?utm_source=100names"
              rel="noopener noreferrer"
              target="_blank"
            >
              <Image
                alt="Featured on Findly.tools"
                className="h-[55px] w-[175px]"
                height="55"
                src="https://findly.tools/badges/findly-tools-badge-light.svg"
                unoptimized
                width="175"
              />
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
