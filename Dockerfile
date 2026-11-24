# PLO-Canvas app image. Built and started by `docker compose up`; see the README.
# One stage on purpose: the image keeps the dev tools so `npm run seed` works inside it.
FROM node:24-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
# Refuse to start without a real session secret, with a message that says how to fix it.
CMD ["sh", "-c", "[ ${#JWT_SECRET} -ge 16 ] && [ \"$JWT_SECRET\" != change-me-to-a-long-random-string ] || { echo 'JWT_SECRET is missing or still the example value. Set it in .env next to docker-compose.yml (README step 2).'; exit 1; }; exec npm start"]
