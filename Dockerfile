# Build Stage - Backend
FROM node:20-alpine AS backend-builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
RUN npm install

COPY src ./src
RUN npm run build

# Build Stage - Frontend
# For production: pass --build-arg VITE_RPC_URL=https://rpc.bery.in when API is on different origin
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
ARG VITE_RPC_URL=
ENV VITE_RPC_URL=${VITE_RPC_URL}
RUN npm run build && test -f dist/index.html || (echo "Frontend build failed - dist/index.html not found" && exit 1)

# Production Stage
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY --from=backend-builder /app/dist ./dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

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
