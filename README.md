# jhuang2023.github.io

Personal academic website for **Jujun Huang**, Assistant Professor of Management Information Systems, School of Management, Binghamton University (SUNY).

Built with Jekyll on top of a customized fork of the [sproogen/modern-resume-theme](https://github.com/sproogen/modern-resume-theme) (MIT licensed — see `LICENSE`).

## Structure

- `_data/profile.yml` / `_data/profile_zh.yml` — all site content (bio, research interests, publications, teaching, service, awards, education), in English and Chinese. This is the file to edit when updating the CV content.
- `_data/landing.yml` — the two preview timelines shown on the homepage.
- `_data/ui.yml` — shared interface strings (en/zh).
- `_config.yml` — site settings, social links, Google Scholar/SSRN icons.
- Pages: `/` (profile picker) and, per language, `/en|zh/cv/` (brief CV, education without years), `/en|zh/cv-detail/` (full CV, education with years), `/en|zh/resume/` (condensed highlights), `/en|zh/all/` (everything, undeduped, for reviewing content). The bare `/cv/`, `/cv-detail/`, `/resume/`, `/all/` paths are client-side redirect stubs (`_layouts/lang-redirect.html`) that forward to the visitor's stored language preference.
- `assets/resume/` — the downloadable CV PDF.
- `legacy/` — archived static output of the previous Hugo-based site, kept for reference only (excluded from the Jekyll build).

## Local development

```bash
bundle install
bundle exec jekyll serve
```

Then open `http://localhost:4000`. Or, with Docker:

```bash
docker compose up
```

See `MIGRATION_PLAN.md` for the notes from the framework migration.
