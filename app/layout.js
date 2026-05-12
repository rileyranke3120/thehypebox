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
      <head>
        <script
          id="retell-widget"
          src="https://dashboard.retellai.com/retell-widget.js"
          type="module"
          data-public-key="public_key_94982025fefe2bc3356a8"
          data-agent-id="agent_132e809e21c0ff5eb0f006d59e"
          data-agent-version="0"
          data-title="Chat with Alex"
          data-bot-name="Alex"
          data-color="#F5C400"
          data-button-icon="chat"
          data-popup-message="Hi! Have questions about AI for your business? Ask Alex!"
          data-show-ai-popup="true"
          data-show-ai-popup-time="5"
          async
        />
      </head>
      <body className={`${barlowCondensed.variable} ${dmSans.variable}`}>
        <Providers>{children}</Providers>
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