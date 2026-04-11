export default () => ({
  port: parseInt(process.env.PORT || '8000', 10),
  serverOrigin: process.env.SERVER_ORIGIN || 'http://localhost:8000',
  database: {
    // Use SQLite by default for local dev; set USE_SQLITE=false to use PostgreSQL (e.g. Supabase)
    useSqlite: process.env.USE_SQLITE !== 'false',
    sqlitePath: process.env.DATABASE_SQLITE_PATH || 'schedley.sqlite',
    // PostgreSQL: use DATABASE_URL (Supabase/Neon/etc.) or individual vars
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'schedley',
    // Set to 'true' for Supabase / hosted Postgres (SSL required)
    ssl: process.env.DATABASE_SSL || 'false',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl:
      process.env.GOOGLE_CALLBACK_URL ||
      'http://localhost:8000/api/auth/google/callback',
    calendarCallbackUrl:
      process.env.GOOGLE_CALENDAR_CALLBACK_URL ||
      'http://localhost:8000/api/integration/google/callback',
  },
  zoom: {
    clientId: process.env.ZOOM_CLIENT_ID,
    clientSecret: process.env.ZOOM_CLIENT_SECRET,
    callbackUrl:
      process.env.ZOOM_CALLBACK_URL ||
      'http://localhost:8000/api/integration/zoom/callback',
  },
  frontend: {
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM,
  },
  /** Inbox for contact form notifications (falls back to SMTP_USER if unset). */
  contact: {
    alertEmail: process.env.CONTACT_ALERT_EMAIL || process.env.SMTP_USER || '',
  },
});
