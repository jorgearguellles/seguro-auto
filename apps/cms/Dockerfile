FROM node:22-alpine

# Build tools required for better-sqlite3 native bindings
RUN apk add --no-cache python3 make g++ curl

WORKDIR /app

COPY package*.json ./
# node:22-alpine ships npm 10; upgrade to 12 so allowScripts is honoured (better-sqlite3 native build)
RUN npm install -g npm@12
# npm install compiles native addons for the container platform
RUN npm install

COPY . .

RUN mkdir -p public/uploads && chmod +x entrypoint.sh

EXPOSE 1337

HEALTHCHECK --interval=15s --timeout=10s --start-period=90s --retries=10 \
  CMD curl -fs http://localhost:1337/_health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
