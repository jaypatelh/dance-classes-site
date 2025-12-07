// Netlify Function for Analytics API
// This handles analytics storage in Supabase for production

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY; // Support both names

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase credentials not configured');
}

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Helper function to calculate funnel metrics
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

exports.handler = async (event, context) => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (!supabase) {
        console.error('Supabase not configured. Check environment variables:', {
            hasUrl: !!process.env.SUPABASE_URL,
            hasAnonKey: !!process.env.SUPABASE_ANON_KEY,
            hasKey: !!process.env.SUPABASE_KEY,
            useSupabase: process.env.USE_SUPABASE
        });
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Supabase not configured',
                details: 'Check SUPABASE_URL and SUPABASE_ANON_KEY environment variables'
            })
        };
    }

    // Extract the path - get everything after /analytics
    const pathMatch = event.path.match(/\/analytics(.*)$/);
    const path = pathMatch ? pathMatch[1] : '';
    
    console.log('Function called with path:', event.path, '-> normalized:', path);

    try {
        // POST /api/analytics - Store events
        if (event.httpMethod === 'POST' && (path === '' || path === '/')) {
            const events = JSON.parse(event.body);
            const eventsArray = Array.isArray(events) ? events : [events];

            for (const evt of eventsArray) {
                // Store session if it's a session_start event
                if (evt.event_type === 'session_start') {
                    await supabase
                        .from('sessions')
                        .upsert({
                            session_id: evt.session_id,
                            user_agent: evt.event_data.user_agent,
                            screen_width: evt.event_data.screen_width,
                            screen_height: evt.event_data.screen_height,
                            referrer: evt.event_data.referrer,
                            landing_page: evt.event_data.landing_page,
                            created_at: evt.timestamp
                        }, { onConflict: 'session_id' });
                }

                // Store event
                await supabase
                    .from('events')
                    .insert({
                        session_id: evt.session_id,
                        event_type: evt.event_type,
                        event_data: evt.event_data,
                        page_url: evt.page_url,
                        timestamp: evt.timestamp
                    });
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true })
            };
        }

        // GET /api/analytics/summary
        if (event.httpMethod === 'GET' && path === '/summary') {
            const { startDate, endDate } = event.queryStringParameters || {};

            let sessionsQuery = supabase.from('sessions').select('*', { count: 'exact' });
            if (startDate) sessionsQuery = sessionsQuery.gte('created_at', startDate);
            if (endDate) sessionsQuery = sessionsQuery.lte('created_at', endDate);

            const { data: sessions, count: sessionCount } = await sessionsQuery;

            let eventsQuery = supabase.from('events').select('*');
            if (startDate) eventsQuery = eventsQuery.gte('timestamp', startDate);
            if (endDate) eventsQuery = eventsQuery.lte('timestamp', endDate);

            const { data: events } = await eventsQuery;

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    totalSessions: sessionCount,
                    totalEvents: events.length,
                    sessions,
                    events
                })
            };
        }

        // GET /api/analytics/funnel
        if (event.httpMethod === 'GET' && path === '/funnel') {
            const { startDate, endDate } = event.queryStringParameters || {};

            let query = supabase.from('events').select('session_id, event_type, event_data, timestamp');
            if (startDate) query = query.gte('timestamp', startDate);
            if (endDate) query = query.lte('timestamp', endDate);

            const { data: events } = await query;
            const funnelData = calculateFunnel(events || []);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(funnelData)
            };
        }

        // DELETE /api/analytics/session/:sessionId - Delete specific session
        if (event.httpMethod === 'DELETE' && path.startsWith('/session/')) {
            const sessionId = path.replace('/session/', '');
            
            // Delete events for this session
            await supabase
                .from('events')
                .delete()
                .eq('session_id', sessionId);
            
            // Delete session
            await supabase
                .from('sessions')
                .delete()
                .eq('session_id', sessionId);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    sessionId
                })
            };
        }

        // DELETE /api/analytics/clear - Clear all data
        if (event.httpMethod === 'DELETE' && path === '/clear') {
            // Delete all events
            const { count: eventsCount } = await supabase
                .from('events')
                .delete()
                .neq('id', 0); // Delete all rows
            
            // Delete all sessions
            const { count: sessionsCount } = await supabase
                .from('sessions')
                .delete()
                .neq('id', 0); // Delete all rows
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    eventsDeleted: eventsCount || 0,
                    sessionsDeleted: sessionsCount || 0
                })
            };
        }

        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Not found' })
        };

    } catch (error) {
        console.error('Analytics function error:', {
            message: error.message,
            stack: error.stack,
            path: event.path,
            method: event.httpMethod
        });
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: error.message,
                path: event.path,
                method: event.httpMethod
            })
        };
    }
};
