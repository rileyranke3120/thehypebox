import { Barlow_Condensed, DM_Sans } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const barlowCondensed = Barlow_Condensed({
  weight: ['400', '600', '700', '900'],
  subsets: ["latin"],
  variable: "--font-barlow-condensed",
});

const dmSans = DM_Sans({
  weight: ['400', '500', '600', '700'],
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export const metadata = {
  title: "TheHypeBox",
  description: "TheHypeBox delivers AI automation to local businesses — AI receptionist, chatbots, lead follow-up, and website builds. $495 setup, $297/month.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${barlowCondensed.variable} ${dmSans.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
