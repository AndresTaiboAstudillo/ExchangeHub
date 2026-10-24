// Tipografías propias (paquetes npm) en vez de next/font/google: el build no depende de internet
// ni de Google Fonts, y la app funciona igual sin conexión (útil para la versión móvil).
import '@fontsource-variable/inter';
import '@fontsource/dm-serif-display';
import './globals.css';
import { AppProvider } from './providers';

export const metadata = {
  title: 'ExchangeHub',
  description:
    'La plataforma para estudiantes internacionales en Chile. Alojamiento, comunidad e información universitaria.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="font-sans">
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
