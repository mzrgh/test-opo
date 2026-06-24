import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "tests-opo · Generador de tests de oposiciones",
  description: "Sube un temario en PDF y genera tests para practicar.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            tests-opo
          </Link>
          <span className="tagline">Generador de tests de oposiciones</span>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
