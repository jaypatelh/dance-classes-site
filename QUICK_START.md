# Quick Start Guide - Analytics System

## 🚀 You're All Set!

Your analytics system is now fully integrated and running!

## Current Status

✅ **Analytics Server** - Running on http://localhost:3001  
✅ **Web Server** - Running on http://localhost:8080  
✅ **Database** - SQLite3 (analytics.db created automatically)  
✅ **Tracking** - Active on all pages  

## Access Your Site

- **Main Site:** http://localhost:8080/index.dev.html
- **Admin Dashboard:** http://localhost:8080/admin.html

## What's Being Tracked Right Now

As soon as you visit the site, analytics starts tracking:

1. **Session Start** - Your visit is logged
2. **Filter Changes** - When you select age/style/day filters
3. **View Toggle** - Switching between Regular and Master Classes
4. **Registration Clicks** - When you click "Register" buttons
5. **Scroll Depth** - How far you scroll down
6. **Session Duration** - How long you stay on the site

## Test the Analytics

### Step 1: Generate Some Data
1. Open http://localhost:8080/index.dev.html
2. Apply some filters (age, style, day)
3. Toggle between Regular and Master Classes
4. Click a few "Register" buttons
5. Scroll down the page

### Step 2: View the Dashboard
1. Open http://localhost:8080/admin.html
2. Select date range (Today, Last 7 Days, etc.)
3. See your funnel visualization
4. Check popular filters and classes

## For Next Time

### Start Development Servers
```bash
# Option 1: Use the start script
./start-dev.sh

# Option 2: Run both servers together
npm run dev:full

# Option 3: Run separately
npm run analytics    # Terminal 1
npm run dev          # Terminal 2
```

### Stop Servers
Press `Ctrl+C` in the terminal(s)

## Production Setup (When Ready)

### 1. Set Up Supabase

1. Go to https://supabase.com and create a project
2. Run the SQL from `ANALYTICS_SETUP.md` to create tables
3. Get your Supabase URL and anon key

### 2. Configure Netlify

Add these environment variables in Netlify dashboard:

```
GOOGLE_API_KEY=your-google-api-key
USE_SUPABASE=true
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
```

### 3. Deploy

```bash
git add .
git commit -m "Add analytics system"
git push
```

Netlify will automatically:
- Build your site
- Deploy the Netlify function for analytics
- Connect to Supabase for data storage

## Admin Dashboard Features

### 📊 Key Metrics Cards
- **Total Visitors** - Unique sessions
- **Classes Viewed** - Users who saw classes
- **Filters Used** - Users who applied filters
- **Registrations** - Registration button clicks
- **Conversion Rate** - % of visitors who clicked register

### 🎯 Visual Funnel
Shows drop-off at each stage:
1. Visited Site (100%)
2. Viewed Classes
3. Used Filters
4. Clicked Registration

### 📈 Popular Filters
See which filters users prefer:
- Age groups most searched
- Dance styles most popular
- Days most requested

### ⭐ Popular Classes
Classes with most registration interest:
- Class name and instructor
- Day and time
- Number of clicks

## Database Location

**Local:** `analytics.db` in project root (gitignored)  
**Production:** Supabase cloud database

## Troubleshooting

### No data showing in dashboard?
- Make sure you've visited the main site first
- Check that date range includes today
- Verify analytics server is running (port 3001)

### Analytics server won't start?
```bash
# Check if port 3001 is in use
lsof -i :3001

# Kill the process if needed
kill -9 <PID>

# Restart
npm run analytics
```

### Web server won't start?
```bash
# Check if port 8080 is in use
lsof -i :8080

# Kill the process if needed
kill -9 <PID>

# Restart
npm run dev
```

## Privacy Notes

Your analytics system is privacy-focused:
- ✅ No cookies
- ✅ No IP tracking
- ✅ No personal information
- ✅ Session IDs are temporary
- ✅ Only behavior patterns tracked

## Need Help?

Check these files:
- `README.md` - Complete documentation
- `ANALYTICS_SETUP.md` - Detailed setup guide
- `.env` - Configuration settings

## What's Next?

1. **Test locally** - Generate data and view in dashboard
2. **Set up Supabase** - For production analytics
3. **Deploy to Netlify** - Go live with analytics
4. **Monitor traffic** - Watch your funnel and optimize

Enjoy your new analytics system! 📊✨
