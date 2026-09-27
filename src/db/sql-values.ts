import { sql, type SQL } from "drizzle-orm";

export function textArray(values: string[]): SQL {
  const items = values.map((value) => sql`${value}`);
  return sql`ARRAY[${sql.join(items, sql`, `)}]::text[]`;
}
