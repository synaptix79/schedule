# House OS - Fabian & Mauri

Aplicación web mobile-first para organizar la rutina diaria de Fabian y Mauri de lunes a sábado, con domingo como descanso/no operativo.

## Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- LocalStorage

## Uso

```bash
npm install
npm run dev
```

Luego abrir `http://localhost:3000`.

## Persistencia

La app guarda tareas, notas, usuarios, tema y configuración en LocalStorage bajo la clave `house-os-v1`. La capa está aislada en `src/lib/storage.ts` para migrar luego a Supabase o Firebase.
