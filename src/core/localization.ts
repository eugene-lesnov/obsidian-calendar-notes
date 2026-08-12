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
  notesFolderName: string;
  notesFolderLabel: string;
  notesFolderDescription: string;
  taskListsSectionLabel: string;
  addTaskListLabel: string;
  setupTaskListLabel: string;
  setupAndCreateTaskLabel: string;
  selectTaskListPlaceholder: string;
  taskListSetupTitle: string;
  taskListSetupDescription: string;
  taskListSetupAdvancedLabel: string;
  taskListSetupFolderDescription: string;
  taskListSetupFolderPlaceholder: string;
  taskListsEmptyDescription: string;
  newTaskListName: string;
  templatesFolderName: string;
  noteTemplateName: string;
  taskTemplateName: string;
  taskListNameLabel: string;
  taskListNameDescription: string;
  taskListColorLabel: string;
  taskListColorDescription: string;
  taskListActiveFolderLabel: string;
  taskListActiveFolderDescription: string;
  taskListCompletionLabel: string;
  taskListCompletionDescription: string;
  taskListKeepLabel: string;
  taskListMoveLabel: string;
  taskListCompletedFolderLabel: string;
  taskListCompletedFolderDescription: string;
  removeTaskListLabel: string;
  removeTaskListDescription: string;
  taskListIdError: string;
  taskListNameRequiredError: string;
  taskListFolderRequiredError: string;
  taskListFoldersConflictError: string;
  notesFolderRequiredError: string;
  folderMissingWarning: string;
  folderExistsStatus: string;
  taskListDuplicateNameWarning: string;
  taskListRequiredError: string;
  taskOrderLabel: string;
  taskOrderDescription: string;
  taskOrderTitleAscLabel: string;
  taskOrderTitleDescLabel: string;
  taskOrderDateAscLabel: string;
  taskOrderDateDescLabel: string;
  taskOrderManualLabel: string;
  moveTaskToTopLabel: string;
  moveTaskUpLabel: string;
  moveTaskDownLabel: string;
  moveTaskToBottomLabel: string;
  newNoteNameLabel: string;
  newNoteNameDescription: string;
  newTaskNameLabel: string;
  newTaskNameDescription: string;
  noteTemplateLabel: string;
  noteTemplateDescription: string;
  taskTemplateLabel: string;
  taskTemplateDescription: string;
  toggleAgendaCommandLabel: string;
  agendaRibbonLabel: string;
  createNoteTodayCommandLabel: string;
  createTaskTodayCommandLabel: string;
  reopenCurrentTaskCommandLabel: string;
  goToTodayCommandLabel: string;
  agendaViewTitle: string;
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
  setItemDateLabel: string;
  unscheduleTaskLabel: string;
  unscheduleRepeatConfirmTitle: string;
  unscheduleRepeatConfirmMessage: string;
  confirmLabel: string;
  cancelLabel: string;
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
  taskRepeatNextMetaLabel: string;
  taskRepeatTodayMetaLabel: string;
  taskRepeatOverdueMetaLabel: string;
  createAgendaNoteFolderError: string;
  createAgendaTaskFolderError: string;
  createAgendaNoteTemplateReadError: string;
  createAgendaTaskTemplateReadError: string;
  repeatAdvanceError: string;
  repeatOccurrenceConflictError: string;
  repeatRequiresDateError: string;
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
    "Vault Agenda items to update: {{items}}. Files to rename: {{renames}}.",
  dateFormatMigrationSample: "For example: {{from}} becomes {{to}}.",
  dateFormatMigrationConfirmLabel: "Change format",
  dateFormatMigrationCancelLabel: "Cancel",
  dateFormatMigrationDone:
    "Date format changed. Vault Agenda items updated: {{items}}.",
  dateFormatMigrationFailed:
    "Failed to update {{count}} Vault Agenda items. They keep the old format and may be unavailable in Vault Agenda until fixed.",
  weekStartLabel: "Week starts on",
  notesFolderName: "Notes",
  notesFolderLabel: "Notes folder",
  notesFolderDescription: "Folder where Vault Agenda notes are stored. Subfolders are included.",
  taskListsSectionLabel: "Task lists",
  addTaskListLabel: "Add task list",
  setupTaskListLabel: "Set up task list",
  setupAndCreateTaskLabel: "Save and create task",
  selectTaskListPlaceholder: "Choose a task list",
  taskListSetupTitle: "Set up task list",
  taskListSetupDescription: "Configure how this task list stores and handles its files",
  taskListSetupAdvancedLabel: "Additional options",
  taskListSetupFolderDescription:
    "Select an existing folder or enter a path to create when the first task is added.",
  taskListSetupFolderPlaceholder: "Select or enter a folder name",
  taskListsEmptyDescription: "Choose where active task files are stored to start using tasks.",
  newTaskListName: "Task List {{index}}",
  templatesFolderName: "Templates",
  noteTemplateName: "Note",
  taskTemplateName: "Task",
  taskListNameLabel: "Name",
  taskListNameDescription: "Name shown in the Vault Agenda task lists section.",
  taskListColorLabel: "Color",
  taskListColorDescription: "Color marker for this list and its tasks.",
  taskListActiveFolderLabel: "Active folder",
  taskListActiveFolderDescription:
    "Active tasks are indexed in this folder and its subfolders. New tasks are created here.",
  taskListCompletionLabel: "Completion",
  taskListCompletionDescription: "Keep completed files here or move them to a separate folder.",
  taskListKeepLabel: "Keep file in place",
  taskListMoveLabel: "Move file to folder",
  taskListCompletedFolderLabel: "Completed folder",
  taskListCompletedFolderDescription:
    "Completed files are moved here while preserving their relative subfolder path.",
  removeTaskListLabel: "Remove task list",
  removeTaskListDescription: "Only the task list setting will be removed. Files will be kept.",
  taskListIdError: "Every task list must have a unique internal identifier.",
  taskListNameRequiredError: "Every task list must have a name.",
  taskListFolderRequiredError: "Task list {{name}} must have valid folders.",
  taskListFoldersConflictError: "Task list folders must not overlap.",
  notesFolderRequiredError: "Notes folder must not be empty.",
  folderMissingWarning: "Folder does not exist yet. It will be created when needed.",
  folderExistsStatus: "Folder found.",
  taskListDuplicateNameWarning: "Another task list has the same name.",
  taskListRequiredError: "Create a task list before creating or changing tasks.",
  taskOrderLabel: "Task order",
  taskOrderDescription: "Controls how tasks in this list are displayed.",
  taskOrderTitleAscLabel: "Name: A to Z",
  taskOrderTitleDescLabel: "Name: Z to A",
  taskOrderDateAscLabel: "Date: earliest first",
  taskOrderDateDescLabel: "Date: latest first",
  taskOrderManualLabel: "Manual",
  moveTaskToTopLabel: "Move to top",
  moveTaskUpLabel: "Move up",
  moveTaskDownLabel: "Move down",
  moveTaskToBottomLabel: "Move to bottom",
  newNoteNameLabel: "New note name",
  newNoteNameDescription:
    "The note's date is added as a prefix using the format selected in the settings.",
  newTaskNameLabel: "New task name",
  newTaskNameDescription:
    "Default file name for a new task. A numeric suffix is added if it already exists.",
  noteTemplateLabel: "New note template",
  noteTemplateDescription: "Path to the template used to create new notes.",
  taskTemplateLabel: "New task template",
  taskTemplateDescription: "Path to the template used to create new tasks in this list.",
  toggleAgendaCommandLabel: "Toggle Vault Agenda",
  agendaRibbonLabel: "Vault Agenda",
  createNoteTodayCommandLabel: "Create note for today",
  createTaskTodayCommandLabel: "Create task for today",
  reopenCurrentTaskCommandLabel: "Reopen current task",
  goToTodayCommandLabel: "Go to today",
  agendaViewTitle: "Vault Agenda",
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
  setItemDateLabel: "Set date...",
  unscheduleTaskLabel: "Remove date",
  unscheduleRepeatConfirmTitle: "Remove date and repeat",
  unscheduleRepeatConfirmMessage:
    "This task repeats. Removing its date will also remove the repeat rule.",
  confirmLabel: "Continue",
  cancelLabel: "Cancel",
  changeDateModalTitle: "Change date",
  changeDateModalDescription: "Date",
  changeDateModalSubmitLabel: "Save",
  invalidDateError: "Select a valid date.",

  taskRepeatNoneLabel: "Do not repeat",
  taskRepeatDailyLabel: "Every day",
  taskRepeatWeeklyLabel: "Every week",
  taskRepeatMonthlyLabel: "Every month",
  taskRepeatYearlyLabel: "Every year",
  taskRepeatMetaLabel: "Repeats: {{repeat}}",
  taskRepeatNextMetaLabel: "{{repeat}} · Next: {{date}}",
  taskRepeatTodayMetaLabel: "{{repeat}} · Today",
  taskRepeatOverdueMetaLabel: "{{repeat}} · Overdue: {{date}}",
  createAgendaNoteFolderError: "Cannot create a Vault Agenda note: folder {{path}} is not available.",
  createAgendaTaskFolderError: "Cannot create a task: folder {{path}} is not available.",
  createAgendaNoteTemplateReadError:
    "Cannot create a Vault Agenda note: failed to find or read template note {{path}}.",
  createAgendaTaskTemplateReadError:
    "Cannot create a Vault Agenda task: failed to find or read template note {{path}}.",
  repeatAdvanceError: "Failed to move the repeating task to its next date.",
  repeatOccurrenceConflictError:
    "Cannot create the next occurrence of the task: {{path}} already exists.",
  repeatRequiresDateError: "Set a task date before configuring repeat.",
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
      "Будет обновлено элементов Vault Agenda: {{items}}. Файлов будет переименовано: {{renames}}.",
    dateFormatMigrationSample: "Например: {{from}} станет {{to}}.",
    dateFormatMigrationConfirmLabel: "Сменить формат",
    dateFormatMigrationCancelLabel: "Отмена",
    dateFormatMigrationDone:
      "Формат даты изменен. Обновлено элементов Vault Agenda: {{items}}.",
    dateFormatMigrationFailed:
      "Не удалось обновить элементы Vault Agenda: {{count}}. Они остались в старом формате и могут быть недоступны в Vault Agenda, пока это не исправлено.",
    weekStartLabel: "Первый день недели",
    notesFolderName: "Заметки",
    notesFolderLabel: "Папка заметок",
    notesFolderDescription: "Папка для заметок Vault Agenda. Учитываются вложенные папки.",
    taskListsSectionLabel: "Списки задач",
    addTaskListLabel: "Добавить список задач",
    setupTaskListLabel: "Настроить список задач",
    setupAndCreateTaskLabel: "Сохранить и создать задачу",
    selectTaskListPlaceholder: "Выберите список задач",
    taskListSetupTitle: "Настройка списка задач",
    taskListSetupDescription: "Настройте хранение и обработку файлов этого списка задач",
    taskListSetupAdvancedLabel: "Дополнительные параметры",
    taskListSetupFolderDescription:
      "Выберите существующую папку или укажите путь, который будет создан вместе с первой задачей.",
    taskListSetupFolderPlaceholder: "Выберите или введите название папки",
    taskListsEmptyDescription:
      "Выберите папку для активных задач, чтобы начать работу со списками.",
    newTaskListName: "Список задач {{index}}",
    templatesFolderName: "Шаблоны",
    noteTemplateName: "Заметка",
    taskTemplateName: "Задача",
    taskListNameLabel: "Название",
    taskListNameDescription: "Название списка в блоке задач Vault Agenda.",
    taskListColorLabel: "Цвет",
    taskListColorDescription: "Цветовой маркер списка и его задач.",
    taskListActiveFolderLabel: "Папка активных задач",
    taskListActiveFolderDescription:
      "Активные задачи индексируются в этой папке и ее подпапках. Новые задачи создаются здесь.",
    taskListCompletionLabel: "Завершение",
    taskListCompletionDescription:
      "Оставлять завершенные файлы на месте или перемещать их в отдельную папку.",
    taskListKeepLabel: "Оставлять файл на месте",
    taskListMoveLabel: "Перемещать файл в папку",
    taskListCompletedFolderLabel: "Папка завершенных задач",
    taskListCompletedFolderDescription:
      "Завершенные файлы перемещаются сюда с сохранением относительного пути подпапок.",
    removeTaskListLabel: "Удалить список задач",
    removeTaskListDescription:
      "Будет удалена только настройка списка. Markdown-файлы останутся на месте.",
    taskListIdError: "У каждого списка задач должен быть уникальный внутренний идентификатор.",
    taskListNameRequiredError: "У каждого списка задач должно быть название.",
    taskListFolderRequiredError: "Для списка {{name}} должны быть указаны корректные папки.",
    taskListFoldersConflictError: "Папки списков задач не должны пересекаться.",
    notesFolderRequiredError: "Папка заметок не должна быть пустой.",
    folderMissingWarning: "Папка пока не существует. Она будет создана при необходимости.",
    folderExistsStatus: "Папка найдена.",
    taskListDuplicateNameWarning: "У другого списка задач такое же название.",
    taskListRequiredError: "Сначала создайте список задач.",
    taskOrderLabel: "Порядок задач",
    taskOrderDescription: "Определяет порядок отображения задач этого списка.",
    taskOrderTitleAscLabel: "Название: А → Я",
    taskOrderTitleDescLabel: "Название: Я → А",
    taskOrderDateAscLabel: "Дата: раньше → позже",
    taskOrderDateDescLabel: "Дата: позже → раньше",
    taskOrderManualLabel: "Вручную",
    moveTaskToTopLabel: "Переместить в начало",
    moveTaskUpLabel: "Переместить выше",
    moveTaskDownLabel: "Переместить ниже",
    moveTaskToBottomLabel: "Переместить в конец",
    newNoteNameLabel: "Название новой заметки",
    newNoteNameDescription:
      "К названию будет добавлен префикс с датой заметки в формате, выбранном в настройках.",
    newTaskNameLabel: "Название новой задачи",
    newTaskNameDescription:
      "Название файла новой задачи. При конфликте добавляется числовой суффикс.",
    noteTemplateLabel: "Шаблон новой заметки",
    noteTemplateDescription: "Путь к шаблону, по которому будут создаваться новые заметки.",
    taskTemplateLabel: "Шаблон новой задачи",
    taskTemplateDescription:
      "Путь к шаблону, по которому будут создаваться новые задачи этого списка.",
    toggleAgendaCommandLabel: "Открыть или закрыть Vault Agenda",
    createNoteTodayCommandLabel: "Создать заметку на сегодня",
    createTaskTodayCommandLabel: "Создать задачу на сегодня",
    reopenCurrentTaskCommandLabel: "Вернуть текущую задачу в активные",
    goToTodayCommandLabel: "Перейти к сегодняшнему дню",
    agendaViewTitle: "Vault Agenda",
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
    setItemDateLabel: "Назначить дату...",
    unscheduleTaskLabel: "Удалить дату",
    unscheduleRepeatConfirmTitle: "Удалить дату и повтор",
    unscheduleRepeatConfirmMessage:
      "Задача повторяется. Вместе с датой будет удалено правило повторения.",
    confirmLabel: "Продолжить",
    cancelLabel: "Отмена",
    changeDateModalTitle: "Назначить дату",
    changeDateModalDescription: "Дата",
    changeDateModalSubmitLabel: "Сохранить",
    invalidDateError: "Выберите корректную дату.",

    taskRepeatNoneLabel: "Не повторять",
    taskRepeatDailyLabel: "Каждый день",
    taskRepeatWeeklyLabel: "Каждую неделю",
    taskRepeatMonthlyLabel: "Каждый месяц",
    taskRepeatYearlyLabel: "Каждый год",
    taskRepeatMetaLabel: "Повтор: {{repeat}}",
    taskRepeatNextMetaLabel: "{{repeat}} · Следующее: {{date}}",
    taskRepeatTodayMetaLabel: "{{repeat}} · Сегодня",
    taskRepeatOverdueMetaLabel: "{{repeat}} · Просрочено: {{date}}",
    createAgendaNoteFolderError:
      "Не удалось создать заметку Vault Agenda: папка {{path}} недоступна.",
    createAgendaTaskFolderError:
      "Не удалось создать задачу: папка {{path}} недоступна.",
    createAgendaNoteTemplateReadError:
      "Не удалось создать заметку Vault Agenda: не получилось найти или прочитать заметку-шаблон {{path}}.",
    createAgendaTaskTemplateReadError:
      "Не удалось создать задачу Vault Agenda: не получилось найти или прочитать заметку-шаблон {{path}}.",
    repeatAdvanceError: "Не удалось перенести повторяющуюся задачу на следующую дату.",
    repeatOccurrenceConflictError:
      "Не удалось создать следующее повторение задачи: {{path}} уже существует.",
    repeatRequiresDateError: "Перед настройкой повтора назначьте задаче дату.",
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
