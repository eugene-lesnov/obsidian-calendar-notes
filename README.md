# Vault Agenda

Vault Agenda adds a compact sidebar agenda for dated notes and file-based tasks.
Plan several items for the same day, track overdue work, and keep everything as
plain Markdown files in your vault.

## Features

- Multiple notes and tasks per day.
- Calendar markers for notes, active tasks, and completed tasks.
- Overdue tasks shown directly below the calendar.
- Multiple task lists with custom names, colors, folders, templates, and completion behavior.
- Scheduled and unscheduled tasks.
- Daily, weekly, monthly, and yearly recurring tasks.
- Templates and configurable default names for new items.
- Change dates, complete tasks, and manage repeats from the agenda.
- Hover previews and standard Obsidian file actions.
- English and Russian interface.

## How it works

Each note or task is a regular Markdown file. Vault Agenda stores the item type,
date, completion state, and repeat rule in frontmatter while keeping filenames and
dates synchronized.

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

Folders, templates, task lists, date format, week start, and default item names are
configured in **Settings → Vault Agenda**.

## Commands

- Toggle Vault Agenda
- Create note for today
- Create task for today
- Go to today
- Reopen current task

## Installation

### BRAT

Install [BRAT](https://github.com/TfTHacker/obsidian42-brat), run
**BRAT: Add a beta plugin for testing**, and enter:

```text
https://github.com/eugene-lesnov/obsidian-vault-agenda
```

You can also use [Install Vault Agenda with BRAT](obsidian://brat?plugin=eugene-lesnov/obsidian-vault-agenda).

### Manual

Download `main.js`, `manifest.json`, and `styles.css` from the latest release and
copy them to:

```text
<vault>/.obsidian/plugins/vault-agenda/
```

Reload Obsidian and enable **Vault Agenda** under **Community plugins**.

## Development

```bash
npm install
npm run typecheck
npm run lint
npm run build
```

## License

[MIT](LICENSE)
