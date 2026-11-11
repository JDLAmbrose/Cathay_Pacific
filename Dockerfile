FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8080
WORKDIR /app
COPY index.html ./
COPY assets ./assets
COPY pages ./pages
COPY tools/serve.py tools/assistant.py ./tools/
USER 65532:65532
EXPOSE 8080
CMD ["python", "tools/serve.py"]
