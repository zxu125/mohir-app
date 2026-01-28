import UserRoles from "../core/UserRoles.js";
import { verifyAccess } from "../helpers/tokens.js";
import prisma from "../prismacl.js";

async function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ message: "No token" });
  let payload;
  try {
    payload = verifyAccess(token);
  } catch {
    return res.status(401).json({ message: "Invalid/expired token" });
  }
  try {
    const user: any = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        regions: true, id: true, name: true, username: true, isActive: true, roleId: true
      }
    });
    // return res.json(user)
    if (!user || !user.isActive)
      return res.status(401).json({ message: "User not found or inactive" });
    let { path, url, baseUrl, originalUrl } = req
    user.role = UserRoles.find((role) => role.id === user.roleId);
    if (user.role.id != 1) {
      let routes = Object.keys(user.role.routes).map(r => {
        return Object.keys(user.role.routes[r]).map(r2 => '/' + r + '/' + user.role.routes[r][r2])
      }).reduce((p, c) => { return p.concat(c) }, [])
      if (!routes.includes(originalUrl.split('?')[0])) return res.status(401).json({ message: "Permission denied" });
    }
    if (user.role)
      req.user = user;

    next();
  } catch (e) {
    return res.status(401).json({ message: "User not found" });
  }
}

export { auth };
