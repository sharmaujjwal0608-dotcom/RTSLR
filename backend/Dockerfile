# Not built or run during development of this repository: treat as a starting point.
# The seed reads research/data from the repository root, so build from the root:
#   docker build -f backend/Dockerfile -t rtslr-api .
#   docker run -p 8000:8000 -e ENVIRONMENT=production \
#     -e CORS_ALLOW_ORIGINS=https://your-frontend.example -v rtslr-data:/data rtslr-api
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATABASE_URL=sqlite:////data/rtslr.db \
    RTSLR_RESEARCH_DATA_DIR=/srv/research/data

RUN useradd --system --uid 10001 --home-dir /srv --shell /usr/sbin/nologin rtslr \
    && mkdir -p /data /srv/app \
    && chown rtslr:rtslr /data

WORKDIR /srv/app
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY backend/migrations ./migrations
COPY backend/alembic.ini ./alembic.ini
COPY research/data /srv/research/data

USER rtslr
EXPOSE 8000
VOLUME ["/data"]

# One worker: the rate limiter keeps its counters in process memory (see README).
# --no-access-log: uvicorn's access log would print client addresses.
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-access-log"]
