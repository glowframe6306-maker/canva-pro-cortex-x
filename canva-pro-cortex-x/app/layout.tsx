import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { InitializeApp } from "@/components/initialize-app";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CANVA PRO | MI CORTEX X INC.",
  description: "MI CORTEX X INC. — Premium digital access plans with simple and secure ordering.",
  metadataBase: new URL("https://canva-pro-cortex-x.vercel.app"),
  verification: {
    google: "elcWCfjeiJG7W67HAjiX2Zg5AGVFmblOwsPSFTf9jLQ",
  },
  openGraph: {
    title: "MI CORTEX X INC. | Digital Access Plans",
    description: "Premium digital access plans with simple and secure ordering.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-white">
        <InitializeApp />
        {children}
      </body>
    </html>
  );
}
