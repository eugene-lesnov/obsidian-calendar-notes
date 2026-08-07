# Calendar Notes

Calendar Notes adds a compact sidebar calendar for standalone dated notes and
note-like tasks. Plan a meeting next Thursday, resurface a task in two weeks, or
keep several independent notes on the same day — without forcing everything into
one daily note.

Pick a date, create an item, and keep working in plain Markdown. The calendar marks
days with content and keeps overdue tasks close at hand.

## Highlights

- Compact calendar in the sidebar.
- Multiple notes and tasks per day.
- Day markers: grey for notes, orange for open tasks, green when all tasks are done.
- Collapsible list of overdue tasks.
- Daily, weekly, monthly, and yearly recurring tasks.
- Open notes, change dates, complete tasks, and configure repeats directly from the calendar.
- Templates for new notes and tasks.
- Configurable folder scope, including subfolders or the whole vault.
- English and Russian UI, following the Obsidian language setting.
- Local-first storage: every item is an ordinary Markdown file.

## One item, one file

Calendar Notes creates files in the configured folder and prefixes their names with
the selected date:

```text
Calendar/
├── 2026-08-06 - Meeting with the team.md
├── 2026-08-06 - Day summary.md
└── 2026-08-07 - New task.md
```

The folder defines the calendar scope. Items in its subfolders are included; leave
the setting empty to use the whole vault. Moving an item outside the configured
folder hides it from the calendar without changing the file.

The date in the filename and the `date` property stay synchronized in both
directions. If the date prefix is removed completely, the plugin leaves the filename
alone and continues using the property.

Calendar items can also be created manually. The plugin recognizes a Markdown file
inside the configured folder when it has the properties shown below.

A note needs two properties:

```yaml
---
calendarItem: note
date: 2026-08-06
---
```

A task also has a completion state and can optionally repeat:

```yaml
---
calendarItem: task
date: 2026-08-06
done: false
repeat: weekly
---
```

| Property | Meaning |
| --- | --- |
| `calendarItem` | `note` or `task`; identifies a calendar item |
| `date` | Date assigned to the item |
| `done` | Task completion state |
| `completed` | Date the task was completed |
| `repeat` | `daily`, `weekly`, `monthly`, or `yearly` |

Dates are written using the configured format. ISO dates such as `2026-08-06` are
always recognized when reading properties.

The plugin manages these fields as follows:

- New tasks start with `done: false`.
- Checking a task sets `done: true` and writes `completed` with today's date.
- Unchecking it removes `completed`.
- Changing the item date from the calendar updates `date` and the filename. If the target
  filename already exists, the plugin adds ` (2)`, ` (3)`, and so on.
- Renaming a date-prefixed file updates `date`.
- Hovering an item shows Obsidian's standard note preview; clicking opens the file.

## Recurring tasks

Repeat frequency is selected from the task's menu in the calendar. The available
choices are daily, weekly, monthly, yearly, and do not repeat. Custom repeat intervals
and schedules are not supported.

Each occurrence is a separate Markdown file. Completing a repeating task creates
the next future occurrence and moves the repeat rule to it. If the completed task is
overdue, missed dates are skipped rather than created retroactively. The completed
file stays in the vault as a permanent record with its own notes and completion date.

New occurrences use the task template rather than copying the previous body. To end
a series, choose **Do not repeat**, remove the `repeat` property manually, or use
**Complete and stop repeating** to end the series and mark the current task done. If
a completion is undone, an already-created next occurrence is kept to avoid deleting
user data. If an unfinished task with the same name already exists on the next date,
the plugin uses it as the next occurrence and preserves its content. Other files at
the target path are not overwritten.

## Settings

| Setting | Effect |
| --- | --- |
| Date format | Controls dates in the UI, properties, and generated filenames |
| Week starts on | Starts the calendar week on Monday or Sunday |
| Calendar folder | Sets the indexed folder and creation destination; empty means the whole vault |
| New note name | Sets the default filename title for new notes |
| New note template | Selects the template copied into new notes |
| New task name | Sets the default filename title for new tasks |
| New task template | Selects the template copied into new tasks and recurring occurrences |

Changing the date format is a vault mutation. Before applying it, the plugin shows
how many calendar items and filenames will change and asks for confirmation. It then
rewrites `date` and `completed` values and renames date-prefixed files. Files with a
conflicting target name are not overwritten.

## Commands

Available commands:

- Toggle calendar
- Create note for today
- Create task for today
- Go to today

## Installation

### Community Plugins

Once available in the Obsidian directory, install Calendar Notes from
**Settings → Community plugins → Browse**.

### BRAT

BRAT can install the latest published release before Calendar Notes is available in
the Obsidian directory.

1. Install and enable **BRAT** from **Settings → Community plugins → Browse**.
2. Open the command palette and run **BRAT: Add a beta plugin for testing**.
3. Enter this repository URL:

   ```text
   https://github.com/eugene-lesnov/obsidian-calendar-notes
   ```

4. Click **Add Plugin** and wait for BRAT to finish.
5. Open **Settings → Community plugins**, refresh the plugin list if necessary, and
   enable **Calendar Notes**.

If BRAT is already installed, you can also use
[Install Calendar Notes with BRAT](obsidian://brat?plugin=eugene-lesnov/obsidian-calendar-notes).

BRAT installs files from GitHub Releases. The release must be published and contain
`main.js`, `manifest.json`, and `styles.css`; draft releases cannot be installed.

### Manual installation

Download `main.js`, `manifest.json`, and `styles.css` from the latest release and
place them in:

```text
<vault>/.obsidian/plugins/calendar-notes/
```

Reload Obsidian, then enable Calendar Notes under **Community plugins**.

## Development

```bash
npm install
npm run typecheck
npm run lint
npm run build
npm run dev
```

- `npm run build` type-checks the project and writes a minified `main.js` to the repository root.
- `npm run dev` watches the source and rebuilds `main.js` with an inline source map.
- `npm run typecheck` checks TypeScript without creating a build.
- `npm run lint` runs the Obsidian-aware ESLint rules.

To test locally, copy `main.js`, `manifest.json`, and `styles.css` into
`<vault>/.obsidian/plugins/calendar-notes/`, then reload the plugin in Obsidian.

## License

[MIT](LICENSE)
