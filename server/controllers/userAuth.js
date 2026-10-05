import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import Users from "../Models/Users.js";
import { rolesFingerprint } from "../utilities/session.js";

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

export const login = async (req, res) => {
  const { user_username, user_password } = req.body;

  if (!user_username || !user_password) {
    return res.json({
      errorStatus: true,
      message: "Enter your username and password",
    });
  }

  try {
    const user = await Users.scope("withSecrets").findOne({
      where: { user_username },
    });

    // Archived accounts are treated as if they don't exist
    if (!user || user.user_archivestatus) {
      return res.json({
        errorStatus: true,
        message: "Couldn't find your account",
      });
    }

    const match = await bcrypt.compare(user_password, user.user_password);
    if (!match) {
      return res.json({
        errorStatus: true,
        message: "Wrong password. Try again",
      });
    }

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
      { expiresIn: "5h" },
    );

    const refreshToken = jwt.sign(
      { user_name: user.user_username },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "1d" },
    );

    await user.update({ user_refreshtoken: refreshToken });

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
    res.json({
      ErrorMessage:
        "Unable to process your request. Contact your administrator.",
      Error: err.toString(),
      ErrorState: true,
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
      where: { user_refreshtoken: refreshToken },
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
          { expiresIn: "5h" },
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
    res.status(500).json({
      message: "Unable to refresh token",
      error: err.toString(),
    });
  }
};

export const logout = async (req, res) => {
  const cookies = req.cookies;
  if (!cookies?.jwt) return res.sendStatus(204); // No content, already logged out

  const refreshToken = cookies.jwt;

  try {
    const user = await Users.findOne({
      where: { user_refreshtoken: refreshToken },
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
    return res.status(500).json({
      errorStatus: true,
      message: "Unable to logout",
      error: err.message,
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

  const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^a-zA-Z0-9]).{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    return res.json({
      errorStatus: true,
      message:
        "Password must be at least 8 characters with an uppercase letter, number, and special character",
    });
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
