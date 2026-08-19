import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { BranchProvider } from "@/context/BranchContext";
import { Toaster } from "@/components/ui/sonner";

import { ErrorBoundary } from "@/components/ErrorBoundary";

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
          <AuthProvider>
            <BranchProvider>
              {children}
              <Toaster />
            </BranchProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}

