import jwt from "jsonwebtoken";
import Users from "../Models/Users.js";

// Verifies the access token and loads the caller into req.user, so handlers
// never need to trust a user id sent in the request body.
const verifyJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.sendStatus(401);
  const token = authHeader.split(" ")[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  } catch {
    return res.sendStatus(403); //invalid token
  }

  const user = await Users.findOne({
    where: { user_username: decoded.user_name },
  });

  // Token is valid but the account was removed or archived since it was issued
  if (!user || user.user_archivestatus) return res.sendStatus(401);

  req.user = user;
  req.user_name = user.user_username;
  next();
};

export default verifyJWT;
