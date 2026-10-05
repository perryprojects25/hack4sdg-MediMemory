import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/language";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "MediMemory",
  description: "A simple medication tracker for older adults, caregivers and doctors.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <LanguageProvider>
          <TopBar />
          {children}
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}
