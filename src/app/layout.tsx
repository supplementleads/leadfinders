import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cinematic Studio — AI Production Platform",
  description: "Autonomous multi-agent cinematic content generation platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="film-grain bg-studio-bg text-studio-text min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
