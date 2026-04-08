# Stage 1: Builder
FROM python:3.9-slim AS builder

WORKDIR /app

# Cài đặt công cụ build cần thiết (nếu có thư viện cần compile)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Runner
FROM python:3.9-slim

# Ưu tiên IPv4
RUN echo "precedence ::ffff:0:0/96 100" >> /etc/gai.conf

WORKDIR /app

# Tạo user để không chạy bằng root
RUN addgroup --system appgroup && adduser --system --group appuser

# Sao chép các gói python đã cài đặt từ builder
COPY --from=builder /install /usr/local

# Sao chép mã nguồn và phân quyền
COPY --chown=appuser:appgroup . .

# Chuyển sang user appuser
USER appuser

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
