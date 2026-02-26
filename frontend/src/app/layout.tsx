import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import SettingsProvider from "@/components/theme/SettingsProvider";
import ThemeInjector from "@/components/theme/ThemeInjector";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ToastProvider } from "@/components/ui/use-toast";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aurum Finance LMS",
  description: "Advanced Loan Management System for MFIs and SACCOs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${outfit.variable} font-sans antialiased`}
      >
        <ThemeProvider>
          <SettingsProvider>
            <ThemeInjector />
            <ToastProvider>
              {children}
            </ToastProvider>
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
