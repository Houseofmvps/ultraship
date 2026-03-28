---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with top-tier product design and UI/UX quality. Use this skill when the user asks to build web components, pages, or applications. Combines product thinking, UX discipline, and creative visual design.
license: Complete terms in LICENSE.txt
---

This skill combines three disciplines: **product design** (does it solve the right problem?), **UX design** (can users accomplish their goals without friction?), and **visual design** (is it distinctive and polished?). All three must be present. Beautiful but unusable is a failure. Usable but ugly is a failure. Both beautiful and usable but solving the wrong problem is the worst failure.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

## Product Design Thinking

Before touching aesthetics, think like a product designer:

**1. User Intent**
- What is the user trying to accomplish on this page/component?
- What is the ONE primary action? (every screen has one — if you can't identify it, the design is confused)
- What information does the user need to make a decision? Show that, hide everything else.

**2. Information Hierarchy**
- What should the user see FIRST? (headline, hero, key metric, CTA)
- What should they see SECOND? (supporting evidence, features, social proof)
- What can they discover on scroll or click? (details, secondary actions, edge cases)
- Apply the 5-second test: if someone sees this page for 5 seconds, do they know what it does and what to do next?

**3. Conversion Design**
- Every page has a goal. What is it? (signup, purchase, upgrade, share, learn)
- Is the primary CTA visible without scrolling?
- Is there a clear value proposition above the fold?
- Are there unnecessary choices that create decision paralysis? Reduce them.
- Does the page have social proof near the CTA? (testimonials, user count, logos, ratings)

**4. User Psychology**
- **Cognitive load**: Fewer choices = more action. Hick's Law — every option added increases decision time.
- **Loss aversion**: "Don't lose your progress" converts better than "Save your progress."
- **Anchoring**: Show the recommended plan in the middle. Show the expensive plan first so the middle feels reasonable.
- **Social proof**: "2,847 teams use this" near the signup button. Specific numbers beat vague claims.
- **Progress indication**: Show users where they are in multi-step flows. Completion drives commitment.

## UX Design Discipline

**Interaction Design:**
- Every interactive element must have 4 states: default, hover, active, disabled. Missing states feel broken.
- Loading states for every async operation. Show skeleton screens, not spinners (skeletons preserve layout and feel faster).
- Empty states with actionable guidance ("No projects yet. Create your first one."), not blank screens.
- Error states that explain what went wrong AND how to fix it. "Something went wrong" is not a UX — it's giving up.
- Success states with clear next-step guidance. "Saved!" then what? Guide the user forward.

**Navigation & Wayfinding:**
- Users should always know: where they are, where they can go, and how to get back.
- Breadcrumbs for deep hierarchies. Active state on current nav item. Back buttons that go where expected.
- Mobile navigation: hamburger menu for secondary pages, bottom tab bar for primary actions (thumb zone).
- Maximum 7 items in any navigation level (Miller's Law). More than 7 = reorganize, don't scroll.

**Form Design (where most UX fails):**
- One column. Always. Two-column forms have measurably lower completion rates.
- Labels above fields, not inside (placeholder text disappears on focus — users forget what the field is for).
- Inline validation on blur, not on every keystroke. Show errors next to the field, not in a banner at the top.
- Auto-focus the first field. Auto-advance in multi-step flows. Pre-fill what you can.
- Submit buttons that say what they do ("Create Account") not generic ("Submit").
- Show password requirements BEFORE the user types, not after they fail validation.

**Accessibility (not optional):**
- Semantic HTML: `<button>` for actions, `<a>` for navigation, `<nav>`, `<main>`, `<header>`, `<footer>`.
- Color contrast: 4.5:1 minimum for text, 3:1 for large text and UI components (WCAG AA).
- Keyboard navigation: every interactive element reachable via Tab. Focus ring visible. Escape closes modals.
- Screen reader support: `aria-label` on icon-only buttons, `aria-live` for dynamic content, `alt` text on meaningful images, `role` on custom widgets.
- Touch targets: minimum 44x44px on mobile (Apple HIG). Don't make users precision-tap.
- Motion: respect `prefers-reduced-motion`. Provide alternatives for animation-dependent interfaces.

**Responsive Design:**
- Design mobile-first, then scale up. Not the other way around.
- Breakpoints: 640px (mobile), 768px (tablet), 1024px (desktop), 1280px (wide). Use your framework's system.
- Touch interactions on mobile, hover interactions on desktop. Don't rely on hover for critical functionality.
- Typography scales: smaller on mobile, larger on desktop. Use clamp() for fluid sizing.
- Images: serve appropriate sizes. A 2400px hero image on a 375px phone is a performance crime.

**Performance as UX:**
- A page that loads in 1s feels instant. 3s feels slow. 5s and users leave.
- Lazy load below-the-fold images and components.
- Defer non-critical JavaScript. Inline critical CSS.
- Skeleton screens for data-dependent sections — they make perceived load time 30% faster.
- Measure: if Lighthouse performance is below 80, the UX is degraded regardless of how good it looks.

## Visual Design — The Aesthetic Direction

Before coding, commit to a BOLD aesthetic direction:
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc. There are so many flavors to choose from. Use these for inspiration but design one that is true to the aesthetic direction.
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity.

Then implement working code (HTML/CSS/JS, React, Vue, etc.) that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail

## Frontend Aesthetics Guidelines

Focus on:
- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics; unexpected, characterful font choices. Pair a distinctive display font with a refined body font.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures that match the overall aesthetic. Apply creative forms like gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, and grain overlays.

NEVER use generic AI-generated aesthetics like overused font families (Inter, Roboto, Arial, system fonts), cliched color schemes (particularly purple gradients on white backgrounds), predictable layouts and component patterns, and cookie-cutter design that lacks context-specific character.

Interpret creatively and make unexpected choices that feel genuinely designed for the context. No design should be the same. Vary between light and dark themes, different fonts, different aesthetics. NEVER converge on common choices (Space Grotesk, for example) across generations.

**IMPORTANT**: Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code with extensive animations and effects. Minimalist or refined designs need restraint, precision, and careful attention to spacing, typography, and subtle details. Elegance comes from executing the vision well.

Remember: Claude is capable of extraordinary creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a distinctive vision.

## Page-Specific UX Patterns

A top product designer knows that different page types have different UX requirements. Apply these patterns based on what you're building:

**Landing Pages:**
- Hero section: headline (6-12 words), subhead (1-2 sentences), primary CTA, visual. Nothing else above the fold.
- Social proof within 1 scroll of the CTA (logos, testimonials, user count)
- Feature sections: benefit-first headlines ("Ship 3x faster" not "AI-powered automation")
- Pricing: highlight recommended plan, show annual savings, FAQ near pricing to reduce objections
- Footer CTA: repeat the primary action. Users who scroll to the bottom are interested — don't lose them.

**Dashboards:**
- Key metrics visible at a glance (top of page, card layout, large numbers)
- Actions grouped by frequency: daily actions prominent, weekly/monthly actions in sidebar or secondary nav
- Data tables: sortable, filterable, searchable. Pagination for >20 rows. Bulk actions if relevant.
- Status indicators: color-coded (green/yellow/red), with text labels (don't rely on color alone — accessibility)
- Empty states that guide: "No data yet. Here's how to get started: [steps]"

**Settings Pages:**
- Group by category, not alphabetically. Users think in domains ("notifications", "billing") not letters.
- Save on change for toggles/dropdowns. Explicit save button for text fields.
- Destructive actions (delete account, revoke API key) require confirmation and are visually distinct (red, separated)
- Show current state clearly. "Email notifications: ON" not just a toggle with no label.

**Onboarding Flows:**
- Progress bar showing step X of Y. Never hide how many steps remain.
- One question per screen. Don't overwhelm on step 1.
- Allow skip where possible. Forced onboarding has higher drop-off than optional onboarding.
- Show value at each step: "This helps us personalize your experience" not just "Enter your company name"
- Celebrate completion. A small animation or congratulations screen improves activation rates.

**Pricing Pages:**
- 3 tiers maximum. More than 3 creates decision paralysis.
- Recommended tier visually emphasized (larger card, "Most Popular" badge, different color)
- Feature comparison table below the cards for detail-oriented buyers
- Annual vs monthly toggle with savings shown ("Save 20%")
- FAQ section addressing common objections (refund policy, upgrade/downgrade, what happens when trial ends)

## Design Quality Checklist

Before marking any frontend work as complete:

- [ ] Primary action is immediately obvious (5-second test)
- [ ] All interactive elements have hover, active, and disabled states
- [ ] Loading, empty, and error states are handled
- [ ] Color contrast meets WCAG AA (4.5:1 for text)
- [ ] Keyboard navigation works (Tab through all interactive elements)
- [ ] Mobile responsive (test at 375px width minimum)
- [ ] Touch targets are 44x44px minimum on mobile
- [ ] Typography hierarchy is clear (one H1, logical heading order)
- [ ] Animations respect prefers-reduced-motion
- [ ] No layout shift on page load (CLS score)