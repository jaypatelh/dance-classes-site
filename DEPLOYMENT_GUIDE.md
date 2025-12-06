# Netlify Deployment Guide with Analytics

This guide walks you through deploying your dance classes site with full analytics to Netlify.

## Overview

The analytics system uses:
- **Frontend:** Regular HTML/CSS/JS (deployed as static files)
- **Backend:** Netlify Functions (serverless, automatically deployed)
- **Database:** Supabase (cloud PostgreSQL)

**No separate server needed!** Netlify Functions replace the local analytics server.

## Step 1: Set Up Supabase

### 1.1 Create Supabase Project
1. Go to https://supabase.com
2. Sign in or create account
3. Click "New Project"
4. Choose organization and project name
5. Set a strong database password (save it!)
6. Select region closest to your users
7. Wait for project to be created (~2 minutes)

### 1.2 Create Database Tables
1. In your Supabase project, go to **SQL Editor**
2. Click "New Query"
3. Paste this SQL and click "Run":

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
```

4. Verify tables were created: Go to **Table Editor** and you should see `sessions` and `events`

### 1.3 Get Supabase Credentials
1. Go to **Project Settings** (gear icon)
2. Click **API** in the sidebar
3. Copy these values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (the long JWT token)

## Step 2: Configure Netlify

### 2.1 Connect Repository
1. Go to https://app.netlify.com
2. Click "Add new site" → "Import an existing project"
3. Choose your Git provider (GitHub, GitLab, etc.)
4. Select your repository
5. Netlify should auto-detect settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `./`
   - **Functions directory:** `netlify/functions`

### 2.2 Add Environment Variables
In Netlify, go to **Site Settings** → **Environment Variables** → **Add a variable**

Add these variables:

| Variable Name | Value | Notes |
|--------------|-------|-------|
| `GOOGLE_API_KEY` | Your Google API key | For Google Sheets |
| `OPENROUTER_API_KEY` | Your OpenRouter key | If using AI features |
| `OWNER_PHONE_NUMBER` | Your phone number | For contact |
| `SUPABASE_URL` | Your Supabase URL | From Step 1.3 |
| `SUPABASE_KEY` | Your Supabase anon key | From Step 1.3 |
| `USE_SUPABASE` | `true` | Enables Supabase |

**Important:** Make sure to set these for **all deploy contexts** (Production, Deploy Previews, Branch deploys)

### 2.3 Deploy
1. Click "Deploy site"
2. Wait for build to complete (~2-3 minutes)
3. Your site will be live at `https://your-site-name.netlify.app`

## Step 3: Verify Deployment

### 3.1 Test Main Site
1. Visit your Netlify URL
2. Check that classes load correctly
3. Try applying filters
4. Click a registration button

### 3.2 Test Analytics
1. Visit your site and interact with it (filters, scrolling, etc.)
2. Wait 10 seconds for events to flush
3. Go to `https://your-site-name.netlify.app/admin.html`
4. Click "Today" button
5. You should see your session in the visitor journeys!

### 3.3 Verify in Supabase
1. Go to Supabase → **Table Editor**
2. Click on `sessions` table - you should see your session
3. Click on `events` table - you should see your events

## How It Works in Production

### Local Development
```
Browser → http://localhost:3001/api/analytics → analytics-server.js → SQLite
```

### Production (Netlify)
```
Browser → https://your-site.netlify.app/api/analytics → Netlify Function → Supabase
```

The redirect in `netlify.toml` automatically routes `/api/analytics/*` to `/.netlify/functions/analytics`

## Troubleshooting

### Analytics Not Recording

**Check Netlify Function Logs:**
1. Go to Netlify Dashboard
2. Click "Functions" tab
3. Click on "analytics" function
4. Check logs for errors

**Common Issues:**
- ❌ Supabase credentials not set → Add them in Netlify environment variables
- ❌ Tables don't exist → Run SQL from Step 1.2
- ❌ CORS errors → Should be handled by function, check logs

### Build Fails

**Check Build Logs:**
1. Go to Netlify Dashboard
2. Click "Deploys" tab
3. Click on failed deploy
4. Read error messages

**Common Issues:**
- ❌ Missing dependencies → Run `npm install` locally first
- ❌ Environment variables not set → Add them in Netlify
- ❌ Node version mismatch → Check `netlify.toml` has correct version

### Admin Dashboard Shows No Data

**Verify:**
1. Check browser console for errors (F12)
2. Check Network tab - is `/api/analytics/funnel` returning data?
3. Check Supabase - are there rows in the tables?
4. Try clicking "Last 7 Days" instead of "Today"

**Debug:**
```javascript
// Add to browser console
fetch('/.netlify/functions/analytics/funnel?startDate=2024-01-01&endDate=2025-12-31')
  .then(r => r.json())
  .then(d => console.log(d))
```

## Custom Domain (Optional)

### Add Custom Domain
1. In Netlify, go to **Domain Settings**
2. Click "Add custom domain"
3. Enter your domain (e.g., `classes.yourdomain.com`)
4. Follow DNS instructions
5. Wait for SSL certificate (automatic, ~24 hours)

### Update Analytics
No changes needed! The analytics will automatically work with your custom domain.

## Monitoring & Maintenance

### Check Analytics Regularly
- Visit admin dashboard weekly
- Look for trends in filter usage
- Identify popular classes
- Monitor conversion rates

### Clear Analytics Data
The admin dashboard has a "Clear All Data" button (red button on the right).

**Use this to:**
- Reset analytics for testing
- Clear old data before launch
- Start fresh after major site changes

**Safety features:**
- Requires 3 confirmations
- Must type "DELETE ALL DATA" to confirm
- Shows count of deleted records
- Cannot be undone!

**Note:** This deletes ALL analytics data permanently.

### Supabase Free Tier Limits
- **Database:** 500 MB
- **API Requests:** 50,000/month
- **Bandwidth:** 2 GB

If you exceed limits:
- Upgrade to Supabase Pro ($25/month)
- Or implement data retention (delete old data)

### Data Retention (Optional)

To keep database small, delete old data monthly:

1. Go to Supabase → SQL Editor
2. Run this query:

```sql
-- Delete events older than 90 days
DELETE FROM events WHERE timestamp < NOW() - INTERVAL '90 days';

-- Delete sessions older than 90 days
DELETE FROM sessions WHERE created_at < NOW() - INTERVAL '90 days';
```

## Files Deployed

### Static Files (Netlify CDN)
- `index.html` - Main site
- `admin.html` - Analytics dashboard
- `classes-script.js` - Site logic
- `analytics.js` - Analytics tracking
- `classes-styles.css` - Styles
- `config.js` - Config (with replaced env vars)

### Serverless Functions (Netlify Functions)
- `netlify/functions/analytics.js` - Analytics API

### Not Deployed
- `analytics-server.js` - Only for local development
- `.env` - Only for local development
- `analytics.db` - Only for local development

## Success Checklist

- [ ] Supabase project created
- [ ] Database tables created
- [ ] Supabase credentials copied
- [ ] Repository connected to Netlify
- [ ] Environment variables added to Netlify
- [ ] Site deployed successfully
- [ ] Main site loads and works
- [ ] Analytics tracking works (test by visiting site)
- [ ] Admin dashboard shows data
- [ ] Data appears in Supabase tables

## Next Steps

1. **Test thoroughly** - Visit site, interact, check admin dashboard
2. **Share admin URL** - Bookmark `https://your-site.netlify.app/admin.html`
3. **Monitor regularly** - Check analytics weekly
4. **Optimize** - Use insights to improve class offerings

## Support

If you encounter issues:
1. Check Netlify build logs
2. Check Netlify function logs
3. Check browser console (F12)
4. Check Supabase logs
5. Review this guide again

---

**You're all set!** Your dance classes site with full analytics is now live on Netlify. 🎉
