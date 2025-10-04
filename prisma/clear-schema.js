import fs from 'fs';
import path from 'path';
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const filePath = path.join(__dirname, 'schema.prisma');
if (fs.existsSync(filePath)) {
  fs.writeFileSync(filePath, '');
  console.log('✅ schema.prisma успешно очищен.');
}