FROM node:22-alpine
FROM node:22-alpine

RUN npm install -g npm@11



WORKDIR /app


COPY package*.json ./
RUN npm ci


COPY . .


RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate
RUN npm run build

EXPOSE 8000

CMD ["node", "dist/main.js"]