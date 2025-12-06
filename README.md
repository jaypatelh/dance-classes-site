# Dance Classes Website with Analytics

A modern, responsive website for displaying dance classes with integrated analytics tracking.

## Features

### Main Site
- 📅 **Dynamic Class Listings** - Classes loaded from Google Sheets
- 🎭 **Regular & Master Classes** - Toggle between different class types
- 🔍 **Smart Filtering** - Filter by age, style, and day
- 📱 **Responsive Design** - Works on all devices
- ✨ **Beautiful UI** - Modern gradient design with smooth animations

### Analytics System
- 📊 **Comprehensive Tracking** - Track visits, filters, views, and registrations
- 🎯 **Conversion Funnel** - Visualize user journey from visit to registration
- 📈 **Real-time Dashboard** - View analytics in beautiful admin interface
- 🔒 **Privacy-Focused** - No PII tracking, no cookies
- 💾 **Dual Storage** - SQLite3 for local dev, Supabase for production

## Quick Start

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start everything:**
   ```bash
   ./start-dev.sh
   ```
   
   Or manually:
   ```bash
   npm run dev:full
   ```

3. **Access the site:**
   - Main site: http://localhost:8080/index.dev.html
   - Admin dashboard: http://localhost:8080/admin.html

### What Gets Tracked

The analytics system automatically tracks:

- **Page Visits** - When users arrive and how long they stay
- **Filter Usage** - Which filters users apply (age, style, day)
- **View Changes** - Switching between Regular and Master Classes
- **Registration Clicks** - Which classes users are interested in
- **Scroll Depth** - How far users scroll down the page
- **User Flow** - Complete journey from arrival to action

### Admin Dashboard

Access at `/admin.html` to see:

- **Key Metrics**
  - Total visitors
  - Classes viewed
  - Filters used
  - Registration clicks
  - Conversion rate

- **Visual Funnel**
  - Visited Site → Viewed Classes → Used Filters → Clicked Registration
  - Shows drop-off at each stage

- **Popular Filters**
  - Most used filter combinations
  - Helps understand user preferences

- **Popular Classes**
  - Classes with most registration interest
  - Includes instructor, day, time details

## Project Structure

```
classes-site/
├── index.html              # Production HTML
├── index.dev.html          # Development HTML
├── admin.html              # Analytics dashboard
├── classes-script.js       # Main site logic
├── classes-styles.css      # Styles
├── analytics.js            # Analytics tracking client
├── analytics-server.js     # Analytics API server (local)
├── config.js               # Config with placeholders
├── gulpfile.js            # Build system
├── netlify/
│   └── functions/
│       └── analytics.js    # Netlify function for production
├── ANALYTICS_SETUP.md     # Detailed analytics guide
└── .env                   # Environment variables
```

## Configuration

### Local Development (.env)

```env
# Google Sheets API
GOOGLE_API_KEY=your-google-api-key

# Analytics (local uses SQLite3)
USE_SUPABASE=false
ANALYTICS_PORT=3001
```

### Production (Netlify Environment Variables)

Set these in Netlify dashboard:

```
GOOGLE_API_KEY=your-google-api-key
USE_SUPABASE=true
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
```

## Supabase Setup for Production

1. Create a Supabase project at https://supabase.com

2. Run this SQL in the Supabase SQL editor:

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

-- Indexes for performance
CREATE INDEX idx_sessions_session_id ON sessions(session_id);
CREATE INDEX idx_sessions_created_at ON sessions(created_at);
CREATE INDEX idx_events_session_id ON events(session_id);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_timestamp ON events(timestamp);
```

3. Get your Supabase URL and anon key from Project Settings > API

4. Add to Netlify environment variables

## Available Scripts

- `npm run build` - Build for production
- `npm run build:dev` - Build for development
- `npm run dev` - Start web server only
- `npm run analytics` - Start analytics server only
- `npm run dev:full` - Start both servers (recommended)
- `./start-dev.sh` - Quick start script

## Analytics Events Reference

### Session Events
- `session_start` - User visits site
- `session_end` - User leaves site
- `page_hidden` - User switches tabs
- `page_visible` - User returns to tab

### User Actions
- `filter_change` - Filter applied
  - Data: `{ filter_type, filter_value }`
- `view_change` - View switched
  - Data: `{ view_type }` (regular/master)
- `registration_click` - Registration button clicked
  - Data: `{ class_id, class_name, day, time, style, instructor }`
- `scroll_depth` - Page scrolled
  - Data: `{ depth }` (percentage)

## Privacy & Security

- ✅ No personally identifiable information (PII) tracked
- ✅ No cookies used
- ✅ Session IDs are temporary and client-generated
- ✅ No IP address tracking
- ✅ Only aggregate behavior patterns collected
- ✅ API keys secured via environment variables
- ✅ Config files use placeholders in Git

## Deployment

### Netlify Deployment

1. **Connect your repository** to Netlify

2. **Set build command:**
   ```
   npm run build
   ```

3. **Set publish directory:**
   ```
   .
   ```

4. **Add environment variables** in Netlify dashboard:
   - `GOOGLE_API_KEY`
   - `USE_SUPABASE=true`
   - `SUPABASE_URL`
   - `SUPABASE_KEY`

5. **Deploy!** The Netlify function will handle analytics automatically.

## Troubleshooting

### Analytics not recording
- Check that analytics server is running (`npm run analytics`)
- Check browser console for errors
- Verify `.env` has correct settings

### Admin dashboard shows no data
- Ensure date range includes tracked sessions
- Verify analytics server is running
- Check database connection

### SQLite database locked
- Close other processes accessing the database
- Delete `analytics.db` and restart (data will be lost)

### Supabase errors
- Verify credentials in `.env` or Netlify
- Check that tables exist in Supabase
- Verify RLS policies allow inserts

## Support

For detailed analytics setup instructions, see [ANALYTICS_SETUP.md](ANALYTICS_SETUP.md)

## License

MIT
