FROM node:24-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig.json ./
COPY assets ./assets
COPY pages ./pages
COPY src ./src
COPY tools/copy-kanban.mjs ./tools/copy-kanban.mjs
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8080
WORKDIR /app
COPY --from=frontend /app/dist ./dist
COPY tools/serve.py tools/assistant.py ./tools/
USER 65532:65532
EXPOSE 8080
CMD ["python", "tools/serve.py"]
