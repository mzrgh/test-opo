import type { Metadata } from "next";
import "./globals.css";
import TopNav from "./TopNav";
import Footer from "./Footer";

export const metadata: Metadata = {
  title: "TESTS-OPO-Hector",
  description:
    "Aplicación de Tests para que Héctor González estudie la oposición.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <TopNav />
        <main id="top" className="container">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
