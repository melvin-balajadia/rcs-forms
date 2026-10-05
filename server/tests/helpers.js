import jwt from "jsonwebtoken";
import supertest from "supertest";
import app from "../app.js";
import sequelize from "../utilities/db.js";
import Users from "../Models/Users.js";
import Forms from "../Models/Forms.js";
import FormApprovers from "../Models/FormApprovers.js";

export const api = supertest(app);

export const ROLES = ["requestor", "approver", "qfd_admin", "all_access"];

export const resetDb = () => sequelize.sync({ force: true });

let counter = 0;
export const createUser = async (role, overrides = {}) => {
  counter += 1;
  return Users.create({
    user_firstname: role,
    user_lastname: `User${counter}`,
    user_email: `${role}${counter}@test.local`,
    user_username: `${role}${counter}`,
    user_password: "not-used-in-tests",
    user_groups: [role],
    user_reset_token: true,
    ...overrides,
  });
};

export const tokenFor = (user) =>
  jwt.sign({ user_name: user.user_username }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "5m",
  });

export const authHeader = (user) => ({
  Authorization: `Bearer ${tokenFor(user)}`,
});

// One user per role, keyed by role name
export const createRoleUsers = async () => {
  const users = {};
  for (const role of ROLES) users[role] = await createUser(role);
  return users;
};

export const createForm = (overrides = {}) =>
  Forms.create({ form_name: "Test Form", ...overrides });

export const assignApprover = (form, user, level) =>
  FormApprovers.create({
    form_id: form.id,
    user_id: user.id,
    approval_level: level,
    is_active: true,
  });
