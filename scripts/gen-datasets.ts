// pnpm datasets: writes the synthetic sample datasets to public/datasets/<id>.csv.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { DATASET_IDS, generateDataset } from "@/lib/datasets/generate";

const dir = path.join("public", "datasets");
mkdirSync(dir, { recursive: true });
for (const id of DATASET_IDS) {
  writeFileSync(path.join(dir, `${id}.csv`), generateDataset(id));
  console.log(`wrote ${dir}/${id}.csv`);
}
