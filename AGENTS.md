# 🤖 AI Agent Guidelines: lifesuck

Welcome, Agent. You are contributing to a premium, high-integrity platform. Follow these rules to ensure consistency and excellence.

## 🎯 Mission Statement
Maintain the **lifesuck** brand as a neutral, premium, and professional data platform. Never use academic, institutional, or "template-y" terminology unless explicitly requested.

---

## 🛠️ Development Rules

### 1. Branding Consistency
- **Name**: Always use `lifesuck` (lowercase, except in sentences where it's `LifeSuck`).
- **Tone**: Professional, premium, and sleek.
- **Forbidden Terms**: University, Student, Teacher, Grade, Sinh Viên, Điểm (in the UI). Use **User**, **Record**, **Metric**, **Performance** instead.

### 2. UI/UX Excellence
- **Design System**: Use the existing Tailwind colors and "premium-glass" classes.
- **Animations**: Always use `framer-motion` for transitions. Avoid plain "pop-in" effects.
- **Icons**: Use `lucide-react`.

### 3. State & API Patterns
- **BFF First**: All frontend requests MUST go through the `/api/bff` layer. Do not call the backend port (8000) directly from the client.
- **Server Actions**: Use Next.js Server Actions for mutations that update database state.

### 4. Security
- **Sensitive Data**: Never log passwords, tokens, or personal identifiers.
- **Shield**: If modifying backend routes, ensure they are protected by the `Shield` middleware if they handle sensitive data.

---

## 🧪 Testing Requirements
Before finishing any task:
1.  **Unit**: Run `pytest` for backend and `npm test` for frontend.
2.  **UI**: Verify changes with a Playwright script if the UI logic has changed.
3.  **Branding Check**: Perform a `grep` for forbidden terms to ensure no branding leaks occurred.

---

## 📊 Knowledge Base
- [System Architecture](docs/ARCHITECTURE.md)
- [API Spec](docs/API_SPEC.md)
