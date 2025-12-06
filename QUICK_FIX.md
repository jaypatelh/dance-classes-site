# Quick Fix for 404/500 Errors on Netlify

## The Problem
You're seeing:
- 404 error on `.netlify/functions/analytics/funnel`
- 500 error on analytics endpoint
- "Failed to fetch analytics data"

## The Solution (3 Steps)

### Step 1: Verify Environment Variables in Netlify

1. Go to Netlify Dashboard
2. Click your site
3. Go to **Site Settings** → **Environment Variables**
4. Make sure these exist:

```
SUPABASE_URL = https://xxxxx.supabase.co
SUPABASE_ANON_KEY = eyJhbGc... (long JWT token)
USE_SUPABASE = true
GOOGLE_API_KEY = your-google-api-key
```

**Note:** Either `SUPABASE_ANON_KEY` or `SUPABASE_KEY` works - the code supports both names.

**Important:** Click "Edit" on each variable and make sure:
- ✅ "All scopes" is selected
- ✅ No extra spaces in values
- ✅ Values are correct

### Step 2: Redeploy

After fixing environment variables:
1. Go to **Deploys** tab
2. Click **Trigger deploy** → **Clear cache and deploy site**
3. Wait for build to complete (~2 minutes)

### Step 3: Check Function Logs

1. Go to **Functions** tab
2. Click on `analytics` function
3. Look at recent logs
4. Should see: "Function called with path: ..."

## If Still Not Working

### Check Supabase Tables

1. Go to Supabase Dashboard
2. Go to **Table Editor**
3. Check if `sessions` and `events` tables exist
4. If not, run this SQL (in **SQL Editor**):

```sql
-- Sessions table
CREATE TABLE sessions (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    user_agent TEXT,
    screen_width INTEGER,
    screen_height INTEGER,
    referrer TEXT,
    landing_page TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events table
CREATE TABLE events (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_data JSONB,
    page_url TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);

-- Indexes
CREATE INDEX idx_sessions_session_id ON sessions(session_id);
CREATE INDEX idx_sessions_created_at ON sessions(created_at);
CREATE INDEX idx_events_session_id ON events(session_id);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_timestamp ON events(timestamp);
```

## Test It

1. Visit your site: `https://your-site.netlify.app`
2. Interact with it (click filters, scroll)
3. Wait 10 seconds
4. Go to: `https://your-site.netlify.app/admin.html`
5. Click "Last 7 Days"
6. Should see your session!

## Still Broken?

Check **NETLIFY_TROUBLESHOOTING.md** for detailed debugging steps.

**Most likely issue:** Environment variables not set correctly! Double-check Step 1.
