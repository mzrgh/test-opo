"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const SECCIONES = [
  { href: "/", label: "Dashboard", match: (p: string) => p === "/" },
  {
    href: "/generar",
    label: "Generar test",
    match: (p: string) => p.startsWith("/generar"),
  },
  {
    href: "/temarios",
    label: "Realizar / Consultar",
    match: (p: string) =>
      p.startsWith("/temarios") ||
      p.startsWith("/tests") ||
      p.startsWith("/attempts"),
  },
];

export default function TopNav() {
  const pathname = usePathname() ?? "/";
  return (
    <header className="topbar">
      <Link href="/" className="topbar-brand" aria-label="Inicio">
        <Image
          src="/logo.png"
          alt=""
          width={40}
          height={40}
          className="topbar-logo"
          priority
        />
        <span className="topbar-title">TESTS-OPO-Hector</span>
      </Link>
      <nav className="topbar-nav">
        {SECCIONES.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className={`nav-link ${s.match(pathname) ? "active" : ""}`}
          >
            {s.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
