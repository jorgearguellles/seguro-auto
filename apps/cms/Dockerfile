FROM node:22-alpine

# Build tools required for better-sqlite3 native bindings
RUN apk add --no-cache python3 make g++ curl

WORKDIR /app

COPY package*.json ./
# npm install compiles native addons for the container platform
RUN npm install

COPY . .

EXPOSE 1337

HEALTHCHECK --interval=15s --timeout=10s --start-period=90s --retries=10 \
  CMD curl -fs http://localhost:1337/_health || exit 1

CMD ["npm", "run", "develop"]
