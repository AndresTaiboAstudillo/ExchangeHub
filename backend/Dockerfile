FROM node:22-alpine

# Misma versión mayor de npm que se usa en desarrollo, para que `npm ci`
# acepte el package-lock.json.
RUN npm install -g npm@11

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# prisma generate solo necesita que la variable exista; no se conecta.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate
RUN npm run build

# Usuario sin privilegios
RUN chown -R node:node /app
USER node

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8000/health || exit 1

# Aplica migraciones pendientes y arranca el servidor.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
