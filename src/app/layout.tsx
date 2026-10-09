import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { Providers } from "@/components/providers";

const SITE = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "APP PET",
  description: "Agenda, clientes, planos e caixa para banho e tosa.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "APP PET", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#6a4fe3",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
