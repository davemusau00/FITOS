FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci
COPY tsconfig.base.json ./
COPY apps/worker apps/worker
COPY packages/contracts packages/contracts
RUN npm run build --workspace=@fitos/contracts && npm run build --workspace=@fitos/worker

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci --omit=dev
COPY --from=build /app/apps/worker/dist apps/worker/dist
COPY --from=build /app/packages/contracts/dist packages/contracts/dist
USER node
CMD ["node", "apps/worker/dist/main.js"]
