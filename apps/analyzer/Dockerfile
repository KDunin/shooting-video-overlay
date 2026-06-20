FROM python:3.12-slim

# ffmpeg/ffprobe are required to decode uploaded videos.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/apps/analyzer

COPY apps/analyzer/pyproject.toml ./
RUN pip install --no-cache-dir numpy scipy soundfile "psycopg[binary]"

COPY apps/analyzer/src ./src

ENV PYTHONUNBUFFERED=1
CMD ["python", "-m", "src.worker"]
