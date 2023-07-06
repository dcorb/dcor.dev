import "./globals.css";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import Script from "next/script";
const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "David Corbacho Román",
  description: "UX Engineer living in the Nordics",
  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <Script
          id="reveal-items"
          dangerouslySetInnerHTML={{
            __html: `
            const elements = document.querySelectorAll('.shwoop-in');
            let i = 0;
            elements.forEach((element) => {
              element.style.setProperty('--i', i);
              i++;
            });

            const elements2 = document.querySelectorAll('.shwoop-bottom');
            let j = 8;
            elements2.forEach((element) => {
              element.style.setProperty('--j', j);
              j++;
            })
          `,
          }}
        />
      </head>
      <body className={inter.className}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
