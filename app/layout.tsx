import type { Metadata } from "next";
import "./globals.css";
import Provider from "./providers";

export const metadata: Metadata = {
  title: "OnChain Leaderboard",
  keywords: ["leaderboard", "onchain", "web3", "blockchain"],
  description: "OnChain Leaderboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
1;
