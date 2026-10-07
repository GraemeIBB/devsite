# --- build frontend ---
FROM node:22-trixie-slim AS web
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- runtime: flask backend + vite preview for built frontend ---
FROM node:22-trixie-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-venv git ripgrep ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN python3 -m venv /venv && /venv/bin/pip install --no-cache-dir -r requirements.txt
COPY backend/ ./

WORKDIR /app/frontend
COPY --from=web /app/frontend ./

ENV PATH="/venv/bin:$PATH"
EXPOSE 5000 5173

# flask CLI used instead of socketio.run: binds 0.0.0.0, no werkzeug-in-prod refusal
CMD ["bash", "-c", "cd /app/backend && flask --app app run --host 0.0.0.0 --port 5000 & cd /app/frontend && npx vite preview --host 0.0.0.0 --port 5173 & wait -n"]
