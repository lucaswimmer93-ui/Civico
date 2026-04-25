# Civico Webapp – Split-Struktur

Diese Version trennt die hochgeladene Monolith-Datei in Funktionsbereiche:

- `src/App.jsx` – Hauptorchestrierung, Routing, Session-Handling
- `src/core/shared.js` – Supabase, Texte, Konstanten, Helfer
- `src/components/ui.jsx` – wiederverwendbare UI-Bausteine
- `src/screens/LoginScreen.jsx`
- `src/screens/VolunteerScreens.jsx`
- `src/screens/OrganizationScreens.jsx`
- `src/screens/GemeindeDashboard.jsx`
- `src/screens/AdminDashboard.jsx`
- `src/screens/LegalScreens.jsx`

## Neu vorbereitet
- Gemeinde-Dashboard mit:
  - Übersicht
  - eigene Stellen
  - Stelle erstellen
  - Organisationen
  - Postfach
  - CSR-Report

- Admin-Dashboard mit:
  - Top-5-Gemeinden
  - PLZ-Filter
  - Verteilung Freiwillige / Organisationen / Stellen
  - offene Anfragen

## Ehrlicher Hinweis
Die ursprüngliche Datei enthält keine vollständige Backend-Struktur für `gemeinden` und `admins`.
Darum sind Gemeinde/Admin im Split vorbereitet, aber serverseitig nur als Best-Effort eingebunden.
Für einen produktiven Lauf brauchst du zusätzlich:
- Tabelle `gemeinden`
- Tabelle `admins`
- optional Tabelle `partner_anfragen` / `admin_inbox`
- echte Admin-/Gemeinde-Login-Wege
