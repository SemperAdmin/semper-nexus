FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# Use npm ci when package-lock.json exists for reproducible builds.
# Fall back to npm install when the lockfile is absent (PoC repo state).
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev; \
    else \
      echo "[Nexus] No package-lock.json found, using npm install --omit=dev"; \
      npm install --omit=dev; \
    fi

COPY server.js ./

EXPOSE 3000

CMD ["node", "server.js"]
