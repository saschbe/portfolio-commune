# Plombières en Images — Instructions permanentes

## Stack technique

- **Framework** : Next.js 16 App Router (`"use client"` si hooks/interactivité)
- **Styles** : Tailwind CSS v4 uniquement (pas de CSS inline sauf cas Leaflet)
- **Langage** : TypeScript strict — pas de `any`, types explicites
- **Base de données** : Supabase (client browser : `@/lib/supabase`)
- **Cartes** : Leaflet via import dynamique (`ssr: false`)

## Identité visuelle — règles absolues

### Couleurs
- Fond : `bg-black` ou `bg-zinc-950`
- Accent principal : `text-cyan-300` / `border-cyan-300` / `bg-cyan-300` (`#22d3ee`)
- Texte primaire : `text-white`
- Texte secondaire : `text-white/50`, `text-white/30`
- Surfaces : `bg-white/5`, `bg-white/[0.02]`
- Bordures : `border-white/10`, `border-white/20`

### Typographie
- Toujours `uppercase` sur les titres, labels, boutons, badges
- Tracking large : `tracking-[0.15em]` à `tracking-[0.4em]`
- Titres de section : `font-light` + `uppercase` + `tracking-[0.15em]`
- Labels de formulaire : `text-xs uppercase tracking-[0.25em] text-white/50`

### Glassmorphism
- Surfaces : `bg-white/5 border border-white/10 backdrop-blur-md`
- Cartes hover : `hover:bg-white/[0.05] hover:border-white/20`
- Modales/overlays : `bg-black/80 backdrop-blur-sm`

### Animations
- Hover sur cartes : `hover:-translate-y-2 transition-all duration-500`
- Transitions standards : `transition-all duration-300`
- Transitions lentes : `transition-all duration-700`
- Fade/zoom en arrière-plan : `animate-slowZoom` (défini dans globals.css)

### Boutons
- Primaire cyan : `px-* py-* rounded-full border border-cyan-300/40 bg-cyan-300/10 text-cyan-300 uppercase tracking-[0.3em] hover:bg-cyan-300/20 hover:border-cyan-300/70 transition-all duration-300`
- Destructif : `border-red-400/40 bg-red-400/10 text-red-400 hover:bg-red-400/20`
- Succès : `border-emerald-400/40 bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20`
- Disabled : `disabled:opacity-40 disabled:cursor-not-allowed`

### Badges de statut
- En attente : `border-amber-300/30 bg-amber-300/10 text-amber-300`
- Approuvé : `border-emerald-400/30 bg-emerald-400/10 text-emerald-400`
- Rejeté : `border-red-400/30 bg-red-400/10 text-red-400`
- Admin : `border-cyan-300/30 bg-cyan-300/10 text-cyan-300`
- Modérateur : `border-amber-300/30 bg-amber-300/10 text-amber-300`

### Formulaires
- Inputs : `bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-cyan-300/60 focus:bg-white/[0.07] transition-all duration-200`
- Checkboxes : `accent-cyan-300`
- Selects : même style que les inputs avec `bg-zinc-900` sur les options

### Structure des pages protégées (admin/dashboard)
- Sidebar desktop : `w-64 border-r border-white/10 py-8 px-4`
- Lien actif : `bg-cyan-300/10 text-cyan-300 border border-cyan-300/20 rounded-xl`
- Lien inactif : `text-white/50 hover:text-white/80 hover:bg-white/5 rounded-xl`
- Bouton déconnexion : `text-white/25 hover:text-white/50 text-xs uppercase tracking-[0.2em]`

## Architecture fichiers

```
frontend/src/
  app/
    admin/
      page.tsx              — dashboard admin (sidebar + sections)
      _components/          — sections admin (PhotosSection, UsersSection, etc.)
    dashboard/page.tsx      — espace utilisateur
    carte/page.tsx          — carte Leaflet
    login/page.tsx
    register/page.tsx
  components/
    navigation/Header.tsx   — header hero page principale
    MapClient.tsx           — carte Leaflet fullscreen
    LocationPicker.tsx      — mini-carte sélection position
  lib/
    supabase.ts             — client Supabase singleton (createBrowserClient)
  middleware.ts             — protection routes /admin et /dashboard
```

## Supabase

- Client browser : `import { supabase } from "@/lib/supabase"`
- Middleware server : `createServerClient` de `@supabase/ssr`
- Table `photos` : id, src, title, village, year, description, type, restored, timeline, status, user_id, latitude, longitude
- Table `profiles` : id, role (user/moderator/admin), notif_new_photo
- Table `lieux` : id, nom, village, type, description, latitude, longitude, url
- Table `activites` : id, type, description, meta (jsonb), created_at
- Bucket Storage : `photos`
