# Analytics Architecture

## Local Development vs Production

### Local Development Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Your Computer                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Browser (localhost:8080)                               │
│  ├── index.dev.html                                     │
│  ├── analytics.js (tracking)                            │
│  └── admin.html (dashboard)                             │
│           │                                              │
│           │ POST /api/analytics                          │
│           ↓                                              │
│  Express Server (localhost:3001)                        │
│  ├── analytics-server.js                                │
│  └── SQLite Database (analytics.db)                     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**How to run:**
```bash
./start-dev.sh
# or
npm run dev:full
```

**Pros:**
- ✅ Fast development
- ✅ No internet required
- ✅ Easy debugging
- ✅ Instant feedback

**Cons:**
- ❌ Only works on your computer
- ❌ Data stored locally
- ❌ Can't share with others

---

### Production Architecture (Netlify)

```
┌─────────────────────────────────────────────────────────┐
│                    Internet                              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  User's Browser                                         │
│  ├── https://your-site.netlify.app                     │
│  ├── analytics.js (tracking)                            │
│  └── admin.html (dashboard)                             │
│           │                                              │
│           │ POST /api/analytics                          │
│           ↓                                              │
│  Netlify CDN                                            │
│  ├── Redirects /api/analytics/* →                      │
│  │   /.netlify/functions/analytics                     │
│  │                                                      │
│  └── Netlify Function (Serverless)                     │
│      └── netlify/functions/analytics.js                │
│                 │                                        │
│                 │ SQL Queries                            │
│                 ↓                                        │
│  Supabase (Cloud Database)                             │
│  ├── sessions table                                     │
│  └── events table                                       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**How it works:**
1. User visits your site
2. `analytics.js` tracks their actions
3. Events sent to `/api/analytics`
4. Netlify redirects to serverless function
5. Function stores data in Supabase
6. Admin dashboard queries Supabase

**Pros:**
- ✅ Globally accessible
- ✅ No server to maintain
- ✅ Scales automatically
- ✅ Cloud database backup
- ✅ Free tier available

**Cons:**
- ❌ Requires Supabase setup
- ❌ Internet required
- ❌ Slight cold start delay

---

## Key Files Explained

### Frontend (Runs in Browser)

**analytics.js**
- Tracks user actions (filters, scrolls, clicks)
- Queues events and flushes every 5 seconds
- Sends to `/api/analytics` endpoint
- Works same in local and production

**admin.html**
- Analytics dashboard
- Fetches data from `/api/analytics/funnel`
- Displays metrics, funnel, journeys
- Works same in local and production

**classes-script.js**
- Main site logic
- Calls `window.analytics.trackFilterChange()` etc.
- No changes needed for deployment

### Backend (Serverless)

**Local: analytics-server.js**
- Express server on port 3001
- Stores in SQLite (analytics.db)
- Only for development
- NOT deployed to Netlify

**Production: netlify/functions/analytics.js**
- Netlify Function (serverless)
- Stores in Supabase
- Automatically deployed
- Handles same API routes

### Configuration

**netlify.toml**
```toml
[build]
  functions = "netlify/functions"  # Where functions are

[[redirects]]
  from = "/api/analytics/*"
  to = "/.netlify/functions/analytics/:splat"
  status = 200
```

This redirect makes `/api/analytics` work the same in local and production!

---

## API Endpoints

### POST /api/analytics
Store analytics events

**Request:**
```json
[
  {
    "session_id": "1234-5678",
    "event_type": "filter_change",
    "event_data": {
      "filter_type": "style",
      "filter_value": "hip-hop"
    },
    "timestamp": "2025-12-05T17:00:00Z",
    "page_url": "https://site.com/"
  }
]
```

**Response:**
```json
{ "success": true }
```

### GET /api/analytics/funnel
Get funnel analysis

**Query Params:**
- `startDate`: ISO date string
- `endDate`: ISO date string

**Response:**
```json
{
  "totalVisitors": 50,
  "clickedRegistration": 30,
  "conversionRate": "60.00",
  "filterUsageBreakdown": {
    "0": 15,
    "1": 20,
    "2": 12,
    "3": 3
  },
  "popularFilters": {
    "byType": {
      "age": 45,
      "style": 38,
      "day": 32
    },
    "topFilters": [...]
  },
  "popularClasses": [...],
  "visitorJourneys": [...]
}
```

---

## Database Schema

### Supabase (Production)

**sessions table:**
```sql
id              BIGSERIAL PRIMARY KEY
session_id      TEXT UNIQUE NOT NULL
user_agent      TEXT
screen_width    INTEGER
screen_height   INTEGER
referrer        TEXT
landing_page    TEXT
created_at      TIMESTAMPTZ DEFAULT NOW()
```

**events table:**
```sql
id              BIGSERIAL PRIMARY KEY
session_id      TEXT NOT NULL
event_type      TEXT NOT NULL
event_data      JSONB
page_url        TEXT
timestamp       TIMESTAMPTZ DEFAULT NOW()
```

### SQLite (Local)

Same schema, but uses SQLite syntax:
- `BIGSERIAL` → `INTEGER PRIMARY KEY AUTOINCREMENT`
- `TIMESTAMPTZ` → `DATETIME`
- `JSONB` → `TEXT` (stored as JSON string)

---

## Why This Architecture?

### Serverless Benefits
1. **No server management** - Netlify handles everything
2. **Auto-scaling** - Handles 1 or 1,000,000 visitors
3. **Cost-effective** - Only pay for what you use
4. **Global CDN** - Fast everywhere
5. **Zero downtime** - No server to crash

### Supabase Benefits
1. **PostgreSQL** - Powerful, reliable database
2. **Real-time** - Can add live updates later
3. **Backup** - Automatic backups
4. **SQL Editor** - Easy to query data
5. **Free tier** - 500MB database free

### Development Benefits
1. **Same code** - Frontend works same locally and production
2. **Easy testing** - Test locally with SQLite
3. **Fast iteration** - No deploy needed for local changes
4. **Debug friendly** - Can inspect local database

---

## Deployment Flow

```
1. Code Changes
   ↓
2. Git Commit & Push
   ↓
3. Netlify Detects Push
   ↓
4. Netlify Runs Build
   - npm install
   - npm run build (replaces env vars in config.js)
   - Copies files to CDN
   - Deploys functions
   ↓
5. Site Live!
   - Static files on CDN
   - Functions ready
   - Connected to Supabase
```

**Build time:** ~2-3 minutes
**Deploy time:** Instant (atomic deploy)

---

## Monitoring

### Netlify Dashboard
- Build logs
- Function logs
- Deploy history
- Analytics (basic)

### Supabase Dashboard
- Database size
- API requests
- Query performance
- Table editor

### Your Admin Dashboard
- Visitor journeys
- Conversion funnel
- Popular filters
- Popular classes

---

## Scaling Considerations

### Current Limits (Free Tiers)

**Netlify:**
- 100 GB bandwidth/month
- 125k function invocations/month
- 100 hours function runtime/month

**Supabase:**
- 500 MB database
- 50k API requests/month
- 2 GB bandwidth/month

### If You Exceed Limits

**Option 1: Upgrade**
- Netlify Pro: $19/month
- Supabase Pro: $25/month

**Option 2: Optimize**
- Implement data retention (delete old data)
- Reduce tracking frequency
- Sample high-traffic periods

**Option 3: Batch Events**
- Already implemented! Events flush every 5 seconds
- Reduces API calls significantly

---

## Security

### What's Secure
✅ API keys in environment variables (not in code)
✅ Supabase credentials never exposed to browser
✅ HTTPS everywhere (Netlify provides SSL)
✅ No sensitive data tracked

### What's Not Tracked
❌ No personally identifiable information (PII)
❌ No IP addresses
❌ No cookies
❌ No cross-site tracking

### Session IDs
- Generated client-side
- Temporary (session-based)
- Not linked to user identity
- Used only for analytics aggregation

---

## Future Enhancements

### Possible Additions
- Real-time dashboard updates (Supabase real-time)
- Email reports (weekly summaries)
- A/B testing (test different layouts)
- Heatmaps (where users click)
- Session recordings (privacy-respecting)
- Export to CSV (download analytics)

### Easy to Add
The architecture supports these without major changes!

---

**Questions?** Check DEPLOYMENT_GUIDE.md for step-by-step instructions.
