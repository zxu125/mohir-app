import bcrypt from 'bcryptjs';

console.log(bcrypt.compareSync('1', '$2b$10$vzP2y8UlzLxOs1NPuEFNiu2OJ162B7pLBm3vBVuRseI77vs1psySq'))