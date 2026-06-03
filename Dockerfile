FROM node:22-alpine AS build

WORKDIR /app

COPY package.json yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile

COPY frontend ./frontend
COPY backend ./backend
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001

COPY package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend ./backend

EXPOSE 3001

CMD ["node", "backend/src/server.js"]
