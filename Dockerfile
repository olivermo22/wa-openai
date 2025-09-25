# Imagen base con Node 22 en Debian slim
FROM node:22-bookworm-slim

# 1) Paquetes del sistema necesarios para Chrome headless
RUN apt-get update && apt-get install -y \
  wget gnupg ca-certificates \
  fonts-liberation xdg-utils \
  libasound2 libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 \
  libcups2 libdbus-1-3 libdrm2 libgbm1 libglib2.0-0 libgtk-3-0 \
  libnspr4 libnss3 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
  libxdamage1 libxext6 libxfixes3 libxkbcommon0 libxrandr2 libxshmfence1 \
  && rm -rf /var/lib/apt/lists/*

# 2) Instala Google Chrome estable (del repo oficial)
RUN wget -qO- https://dl.google.com/linux/linux_signing_key.pub \
  | gpg --dearmor -o /usr/share/keyrings/google-linux.gpg && \
  echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-linux.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
  > /etc/apt/sources.list.d/google-chrome.list && \
  apt-get update && apt-get install -y google-chrome-stable && \
  rm -rf /var/lib/apt/lists/*

# 3) Variables para Puppeteer/whatsapp-web.js
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
ENV CHROME_PATH=/usr/bin/google-chrome
ENV NODE_ENV=production
ENV PORT=3000

# 4) Archivos de la app
WORKDIR /app
COPY package*.json ./
# Si hay package-lock, usa ci; si no, cae a npm install
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .

# 5) Arranque
CMD ["node", "index.js"]
