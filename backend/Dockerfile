FROM python:3.12-slim

# Install FFmpeg, fonts, dan utility sistem yang dibutuhkan pipeline
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    fonts-liberation \
    fonts-dejavu-core \
    fontconfig \
    curl \
    && fc-cache -f \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Salin source code backend
COPY . .

# Pastikan folder penyimpanan persisten tersedia
RUN mkdir -p storage/uploads storage/outputs

EXPOSE 8000

ENV PYTHONUNBUFFERED=1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
