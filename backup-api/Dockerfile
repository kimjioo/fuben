FROM python:3.13-alpine

WORKDIR /app

RUN addgroup -S app && adduser -S -G app app \
    && mkdir -p /data \
    && chown -R app:app /app /data

COPY --chown=app:app app.py ./app.py

ENV PYTHONUNBUFFERED=1 \
    DB_PATH=/data/fuben.sqlite3 \
    PORT=8080

USER app

EXPOSE 8080

CMD ["python", "app.py"]
