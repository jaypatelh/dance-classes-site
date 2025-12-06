# Analytics Setup Guide

This guide explains how to set up the analytics system for the dance classes website.

## Overview

The analytics system tracks:
- **Page visits** and session duration
- **Filter usage** (age, style, day filters)
- **View changes** (Regular Classes vs Master Classes)
- **Registration clicks** with class details
- **Scroll depth** and user engagement

## Local Development (SQLite3)

For local testing, the system uses SQLite3 automatically.

### Setup Steps:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   Make sure `.env` has `USE_SUPABASE=false`

3. **Start the analytics server:**
   ```bash
   npm run analytics
   ```
   This starts the analytics API server on port 3001.

4. **Start the web server:**
   ```bash
   npm run dev
   ```
   This starts the website on port 8080.

5. **Or run both together:**
   ```bash
   npm run dev:full
   ```

6. **View analytics dashboard:**
   Open `http://localhost:8080/admin.html` in your browser.

The SQLite database (`analytics.db`) will be created automatically in the project root.

## Production (Supabase)

For production deployment, use Supabase for analytics storage.

### Supabase Setup:

1. **Create a Supabase project** at https://supabase.com

2. **Create the required tables** by running this SQL in the Supabase SQL editor:

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

3. **Configure environment variables:**

   In your `.env` file (for local testing with Supabase):
   ```
   USE_SUPABASE=true
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-supabase-anon-key
   ```

   In Netlify (for production):
   - Go to Site Settings > Environment Variables
   - Add:
     - `USE_SUPABASE=true`
     - `SUPABASE_URL=https://your-project.supabase.co`
     - `SUPABASE_KEY=your-supabase-anon-key`

4. **Deploy analytics server:**
   
   The analytics server needs to be deployed separately. Options:
   
   - **Netlify Functions:** Convert `analytics-server.js` to serverless functions
   - **Vercel:** Deploy as API routes
   - **Railway/Render:** Deploy as a Node.js service
   - **AWS Lambda:** Use with API Gateway

## Analytics Events Tracked

### Session Events
- `session_start` - User visits the site
- `session_end` - User leaves the site
- `page_hidden` - User switches tabs
- `page_visible` - User returns to tab

### User Actions
- `filter_change` - User applies a filter (age, style, or day)
- `view_change` - User switches between Regular and Master Classes
- `registration_click` - User clicks a registration button
- `scroll_depth` - User scrolls down the page

### Error Tracking
- `error` - JavaScript errors or API failures

## Admin Dashboard

Access the analytics dashboard at `/admin.html`

Features:
- **Date range filtering** (Today, Last 7 Days, Last 30 Days, Custom)
- **Key metrics:** Total visitors, classes viewed, filters used, registrations
- **Conversion funnel:** Visual representation of user journey
- **Popular filters:** Most used filter combinations
- **Popular classes:** Classes with most registration clicks

## API Endpoints

### POST `/api/analytics`
Store analytics events
- Body: Array of event objects
- Used by the frontend to send tracking data

### GET `/api/analytics/summary`
Get analytics summary
- Query params: `startDate`, `endDate`
- Returns: Session and event counts

### GET `/api/analytics/funnel`
Get funnel analysis
- Query params: `startDate`, `endDate`
- Returns: Conversion funnel data, popular filters, and classes

## Privacy Considerations

The analytics system:
- Does NOT track personally identifiable information (PII)
- Does NOT use cookies
- Uses session IDs that are generated client-side and temporary
- Tracks only aggregate behavior patterns
- Does NOT track IP addresses

## Troubleshooting

### Analytics not recording
1. Check that the analytics server is running
2. Check browser console for errors
3. Verify the API endpoint is correct in `analytics.js`

### Admin dashboard shows no data
1. Ensure the date range includes tracked sessions
2. Check that the analytics server is running
3. Verify database connection

### SQLite database locked
1. Close any other processes accessing the database
2. Delete `analytics.db` and restart (data will be lost)

### Supabase connection errors
1. Verify `SUPABASE_URL` and `SUPABASE_KEY` are correct
2. Check that tables exist in Supabase
3. Verify Row Level Security (RLS) policies allow inserts
