FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-fund && npm cache clean --force
COPY server.js discord-bot.js presence.js index.html local.js local.css ./
COPY assets/ ./assets/
ENV NODE_ENV=production
ENV PORT=8080
USER node
EXPOSE 8080
CMD ["npm", "start"]
