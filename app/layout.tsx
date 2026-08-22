import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stock semilla — campaña 2026",
  description: "Una sola fuente de verdad para bolsas por lote y ubicación",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
