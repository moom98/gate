import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gate - Claude Code Permission Gateway",
  description: "Manage Claude Code CLI permission requests",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
