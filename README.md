# Elma Hache - Portfolio Website

A minimalist portfolio website built with React, TypeScript, and Vite, inspired by the aesthetic of Akinori Goto's portfolio.

## Features

- **Minimalist Design**: Clean, image-focused layout with generous whitespace
- **Multi-language Support**: Full Spanish and English translations
- **Responsive Design**: Mobile-first approach with breakpoints for tablet and desktop
- **Modern Stack**: React 18, TypeScript, Vite, Tailwind CSS

## Tech Stack

- React 18.3.1
- TypeScript 5.8.3
- Vite 5.4.19
- React Router DOM 6.30.1
- Tailwind CSS 3.4.17
- Shadcn UI components
- Lucide React icons

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The site will be available at `http://localhost:5173`

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
src/
├── components/     # React components
│   ├── Navigation.tsx
│   ├── Layout.tsx
│   ├── Footer.tsx
│   ├── HeroImage.tsx
│   └── LanguageSwitcher.tsx
├── contexts/       # React Context providers
│   └── LanguageContext.tsx
├── data/           # Static JSON data
│   └── portfolioData.json
├── hooks/          # Custom React hooks
│   └── useTranslation.ts
├── pages/          # Page components
│   ├── Home.tsx
│   ├── Works.tsx
│   ├── News.tsx
│   ├── Exhibitions.tsx
│   ├── CV.tsx
│   └── Contact.tsx
├── translations/   # i18n translation files
│   ├── en.json
│   └── es.json
└── App.tsx         # Main app component with routing
```

## Pages

- **Home**: Hero image with artist name and subtitle
- **Works**: Grid layout of artwork thumbnails
- **News**: List of news items and updates
- **Exhibitions**: Chronological list of exhibitions
- **CV**: Biography, education, exhibitions, awards, and collections
- **Contact**: Contact information and social media links

## Translation System

All text content is managed through translation files in `src/translations/`. The site supports:
- English (en) - Default
- Spanish (es)

Users can switch languages using the language switcher in the navigation.

## Customization

### Adding Content

Edit `src/data/portfolioData.json` to update:
- Works/artwork
- News items
- Exhibitions
- CV information
- Contact details

### Styling

The site uses Tailwind CSS with a custom minimalist theme. Main styling is in:
- `tailwind.config.js` - Theme configuration
- `src/index.css` - Base styles and typography

### Colors

The color scheme is minimalist:
- Primary: Black (#000000)
- Background: White (#FFFFFF)
- Text: Dark grey/black
- Accents: Subtle greys

## License

© Elma Hache All Rights Reserved.

