import { Inter, DM_Serif_Display } from 'next/font/google';
import './globals.css';
import { AppProvider } from './providers';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
});

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-dm-serif',
});

export const metadata = {
  title: 'ExchangeHub',
  description:
    'La plataforma para estudiantes internacionales en Chile. Alojamiento, comunidad e información universitaria.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${inter.variable} ${dmSerif.variable} font-sans`}>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
