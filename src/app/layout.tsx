import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HazardNode | Mission Control",
  description: "Real-time hazard detection and sensor network monitoring",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased selection:bg-blue-500/30">
        {children}
      </body>
    </html>
  );
}
