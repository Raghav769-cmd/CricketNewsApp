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

    const adminExists = await prisma.admins.findFirst({
      where: { username },
      select: { username: true },
    });
    const userExists = await prisma.regular_users.findFirst({
      where: { username },
      select: { username: true },
    });

    if (adminExists || userExists) {
      return res
        .status(409)
        .json({
          error:
            "Username is already taken. Please choose a different username.",
        });
    }

    if (role === "superadmin" || role === "admin") {
      const existingRequest = await prisma.admin_requests.findFirst({
        where: {
          OR: [
            { email },
            { username },
          ],
        },
      });

      if (existingRequest) {
        return res
          .status(409)
          .json({
            error: "Admin request already exists for this email or username",
          });
      }

      const request = await prisma.admin_requests.create({
        data: {
          email,
          password: hashedPassword,
          name: name || null,
          username,
          status: "pending",
          requested_by_email: email,
          role,
        },
      });

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

    const existingUser = await prisma.regular_users.findFirst({
      where: {
        OR: [
          { email },
          { username },
        ],
      },
    });

    if (existingUser) {
      return res
        .status(409)
        .json({ error: "User with this email or username already exists" });
    }

    const user = await prisma.regular_users.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
        username,
      },
    });
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

    let user: any = null;
    let role: "superadmin" | "admin" | "user" = "user";

    const adminResult = await prisma.admins.findFirst({
      where: { email },
    });

    if (adminResult) {
      user = adminResult;
      role = (adminResult.role as "superadmin" | "admin") || "admin";
    } else {
      const userResult = await prisma.regular_users.findFirst({
        where: { email },
      });

      if (userResult) {
        user = userResult;
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

    let dbUser: any = null;
    if (user.role === "admin" || user.role === "superadmin") {
      dbUser = await prisma.admins.findFirst({
        where: { id: user.id },
        select: { id: true, email: true, username: true, name: true, role: true },
      });
    } else {
      dbUser = await prisma.regular_users.findFirst({
        where: { id: user.id },
        select: { id: true, email: true, username: true, name: true },
      });
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

      const result = await prisma.admin_requests.findMany({
        where: { status: "pending" },
        orderBy: { created_at: "desc" },
      });

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

      const adminRequest = await prisma.admin_requests.findFirst({
        where: {
          id: parseInt(requestId ?? "0"),
          status: "pending",
        },
      });

      if (!adminRequest) {
        return res
          .status(404)
          .json({ error: "Request not found or already processed" });
      }

      const existingAdmin = await prisma.admins.findFirst({
        where: {
          OR: [
            { email: adminRequest.email },
            { username: adminRequest.username },
          ],
        },
      });

      if (existingAdmin) {
        return res
          .status(409)
          .json({ error: "Email or username already exists" });
      }

      const newAdmin = await prisma.admins.create({
        data: {
          email: adminRequest.email,
          password: adminRequest.password,
          name: adminRequest.name || null,
          username: adminRequest.username,
          role: adminRequest.role || "admin",
        },
      });

      await prisma.admin_requests.update({
        where: { id: parseInt(requestId ?? "0") },
        data: {
          status: "approved",
        },
      });

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

      const adminRequest = await prisma.admin_requests.findFirst({
        where: {
          id: parseInt(requestId ?? "0"),
          status: "pending",
        },
      });

      if (!adminRequest) {
        return res
          .status(404)
          .json({ error: "Request not found or already processed" });
      }

      await prisma.admin_requests.update({
        where: { id: parseInt(requestId ?? "0") },
        data: {
          status: "rejected",
        },
      });

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
