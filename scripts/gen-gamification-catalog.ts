// pnpm gamification:catalog: writes the leagues and achievements catalog migration.
import { writeFileSync } from "node:fs";

import { CATALOG_MIGRATION, catalogSql } from "@/features/gamification/catalog-sql";

writeFileSync(CATALOG_MIGRATION, catalogSql());
console.log(`wrote ${CATALOG_MIGRATION}`);
