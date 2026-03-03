import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Set List App",
  description: "Paste a YouTube URL and preview it instantly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
