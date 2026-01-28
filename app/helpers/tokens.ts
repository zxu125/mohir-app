import jwt from "jsonwebtoken";

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

export { signAccessToken, signRefreshToken, verifyAccess, verifyRefresh };
