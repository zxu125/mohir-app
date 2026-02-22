import jwt from "jsonwebtoken";
import crypto from "crypto";
import querystring from "querystring"; 

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_TTL || "15m" }
  );
}

function signRefreshToken(user, tokenId) {
  return jwt.sign(
    { sub: user.id, tid: tokenId }, // tid = id записи refresh токена в БД
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_TTL || "30d" }
  );
}

function verifyAccess(token) {
  return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
}

function verifyRefresh(token) {
  return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
}

function verifyTelegramInitData(initData, botToken) {
  const p = new URLSearchParams(initData);

  const hash = p.get("hash");
  if (!hash) return false;

  // убираем только hash
  p.delete("hash");

  // data_check_string: отсортированные пары key=value, разделитель \n
  const dataCheckString = [...p.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  // ✅ secret_key = HMAC_SHA256(bot_token, "WebAppData")
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest(); // Buffer

  // ✅ hmac = HMAC_SHA256(data_check_string, secret_key)
  const hmac = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  return hmac === hash;
}

function parseInitData(initData) {
  const parsed:any = querystring.parse(initData);
  // user приходит JSON строкой
  const user = parsed.user ? JSON.parse(parsed.user) : null;
  const authDate = parsed.auth_date ? Number(parsed.auth_date) : null;
  const hash = parsed.hash;
  return { parsed, user, authDate, hash };
}


export { signAccessToken, signRefreshToken, verifyAccess, verifyRefresh, verifyTelegramInitData, parseInitData };
