// Netlify Function for Analytics API
// This handles analytics storage in Supabase for production

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

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
                visited: false,
                usedFilters: false,
                clickedRegistration: false,
                filters: [],
                registrations: [],
                journey: [],
                startTime: null,
                uniqueFilterTypes: new Set()
            });
        }
        
        const session = sessionMap.get(event.session_id);
        
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
        }
    });
    
    const sessions = Array.from(sessionMap.values());
    
    // Calculate filter usage breakdown
    const filterUsageBreakdown = {
        0: 0, 1: 0, 2: 0, 3: 0
    };
    sessions.forEach(s => {
        const filterCount = s.uniqueFilterTypes.size;
        filterUsageBreakdown[filterCount] = (filterUsageBreakdown[filterCount] || 0) + 1;
    });
    
    return {
        totalVisitors: sessions.filter(s => s.visited).length,
        usedFilters: sessions.filter(s => s.usedFilters).length,
        clickedRegistration: sessions.filter(s => s.clickedRegistration).length,
        conversionRate: sessions.length > 0 
            ? (sessions.filter(s => s.clickedRegistration).length / sessions.length * 100).toFixed(2)
            : 0,
        filterUsageBreakdown,
        popularFilters: getPopularFilters(sessions),
        popularClasses: getPopularClasses(sessions),
        visitorJourneys: sessions.map(s => ({
            session_id: s.session_id.substring(0, 8) + '...', // Shortened for display
            startTime: s.startTime,
            journey: s.journey,
            usedFilters: s.usedFilters,
            clickedRegistration: s.clickedRegistration
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
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Supabase not configured' })
        };
    }

    const path = event.path.replace('/.netlify/functions/analytics', '');

    try {
        // POST /api/analytics - Store events
        if (event.httpMethod === 'POST' && path === '') {
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
        console.error('Analytics function error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
