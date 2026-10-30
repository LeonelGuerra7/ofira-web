# Ofira · imagen para publicar en la nube (Railway, Render, Fly.io o cualquier servidor con Docker)
FROM node:22-alpine
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0 DATA_DIR=/data TRUST_PROXY=1
WORKDIR /app
COPY package.json ./
COPY public ./public
COPY server ./server
COPY tools/reiniciar-datos.js ./tools/reiniciar-datos.js
RUN mkdir -p /data && chown -R node:node /data
USER node
EXPOSE 3000
CMD ["node", "--disable-warning=ExperimentalWarning", "server/server.js"]
