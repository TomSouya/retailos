FROM node:22-alpine AS build
WORKDIR /app
COPY . .
ARG VITE_AGENT_TRANSPORT=sse
ARG VITE_AGENT_API_URL=/api/agent/stream
ARG VITE_API_BASE_URL=
ENV VITE_AGENT_TRANSPORT=$VITE_AGENT_TRANSPORT
ENV VITE_AGENT_API_URL=$VITE_AGENT_API_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm ci && npm run build

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
