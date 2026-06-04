const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {
  selectOne,
  insertOne
} = require('../services/supabaseRepository');

const DEFAULT_AVATAR = { key: 'neon', themeColor: '#8a4dff' };
const USER_SELECT = 'id, username, email, password, created_at';

const getRoleFromEmail = (email) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const adminEmails = String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return adminEmails.includes(normalizedEmail) ? 'admin' : 'user';
};

const createToken = (user) =>
  jwt.sign(
    { id: user.id, username: user.username, name: user.username, email: user.email, role: getRoleFromEmail(user.email) },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

const sanitizeUser = (user) => ({
  id: user.id,
  username: user.username,
  name: user.username,
  email: user.email,
  role: getRoleFromEmail(user.email),
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
    const { username, name, email, password } = req.body;
    const resolvedUsername = String(username || name || '').trim();

    if (!resolvedUsername || !email || !password) {
      return res.status(400).json({ message: 'Completa todos los campos' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await selectOne('users', {
      select: 'id, username, email',
      filters: [{ type: 'eq', column: 'email', value: normalizedEmail }]
    }) || await selectOne('users', {
      select: 'id, username, email',
      filters: [{ type: 'eq', column: 'username', value: resolvedUsername }]
    });

    if (existingUser) {
      return res.status(409).json({ message: 'Ya existe una cuenta con ese email' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await insertOne('users', {
      username: resolvedUsername,
      email: normalizedEmail,
      password: hashedPassword
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
      select: USER_SELECT,
      filters: [{ type: 'eq', column: 'email', value: normalizedEmail }]
    });

    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password || '');
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
      select: USER_SELECT,
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
