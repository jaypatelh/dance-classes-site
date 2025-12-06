// Analytics tracking module
// Supports both Supabase (production) and SQLite3 (local development)

class Analytics {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.sessionStart = Date.now();
        this.isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        // Use local server for development, Netlify functions for production
        this.apiEndpoint = this.isLocal 
            ? 'http://localhost:3001/api/analytics' 
            : '/.netlify/functions/analytics';
        this.eventQueue = [];
        this.flushInterval = 5000; // Flush events every 5 seconds
        
        this.initializeSession();
        this.setupEventListeners();
        this.startFlushTimer();
    }

    generateSessionId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    async initializeSession() {
        const sessionData = {
            session_id: this.sessionId,
            user_agent: navigator.userAgent,
            screen_width: window.screen.width,
            screen_height: window.screen.height,
            referrer: document.referrer || 'direct',
            landing_page: window.location.pathname + window.location.search + window.location.hash,
            timestamp: new Date().toISOString()
        };

        await this.trackEvent('session_start', sessionData);
    }

    setupEventListeners() {
        // Track page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.trackEvent('page_hidden', { duration: Date.now() - this.sessionStart });
            } else {
                this.trackEvent('page_visible', {});
            }
        });

        // Track when user leaves
        window.addEventListener('beforeunload', () => {
            this.trackEvent('session_end', { 
                duration: Date.now() - this.sessionStart 
            }, true); // Synchronous for beforeunload
        });

        // Track scroll depth at key milestones
        let maxScrollDepth = 0;
        const scrollMilestones = [25, 50, 75, 100];
        window.addEventListener('scroll', this.debounce(() => {
            const scrollDepth = Math.round((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100);
            
            // Find the highest milestone we've passed
            for (let milestone of scrollMilestones) {
                if (scrollDepth >= milestone && maxScrollDepth < milestone) {
                    maxScrollDepth = milestone;
                    this.trackEvent('scroll_depth', { depth: milestone });
                    break;
                }
            }
        }, 500));
    }

    startFlushTimer() {
        setInterval(() => {
            this.flushEvents();
        }, this.flushInterval);
    }

    async trackEvent(eventType, eventData, synchronous = false) {
        const event = {
            session_id: this.sessionId,
            event_type: eventType,
            event_data: eventData,
            timestamp: new Date().toISOString(),
            page_url: window.location.href
        };

        if (synchronous) {
            // Use sendBeacon for synchronous events (like beforeunload)
            const blob = new Blob([JSON.stringify([event])], { type: 'application/json' });
            navigator.sendBeacon(this.apiEndpoint, blob);
        } else {
            this.eventQueue.push(event);
        }
    }

    async flushEvents() {
        if (this.eventQueue.length === 0) return;

        const eventsToSend = [...this.eventQueue];
        this.eventQueue = [];

        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(eventsToSend)
            });

            if (!response.ok) {
                console.error('Failed to send analytics events:', response.statusText);
                // Re-queue events if failed
                this.eventQueue.push(...eventsToSend);
            }
        } catch (error) {
            console.error('Error sending analytics:', error);
            // Re-queue events if failed
            this.eventQueue.push(...eventsToSend);
        }
    }

    // Public methods for tracking specific events

    trackFilterChange(filterType, filterValue) {
        this.trackEvent('filter_change', {
            filter_type: filterType,
            filter_value: filterValue
        });
    }

    trackViewChange(viewType) {
        this.trackEvent('view_change', {
            view_type: viewType
        });
    }

    trackClassView(classData) {
        this.trackEvent('class_view', {
            class_id: classData.classId,
            class_name: classData.name,
            day: classData.day,
            time: classData.time,
            style: classData.style,
            instructor: classData.instructor
        });
    }

    trackRegistrationClick(classData) {
        this.trackEvent('registration_click', {
            class_id: classData.classId,
            class_name: classData.name,
            day: classData.day,
            time: classData.time,
            style: classData.style,
            instructor: classData.instructor
        });
    }

    trackSearch(searchTerm) {
        this.trackEvent('search', {
            search_term: searchTerm
        });
    }

    trackError(errorMessage, errorContext) {
        this.trackEvent('error', {
            error_message: errorMessage,
            error_context: errorContext
        });
    }

    // Utility function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Initialize analytics when the script loads
window.analytics = new Analytics();
