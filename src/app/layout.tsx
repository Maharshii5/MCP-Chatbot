import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./rag-dropdown.css";
import "./settings.css";
import "./refactored-ui.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GCP AI Assistant",
  description: "A production-ready AI chat application with Groq, MCP, and RAG.",
};

import GrainShader from "@/components/Effects/GrainShader";
import { AudioProvider } from "@/components/Effects/WorkstationAudio";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AudioProvider>
          <GrainShader />
          {children}
        </AudioProvider>
      </body>
    </html>
  );
}
