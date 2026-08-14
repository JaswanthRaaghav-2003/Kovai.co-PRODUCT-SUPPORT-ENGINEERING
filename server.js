require('dotenv').config({ quiet: true });

const path = require('path');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const Database = require('better-sqlite3');

const PORT = process.env.PORT || 3000;
const VALID_STATUSES = ['Planned', 'In Progress', 'Complete'];

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------

const db = new Database(path.join(__dirname, 'database', 'taskflow.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    google_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    photo TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Planned',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const statements = {
  findUserByGoogleId: db.prepare('SELECT * FROM users WHERE google_id = ?'),
  findUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
  insertUser: db.prepare(
    'INSERT INTO users (id, google_id, name, email, photo) VALUES (?, ?, ?, ?, ?)'
  ),
  listTasksForUser: db.prepare(
    'SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC, id DESC'
  ),
  insertTask: db.prepare(
    "INSERT INTO tasks (user_id, title, status) VALUES (?, ?, 'Planned')"
  ),
  findTaskById: db.prepare('SELECT * FROM tasks WHERE id = ?'),
  updateTaskStatus: db.prepare('UPDATE tasks SET status = ? WHERE id = ?'),
};

// ---------------------------------------------------------------------------
// Passport / Google OAuth setup
// ---------------------------------------------------------------------------

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser((id, done) => {
  const user = statements.findUserById.get(id);
  done(null, user || false);
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
    },
    (accessToken, refreshToken, profile, done) => {
      try {
        let user = statements.findUserByGoogleId.get(profile.id);

        if (!user) {
          const email = profile.emails && profile.emails[0] && profile.emails[0].value;
          const photo = profile.photos && profile.photos[0] && profile.photos[0].value;

          statements.insertUser.run(profile.id, profile.id, profile.displayName, email, photo);
          user = statements.findUserByGoogleId.get(profile.id);
        }

        done(null, user);
      } catch (err) {
        done(err);
      }
    }
  )
);

// ---------------------------------------------------------------------------
// Express app setup
// ---------------------------------------------------------------------------

const app = express();

app.set('trust proxy', 1);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => res.redirect('/')
);

app.get('/auth/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/');
  });
});

// ---------------------------------------------------------------------------
// User routes
// ---------------------------------------------------------------------------

app.get('/api/me', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });

  const { id, name, email, photo } = req.user;
  res.json({ id, name, email, photo });
});

// ---------------------------------------------------------------------------
// Task routes
// ---------------------------------------------------------------------------

app.get('/api/tasks', ensureAuthenticated, (req, res) => {
  const tasks = statements.listTasksForUser.all(req.user.id);
  res.json(tasks);
});

app.post('/api/tasks', ensureAuthenticated, (req, res) => {
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';

  if (!title) {
    return res.status(400).json({ error: 'Task title is required.' });
  }

  const result = statements.insertTask.run(req.user.id, title);
  const task = statements.findTaskById.get(result.lastInsertRowid);
  res.status(201).json(task);
});

app.patch('/api/tasks/:id/status', ensureAuthenticated, (req, res) => {
  const { status } = req.body;

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }

  const task = statements.findTaskById.get(req.params.id);

  if (!task) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  if (task.user_id !== req.user.id) {
    return res.status(403).json({ error: 'You do not have permission to modify this task.' });
  }

  statements.updateTaskStatus.run(status, task.id);
  res.json(statements.findTaskById.get(task.id));
});

// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`TaskFlow server running on http://localhost:${PORT}`);
});
