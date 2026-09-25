# Habit Tracker con Google Antigravity

Aplicación web para registrar hábitos diarios (binarios y cuantificables), con rachas, estadísticas y persistencia en Supabase. Construida de cero a producción con Google Antigravity y sin escribir código a mano.

- 📺 Video: https://youtu.be/ilyVipGq89w
- 📖 Guía paso a paso: https://rafael-paucar-ai.vercel.app/biblioteca/google-antigravity-cero-a-produccion
- 🌐 Demo: https://habit-tracker-antigravity-yem3.vercel.app/

## Tecnologías

Next.js · Tailwind CSS · Supabase

## Cómo Ejecutarlo

Requisitos: Node.js 18 o superior y un proyecto en [Supabase](https://supabase.com/).

```bash
git clone https://github.com/rafael-paucar-ai/habit-tracker-antigravity.git
```

```bash
cd habit-tracker-antigravity
```

```bash
npm install
```

Copia `.env.example` como `.env.local` y rellena la URL y la anon key de tu proyecto de Supabase.

```bash
npm run dev
```

Abre http://localhost:3000.

## Documentación

- `docs/SRS_HabitTracker.md`: documento de requisitos del sistema generado en la fase de planificación.
