---
name: InfoTarea Design System
colors:
  surface: '#f8f9ff'
  surface-dim: '#ccdbf3'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d5e3fc'
  on-surface: '#0d1c2e'
  on-surface-variant: '#3e4947'
  inverse-surface: '#233144'
  inverse-on-surface: '#eaf1ff'
  outline: '#6e7977'
  outline-variant: '#bdc9c6'
  surface-tint: '#006a63'
  primary: '#005c55'
  on-primary: '#ffffff'
  primary-container: '#0f766e'
  on-primary-container: '#a3faef'
  inverse-primary: '#80d5cb'
  secondary: '#006e2d'
  on-secondary: '#ffffff'
  secondary-container: '#7cf994'
  on-secondary-container: '#007230'
  tertiary: '#005e27'
  on-tertiary: '#ffffff'
  tertiary-container: '#007a35'
  on-tertiary-container: '#a1ffaf'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#9cf2e8'
  primary-fixed-dim: '#80d5cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#00504a'
  secondary-fixed: '#7ffc97'
  secondary-fixed-dim: '#62df7d'
  on-secondary-fixed: '#002109'
  on-secondary-fixed-variant: '#005320'
  tertiary-fixed: '#6bff8f'
  tertiary-fixed-dim: '#4ae176'
  on-tertiary-fixed: '#002109'
  on-tertiary-fixed-variant: '#005321'
  background: '#f8f9ff'
  on-background: '#0d1c2e'
  surface-variant: '#d5e3fc'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.25'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.25'
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  title-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  container-max: 1440px
  gutter: 24px
  sidebar-width: 280px
---

## Brand & Style
The design system is engineered for high-density academic management, prioritizing clarity, trust, and rhythmic efficiency. The brand personality is **Institutional yet Fresh**, moving away from the "dusty" feel of traditional educational software toward a modern, SaaS-inspired dashboard aesthetic.

The visual style follows a **Modern Corporate** direction with a focus on modularity. It utilizes a structured "layer-on-layer" approach where whitespace is used as a functional tool rather than just an aesthetic choice. The interface should feel reliable and grounded, evoking a sense of organized productivity for students, educators, and administrators alike.

## Colors
The palette is rooted in a spectrum of professional greens and teals to signify growth and stability.

- **Primary & Secondary:** Deep Teal (#0F766E) is used for critical UI anchors like sidebars, primary buttons, and active headers. Forest Green (#16A34A) acts as a secondary accent for progression and positive actions.
- **Surface Palette:** We utilize a dual-tone background strategy. The main canvas uses a soft Slate (#F8FAFC), while the light Mint (#ECFDF5) is reserved for highlighting specific sections, secondary sidebars, or "success-state" containers.
- **Functional Colors:** Semantic colors follow standard conventions but are adjusted for high legibility against white card surfaces. "Vencido" (Overdue) uses the Error red, while "Pendiente" (Pending) uses the Warning amber.

## Typography
This design system utilizes **Inter** for all roles to leverage its exceptional legibility in data-heavy environments. 

The type scale is built on a modular scale to ensure hierarchy in complex dashboards. **Title-lg** and **Headline-md** are the workhorses of the application, used for card titles and section headers. For data tables and metadata, **Body-md** and **Label-sm** provide a compact yet readable experience. All headlines use a slight negative letter-spacing to appear more "locked-in" and authoritative.

## Layout & Spacing
The system employs a **12-column fluid grid** for the main content area, with a fixed-width sidebar for navigation. 

- **The Sidebar:** Remains fixed at 280px on desktop to provide a persistent navigation anchor.
- **Rhythm:** An 8px grid (using 4px increments for micro-adjustments) governs all spacing. 
- **Margins:** Desktop views use 32px (xl) outer margins, while mobile scales down to 16px (md). 
- **Card Padding:** Standard cards use 24px padding to ensure data does not feel cramped, maintaining the "institutional" sense of breathability.

## Elevation & Depth
This design system uses **Tonal Layering** combined with **Ambient Shadows** to create a clear visual hierarchy.

- **Level 0 (Background):** #F8FAFC. The foundation layer.
- **Level 1 (Cards/Surfaces):** Pure white (#FFFFFF) with a very soft, diffused shadow (0px 1px 3px rgba(15, 23, 42, 0.05)). This is the primary container for all content.
- **Level 2 (Hover/Active):** A more pronounced shadow (0px 10px 15px -3px rgba(15, 23, 42, 0.08)) to indicate interactivity, specifically for KPI cards and list items.
- **Outlines:** Subtle 1px borders (#E2E8F0) are used on inputs and inactive states to maintain structure without the weight of a shadow.

## Shapes
The shape language is **Soft (0.25rem base)**. This provides a professional balance—avoiding the clinical sharpness of 0px corners while remaining more formal than heavily rounded "playful" apps.

- **Standard Elements:** 4px (0.25rem) for buttons, inputs, and small components.
- **Containers/Cards:** 8px (0.5rem) for main dashboard cards and modals to soften the overall interface.
- **Badges:** Fully pill-shaped (999px) to distinguish them from interactive buttons.

## Components

- **Sidebar Items:** Clear vertical stack with 4px roundedness. Active states use a "ghost" Teal background (#F0FDFA) with a 4px solid Teal left-border indicator.
- **KPI Cards:** White background, 8px rounded corners. Includes a large numerical value (Headline-lg), a label (Label-md), and a small trend indicator at the bottom.
- **Status Badges:** 
    - *Pendiente:* Amber text/background (low opacity).
    - *Entregado:* Forest Green text/background (low opacity).
    - *Revisado:* Deep Teal text/background (low opacity).
    - *Vencido:* Rose/Red text/background (low opacity).
- **Modern Tables:** No vertical borders. Soft Slate (#F1F5F9) header row with Label-md text. Rows use a 1px bottom border and a subtle transition to a light mint hover state.
- **Input Fields:** 1px Slate-300 border. Focus state uses a 2px Deep Teal ring with 0.25rem roundedness.
- **Buttons:**
    - *Primary:* Solid Deep Teal, white text.
    - *Secondary:* Outline Forest Green, Forest Green text.
    - *Ghost:* No border, Slate-600 text, light gray background on hover.