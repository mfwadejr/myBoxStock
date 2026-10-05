FROM node:22-alpine
ARG BUILD_ID=""
ENV BUILD_ID=$BUILD_ID
# Optional: database client tools so the console can back up external databases; samba-client lets backups be sent to a Windows/NAS (SMB) share
RUN apk add --no-cache postgresql-client mariadb-client samba-client tini
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production DATA_DIR=/data PORT=8080
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.mjs"]
