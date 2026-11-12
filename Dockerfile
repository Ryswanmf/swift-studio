FROM python:3.12-slim

# Install FFmpeg, font styling ASS, dan tool sistem
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    fonts-liberation \
    fonts-dejavu-core \
    fontconfig \
    curl \
    && fc-cache -f \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies backend
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Salin backend code
COPY backend/ ./
RUN mkdir -p storage/uploads storage/outputs

EXPOSE 8000

ENV PYTHONUNBUFFERED=1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
