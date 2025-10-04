import fs from 'fs';
import path from 'path';

import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const header = `// GENERATED FILE — DO NOT EDIT MANUALLY

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

`;

const modelsDir = path.join(__dirname, 'models');
const outputFile = path.join(__dirname, 'schema.prisma');

const parts = fs
  .readdirSync(modelsDir)
  .filter(f => f.endsWith('.prisma'))
  .map(f => fs.readFileSync(path.join(modelsDir, f), 'utf8'));

fs.writeFileSync(outputFile, header + parts.join('\n\n'));

console.log('✅ schema.prisma успешно собрано.');
