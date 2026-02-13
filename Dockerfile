# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
RUN npm install

COPY src ./src
RUN npm run build

# Production Stage
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY --from=builder /app/dist ./dist

# Environment Variables
ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV P2P_PORT=3000
ENV API_PORT=8080

# Expose Ports
EXPOSE 3000 8080

# Volume for data
VOLUME ["/data"]

CMD ["node", "dist/index.js"]
