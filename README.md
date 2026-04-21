# 🌟 lifesuck: Premium Data Management Platform

[![Next.js](https://img.shields.io/badge/Next.js-15.1-black?logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**lifesuck** is a high-performance, enterprise-grade platform designed for seamless data management and analytics. Built with a focus on **visual excellence**, **real-time interaction**, and **architectural integrity**, it provides a premium experience for both administrators and end-users.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Side (Next.js 16)"]
        UI["Modern UI (Tailwind + Framer)"]
        BFF["BFF API Layer (/api/bff)"]
        WS_C["WebSocket Client (Chat)"]
    end

    subgraph Server ["Backend (FastAPI)"]
        API["REST API Endpoints"]
        SEC["Security & Auth (JWT/Shield)"]
        WS_S["WebSocket Server"]
        CACHE["Redis Middleware (Caching)"]
    end

    subgraph Data ["Data Persistence"]
        DB[(PostgreSQL)]
        REDIS[(Redis Cache / Sessions)]
    end

    subgraph Integration ["External Ecosystem"]
        N8N["n8n Scraping Workflows"]
        TG["Telegram Bot Notifications"]
    end

    UI <--> BFF
    BFF <--> API
    WS_C <--> WS_S
    API <--> SEC
    API <--> CACHE
    CACHE <--> REDIS
    SEC <--> DB
    API <--> DB
    N8N -.->|Scraped Data| DB
    API -.->|Alerts| TG
```

---

## ✨ Core Features

- **🚀 Premium Dashboard**: State-of-the-art data visualization with interactive charts and real-time status tracking.
- **🛡️ Enterprise Security**: Multi-layered protection using a custom "Shield" middleware and JWT-based authentication.
- **💬 Real-time Stream**: Low-latency public chat with automated moderation and administrative controls.
- **🏢 Administrative Suite**: Comprehensive user management, IP tracking, and access logging for full oversight.
- **🎨 Glassmorphism UI**: A stunning, responsive design with dynamic themes and smooth micro-animations.

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+ & npm
- Python 3.10+
- PostgreSQL & Redis (active)

### 2. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # atau venv\Scripts\activate trên Windows
pip install -r requirements.txt
python main.py
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 📚 Documentation
- [Architecture Deep Dive](docs/ARCHITECTURE.md)
- [API Specification](docs/API_SPEC.md)
- [AI Agent Guidelines](AGENTS.md)

## ⚖️ License
Distributed under the MIT License. See `LICENSE` for more information.

---
<p align="center">Made with ❤️ for the <b>lifesuck</b> community.</p>
