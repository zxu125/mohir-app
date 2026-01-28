import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

let token = jwt.sign(
    { foo: 'bar' },
    'shhhhh', { expiresIn: '1h' }
);
let hash = await bcrypt.hash(token, 10)
console.log(crypto.randomUUID().toString());