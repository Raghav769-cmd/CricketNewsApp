import { Router, type Request, type Response } from 'express';
import pool from '../db/connection.js';
import bcrypt from 'bcryptjs';
import { generateToken, verifyToken, isSuperadmin } from '../middleware/auth.ts';

const router: Router = Router();

router.post('/register', async (req: Request, res: Response) => {
  const { email, password, role = 'user', name, username } = req.body;

  try {
    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Email, password, and username are required' });
    }

    if (!['superadmin', 'admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Role must be superadmin, admin, or user' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const usernameExists = await pool.query(
      'SELECT username FROM admins WHERE username = $1 UNION SELECT username FROM regular_users WHERE username = $1',
      [username]
    );

    if (usernameExists.rows.length > 0) {
      return res.status(409).json({ error: 'Username is already taken. Please choose a different username.' });
    }

    if (role === 'superadmin' || role === 'admin') {
      const existingRequest = await pool.query(
        'SELECT * FROM admin_requests WHERE email = $1 OR username = $2',
        [email, username]
      );

      if (existingRequest.rows.length > 0) {
        return res.status(409).json({ error: 'Admin request already exists for this email or username' });
      }

      const result = await pool.query(
        'INSERT INTO admin_requests (email, password, name, username, status, requested_by_email, role) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, email, username, name, status, created_at, role',
        [email, hashedPassword, name || null, username, 'pending', email, role]
      );

      const request = result.rows[0];

      return res.status(201).json({
        message: `${role === 'superadmin' ? 'Superadmin' : 'Admin'} request submitted for approval. An existing superadmin must approve your request.`,
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

    const existingUser = await pool.query(
      'SELECT * FROM regular_users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User with this email or username already exists' });
    }

    const result = await pool.query(
      'INSERT INTO regular_users (email, password, name, username) VALUES ($1, $2, $3, $4) RETURNING id, email, username, name',
      [email, hashedPassword, name || null, username]
    );

    const user = result.rows[0];
    const token = generateToken(user.id, user.email, role as 'superadmin' | 'admin' | 'user');

    res.status(201).json({
      message: 'User registered successfully',
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
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    let user = null;
    let role: 'superadmin' | 'admin' | 'user' = 'user';

    const adminResult = await pool.query(
      'SELECT id, email, password, name, username, role FROM admins WHERE email = $1',
      [email]
    );

    if (adminResult.rows.length > 0) {
      user = adminResult.rows[0];
      role = user.role as 'superadmin' | 'admin' | 'user'; 
    } else {
      const userResult = await pool.query(
        'SELECT id, email, password, name, username FROM regular_users WHERE email = $1',
        [email]
      );

      if (userResult.rows.length > 0) {
        user = userResult.rows[0];
        role = 'user';
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user.id, user.email, role);

    res.json({
      message: 'Login successful',
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
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

router.get('/me', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    let dbUser = null;
    if (user.role === 'admin' || user.role === 'superadmin') {
      const adminResult = await pool.query(
        'SELECT id, email, username, name, role FROM admins WHERE id = $1',
        [user.id]
      );
      dbUser = adminResult.rows[0];
    } else {
      const userResult = await pool.query(
        'SELECT id, email, username, name FROM regular_users WHERE id = $1',
        [user.id]
      );
      dbUser = userResult.rows[0];
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
    console.error('Error fetching user info:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/logout', verifyToken, (req: Request, res: Response) => {
  res.json({ message: 'Logout successful' });
});

router.get('/admin-requests/pending', verifyToken, async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmins can view pending requests' });
    }

    const result = await pool.query(
      'SELECT id, email, username, name, status, requested_by_email, created_at, role FROM admin_requests WHERE status = $1 ORDER BY created_at DESC',
      ['pending']
    );

    res.json({
      requests: result.rows,
    });
  } catch (err) {
    console.error('Error fetching admin requests:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/admin-requests/:id/approve', verifyToken, isSuperadmin, async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmins can approve requests' });
    }

    const requestId = req.params.id;

    const requestResult = await pool.query(
      'SELECT * FROM admin_requests WHERE id = $1 AND status = $2',
      [requestId, 'pending']
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found or already processed' });
    }

    const adminRequest = requestResult.rows[0];

    const existingAdmin = await pool.query(
      'SELECT * FROM admins WHERE email = $1 OR username = $2',
      [adminRequest.email, adminRequest.username]
    );

    if (existingAdmin.rows.length > 0) {
      return res.status(409).json({ error: 'Email or username already exists' });
    }

    const adminResult = await pool.query(
      'INSERT INTO admins (email, password, name, username, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, username, role',
      [adminRequest.email, adminRequest.password, adminRequest.name, adminRequest.username, adminRequest.role || 'admin']
    );

    const newAdmin = adminResult.rows[0];

    await pool.query(
      'UPDATE admin_requests SET status = $1, approved_by_admin_id = $2, approved_at = CURRENT_TIMESTAMP WHERE id = $3',
      ['approved', req.user?.id, requestId]
    );

    res.json({
      message: `${newAdmin.role === 'superadmin' ? 'Superadmin' : 'Admin'} request approved successfully`,
      admin: {
        id: newAdmin.id,
        email: newAdmin.email,
        username: newAdmin.username,
        name: newAdmin.name,
        role: newAdmin.role,
      },
    });
  } catch (err) {
    console.error('Error approving admin request:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/admin-requests/:id/reject', verifyToken, async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmins can reject requests' });
    }

    const requestId = req.params.id;
    const { reason } = req.body;

    const requestResult = await pool.query(
      'SELECT * FROM admin_requests WHERE id = $1 AND status = $2',
      [requestId, 'pending']
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found or already processed' });
    }

    await pool.query(
      'UPDATE admin_requests SET status = $1, approved_by_admin_id = $2, rejection_reason = $3, approved_at = CURRENT_TIMESTAMP WHERE id = $4',
      ['rejected', req.user?.id, reason || null, requestId]
    );

    res.json({
      message: 'Admin request rejected successfully',
    });
  } catch (err) {
    console.error('Error rejecting admin request:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
