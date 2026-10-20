# ==============================================================================
# Multi-Stage Production Dockerfile for ERP Frontend SPA
# ==============================================================================

# Stage 1: Build Vite React Application
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json tsconfig*.json vite.config.ts postcss.config.js tailwind.config.js ./
RUN npm ci

COPY public/ ./public/
COPY index.html ./
COPY src/ ./src/

# Pass production build arguments
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Stage 2: Production Nginx High-Performance Server
FROM nginx:alpine AS runner

# Remove default nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy built static assets from builder
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html

# Provide SPA-friendly Nginx routing configuration
RUN cat <<'EOF' > /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Single Page Application routing (fallback to index.html)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to backend container
    location /api/ {
        proxy_pass http://backend:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";
}
EOF

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
