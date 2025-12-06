# Netlify Deployment Troubleshooting

## Common Issues and Solutions

### 404 Error on Analytics Endpoint

**Error:**
```
Failed to load resource: the server responded with a status of 404
.netlify/functions/analytics/funnel?startDate=...
```

**Causes:**
1. Functions directory not configured
2. Function file not deployed
3. Redirect not working

**Solutions:**

#### 1. Check netlify.toml
Verify `netlify.toml` has:
```toml
[build]
  functions = "netlify/functions"

[[redirects]]
  from = "/api/analytics/*"
  to = "/.netlify/functions/analytics/:splat"
  status = 200
```

#### 2. Check Function Exists
In Netlify Dashboard:
1. Go to **Functions** tab
2. Look for `analytics` function
3. If missing, check build logs

#### 3. Check Build Logs
In Netlify Dashboard:
1. Go to **Deploys** tab
2. Click latest deploy
3. Check for errors in build log
4. Look for "Functions bundled" message

#### 4. Verify File Structure
Your repo should have:
```
netlify/
  functions/
    analytics.js
```

---

### 500 Error on Analytics Endpoint

**Error:**
```
Failed to load resource: the server responded with a status of 500
Error loading analytics: Error: Failed to fetch analytics data
```

**Causes:**
1. Supabase credentials not set
2. Supabase credentials incorrect
3. Database tables don't exist
4. Function code error

**Solutions:**

#### 1. Check Environment Variables
In Netlify Dashboard → **Site Settings** → **Environment Variables**

**Required variables:**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Your Supabase anon key
- `USE_SUPABASE` - Set to `true`

**How to verify:**
1. Check each variable exists
2. Check values are correct (no extra spaces)
3. Check they're set for "All scopes"

#### 2. Check Supabase Tables
In Supabase Dashboard → **Table Editor**

**Required tables:**
- `sessions` - Should have columns: id, session_id, user_agent, etc.
- `events` - Should have columns: id, session_id, event_type, etc.

**If missing:**
1. Go to **SQL Editor**
2. Run the SQL from DEPLOYMENT_GUIDE.md (Step 1.2)

#### 3. Check Function Logs
In Netlify Dashboard:
1. Go to **Functions** tab
2. Click `analytics` function
3. Check logs for errors

**Common errors in logs:**
- "Supabase not configured" → Environment variables not set
- "relation does not exist" → Tables not created
- "invalid API key" → Wrong Supabase key

#### 4. Test Supabase Connection
In Supabase Dashboard → **SQL Editor**

Run this query:
```sql
SELECT COUNT(*) FROM sessions;
SELECT COUNT(*) FROM events;
```

If this fails, tables don't exist.

---

### Analytics Not Recording

**Symptoms:**
- Admin dashboard shows 0 visitors
- No data in Supabase tables
- No errors in console

**Solutions:**

#### 1. Check Browser Console
Open browser console (F12) and look for:
- Analytics tracking events
- POST requests to `/api/analytics`
- Any error messages

#### 2. Check Network Tab
In browser DevTools → **Network** tab:
1. Visit your site
2. Look for POST to `/api/analytics`
3. Check if it returns 200 or error
4. Click on request to see response

#### 3. Verify analytics.js Loaded
In browser console, type:
```javascript
window.analytics
```

Should show an object. If undefined, analytics.js didn't load.

#### 4. Check Supabase Tables
In Supabase → **Table Editor**:
1. Check `sessions` table
2. Check `events` table
3. Should see new rows after visiting site

---

### Build Fails

**Error:**
```
Build failed
Error: Command failed with exit code 1
```

**Solutions:**

#### 1. Check Build Logs
Look for specific error messages:
- "Module not found" → Missing dependency
- "Syntax error" → Code error
- "Command not found" → Wrong build command

#### 2. Verify package.json
Check `package.json` has:
```json
{
  "scripts": {
    "build": "gulp build"
  },
  "dependencies": {
    "gulp": "^4.0.2",
    "gulp-replace": "^1.1.3",
    // ... other dependencies
  }
}
```

#### 3. Test Build Locally
Run locally:
```bash
npm install
npm run build
```

If this fails locally, fix the error before deploying.

#### 4. Check Node Version
In `netlify.toml`:
```toml
[build.environment]
  NODE_VERSION = "18"
```

---

### CORS Errors

**Error:**
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

**Solution:**
This shouldn't happen with the current setup, but if it does:

1. Check `netlify/functions/analytics.js` has:
```javascript
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
};
```

2. Redeploy the site

---

### Admin Dashboard Shows No Data

**Symptoms:**
- Site works fine
- Analytics tracking works
- Admin dashboard shows 0 visitors

**Solutions:**

#### 1. Check Date Range
- Click "Last 7 Days" instead of "Today"
- Check if data appears

#### 2. Check Timezone
- Data stored in UTC
- "Today" might be off by timezone
- Use "Last 7 Days" to verify data exists

#### 3. Verify Data in Supabase
In Supabase → **Table Editor**:
1. Check `events` table has rows
2. Check timestamps are recent
3. If data exists but dashboard empty, it's a query issue

#### 4. Check Browser Console
Look for errors when loading dashboard:
- Failed to fetch
- JSON parse errors
- Network errors

---

## Debugging Checklist

When something goes wrong, check in this order:

### 1. Environment Variables
- [ ] `SUPABASE_URL` is set
- [ ] `SUPABASE_KEY` is set
- [ ] `USE_SUPABASE` is set to `true`
- [ ] All variables are for "All scopes"

### 2. Supabase Setup
- [ ] Project exists
- [ ] Tables created (sessions, events)
- [ ] Can query tables in SQL Editor
- [ ] Credentials are correct

### 3. Netlify Configuration
- [ ] `netlify.toml` exists
- [ ] Functions directory configured
- [ ] Redirect configured
- [ ] Build command is correct

### 4. Build Success
- [ ] Latest deploy succeeded
- [ ] Functions bundled successfully
- [ ] No errors in build log

### 5. Function Deployment
- [ ] Function appears in Functions tab
- [ ] Function logs show no errors
- [ ] Can invoke function manually

### 6. Frontend
- [ ] Site loads correctly
- [ ] analytics.js loads
- [ ] No console errors
- [ ] Network requests succeed

---

## Manual Testing

### Test Analytics Tracking
1. Visit your site in incognito/private window
2. Open browser console (F12)
3. Interact with site (filters, scroll, etc.)
4. Check Network tab for POST to `/api/analytics`
5. Should return 200 OK

### Test Admin Dashboard
1. Go to `/admin.html`
2. Click "Last 7 Days"
3. Should see data
4. Check browser console for errors

### Test Supabase Directly
In Supabase → **SQL Editor**:
```sql
-- Check recent sessions
SELECT * FROM sessions 
ORDER BY created_at DESC 
LIMIT 10;

-- Check recent events
SELECT * FROM events 
ORDER BY timestamp DESC 
LIMIT 20;
```

---

## Getting Help

### Check Logs
1. **Netlify Build Logs:** Deploys tab → Click deploy → View logs
2. **Netlify Function Logs:** Functions tab → Click function → View logs
3. **Browser Console:** F12 → Console tab
4. **Supabase Logs:** Project → Logs

### Useful Commands

**Test function locally:**
```bash
netlify dev
```

**Check environment variables:**
```bash
netlify env:list
```

**View function logs:**
```bash
netlify functions:log analytics
```

---

## Quick Fixes

### "Supabase not configured"
```bash
# In Netlify Dashboard
Site Settings → Environment Variables → Add:
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=your-anon-key
USE_SUPABASE=true
```

### "relation does not exist"
```sql
-- In Supabase SQL Editor, run:
-- (Copy SQL from DEPLOYMENT_GUIDE.md Step 1.2)
```

### "404 on function"
```toml
# Check netlify.toml has:
[build]
  functions = "netlify/functions"
```

### "Build failed"
```bash
# Test locally first:
npm install
npm run build
# Fix any errors, then commit and push
```

---

## Still Having Issues?

1. Check all sections above
2. Review DEPLOYMENT_GUIDE.md
3. Check Netlify documentation
4. Check Supabase documentation
5. Look at function logs for specific errors

**Most common issue:** Environment variables not set correctly in Netlify!
