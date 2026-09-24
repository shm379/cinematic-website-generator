# Cinemate — production image
# Build:  docker build -t cinemate .
# Run:    docker run -p 3000:3000 cinemate
# Works out of the box with Coolify (Dockerfile build pack) — see README.

FROM node:20-alpine AS base
# Default port; platforms (Coolify, etc.) may override PORT at runtime and
# server.js binds exactly to it on 0.0.0.0.
ENV PORT=3000
WORKDIR /app

# express is a devDependency because the PUBLISHED npm package is the generator
# library + CLI, which need nothing at runtime — a consumer running
# `npx cinemate` should not pull express's tree to render one HTML file. The
# demo server in this image does need it, hence --include=dev.
#
# NODE_ENV is deliberately set AFTER the install: npm treats
# NODE_ENV=production as implying --omit=dev, which would win over the flag
# and leave the image without express.
COPY package.json package-lock.json ./
RUN npm ci --include=dev && npm cache clean --force
ENV NODE_ENV=production

# App source (public/, server.js, generator.js, etc.)
COPY . .

# Run as the unprivileged node user
USER node

EXPOSE 3000

# Container health — server.js exposes /healthz (honours $PORT)
HEALTHCHECK --interval=30s --timeout=4s --start-period=8s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/healthz" || exit 1

CMD ["node", "server.js"]
