FROM python:3.9-slim

# Prefer IPv4 over IPv6
RUN echo "precedence ::ffff:0:0/96 100" >> /etc/gai.conf

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
