# Production Deployment Checklist

Use this checklist when deploying your analytics system to production.

## Pre-Deployment

### ✅ Supabase Setup

- [ ] Create Supabase account at https://supabase.com
- [ ] Create new project
- [ ] Copy project URL and anon key
- [ ] Run SQL schema (from ANALYTICS_SETUP.md):
  ```sql
  -- Sessions table
  CREATE TABLE sessions (...)
  -- Events table  
  CREATE TABLE events (...)
  -- Indexes
  CREATE INDEX ...
  ```
- [ ] Test connection with a simple query
- [ ] Verify tables are created correctly

### ✅ Netlify Configuration

- [ ] Repository connected to Netlify
- [ ] Build command set: `npm run build`
- [ ] Publish directory set: `.`
- [ ] Environment variables added:
  - [ ] `GOOGLE_API_KEY`
  - [ ] `USE_SUPABASE=true`
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_KEY`

### ✅ Code Review

- [ ] All API keys removed from code
- [ ] config.js uses placeholders only
- [ ] .env file is gitignored
- [ ] analytics.db is gitignored
- [ ] No console.logs with sensitive data
- [ ] Error handling in place

## Deployment

### ✅ Build & Deploy

- [ ] Run local build test: `npm run build`
- [ ] Commit all changes
- [ ] Push to repository
- [ ] Verify Netlify build succeeds
- [ ] Check Netlify function logs

### ✅ Testing Production

- [ ] Visit production site
- [ ] Open browser console - check for errors
- [ ] Apply filters - verify no errors
- [ ] Click register button - verify tracking
- [ ] Wait 10 seconds for events to flush
- [ ] Check Supabase tables for data:
  ```sql
  SELECT * FROM sessions ORDER BY created_at DESC LIMIT 5;
  SELECT * FROM events ORDER BY timestamp DESC LIMIT 10;
  ```

### ✅ Admin Dashboard

- [ ] Access admin.html on production
- [ ] Verify data loads
- [ ] Test date range filters
- [ ] Check funnel visualization
- [ ] Verify popular filters display
- [ ] Verify popular classes display

## Post-Deployment

### ✅ Monitoring

- [ ] Bookmark admin dashboard URL
- [ ] Set up regular check schedule
- [ ] Monitor Supabase usage/limits
- [ ] Check Netlify function invocations
- [ ] Review error logs weekly

### ✅ Security

- [ ] Verify no API keys in public code
- [ ] Check Supabase RLS policies (if needed)
- [ ] Confirm environment variables are secure
- [ ] Review access logs

### ✅ Performance

- [ ] Check page load times
- [ ] Monitor analytics API response times
- [ ] Review Supabase query performance
- [ ] Optimize if needed

## Supabase Credentials

You mentioned you have Supabase credentials. Here's where to add them:

### Local Testing (.env file)
```env
USE_SUPABASE=true
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Production (Netlify Dashboard)
1. Go to: Site Settings > Environment Variables
2. Add new variable: `USE_SUPABASE` = `true`
3. Add new variable: `SUPABASE_URL` = `https://xxxxx.supabase.co`
4. Add new variable: `SUPABASE_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
5. Save and redeploy

## SQL Schema for Supabase

Copy this entire block and run in Supabase SQL Editor:

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

-- Create indexes for better query performance
CREATE INDEX idx_sessions_session_id ON sessions(session_id);
CREATE INDEX idx_sessions_created_at ON sessions(created_at);
CREATE INDEX idx_events_session_id ON events(session_id);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_timestamp ON events(timestamp);

-- Optional: Enable Row Level Security (RLS)
-- ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Optional: Create policies for public insert (if needed)
-- CREATE POLICY "Allow public insert" ON sessions FOR INSERT TO anon WITH CHECK (true);
-- CREATE POLICY "Allow public insert" ON events FOR INSERT TO anon WITH CHECK (true);
```

## Verification Queries

After deployment, run these in Supabase SQL Editor to verify:

```sql
-- Check sessions are being created
SELECT COUNT(*) as total_sessions FROM sessions;

-- Check recent sessions
SELECT session_id, created_at, referrer, landing_page 
FROM sessions 
ORDER BY created_at DESC 
LIMIT 10;

-- Check events are being tracked
SELECT COUNT(*) as total_events FROM events;

-- Check event types distribution
SELECT event_type, COUNT(*) as count 
FROM events 
GROUP BY event_type 
ORDER BY count DESC;

-- Check recent registration clicks
SELECT event_data->>'class_name' as class_name,
       event_data->>'instructor' as instructor,
       timestamp
FROM events 
WHERE event_type = 'registration_click'
ORDER BY timestamp DESC
LIMIT 10;

-- Check filter usage
SELECT event_data->>'filter_type' as filter_type,
       event_data->>'filter_value' as filter_value,
       COUNT(*) as usage_count
FROM events 
WHERE event_type = 'filter_change'
GROUP BY filter_type, filter_value
ORDER BY usage_count DESC;
```

## Troubleshooting Production

### Issue: No data in Supabase

**Check:**
1. Netlify function logs for errors
2. Browser console for failed requests
3. Supabase credentials are correct
4. Tables exist in Supabase
5. Network tab shows requests to `/.netlify/functions/analytics`

**Fix:**
- Verify environment variables in Netlify
- Check Netlify function deployment
- Review Supabase connection settings

### Issue: Admin dashboard not loading

**Check:**
1. Dashboard is accessing correct endpoint
2. CORS is configured properly
3. Supabase allows queries from your domain

**Fix:**
- Check browser console for errors
- Verify API endpoint in admin.html
- Test API endpoint directly

### Issue: High Supabase usage

**Solutions:**
- Implement data retention policy (delete old data)
- Aggregate old data into summary tables
- Increase flush interval in analytics.js
- Add sampling for high-traffic sites

## Data Retention

Consider implementing automatic cleanup:

```sql
-- Delete sessions older than 90 days
DELETE FROM events WHERE timestamp < NOW() - INTERVAL '90 days';
DELETE FROM sessions WHERE created_at < NOW() - INTERVAL '90 days';

-- Or create a scheduled function in Supabase
```

## Success Metrics

After deployment, you should see:
- ✅ Sessions being created in real-time
- ✅ Events tracking user actions
- ✅ Admin dashboard showing data
- ✅ Funnel visualization working
- ✅ No errors in logs

## Support

If you encounter issues:
1. Check browser console
2. Check Netlify function logs
3. Check Supabase logs
4. Review ANALYTICS_SETUP.md
5. Test locally first with Supabase credentials

---

**Ready to deploy?** Start with the Supabase setup, then configure Netlify, and finally test everything! 🚀
