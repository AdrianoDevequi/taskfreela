import type { Metadata } from "next";
import { Montserrat } from "next/font/google"; // Switch to Montserrat
import { Providers } from "./providers";
import "./globals.css";

const montserrat = Montserrat({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TaskFreela",
  description: "A simple and fast task management system.",
  icons: {
    icon: [
      { url: '/favicon.ico?v=2' },
      { url: '/icon.png?v=2', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-192.png?v=2' }
    ]
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${montserrat.className} min-h-screen bg-background text-foreground antialiased`} suppressHydrationWarning={true}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
