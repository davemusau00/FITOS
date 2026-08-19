FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci
COPY tsconfig.base.json ./
COPY apps/web apps/web
COPY packages/contracts packages/contracts
COPY packages/ui packages/ui
RUN npm run build --workspace=@fitos/contracts && npm run build --workspace=@fitos/web

FROM nginx:1.29-alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
