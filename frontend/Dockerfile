FROM node:20-alpine

WORKDIR /app

# Build-time API URL for Next.js config/rewrite generation
ARG API_URL=http://backend:8000
ENV API_URL=${API_URL}

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Run the custom server (supports WebSocket proxy via /_s/ path)
CMD ["node", "server.js"]
