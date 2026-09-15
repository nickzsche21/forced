import type { Metadata } from "next";
import "./globals.css";

const title = "FORCED — Minesweeper that never makes you guess";
const description =
  "Every board is proven solvable by logic before you see it. Stuck? It shows you the proof. No ads, no account, no subscription — about 40KB.";

export const metadata: Metadata = {
  title,
  description,
  keywords: ["minesweeper", "no guess", "logic", "puzzle", "free", "no ads"],
  openGraph: { title, description, type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
