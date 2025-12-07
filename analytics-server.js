// Analytics API Server
// Handles both SQLite3 (local) and Supabase (production)

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.ANALYTICS_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Determine environment
const isProduction = process.env.NODE_ENV === 'production';
const USE_SUPABASE = process.env.USE_SUPABASE === 'true' || isProduction;

let db;

// Initialize database based on environment
async function initializeDatabase() {
    if (USE_SUPABASE) {
        console.log('Using Supabase for analytics storage');
        const { createClient } = require('@supabase/supabase-js');
        
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase credentials not configured');
        }
        
        db = createClient(supabaseUrl, supabaseKey);
        console.log('Supabase client initialized');
    } else {
        console.log('Using SQLite3 for analytics storage (local development)');
        const sqlite3 = require('sqlite3').verbose();
        const dbPath = path.join(__dirname, 'analytics.db');
        
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err);
            } else {
                console.log('SQLite database connected');
                createTables();
            }
        });
    }
}

// Create SQLite tables
function createTables() {
    if (USE_SUPABASE) return;
    
    const createSessionsTable = `
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT UNIQUE NOT NULL,
            visitor_id TEXT,
            user_agent TEXT,
            screen_width INTEGER,
            screen_height INTEGER,
            referrer TEXT,
            landing_page TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `;
    
    const createEventsTable = `
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            visitor_id TEXT,
            event_type TEXT NOT NULL,
            event_data TEXT,
            page_url TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES sessions(session_id)
        )
    `;
    
    db.run(createSessionsTable, (err) => {
        if (err) console.error('Error creating sessions table:', err);
    });
    
    db.run(createEventsTable, (err) => {
        if (err) console.error('Error creating events table:', err);
    });
}

// API Endpoints

// Store analytics events
app.post('/api/analytics', async (req, res) => {
    try {
        const events = Array.isArray(req.body) ? req.body : [req.body];
        
        if (USE_SUPABASE) {
            // Store in Supabase
            for (const event of events) {
                // First, ensure session exists
                if (event.event_type === 'session_start') {
                    const { error: sessionError } = await db
                        .from('sessions')
                        .upsert({
                            session_id: event.session_id,
                            visitor_id: event.visitor_id,
                            user_agent: event.event_data.user_agent,
                            screen_width: event.event_data.screen_width,
                            screen_height: event.event_data.screen_height,
                            referrer: event.event_data.referrer,
                            landing_page: event.event_data.landing_page,
                            created_at: event.timestamp
                        }, { onConflict: 'session_id' });
                    
                    if (sessionError) {
                        console.error('Error storing session:', sessionError);
                    }
                }
                
                // Store event
                const { error: eventError } = await db
                    .from('events')
                    .insert({
                        session_id: event.session_id,
                        visitor_id: event.visitor_id,
                        event_type: event.event_type,
                        event_data: event.event_data,
                        page_url: event.page_url,
                        timestamp: event.timestamp
                    });
                
                if (eventError) {
                    console.error('Error storing event:', eventError);
                }
            }
        } else {
            // Store in SQLite
            for (const event of events) {
                if (event.event_type === 'session_start') {
                    db.run(
                        `INSERT OR IGNORE INTO sessions (session_id, visitor_id, user_agent, screen_width, screen_height, referrer, landing_page, created_at) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            event.session_id,
                            event.visitor_id,
                            event.event_data.user_agent,
                            event.event_data.screen_width,
                            event.event_data.screen_height,
                            event.event_data.referrer,
                            event.event_data.landing_page,
                            event.timestamp
                        ]
                    );
                }
                
                db.run(
                    `INSERT INTO events (session_id, visitor_id, event_type, event_data, page_url, timestamp) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        event.session_id,
                        event.visitor_id,
                        event.event_type,
                        JSON.stringify(event.event_data),
                        event.page_url,
                        event.timestamp
                    ]
                );
            }
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error storing analytics:', error);
        res.status(500).json({ error: 'Failed to store analytics' });
    }
});

// Get analytics summary
app.get('/api/analytics/summary', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        if (USE_SUPABASE) {
            // Query Supabase
            let query = db.from('sessions').select('*', { count: 'exact' });
            
            if (startDate) {
                query = query.gte('created_at', startDate);
            }
            if (endDate) {
                query = query.lte('created_at', endDate);
            }
            
            const { data: sessions, count: sessionCount } = await query;
            
            // Get events
            let eventsQuery = db.from('events').select('*');
            if (startDate) {
                eventsQuery = eventsQuery.gte('timestamp', startDate);
            }
            if (endDate) {
                eventsQuery = eventsQuery.lte('timestamp', endDate);
            }
            
            const { data: events } = await eventsQuery;
            
            res.json({
                totalSessions: sessionCount,
                totalEvents: events.length,
                sessions,
                events
            });
        } else {
            // Query SQLite
            db.all(
                `SELECT * FROM sessions WHERE created_at >= ? AND created_at <= ?`,
                [startDate || '2000-01-01', endDate || '2100-01-01'],
                (err, sessions) => {
                    if (err) {
                        console.error('Error querying sessions:', err);
                        return res.status(500).json({ error: 'Database error' });
                    }
                    
                    db.all(
                        `SELECT * FROM events WHERE timestamp >= ? AND timestamp <= ?`,
                        [startDate || '2000-01-01', endDate || '2100-01-01'],
                        (err, events) => {
                            if (err) {
                                console.error('Error querying events:', err);
                                return res.status(500).json({ error: 'Database error' });
                            }
                            
                            // Parse event_data JSON
                            events = events.map(e => ({
                                ...e,
                                event_data: e.event_data ? JSON.parse(e.event_data) : {}
                            }));
                            
                            res.json({
                                totalSessions: sessions.length,
                                totalEvents: events.length,
                                sessions,
                                events
                            });
                        }
                    );
                }
            );
        }
    } catch (error) {
        console.error('Error fetching analytics summary:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// Get funnel data
app.get('/api/analytics/funnel', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        if (USE_SUPABASE) {
            // Query Supabase for funnel data
            let query = db.from('events').select('session_id, visitor_id, event_type, event_data, timestamp');
            
            if (startDate) {
                query = query.gte('timestamp', startDate);
            }
            if (endDate) {
                query = query.lte('timestamp', endDate);
            }
            
            const { data: events } = await query;
            
            const funnelData = calculateFunnel(events);
            res.json(funnelData);
        } else {
            // Query SQLite
            db.all(
                `SELECT session_id, visitor_id, event_type, event_data, timestamp FROM events 
                 WHERE timestamp >= ? AND timestamp <= ?
                 ORDER BY timestamp ASC`,
                [startDate || '2000-01-01', endDate || '2100-01-01'],
                (err, events) => {
                    if (err) {
                        console.error('Error querying events:', err);
                        return res.status(500).json({ error: 'Database error' });
                    }
                    
                    // Parse event_data JSON
                    events = events.map(e => ({
                        ...e,
                        event_data: e.event_data ? JSON.parse(e.event_data) : {}
                    }));
                    
                    const funnelData = calculateFunnel(events);
                    res.json(funnelData);
                }
            );
        }
    } catch (error) {
        console.error('Error fetching funnel data:', error);
        res.status(500).json({ error: 'Failed to fetch funnel data' });
    }
});

// Calculate funnel metrics
function calculateFunnel(events) {
    const sessionMap = new Map();
    
    events.forEach(event => {
        if (!sessionMap.has(event.session_id)) {
            sessionMap.set(event.session_id, {
                session_id: event.session_id,
                visitor_id: event.visitor_id || 'unknown',
                visited: false,
                usedFilters: false,
                clickedRegistration: false,
                scrolled: false,
                filters: [],
                registrations: [],
                journey: [],
                startTime: null,
                uniqueFilterTypes: new Set()
            });
        }
        
        const session = sessionMap.get(event.session_id);
        
        // Update visitor_id if available (in case first event didn't have it)
        if (event.visitor_id) {
            session.visitor_id = event.visitor_id;
        }
        
        // Add to journey
        session.journey.push({
            event_type: event.event_type,
            event_data: event.event_data,
            timestamp: event.timestamp
        });
        
        if (event.event_type === 'session_start') {
            session.visited = true;
            session.startTime = event.timestamp;
        } else if (event.event_type === 'filter_change') {
            session.usedFilters = true;
            session.filters.push(event.event_data);
            // Track unique filter types used
            if (event.event_data.filter_value !== 'all') {
                session.uniqueFilterTypes.add(event.event_data.filter_type);
            }
        } else if (event.event_type === 'registration_click') {
            session.clickedRegistration = true;
            session.registrations.push(event.event_data);
        } else if (event.event_type === 'scroll_depth') {
            session.scrolled = true;
        }
    });
    
    const allSessions = Array.from(sessionMap.values());
    
    // Calculate session duration for each session
    allSessions.forEach(session => {
        if (session.journey.length > 0) {
            const firstEvent = session.journey[0];
            const lastEvent = session.journey[session.journey.length - 1];
            const durationMs = new Date(lastEvent.timestamp) - new Date(firstEvent.timestamp);
            session.duration = Math.max(0, Math.round(durationMs / 1000)); // Duration in seconds
        } else {
            session.duration = 0;
        }
    });
    
    // Filter out inactive sessions (no filters AND no scrolling)
    const inactiveSessions = allSessions.filter(s => !s.usedFilters && !s.scrolled);
    const activeSessions = allSessions.filter(s => s.usedFilters || s.scrolled);
    
    // Calculate filter usage breakdown (only for active sessions)
    const filterUsageBreakdown = {
        0: 0, 1: 0, 2: 0, 3: 0
    };
    activeSessions.forEach(s => {
        const filterCount = s.uniqueFilterTypes.size;
        filterUsageBreakdown[filterCount] = (filterUsageBreakdown[filterCount] || 0) + 1;
    });
    
    // Calculate duration statistics (only for active sessions)
    const durations = activeSessions.map(s => s.duration).filter(d => d > 0);
    const avgDuration = durations.length > 0 
        ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
        : 0;
    
    // Duration distribution buckets (in seconds)
    const durationDistribution = {
        'under_30s': activeSessions.filter(s => s.duration < 30).length,
        '30s_to_2m': activeSessions.filter(s => s.duration >= 30 && s.duration < 120).length,
        '2m_to_5m': activeSessions.filter(s => s.duration >= 120 && s.duration < 300).length,
        'over_5m': activeSessions.filter(s => s.duration >= 300).length
    };
    
    return {
        totalVisitors: activeSessions.filter(s => s.visited).length,
        usedFilters: activeSessions.filter(s => s.usedFilters).length,
        clickedRegistration: activeSessions.filter(s => s.clickedRegistration).length,
        conversionRate: activeSessions.length > 0 
            ? (activeSessions.filter(s => s.clickedRegistration).length / activeSessions.length * 100).toFixed(2)
            : 0,
        filterUsageBreakdown,
        inactiveJourneys: inactiveSessions.length,
        avgDuration,
        durationDistribution,
        popularFilters: getPopularFilters(activeSessions),
        popularClasses: getPopularClasses(activeSessions),
        activeJourneys: activeSessions.map(s => ({
            session_id: s.session_id,
            visitor_id: s.visitor_id,
            session_id_display: s.session_id.substring(0, 8) + '...',
            startTime: s.startTime,
            journey: s.journey,
            usedFilters: s.usedFilters,
            clickedRegistration: s.clickedRegistration,
            duration: s.duration
        })),
        inactiveJourneysData: inactiveSessions.map(s => ({
            session_id: s.session_id,
            visitor_id: s.visitor_id,
            session_id_display: s.session_id.substring(0, 8) + '...',
            startTime: s.startTime,
            journey: s.journey,
            usedFilters: s.usedFilters,
            clickedRegistration: s.clickedRegistration,
            duration: s.duration
        }))
    };
}

function getPopularFilters(sessions) {
    const filterCounts = {};
    const filterTypeCounts = { age: 0, style: 0, day: 0 };
    
    sessions.forEach(session => {
        session.filters.forEach(filter => {
            // Skip "all" selections for counts
            if (filter.filter_value !== 'all') {
                // Count by type
                filterTypeCounts[filter.filter_type] = (filterTypeCounts[filter.filter_type] || 0) + 1;
                
                // Count specific values
                const key = `${filter.filter_type}: ${filter.filter_value}`;
                filterCounts[key] = (filterCounts[key] || 0) + 1;
            }
        });
    });
    
    // Get top specific filters
    const topFilters = Object.entries(filterCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([filter, count]) => ({ filter, count }));
    
    return {
        byType: filterTypeCounts,
        topFilters
    };
}

function getPopularClasses(sessions) {
    const classCounts = {};
    
    sessions.forEach(session => {
        session.registrations.forEach(reg => {
            const key = reg.class_name || reg.class_id;
            if (!classCounts[key]) {
                classCounts[key] = { ...reg, count: 0 };
            }
            classCounts[key].count++;
        });
    });
    
    return Object.values(classCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
}

// Delete specific session
app.delete('/api/analytics/session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        if (USE_SUPABASE) {
            // Delete from Supabase
            await db
                .from('events')
                .delete()
                .eq('session_id', sessionId);
            
            await db
                .from('sessions')
                .delete()
                .eq('session_id', sessionId);
            
            res.json({
                success: true,
                sessionId
            });
        } else {
            // Delete from SQLite
            db.run('DELETE FROM events WHERE session_id = ?', [sessionId], function(err) {
                if (err) {
                    console.error('Error deleting events:', err);
                    return res.status(500).json({ error: 'Failed to delete events' });
                }
                
                db.run('DELETE FROM sessions WHERE session_id = ?', [sessionId], function(err) {
                    if (err) {
                        console.error('Error deleting session:', err);
                        return res.status(500).json({ error: 'Failed to delete session' });
                    }
                    
                    res.json({
                        success: true,
                        sessionId
                    });
                });
            });
        }
    } catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).json({ error: 'Failed to delete session' });
    }
});

// Clear all analytics data
app.delete('/api/analytics/clear', async (req, res) => {
    try {
        if (USE_SUPABASE) {
            // Clear Supabase data
            const { count: eventsCount } = await db
                .from('events')
                .delete()
                .neq('id', 0); // Delete all rows
            
            const { count: sessionsCount } = await db
                .from('sessions')
                .delete()
                .neq('id', 0); // Delete all rows
            
            res.json({
                success: true,
                eventsDeleted: eventsCount || 0,
                sessionsDeleted: sessionsCount || 0
            });
        } else {
            // Clear SQLite data
            db.run('DELETE FROM events', function(err) {
                if (err) {
                    console.error('Error deleting events:', err);
                    return res.status(500).json({ error: 'Failed to delete events' });
                }
                
                const eventsDeleted = this.changes;
                
                db.run('DELETE FROM sessions', function(err) {
                    if (err) {
                        console.error('Error deleting sessions:', err);
                        return res.status(500).json({ error: 'Failed to delete sessions' });
                    }
                    
                    const sessionsDeleted = this.changes;
                    
                    res.json({
                        success: true,
                        eventsDeleted,
                        sessionsDeleted
                    });
                });
            });
        }
    } catch (error) {
        console.error('Error clearing analytics data:', error);
        res.status(500).json({ error: 'Failed to clear data' });
    }
});

// Initialize and start server
initializeDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Analytics server running on port ${PORT}`);
        console.log(`Environment: ${USE_SUPABASE ? 'Production (Supabase)' : 'Local (SQLite3)'}`);
    });
}).catch(error => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
});
