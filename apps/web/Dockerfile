FROM node:22-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY package*.json ./
# node:22-alpine ships npm 10; upgrade to 12 so allowScripts is honoured
RUN npm install -g npm@12
RUN npm install

COPY . .

EXPOSE 4201

HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=12 \
  CMD curl -fs http://localhost:4201/ || exit 1

# No --proxy-config: nginx handles /api → cms routing (ADR-003)
CMD ["npx", "ng", "serve", "--host", "0.0.0.0", "--port", "4201"]
