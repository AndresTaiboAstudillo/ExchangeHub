import type { CapacitorConfig } from "@capacitor/cli";

// En desarrollo la API suele ser http (p. ej. http://10.0.2.2:8000 desde el emulador). Android bloquea el
// tráfico http y el contenido mixto (la app se sirve desde https://localhost), así que solo se permiten
// con CAP_DEV=true. Un APK de producción debe hablar con una API https y no activa ninguno de los dos.
const dev = process.env.CAP_DEV === "true";

const config: CapacitorConfig = {
  appId: "cl.exchangehub.app",
  appName: "ExchangeHub",
  webDir: "out",
  server: {
    androidScheme: "https", // origen de la app: https://localhost (es el que debe permitir CORS)
    cleartext: dev,
  },
  android: {
    allowMixedContent: dev,
  },
};

export default config;
