import type { Metadata } from "next";
import { Montserrat } from "next/font/google"; // Switch to Montserrat
import "./globals.css";


const montserrat = Montserrat({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Task Manager",
  description: "A simple and fast task management system.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${montserrat.className} min-h-screen bg-background text-foreground antialiased`} suppressHydrationWarning={true}>
        {children}
      </body>
    </html>
  );
}
