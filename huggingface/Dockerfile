FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci && npm cache clean --force

COPY . .

ENV NODE_OPTIONS="--max-old-space-size=512"
RUN npm run build

ENV NODE_ENV=production
ENV PORT=7860
ENV SITE_URL=https://piratexplay.cc
ENV CACHE_TTL=300
ENV RATE_LIMIT_MAX=120
ENV RATE_LIMIT_WINDOW=60000

EXPOSE 7860

CMD ["node", "node_modules/.bin/next", "start"]
