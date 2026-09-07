import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { BranchProvider } from "@/context/BranchContext";
import QueryProvider from "@/providers/QueryProvider";
import { Toaster } from "@/components/ui/sonner";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LanguageProvider } from "@/context/LanguageContext";

export const metadata: Metadata = {
  title: "Bakery ERP Management",
  description: "Dashboard for bakery operations",
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
              <AuthProvider>
                <BranchProvider>
                  {children}
                  <Toaster />
                </BranchProvider>
              </AuthProvider>
            </LanguageProvider>
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}

