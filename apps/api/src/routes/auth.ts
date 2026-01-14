import { Router, type Request, type Response } from "express";
import { prisma } from "../db/connection.js";
import bcrypt from "bcryptjs";
import {
  generateToken,
  verifyToken,
  isSuperadmin,
} from "../middleware/auth.ts";

const router: Router = Router();

router.post("/register", async (req: Request, res: Response) => {
  const { email, password, role = "user", name, username } = req.body;

  try {
    if (!email || !password || !username) {
      return res
        .status(400)
        .json({ error: "Email, password, and username are required" });
    }

    if (!["superadmin", "admin", "user"].includes(role)) {
      return res
        .status(400)
        .json({ error: "Role must be superadmin, admin, or user" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters long" });
    }

    if (username.length < 3) {
      return res
        .status(400)
        .json({ error: "Username must be at least 3 characters long" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const usernameExists = await prisma.$queryRaw<{ username: string }[]>`
  SELECT username FROM admins WHERE username = ${username}
  UNION
  SELECT username FROM regular_users WHERE username = ${username}
`;

    if (usernameExists.length > 0) {
      return res
        .status(409)
        .json({
          error:
            "Username is already taken. Please choose a different username.",
        });
    }

    if (role === "superadmin" || role === "admin") {
      const existingRequest = await prisma.$queryRaw<any[]>`
        SELECT * FROM admin_requests WHERE email = ${email} OR username = ${username}
      `;

      if (existingRequest.length > 0) {
        return res
          .status(409)
          .json({
            error: "Admin request already exists for this email or username",
          });
      }

      const result = await prisma.$queryRaw<any[]>`
        INSERT INTO admin_requests (email, password, name, username, status, requested_by_email, role)
        VALUES (${email}, ${hashedPassword}, ${name || null}, ${username}, ${"pending"}, ${email}, ${role})
        RETURNING id, email, username, name, status, created_at, role
      `;

      const request = result[0];

      return res.status(201).json({
        message: `${role === "superadmin" ? "Superadmin" : "Admin"} request submitted for approval. An existing superadmin must approve your request.`,
        data: {
          id: request.id,
          email: request.email,
          username: request.username,
          name: request.name,
          role: request.role,
          status: request.status,
          created_at: request.created_at,
        },
      });
    }

    const existingUser = await prisma.$queryRaw<any[]>`
      SELECT * FROM regular_users WHERE email = ${email} OR username = ${username}
    `;

    if (existingUser.length > 0) {
      return res
        .status(409)
        .json({ error: "User with this email or username already exists" });
    }

    const result = await prisma.$queryRaw<any[]>`
      INSERT INTO regular_users (email, password, name, username)
      VALUES (${email}, ${hashedPassword}, ${name || null}, ${username})
      RETURNING id, email, username, name
    `;

    const user = result[0];
    const token = generateToken(
      user.id,
      user.email,
      role as "superadmin" | "admin" | "user"
    );

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: role,
        name: user.name,
      },
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Server error during registration" });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    let user = null;
    let role: "superadmin" | "admin" | "user" = "user";

    const adminResult = await prisma.$queryRaw<any[]>`
      SELECT id, email, password, name, username, role FROM admins WHERE email = ${email}
    `;

    if (adminResult.length > 0) {
      user = adminResult[0];
      role = user.role as "superadmin" | "admin" | "user";
    } else {
      const userResult = await prisma.$queryRaw<any[]>`
        SELECT id, email, password, name, username FROM regular_users WHERE email = ${email}
      `;

      if (userResult.length > 0) {
        user = userResult[0];
        role = "user";
      }
    }

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = generateToken(user.id, user.email, role);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: role,
        name: user.name,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});

router.get("/me", verifyToken, async (req: Request, res: Response) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let dbUser = null;
    if (user.role === "admin" || user.role === "superadmin") {
      const adminResult = await prisma.$queryRaw<any[]>`
        SELECT id, email, username, name, role FROM admins WHERE id = ${user.id}
      `;
      dbUser = adminResult[0];
    } else {
      const userResult = await prisma.$queryRaw<any[]>`
        SELECT id, email, username, name FROM regular_users WHERE id = ${user.id}
      `;
      dbUser = userResult[0];
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: dbUser?.username,
        role: user.role,
        name: dbUser?.name,
      },
    });
  } catch (err) {
    console.error("Error fetching user info:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/logout", verifyToken, (req: Request, res: Response) => {
  res.json({ message: "Logout successful" });
});

router.get(
  "/admin-requests/pending",
  verifyToken,
  async (req: Request, res: Response) => {
    try {
      if (req.user?.role !== "superadmin") {
        return res
          .status(403)
          .json({ error: "Only superadmins can view pending requests" });
      }

      const result = await prisma.$queryRaw<any[]>`
        SELECT id, email, username, name, status, requested_by_email, created_at, role
        FROM admin_requests WHERE status = ${"pending"} ORDER BY created_at DESC
      `;

      res.json({
        requests: result,
      });
    } catch (err) {
      console.error("Error fetching admin requests:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

router.post(
  "/admin-requests/:id/approve",
  verifyToken,
  isSuperadmin,
  async (req: Request, res: Response) => {
    try {
      if (req.user?.role !== "superadmin") {
        return res
          .status(403)
          .json({ error: "Only superadmins can approve requests" });
      }

      const requestId = req.params.id;

      const requestResult = await prisma.$queryRaw<any[]>`
        SELECT * FROM admin_requests WHERE id = ${requestId} AND status = ${"pending"}
      `;

      if (requestResult.length === 0) {
        return res
          .status(404)
          .json({ error: "Request not found or already processed" });
      }
      const adminRequest = requestResult[0];

      const existingAdmin = await prisma.$queryRaw<any[]>`
        SELECT * FROM admins WHERE email = ${adminRequest.email} OR username = ${adminRequest.username}
      `;

      if (existingAdmin.length > 0) {
        return res
          .status(409)
          .json({ error: "Email or username already exists" });
      }
      const adminResult = await prisma.$queryRaw<any[]>`
        INSERT INTO admins (email, password, name, username, role)
        VALUES (${adminRequest.email}, ${adminRequest.password}, ${adminRequest.name}, ${adminRequest.username}, ${adminRequest.role || "admin"})
        RETURNING id, email, name, username, role
      `;

      const newAdmin = adminResult[0];

      await prisma.$queryRaw`
        UPDATE admin_requests SET status = ${"approved"}, approved_by_admin_id = ${req.user?.id}, approved_at = CURRENT_TIMESTAMP WHERE id = ${requestId}
      `;

      res.json({
        message: `${newAdmin.role === "superadmin" ? "Superadmin" : "Admin"} request approved successfully`,
        admin: {
          id: newAdmin.id,
          email: newAdmin.email,
          username: newAdmin.username,
          name: newAdmin.name,
          role: newAdmin.role,
        },
      });
    } catch (err) {
      console.error("Error approving admin request:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

router.post(
  "/admin-requests/:id/reject",
  verifyToken,
  async (req: Request, res: Response) => {
    try {
      if (req.user?.role !== "superadmin") {
        return res
          .status(403)
          .json({ error: "Only superadmins can reject requests" });
      }

      const requestId = req.params.id;
      const { reason } = req.body;

      const requestResult = await prisma.$queryRaw<any[]>`
        SELECT * FROM admin_requests WHERE id = ${requestId} AND status = ${"pending"}
      `;

      if (requestResult.length === 0) {
        return res
          .status(404)
          .json({ error: "Request not found or already processed" });
      }

      await prisma.$queryRaw`
        UPDATE admin_requests SET status = ${"rejected"}, approved_by_admin_id = ${req.user?.id}, rejection_reason = ${reason || null}, approved_at = CURRENT_TIMESTAMP WHERE id = ${requestId}
      `;

      res.json({
        message: "Admin request rejected successfully",
      });
    } catch (err) {
      console.error("Error rejecting admin request:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

export default router;
