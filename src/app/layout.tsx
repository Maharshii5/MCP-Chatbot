import type { Metadata } from "next";
import "./globals.css";
import "./rag-dropdown.css";
import "./settings.css";
import "./refactored-ui.css";

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
      <body>
        <AudioProvider>
          <GrainShader />
          {children}
        </AudioProvider>
      </body>
    </html>
  );
}
