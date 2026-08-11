import type { TaskList } from "../core/types";
import type { Task } from "./item";

function compareTitles(first: Task, second: Task): number {
  return first.title.localeCompare(second.title, undefined, { numeric: true });
}

function compareDates(first: Task, second: Task): number {
  if (first.dateId && second.dateId) {
    return first.dateId.localeCompare(second.dateId) || compareTitles(first, second);
  }

  if (first.dateId) {
    return -1;
  }

  if (second.dateId) {
    return 1;
  }

  return compareTitles(first, second);
}

export function orderTasks(taskList: TaskList, tasks: Task[]): Task[] {
  const ordered = [...tasks];

  switch (taskList.order) {
    case "title-asc":
      return ordered.sort(compareTitles);
    case "title-desc":
      return ordered.sort((first, second) => compareTitles(second, first));
    case "date-asc":
      return ordered.sort(compareDates);
    case "date-desc":
      return ordered.sort((first, second) => {
        if (!first.dateId || !second.dateId) {
          return compareDates(first, second);
        }

        return second.dateId.localeCompare(first.dateId) || compareTitles(first, second);
      });
    case "manual": {
      const positions = new Map(taskList.manualOrder.map((path, index) => [path, index]));

      return ordered.sort((first, second) => {
        const firstPosition = positions.get(first.file.path);
        const secondPosition = positions.get(second.file.path);

        if (firstPosition === undefined && secondPosition === undefined) {
          return compareTitles(first, second);
        }

        if (firstPosition === undefined) {
          return 1;
        }

        if (secondPosition === undefined) {
          return -1;
        }

        return firstPosition - secondPosition;
      });
    }
  }
}

export function initializeManualOrder(taskList: TaskList, tasks: Task[]): string[] {
  const orderedPaths = orderTasks(taskList, tasks).map((task) => task.file.path);

  if (taskList.manualOrder.length === 0) {
    return orderedPaths;
  }

  const knownPaths = new Set(taskList.manualOrder);

  return [
    ...taskList.manualOrder,
    ...orderedPaths.filter((path) => !knownPaths.has(path)),
  ];
}
