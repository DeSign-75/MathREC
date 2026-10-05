import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MathREC",
  description: "Dark robotic math puzzle game — 4 choices, 3 lives, chase the score.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;800&family=Rajdhani:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-void text-white antialiased">{children}</body>
    </html>
  );
}
