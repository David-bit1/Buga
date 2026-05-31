const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {
  selectOne,
  insertOne
} = require('../services/supabaseRepository');

const DEFAULT_AVATAR = { key: 'neon', themeColor: '#8a4dff' };

const createToken = (user) =>
  jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role || 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role || 'user',
  createdAt: user.created_at || user.createdAt
});

const createDefaultProfile = async (userId) =>
  insertOne('profiles', {
    user_id: userId,
    name: 'Perfil 1',
    avatar: DEFAULT_AVATAR.key,
    theme_color: DEFAULT_AVATAR.themeColor,
    is_kids: false,
    is_default: true
  });

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Completa todos los campos' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await selectOne('users', {
      filters: [{ type: 'eq', column: 'email', value: normalizedEmail }]
    });

    if (existingUser) {
      return res.status(409).json({ message: 'Ya existe una cuenta con ese email' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const adminEmails = String(process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    const role = adminEmails.includes(normalizedEmail) ? 'admin' : 'user';

    const user = await insertOne('users', {
      name: String(name).trim(),
      email: normalizedEmail,
      password_hash: hashedPassword,
      role
    });

    await createDefaultProfile(user.id);

    const token = createToken(user);
    return res.status(201).json({
      message: 'Cuenta creada correctamente',
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Completa email y contraseña' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await selectOne('users', {
      filters: [{ type: 'eq', column: 'email', value: normalizedEmail }]
    });

    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash || '');
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const token = createToken(user);
    return res.json({
      message: 'Inicio de sesión exitoso',
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    return next(error);
  }
};

const me = async (req, res, next) => {
  try {
    const user = await selectOne('users', {
      filters: [{ type: 'eq', column: 'id', value: req.user.id }]
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  register,
  login,
  me
};
