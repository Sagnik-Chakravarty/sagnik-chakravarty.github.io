# Misc Content Manual

This folder controls most page copy and small reusable sections that are not full project, experience, education, or skill records.

## Homepage

- `home-hero.md`: hero title template, rotating domain list, subtitle, and search placeholder.
- `home-research-areas.csv`: Research Areas cards on the homepage.
- `home-demos.csv`: compact homepage demo cards.
- `home-skill-showcase.csv`: skill showcase cards.
- `highlights.csv`: homepage proof row and About current work cards.

To change the rotating "Graduate student in" list, edit the `## Domains` section in `home-hero.md`. Put one domain per line.

## About Page

- `about-copy.csv`: normal text copy for the About page.
- `about-highlights.csv`: stacked highlight cards near the top.
- `about-skill-cards.csv`: About skill tab cards.
- `about-experience.csv`: About experience tab list.

Edit the `value` column in `about-copy.csv` to change text without touching HTML.

## Resume Page

- `resume-copy.csv`: hero and overview copy.
- `resume-hero-kpis.csv`: Resume hero KPI box.
- `resume-overview-cards.csv`: overview navigation cards.
- `resume-experience-categories.csv`: Research/Teaching/Industry category cards.
- `resume-skill-matrix.csv`: skill matrix rows.

The detailed Resume timelines come from `../education`, `../experience`, `../projects`, and `../skills`.

## Research Page

- `research-copy.csv`: hero, agenda, and selected work copy.
- `research-hero-kpis.csv`: Research hero KPI box.
- `research-focus.csv`: the focused paper/applied-work evidence cards at the top of Research.
- `research-selected.csv`: non-repeated additional research evidence cards below the main focus projects.
- `research-references.csv`: rotating advisor/reference cards below the lab section.
- `research-agenda.csv`: research agenda cards.
- `research-bottom-cards.csv`: Research page lab card copy.

The additional Research evidence cards are controlled by `research-selected.csv`, which references project IDs from `../projects/*.md`.

## Publications And Live Demos Page

- `publications-copy.csv`: hero and section copy for the Publications page.
- `publication-talks.csv`: Talks section rows with event, location, date, project reference, description, and links.
- `assistant-architecture.csv`: optional SagnikGPT architecture notes.

Publication cards and live demos are controlled by fields inside `../projects/*.md`. SagnikGPT is embedded as the first live demo on this page.

## Highlights CSV

`highlights.csv` can reference existing content or define custom cards.

Important columns:

- `placement`: where the card appears, such as `homeProof` or `aboutWork`.
- `type`: `project`, `experience`, `skill`, or `custom`.
- `ref`: the referenced `id` when using project/experience/skill.
- `titleOverride`, `descriptionOverride`: optional text overrides.
- `actionType`: `open`, `poster`, `ask`, or `link`.
- `target`: URL, asset path, page link, or prompt key depending on `actionType`.

For a custom card, leave `ref` blank and fill the override fields.
