import type { TaskTemplate } from "./taskTemplates";

export const TOUR_TEMPLATE_CATEGORY = "Tours";

export function isTourTemplate(template: Pick<TaskTemplate, "id" | "name" | "category" | "schoolTourImportTarget">) {
  const id = template.id.toLowerCase();
  const name = template.name.toLowerCase();
  const category = template.category?.toLowerCase() || "";
  return (
    template.schoolTourImportTarget === true ||
    category === TOUR_TEMPLATE_CATEGORY.toLowerCase() ||
    category.includes("tour") ||
    id.includes("tour") ||
    name.includes("tour")
  );
}
