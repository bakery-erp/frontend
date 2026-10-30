import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { BranchProvider } from "@/context/BranchContext";
import QueryProvider from "@/providers/QueryProvider";
import { Toaster } from "@/components/ui/sonner";
import InstallPwaPrompt from "@/components/InstallPwaPrompt";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LanguageProvider } from "@/context/LanguageContext";
import { DateSettingsProvider } from "@/context/DateSettingsContext";
import AppShell from "@/components/AppShell";

export const viewport: Viewport = {
  themeColor: "#E87A18",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Koket Bakery ERP",
  description: "Koket Bakery Operations and Inventory Management System",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Koket ERP",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-zinc-50 text-zinc-900">
        <ErrorBoundary>
          <QueryProvider>
            <LanguageProvider>
              <DateSettingsProvider>
                <AuthProvider>
                  <BranchProvider>
                    <AppShell>
                      {children}
                    </AppShell>
                    <Toaster />
                    <InstallPwaPrompt />
                  </BranchProvider>
                </AuthProvider>
              </DateSettingsProvider>
            </LanguageProvider>
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}

