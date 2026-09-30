export type Field = { key: string; label: string; type: "text" | "number" };
export type Lead = { id: number } & Record<string, string | number>;
export type Filter = { field: string; operator: string; value: string; valueTo?: string };
export const textOperators = ["contains", "equals", "starts_with", "not_equals", "is_empty", "is_not_empty"];
export const numberOperators = ["equals", "gt", "lt", "between", "is_empty", "is_not_empty"];
export const operatorLabels: Record<string, string> = { contains: "contains", equals: "is", starts_with: "starts with", not_equals: "is not", is_empty: "is empty", is_not_empty: "is not empty", gt: "greater than", lt: "less than", between: "between" };
