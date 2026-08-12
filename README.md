# Vault Agenda

Vault Agenda adds a compact sidebar agenda for dated notes and file-based tasks.
Plan several items for the same day, track overdue work, and keep everything as
plain Markdown files in your vault.

## Features

- Multiple notes and tasks per day, with calendar markers and overdue tracking.
- Task lists with custom names, colors, folders, templates, sorting, and completion behavior.
- Scheduled, unscheduled, and recurring tasks (daily, weekly, monthly, or yearly).
- Create, reschedule, complete, reorder, and manage repeats directly from the agenda.
- Configurable templates, date format, week start, and default item names.
- Hover previews and standard Obsidian file actions, with an English and Russian interface.

## How it works

Each note or task is a regular Markdown file. Vault Agenda stores its metadata in
frontmatter. For notes, the date in the filename and frontmatter stays synchronized.

Notes use one configured folder. Tasks are organized into configurable lists, each
with its own active folder and optional completed folder. A completed task can
either stay in place or move to that folder.

```yaml
---
vaultAgendaItem: task
date: 2026-08-10
done: false
repeat: weekly
---
```

Removing a task's date keeps it in its task list without displaying it on a dated
day. Completing a recurring task creates its next future occurrence as a separate
file.

Configure folders, templates, task lists, date format, week start, and default item
names in **Settings → Vault Agenda**.

## Installation

### BRAT

Install [BRAT](https://github.com/TfTHacker/obsidian42-brat), run
**BRAT: Add a beta plugin for testing**, and enter:

```text
https://github.com/eugene-lesnov/obsidian-vault-agenda
```

### Manual

Download `main.js`, `manifest.json`, and `styles.css` from the
[latest release](https://github.com/eugene-lesnov/obsidian-vault-agenda/releases/latest)
and copy them to:

```text
<vault>/.obsidian/plugins/vault-agenda/
```

Reload Obsidian and enable **Vault Agenda** under **Community plugins**.

## Development

```bash
npm ci
npm run lint
npm run build
```

## License

[MIT](LICENSE)
