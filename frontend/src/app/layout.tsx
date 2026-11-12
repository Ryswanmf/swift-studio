import React, { ReactNode } from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Swift Studio — AI Video to Shorts Generator",
  description:
    "Ubah video panjang jadi Shorts vertikal 9:16 dalam hitungan menit lengkap dengan caption dinamis menggunakan Gemini AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="id" className="dark">
      <body
        className={`${inter.className} min-h-screen bg-zinc-950 text-zinc-100 flex flex-col antialiased selection:bg-orange-500 selection:text-white`}
      >
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
