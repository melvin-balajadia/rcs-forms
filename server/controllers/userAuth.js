import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import Users from "../Models/Users.js";
import { rolesFingerprint } from "../utilities/session.js";
import {
  lockRemainingMs,
  recordFailure,
  recordSuccess,
} from "../utilities/loginThrottle.js";
import {
  isStrongPassword,
  PASSWORD_RULE_MESSAGE,
} from "../utilities/passwordPolicy.js";

// Reset tokens are signed with a key derived from ACCESS_TOKEN_SECRET so they
// can never be accepted as access tokens, and no new env variable is needed.
const resetTokenSecret = () =>
  crypto
    .createHmac("sha256", process.env.ACCESS_TOKEN_SECRET)
    .update("password-reset")
    .digest("hex");

// Ties a reset token to the current password hash, so the token stops working
// once the password changes (single use, and invalidated by an admin re-reset).
const passwordFingerprint = (passwordHash) =>
  crypto.createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);

// The database stores only a SHA-256 of each refresh token, so a leaked
// database or backup holds nothing that can be used to log in
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const ACCESS_TOKEN_TTL = "15m";

// Compared against when the username doesn't exist, so a wrong username takes
// as long to answer as a wrong password and response times reveal nothing
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

// Same answer whether the username exists, is archived, or the password is wrong
const INVALID_LOGIN = {
  errorStatus: true,
  message: "Invalid username or password",
};

export const login = async (req, res) => {
  const { user_username, user_password } = req.body;

  if (!user_username || !user_password) {
    return res.json({
      errorStatus: true,
      message: "Enter your username and password",
    });
  }

  const lockedMs = lockRemainingMs(user_username);
  if (lockedMs > 0) {
    const minutes = Math.ceil(lockedMs / 60000);
    return res.status(429).json({
      errorStatus: true,
      message: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    });
  }

  try {
    const user = await Users.scope("withSecrets").findOne({
      where: { user_username },
    });

    // Archived accounts are treated as if they don't exist
    const account = user && !user.user_archivestatus ? user : null;
    const match = await bcrypt.compare(
      user_password,
      account ? account.user_password : DUMMY_HASH,
    );
    if (!account || !match) {
      recordFailure(user_username);
      return res.json(INVALID_LOGIN);
    }

    recordSuccess(user_username);

    if (!user.user_reset_token) {
      const resetToken = jwt.sign(
        { sub: user.id, pwd: passwordFingerprint(user.user_password) },
        resetTokenSecret(),
        { expiresIn: "15m" },
      );

      return res.json({
        errorStatus: false,
        requiresReset: true,
        resetToken,
        message: "Password reset required",
      });
    }

    const userId = user.id;
    const userSite = user.user_site;
    const userFullname = `${user.user_firstname} ${user.user_lastname}`;
    const userEmail = user.user_email;
    const userContact = user.user_contact;
    const userDepartment = user.user_department;
    const userGroups = user.user_groups;

    const accessToken = jwt.sign(
      { user_name: user.user_username, grp: rolesFingerprint(user) },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: ACCESS_TOKEN_TTL },
    );

    const refreshToken = jwt.sign(
      { user_name: user.user_username },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "1d" },
    );

    await user.update({ user_refreshtoken: hashToken(refreshToken) });

    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: "None",
      secure: true,
    });

    res.json({
      errorStatus: false,
      userId,
      userSite,
      userFullname,
      userEmail,
      userContact,
      userDepartment,
      userGroups,
      accessToken,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({
      errorStatus: true,
      message: "Unable to process your request. Contact your administrator.",
    });
  }
};

export const refreshToken = async (req, res) => {
  const cookies = req.cookies;
  if (!cookies?.jwt) {
    return res.status(200).json({
      accessToken: null,
      user: null,
    });
  }

  const refreshToken = cookies.jwt;

  try {
    const user = await Users.findOne({
      where: { user_refreshtoken: hashToken(refreshToken) },
    });
    // Archived accounts, and accounts with a pending password reset, must log
    // in again (login sends a pending reset to the reset page)
    if (!user || user.user_archivestatus || !user.user_reset_token)
      return res.sendStatus(403);

    jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      (err, decoded) => {
        if (err || user.user_username !== decoded.user_name) {
          return res.sendStatus(403);
        }

        const accessToken = jwt.sign(
          {
            sub: user.id,
            user_name: user.user_username,
            grp: rolesFingerprint(user),
          },
          process.env.ACCESS_TOKEN_SECRET,
          { expiresIn: ACCESS_TOKEN_TTL },
        );

        res.json({
          accessToken,
          user: {
            id: user.id,
            username: user.user_username,
            fullname: `${user.user_firstname} ${user.user_lastname}`,
            email: user.user_email,
            site: user.user_site,
            contact: user.user_contact,
            department: user.user_department,
            user_groups: user.user_groups,
          },
        });
      },
    );
  } catch (err) {
    console.error("Refresh token error:", err);
    res.status(500).json({ message: "Unable to refresh token" });
  }
};

export const logout = async (req, res) => {
  const cookies = req.cookies;
  if (!cookies?.jwt) return res.sendStatus(204); // No content, already logged out

  const refreshToken = cookies.jwt;

  try {
    const user = await Users.findOne({
      where: { user_refreshtoken: hashToken(refreshToken) },
    });

    if (!user) {
      res.clearCookie("jwt", {
        httpOnly: true,
        sameSite: "None",
        secure: true,
      });
      return res.sendStatus(204); // No content
    }

    await user.update({ user_refreshtoken: null });

    res.clearCookie("jwt", {
      httpOnly: true,
      sameSite: "None",
      secure: true,
    });

    return res.sendStatus(204); // No content
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({
      errorStatus: true,
      message: "Unable to logout",
    });
  }
};

export const resetPassword = async (req, res) => {
  const { resetToken, newPassword, confirmPassword } = req.body;

  if (!resetToken || !newPassword || !confirmPassword) {
    return res.json({ errorStatus: true, message: "All fields are required" });
  }

  if (newPassword !== confirmPassword) {
    return res.json({ errorStatus: true, message: "Passwords do not match" });
  }

  if (!isStrongPassword(newPassword)) {
    return res.json({ errorStatus: true, message: PASSWORD_RULE_MESSAGE });
  }

  const invalidLink = {
    errorStatus: true,
    message: "Your reset session has expired. Please log in again.",
  };

  let payload;
  try {
    payload = jwt.verify(resetToken, resetTokenSecret());
  } catch {
    return res.json(invalidLink);
  }

  try {
    const user = await Users.scope("withSecrets").findByPk(payload.sub);

    // Only accounts still flagged for reset, with an unchanged password hash
    if (
      !user ||
      user.user_reset_token ||
      payload.pwd !== passwordFingerprint(user.user_password)
    ) {
      return res.json(invalidLink);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await user.update({
      user_password: hashedPassword,
      user_reset_token: true, // ✅ flip to true — reset complete
    });

    res.json({ errorStatus: false, message: "Password updated successfully" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.json({
      errorStatus: true,
      message: "Unable to process your request. Contact your administrator.",
    });
  }
};
