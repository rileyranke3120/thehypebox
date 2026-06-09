import { Barlow_Condensed, DM_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./providers";

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

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head></head>
      <body className={`${barlowCondensed.variable} ${dmSans.variable}`}>
        <Providers>{children}</Providers>
        <div dangerouslySetInnerHTML={{ __html: '<script src="https://widgets.leadconnectorhq.com/loader.js" data-resources-url="https://widgets.leadconnectorhq.com/chat-widget/loader.js" data-widget-id="6a27119dea8f17ad15de44fe" data-source="WEB_USER"></script>' }} />
        {GA_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga-init" strategy="afterInteractive">{`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
            `}</Script>
          </>
        )}
      </body>
    </html>
  );
}