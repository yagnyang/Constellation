import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Constellation Aligner',
  description: 'Align constellations through 3D stellar perspective.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-black text-white antialiased overflow-hidden select-none font-sans">
        {children}
      </body>
    </html>
  );
}

