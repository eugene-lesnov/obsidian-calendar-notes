import type { RepeatFrequency } from "./types";

export interface AppLocalization {
  dateFormatLabel: string;
  dateFormatDescription: string;
  dateFormatPreview: string;
  dateFormatWarning: string;
  dateFormatApplyLabel: string;
  dateFormatMigrationTitle: string;
  dateFormatMigrationSummary: string;
  dateFormatMigrationCounts: string;
  dateFormatMigrationSample: string;
  dateFormatMigrationConfirmLabel: string;
  dateFormatMigrationCancelLabel: string;
  dateFormatMigrationDone: string;
  dateFormatMigrationFailed: string;
  weekStartLabel: string;
  defaultNotesFolder: string;
  defaultActiveTasksFolder: string;
  defaultCompletedTasksFolder: string;
  notesFolderLabel: string;
  notesFolderDescription: string;
  activeTasksFolderLabel: string;
  activeTasksFolderDescription: string;
  completedTasksFolderLabel: string;
  completedTasksFolderDescription: string;
  taskFoldersConflictError: string;
  newNoteNameLabel: string;
  newNoteNameDescription: string;
  newTaskNameLabel: string;
  newTaskNameDescription: string;
  noteTemplateLabel: string;
  noteTemplateDescription: string;
  noteTemplatePlaceholder: string;
  taskTemplateLabel: string;
  taskTemplateDescription: string;
  taskTemplatePlaceholder: string;
  toggleCalendarCommandLabel: string;
  calendarRibbonLabel: string;
  createNoteTodayCommandLabel: string;
  createTaskTodayCommandLabel: string;
  goToTodayCommandLabel: string;
  calendarViewTitle: string;
  previousMonthTitle: string;
  nextMonthTitle: string;
  todayButtonLabel: string;
  overdueTasksLabel: string;
  showAllOverdueTasksLabel: string;
  hideOverdueTasksLabel: string;
  selectedDayLabel: string;
  tasksSectionLabel: string;
  notesSectionLabel: string;
  emptyTasksLabel: string;
  emptyNotesLabel: string;
  createTaskButtonTitle: string;
  createNoteButtonTitle: string;
  newTaskDefaultTitle: string;
  newNoteDefaultTitle: string;
  itemActionsLabel: string;
  openItemLabel: string;
  completeAndStopRepeatLabel: string;
  moveItemPickDateLabel: string;
  changeDateModalTitle: string;
  changeDateModalDescription: string;
  changeDateModalSubmitLabel: string;
  invalidDateError: string;
  taskRepeatNoneLabel: string;
  taskRepeatDailyLabel: string;
  taskRepeatWeeklyLabel: string;
  taskRepeatMonthlyLabel: string;
  taskRepeatYearlyLabel: string;
  taskRepeatMetaLabel: string;
  createCalendarNoteFolderError: string;
  createCalendarTaskFolderError: string;
  createCalendarNoteTemplateReadError: string;
  createCalendarTaskTemplateReadError: string;
  repeatAdvanceError: string;
  repeatOccurrenceConflictError: string;
  reconcileError: string;
  invalidDateFormatError: string;
}

const PLACEHOLDER_PATTERN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

const defaultStrings: AppLocalization = {
  dateFormatLabel: "Date format",
  dateFormatDescription: "Format for displayed and stored dates, e.g. YYYY-MM-DD.",
  dateFormatPreview: "Preview: {{date}}",
  dateFormatWarning: "Changing it updates existing dates and filenames after confirmation.",
  dateFormatApplyLabel: "Apply",
  dateFormatMigrationTitle: "Change date format",
  dateFormatMigrationSummary: "Date format will change from {{from}} to {{to}}.",
  dateFormatMigrationCounts:
    "Calendar notes to update: {{items}}. Files to rename: {{renames}}.",
  dateFormatMigrationSample: "For example: {{from}} becomes {{to}}.",
  dateFormatMigrationConfirmLabel: "Change format",
  dateFormatMigrationCancelLabel: "Cancel",
  dateFormatMigrationDone: "Date format changed. Calendar notes updated: {{items}}.",
  dateFormatMigrationFailed:
    "Failed to update {{count}} calendar notes. They keep the old format and stay hidden from the calendar until it is fixed.",
  weekStartLabel: "Week starts on",
  defaultNotesFolder: "Calendar Notes/Notes",
  defaultActiveTasksFolder: "Calendar Notes/Tasks/Active",
  defaultCompletedTasksFolder: "Calendar Notes/Tasks/Completed",
  notesFolderLabel: "Notes folder",
  notesFolderDescription: "Folder where calendar notes are stored. Subfolders are included.",
  activeTasksFolderLabel: "Active tasks folder",
  activeTasksFolderDescription: "Folder where unfinished tasks are stored.",
  completedTasksFolderLabel: "Completed tasks folder",
  completedTasksFolderDescription: "Folder where tasks are moved when completed.",
  taskFoldersConflictError:
    "Active and completed task folders must be separate and must not contain one another.",
  newNoteNameLabel: "New note name",
  newNoteNameDescription:
    "The note's date is added as a prefix using the format selected in the settings.",
  newTaskNameLabel: "New task name",
  newTaskNameDescription:
    "The task's date is added as a prefix using the format selected in the settings.",
  noteTemplateLabel: "New note template",
  noteTemplateDescription: "Path to the template used to create new notes.",
  noteTemplatePlaceholder: "Templates/Calendar note",
  taskTemplateLabel: "New task template",
  taskTemplateDescription: "Path to the template used to create new tasks.",
  taskTemplatePlaceholder: "Templates/Calendar task",
  toggleCalendarCommandLabel: "Toggle calendar",
  calendarRibbonLabel: "Calendar Notes",
  createNoteTodayCommandLabel: "Create note for today",
  createTaskTodayCommandLabel: "Create task for today",
  goToTodayCommandLabel: "Go to today",
  calendarViewTitle: "Calendar Notes",
  previousMonthTitle: "Previous month",
  nextMonthTitle: "Next month",
  todayButtonLabel: "Today",
  overdueTasksLabel: "Overdue tasks: {{count}}",
  showAllOverdueTasksLabel: "Show all",
  hideOverdueTasksLabel: "Hide",
  selectedDayLabel: "{{date}}",
  tasksSectionLabel: "Tasks",
  notesSectionLabel: "Notes",
  emptyTasksLabel: "No tasks",
  emptyNotesLabel: "No notes",
  createTaskButtonTitle: "Add task",
  createNoteButtonTitle: "Add note",
  newTaskDefaultTitle: "New task",
  newNoteDefaultTitle: "New note",
  itemActionsLabel: "Actions",
  openItemLabel: "Open",
  completeAndStopRepeatLabel: "Complete and stop repeating",
  moveItemPickDateLabel: "Move to date...",
  changeDateModalTitle: "Change date",
  changeDateModalDescription: "Date in {{format}} format",
  changeDateModalSubmitLabel: "Move",
  invalidDateError: "Enter a valid date in {{format}} format.",

  taskRepeatNoneLabel: "Do not repeat",
  taskRepeatDailyLabel: "Every day",
  taskRepeatWeeklyLabel: "Every week",
  taskRepeatMonthlyLabel: "Every month",
  taskRepeatYearlyLabel: "Every year",
  taskRepeatMetaLabel: "Repeats: {{repeat}}",
  createCalendarNoteFolderError: "Cannot create a calendar note: folder {{path}} is not available.",
  createCalendarTaskFolderError: "Cannot create a task: folder {{path}} is not available.",
  createCalendarNoteTemplateReadError:
    "Cannot create a calendar note: failed to find or read template note {{path}}.",
  createCalendarTaskTemplateReadError:
    "Cannot create a calendar task: failed to find or read template note {{path}}.",
  repeatAdvanceError: "Failed to move the repeating task to its next date.",
  repeatOccurrenceConflictError:
    "Cannot create the next occurrence of the task: {{path}} already exists.",
  reconcileError:
    "Failed to synchronize the file name and date of {{path}}. The file name and its date property may differ.",
  invalidDateFormatError:
    "Date format is not valid: it must contain year, month and day.",
};

const localizations: Record<string, Partial<AppLocalization>> = {
  ru: {
    dateFormatLabel: "Формат даты",
    dateFormatDescription: "Формат отображения и хранения дат, например YYYY-MM-DD.",
    dateFormatPreview: "Пример: {{date}}",
    dateFormatWarning: "После подтверждения обновятся существующие даты и имена файлов.",
    dateFormatApplyLabel: "Применить",
    dateFormatMigrationTitle: "Смена формата даты",
    dateFormatMigrationSummary: "Формат даты изменится с {{from}} на {{to}}.",
    dateFormatMigrationCounts:
      "Календарных заметок будет обновлено: {{items}}. Файлов будет переименовано: {{renames}}.",
    dateFormatMigrationSample: "Например: {{from}} станет {{to}}.",
    dateFormatMigrationConfirmLabel: "Сменить формат",
    dateFormatMigrationCancelLabel: "Отмена",
    dateFormatMigrationDone: "Формат даты изменён. Обновлено календарных заметок: {{items}}.",
    dateFormatMigrationFailed:
      "Не удалось обновить календарных заметок: {{count}}. Они остались в старом формате и не будут видны в календаре, пока это не исправлено.",
    weekStartLabel: "Первый день недели",
    defaultNotesFolder: "Calendar Notes/Заметки",
    defaultActiveTasksFolder: "Calendar Notes/Задачи/Активные",
    defaultCompletedTasksFolder: "Calendar Notes/Задачи/Завершенные",
    notesFolderLabel: "Папка заметок",
    notesFolderDescription: "Папка для календарных заметок. Учитываются вложенные папки.",
    activeTasksFolderLabel: "Папка активных задач",
    activeTasksFolderDescription: "Папка для всех незавершённых задач.",
    completedTasksFolderLabel: "Папка завершённых задач",
    completedTasksFolderDescription: "Папка, куда перемещаются завершенные задачи.",
    taskFoldersConflictError:
      "Папки активных и завершённых задач должны отличаться и не должны находиться одна внутри другой.",
    newNoteNameLabel: "Название новой заметки",
    newNoteNameDescription:
      "К названию будет добавлен префикс с датой заметки в формате, выбранном в настройках.",
    newTaskNameLabel: "Название новой задачи",
    newTaskNameDescription:
      "К названию будет добавлен префикс с датой задачи в формате, выбранном в настройках.",
    noteTemplateLabel: "Шаблон новой заметки",
    noteTemplateDescription: "Путь к шаблону, по которому будут создаваться новые заметки.",
    noteTemplatePlaceholder: "Шаблоны/Заметка",
    taskTemplateLabel: "Шаблон новой задачи",
    taskTemplateDescription: "Путь к шаблону, по которому будут создаваться новые задачи.",
    taskTemplatePlaceholder: "Шаблоны/Задача",
    toggleCalendarCommandLabel: "Открыть или закрыть календарь",
    createNoteTodayCommandLabel: "Создать заметку на сегодня",
    createTaskTodayCommandLabel: "Создать задачу на сегодня",
    goToTodayCommandLabel: "Перейти к сегодняшнему дню",
    calendarViewTitle: "Calendar Notes",
    previousMonthTitle: "Предыдущий месяц",
    nextMonthTitle: "Следующий месяц",
    todayButtonLabel: "Сегодня",
    overdueTasksLabel: "Просроченные задачи: {{count}}",
    showAllOverdueTasksLabel: "Показать все",
    hideOverdueTasksLabel: "Скрыть",
    selectedDayLabel: "{{date}}",
    tasksSectionLabel: "Задачи",
    notesSectionLabel: "Заметки",
    emptyTasksLabel: "Задач нет",
    emptyNotesLabel: "Заметок нет",
    createTaskButtonTitle: "Добавить задачу",
    createNoteButtonTitle: "Добавить заметку",
    newTaskDefaultTitle: "Новая задача",
    newNoteDefaultTitle: "Новая заметка",
    itemActionsLabel: "Действия",
    openItemLabel: "Открыть",
    completeAndStopRepeatLabel: "Завершить и прекратить повторение",
    moveItemPickDateLabel: "Перенести на дату...",
    changeDateModalTitle: "Изменить дату",
    changeDateModalDescription: "Дата в формате {{format}}",
    changeDateModalSubmitLabel: "Перенести",
    invalidDateError: "Введите корректную дату в формате {{format}}.",

    taskRepeatNoneLabel: "Не повторять",
    taskRepeatDailyLabel: "Каждый день",
    taskRepeatWeeklyLabel: "Каждую неделю",
    taskRepeatMonthlyLabel: "Каждый месяц",
    taskRepeatYearlyLabel: "Каждый год",
    taskRepeatMetaLabel: "Повтор: {{repeat}}",
    createCalendarNoteFolderError:
      "Не удалось создать календарную заметку: папка {{path}} недоступна.",
    createCalendarTaskFolderError:
      "Не удалось создать задачу: папка {{path}} недоступна.",
    createCalendarNoteTemplateReadError:
      "Не удалось создать календарную заметку: не получилось найти или прочитать заметку-шаблон {{path}}.",
    createCalendarTaskTemplateReadError:
      "Не удалось создать календарную задачу: не получилось найти или прочитать заметку-шаблон {{path}}.",
    repeatAdvanceError: "Не удалось перенести повторяющуюся задачу на следующую дату.",
    repeatOccurrenceConflictError:
      "Не удалось создать следующее повторение задачи: {{path}} уже существует.",
    reconcileError:
      "Не удалось синхронизировать имя файла и дату для {{path}}. Имя файла и свойство date могут расходиться.",
    invalidDateFormatError:
      "Формат даты некорректен: он должен содержать год, месяц и день.",
  },
};

let supportedLanguages: string[] = [];

const strings: AppLocalization = { ...defaultStrings };

const getNavigatorLanguages = (): readonly string[] => {
  if (typeof navigator === "undefined") {
    return [];
  }

  if (navigator.languages?.length > 0) {
    return navigator.languages;
  }

  return navigator.language ? [navigator.language] : [];
};

const normalizeLocale = (locale: string): string => locale.replace("_", "-");

const getLanguageCode = (locale: string): string | undefined => {
  const localeSeparatorIndex = locale.indexOf("-");

  return localeSeparatorIndex === -1 ? undefined : locale.substring(0, localeSeparatorIndex);
};

const getSupportedLanguages = (locales: readonly string[]): string[] => {
  const languages: string[] = [];

  for (const locale of locales) {
    const normalizedLocale = normalizeLocale(locale);
    languages.push(normalizedLocale);

    const languageCode = getLanguageCode(normalizedLocale);

    if (languageCode) {
      languages.push(languageCode);
    }
  }

  return languages;
};

const findLocalization = (languages: readonly string[]): Partial<AppLocalization> => {
  for (const language of languages) {
    const localization = localizations[language];

    if (localization) {
      return localization;
    }
  }

  return {};
};

const applyLocalization = (localization: Partial<AppLocalization>) => {
  Object.assign(strings, defaultStrings, localization);
};

export const setLocale = (supportedLocales: readonly string[] | string) => {
  const locales = typeof supportedLocales === "string" ? [supportedLocales] : supportedLocales;
  const languages = getSupportedLanguages(locales);

  supportedLanguages = languages;
  applyLocalization(findLocalization(languages));
};

setLocale(getNavigatorLanguages());

export const getLocales = (): string[] => {
  return [...supportedLanguages];
};

export const formatLocalizedString = (
  template: string,
  values: Record<string, string | number>,
): string => {
  return template.replace(PLACEHOLDER_PATTERN, (match, key: string) => {
    const value = values[key];

    return value === undefined ? match : String(value);
  });
};

export const getRepeatLabel = (frequency: RepeatFrequency): string => {
  if (frequency === "daily") {
    return strings.taskRepeatDailyLabel;
  }

  if (frequency === "weekly") {
    return strings.taskRepeatWeeklyLabel;
  }

  if (frequency === "monthly") {
    return strings.taskRepeatMonthlyLabel;
  }

  return strings.taskRepeatYearlyLabel;
};

export default strings;
