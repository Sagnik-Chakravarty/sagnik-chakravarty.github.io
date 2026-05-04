# JavaScript Structure

The site keeps HTML files mostly declarative. Page behavior lives in small JavaScript controllers and shared modules.

## Shared Modules

- `modules/core.js`: common helpers, nav toggle, global SagnikGPT redirect hooks, escaping, CSV-style link parsing, icon class normalization, image fallback handling.
- `modules/modal.js`: reusable poster modal controller.
- `modules/assistant.js`: research assistant chat client and prompt handling.
- `content-loader.js`: loads Markdown and CSV content from `content/`.
- `content-data.js`: generated fallback bundle for direct file preview.

## Page Controllers

- `pages/home.js`: homepage hero, rotating domains, KPI rotation, proof cards, home search.
- `pages/about.js`: About copy, tabs, highlights, work cards, skill/education/experience lists.
- `pages/resume.js`: interactive resume tabs, timelines, detail panels, poster modal integration.
- `pages/research.js`: research cards, publications, agenda, SagnikGPT UI, poster modal integration.
- `pages/contact.js`: contact directory, intent cards, footer contacts.
- `pages/thankyou.js`: navbar/footer hydration for the thank-you page.

## Event Pattern

HTML uses `data-*` attributes instead of inline `onclick` handlers.

Examples:

```html
<button data-nav-toggle>☰</button>
<button data-resume-section="skills">Skills</button>
<article data-ask-sagnik="Summarize this project">...</article>
<img data-poster-src="assets/poster/example.png" data-poster-title="Example">
```

Page controllers attach listeners after `DOMContentLoaded` and use event delegation for dynamic content. This keeps generated cards reusable and avoids duplicating functions inside HTML files.

## Adding A New Page

1. Create the HTML page under `pages/`.
2. Include shared content scripts:

```html
<script src="assets/js/content-data.js"></script>
<script src="assets/js/content-loader.js"></script>
<script src="assets/js/modules/core.js"></script>
```

3. Add any needed shared modules, such as `modal.js` or `assistant.js`.
4. Create a page controller under `assets/js/pages/`.
5. Add the controller script after the modules.
6. Add the page to `content/navigation/pages.csv` if it should appear in the navbar.

