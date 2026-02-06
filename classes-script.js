// Classes Page Script - Standalone class grid functionality

// Global variables
let allClasses = {};
let filteredClasses = [];
let masterClasses = [];
let currentView = 'regular'; // 'regular', 'master', or season name
let seasons = [];
let filtersInitialized = false; // Track if filters have been set by user

// Blacklist of season names to hide
const SEASON_BLACKLIST = ['Comp dancers  2025-2026-and Info'];

// Google Sheets configuration
const GOOGLE_SHEET_ID = '1oiD4w17jVWc9_4NDAIFZpfWa4Unli5wovxxVUqzyn88';

// Initialize when page loads
window.onload = async function() {
    // First, set up the static parts of the page
    setupFilters();
    setupViewToggle();

    // Wait for all class data to be loaded from Google Sheets
    await loadClassesFromGoogleSheets();

    // Now that data is loaded, handle the initial view based on the URL hash
    const initialView = window.location.hash.substring(1) || (seasons.length > 0 ? seasons[0] : '');
    switchView(initialView, true); // true to prevent re-updating the hash

    // Add a listener to handle back/forward navigation
    window.addEventListener('hashchange', () => {
        const newView = window.location.hash.substring(1) || (seasons.length > 0 ? seasons[0] : '');
        // Call switchView, but don't treat it as the initial page load
        switchView(newView, true); 
    });
};

// Load classes from Google Sheets using API v4
async function loadClassesFromGoogleSheets() {
    try {
        showLoading(true);
        
        if (!GOOGLE_SHEET_ID) throw new Error('Google Sheet ID is not configured');
        
        const apiKey = window.config?.googleApiKey;
        if (!apiKey || apiKey === '{{GOOGLE_API_KEY}}') {
            throw new Error('Google API key is not configured or not replaced during build');
        }

        // First, get sheet metadata to find all sheet names
        const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}?key=${apiKey}&fields=sheets(properties(sheetId,title))`;
        
        console.log('Fetching sheet metadata...');
        const metadataResponse = await fetch(metadataUrl);
        
        if (!metadataResponse.ok) {
            throw new Error('Failed to fetch sheet metadata');
        }
        
        const metadata = await metadataResponse.json();
        const sheets = metadata.sheets || [];
        
        console.log('Available sheets:', sheets.map(s => s.properties.title));
        
        // Filter to season tabs (exclude Call Bookings, Call Availabilities, and blacklisted seasons)
        const seasonSheets = sheets.filter(sheet => {
            const title = sheet.properties.title;
            return !['Call Bookings', 'Call Availabilities'].includes(title) && 
                   !SEASON_BLACKLIST.includes(title);
        });
        
        console.log('Season sheets found:', seasonSheets.map(s => s.properties.title));
        
        // Store season names and create season mapping
        seasons = seasonSheets.map(sheet => sheet.properties.title);
        
        // Load classes from all season sheets
        const allClassPromises = seasonSheets.map(sheet => 
            loadClassesFromSheet(sheet.properties.title, apiKey)
        );
        
        const classArrays = await Promise.all(allClassPromises);
        
        // Organize classes by season
        seasons.forEach((season, index) => {
            allClasses[season] = classArrays[index] || [];
            console.log(`Loaded ${allClasses[season].length} classes for ${season}`);
        });
        
        // Load Master Classes
        await loadMasterClasses(apiKey);
        
        // Display all classes initially
        if (seasons.length > 0) {
            filteredClasses = [...allClasses[seasons[0]]];
        } else {
            filteredClasses = [];
        }
        
        // Analyze age ranges and create buckets
        createAgeBuckets();
        
        // Create dynamic season tabs
        createSeasonTabs();
        
        displayClasses();
        
    } catch (error) {
        console.error('Error loading classes:', error);
        showError('Failed to load classes. Please try again later.');
    } finally {
        showLoading(false);
    }
}

// Load classes from a specific sheet
async function loadClassesFromSheet(sheetName, apiKey) {
    try {
        const range = `${sheetName}!A:Z`; // Get all columns to find class ID
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}?key=${apiKey}`;
        
        console.log(`Loading classes from sheet: ${sheetName}`);
        const response = await fetch(url);
        
        if (!response.ok) {
            console.warn(`Failed to load sheet ${sheetName}:`, response.status);
            return [];
        }
        
        const data = await response.json();
        const rows = data.values || [];
        
        if (rows.length < 2) {
            console.warn(`Sheet ${sheetName} has insufficient data`);
            return [];
        }
        
        // Find class ID column from headers
        const headers = rows[0] || [];
        const classIdColumnIndex = findClassIdColumn(headers);
        const dayColumnIndex = findDayColumn(headers);
        const dateColumnIndex = findDateColumn(headers);
        
        console.log(`Class ID column index for ${sheetName}: ${classIdColumnIndex}`);
        console.log(`Day column index for ${sheetName}: ${dayColumnIndex}`);
        console.log(`Date column index for ${sheetName}: ${dateColumnIndex}`);
        
        // Parse classes from rows (skip header row)
        const classes = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length >= 4 && row[0] && row[3]) { // Ensure name and time exist
                console.log('Raw row data from', sheetName, ':', row);
                
                const classId = extractClassId(row, classIdColumnIndex);
                const day = dayColumnIndex >= 0 ? (row[dayColumnIndex] || '').toString().trim() : '';
                const date = dateColumnIndex >= 0 ? (row[dateColumnIndex] || '').toString().trim() : '';
                
                const classObj = {
                    name: row[0] || '',           // A: Class Name
                    description: row[1] || '',    // B: Description  
                    performance: row[2] || '',    // C: Performance
                    time: row[3] || '',           // D: Time
                    ages: row[4] || 'All Ages',   // E: Ages
                    instructor: row[5] || '',     // F: Instructor
                    date: date,                   // Use actual Date field
                    classId: classId,             // Found class ID
                    season: sheetName,
                    day: day,                    // Use actual Day field
                    styles: extractDanceStyles(row[0] || ''),
                    ageBucket: parseAgeBucket(row[4] || 'All Ages')
                };
                console.log('Processed class:', classObj.name, 'classId:', classObj.classId, 'day:', classObj.day, 'date:', classObj.date, 'season:', classObj.season, 'hasRegisterButton:', !!classObj.classId);
                classes.push(classObj);
            }
        }
        
        console.log(`Loaded ${classes.length} classes from ${sheetName}`);
        return classes;
        
    } catch (error) {
        console.error(`Error loading sheet ${sheetName}:`, error);
        return [];
    }
}

// Find Date column by looking for common headers
function findDateColumn(headers) {
    const dateHeaders = ['date', 'class date', 'event date', 'start date'];
    
    for (let i = 0; i < headers.length; i++) {
        const header = (headers[i] || '').toLowerCase().trim();
        if (dateHeaders.includes(header)) {
            console.log(`Found Date column at index ${i} with header: "${headers[i]}"`);
            return i;
        }
    }
    
    // If no header found, return -1
    console.log('No Date column found');
    return -1;
}

// Find Day column by looking for common headers
function findDayColumn(headers) {
    const dayHeaders = ['day', 'weekday', 'schedule day', 'class day'];
    
    for (let i = 0; i < headers.length; i++) {
        const header = (headers[i] || '').toLowerCase().trim();
        if (dayHeaders.includes(header)) {
            console.log(`Found Day column at index ${i} with header: "${headers[i]}"`);
            return i;
        }
    }
    
    // If no header found, return -1
    console.log('No Day column found');
    return -1;
}

// Find class ID column by looking for common headers or numeric patterns
function findClassIdColumn(headers) {
    // First try to find by common header names
    const classIdHeaders = ['class id', 'classid', 'id', 'class_id', 'registration id', 'reg id'];
    
    for (let i = 0; i < headers.length; i++) {
        const header = (headers[i] || '').toLowerCase().trim();
        if (classIdHeaders.includes(header)) {
            console.log(`Found class ID column at index ${i} with header: "${headers[i]}"`);
            return i;
        }
    }
    
    // If no header found, look for columns with numeric IDs (common pattern)
    for (let i = 0; i < headers.length; i++) {
        const header = headers[i] || '';
        // Check if header looks like a numeric ID (e.g., "12345", "CID-123", etc.)
        if (/^\d+$/.test(header) || /^cid-?\d+$/i.test(header) || /^class-?\d+$/i.test(header)) {
            console.log(`Found class ID column at index ${i} with numeric pattern: "${header}"`);
            return i;
        }
    }
    
    // If still not found, return -1 to indicate no class ID column
    console.log('No class ID column found, checking all columns for numeric values...');
    return -1;
}

// Extract class ID from a row by checking multiple columns
function extractClassId(row, classIdColumnIndex) {
    // If we found a specific class ID column, use it
    if (classIdColumnIndex >= 0 && row[classIdColumnIndex]) {
        return row[classIdColumnIndex].toString().trim();
    }
    
    // Otherwise, search all columns for class ID patterns
    for (let i = 0; i < row.length; i++) {
        const value = (row[i] || '').toString().trim();
        // Look for numeric patterns that could be class IDs
        if (value && /^\d+$/.test(value)) {
            console.log(`Found potential class ID in column ${i}: ${value}`);
            return value;
        }
        // Look for patterns like "CID-123" or "CLASS-123"
        if (value && /^cid-?\d+$/i.test(value) || /^class-?\d+$/i.test(value)) {
            console.log(`Found potential class ID in column ${i}: ${value}`);
            return value;
        }
    }
    
    return '';
}

// Extract day information from class name
function extractDayFromClass(className) {
    const name = className.toLowerCase();
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    for (const day of days) {
        if (name.includes(day)) {
            return day.charAt(0).toUpperCase() + day.slice(1);
        }
    }
    
    return '';
}

// Extract dance styles from class name
function extractDanceStyles(className) {
    const styles = [];
    const name = className.toLowerCase();
    
    if (name.includes('ballet')) styles.push('ballet');
    if (name.includes('jazz')) styles.push('jazz');
    if (name.includes('tap')) styles.push('tap');
    if (name.includes('hip hop') || name.includes('hip-hop')) styles.push('hip-hop');
    if (name.includes('contemporary')) styles.push('contemporary');
    if (name.includes('musical theater') || name.includes('musical theatre')) styles.push('musical-theater');
    if (name.includes('lyrical')) styles.push('lyrical');
    if (name.includes('acro')) styles.push('acro');
    
    return styles;
}

// Parse age range into buckets
function parseAgeBucket(ageString) {
    if (!ageString || ageString.trim() === '') {
        return 'all-ages';
    }
    
    const age = ageString.toLowerCase();
    
    // Extract numbers from age string
    const numbers = age.match(/\d+/g) || [];
    const minAge = numbers.length > 0 ? parseInt(numbers[0]) : 0;
    const maxAge = numbers.length > 1 ? parseInt(numbers[1]) : minAge;
    
    // Categorize into buckets based on age ranges
    if (age.includes('adult') || minAge >= 18) return 'adult';
    if (age.includes('teen') || minAge >= 13 || (minAge >= 12 && maxAge >= 15)) return 'teen';
    if (minAge >= 8 || (minAge >= 6 && maxAge >= 10)) return 'elementary';
    if (minAge >= 4 || (minAge >= 3 && maxAge >= 6)) return 'preschool';
    if (minAge >= 1 && minAge <= 3) return 'toddler';
    if (age.includes('all')) return 'all-ages';
    
    // Default categorization based on typical ranges
    if (maxAge <= 3) return 'toddler';
    if (maxAge <= 6) return 'preschool';
    if (maxAge <= 12) return 'elementary';
    if (maxAge <= 17) return 'teen';
    
    return 'all-ages';
}

// Create dynamic season tabs
function createSeasonTabs() {
    const toggleSection = document.querySelector('.view-toggle-section .toggle-buttons');
    
    // Clear existing tabs
    toggleSection.innerHTML = '';
    
    // Add season tabs
    seasons.forEach((season, index) => {
        const button = document.createElement('button');
        button.id = `season-${season.toLowerCase().replace(/\s+/g, '-')}-btn`;
        button.className = 'toggle-btn';
        if (index === 0) button.classList.add('active'); // First season is active by default
        
        button.innerHTML = `
            <i class="fas fa-calendar-alt"></i>
            <span>${season}</span>
        `;
        
        button.addEventListener('click', () => switchView(season));
        toggleSection.appendChild(button);
    });
}

// Create age buckets from all classes
function createAgeBuckets() {
    const buckets = new Set();
    
    // Collect buckets from all seasons
    Object.values(allClasses).forEach(seasonClasses => {
        seasonClasses.forEach(cls => {
            const bucket = parseAgeBucket(cls.ages);
            buckets.add(bucket);
            cls.ageBucket = bucket; // Add bucket to class object
        });
    });
    
    console.log('Age buckets found:', Array.from(buckets));
    
    // Update age filter dropdown
    updateAgeFilterOptions(Array.from(buckets));
}

// Update age filter dropdown with buckets
function updateAgeFilterOptions(buckets) {
    const ageFilter = document.getElementById('age-filter');
    
    // Clear existing options except "All Ages"
    ageFilter.innerHTML = '<option value="">All Ages</option>';
    
    // Add bucket options in logical order
    const bucketOrder = ['toddler', 'preschool', 'elementary', 'teen', 'adult', 'all-ages'];
    const bucketLabels = {
        'toddler': 'Toddler (1-3)',
        'preschool': 'Preschool (4-6)', 
        'elementary': 'Elementary (7-12)',
        'teen': 'Teen (13-17)',
        'adult': 'Adult (18+)',
        'all-ages': 'All Ages'
    };
    
    bucketOrder.forEach(bucket => {
        if (buckets.includes(bucket)) {
            const option = document.createElement('option');
            option.value = bucket;
            option.textContent = bucketLabels[bucket];
            ageFilter.appendChild(option);
        }
    });
}

// Setup filter functionality
function setupFilters() {
    const ageFilter = document.getElementById('age-filter');
    const styleFilter = document.getElementById('style-filter');
    // Day filter is now disabled since seasons are handled by tabs
    
    ageFilter.addEventListener('change', () => {
        if (window.analytics) {
            window.analytics.trackFilterChange('age', ageFilter.value || 'all');
        }
        applyFilters();
    });
    styleFilter.addEventListener('change', () => {
        if (window.analytics) {
            window.analytics.trackFilterChange('style', styleFilter.value || 'all');
        }
        applyFilters();
    });
}

// Apply filters to classes
function applyFilters() {
    const ageFilter = document.getElementById('age-filter').value;
    const styleFilter = document.getElementById('style-filter').value;
    // Day filter removed - seasons are handled by tabs
    
    filteredClasses = (allClasses[currentView] || []).filter(cls => {
        // Age filter - now using buckets
        if (ageFilter && cls.ageBucket !== ageFilter) {
            return false;
        }
        
        // Style filter
        if (styleFilter && !cls.styles.includes(styleFilter)) {
            return false;
        }
        
        // No day filter needed - classes are already filtered by season tab
        
        return true;
    });
    
    displayClasses();
}


// Display classes in grid
function displayClasses() {
    const grid = document.getElementById('classes-grid');
    
    if (filteredClasses.length === 0) {
        grid.innerHTML = `
            <div class="no-classes">
                <i class="fas fa-search"></i>
                <h3>No classes found</h3>
                <p>Try adjusting your filters to see more classes.</p>
            </div>
        `;
        return;
    }
    
    console.log('Sample class data:', filteredClasses[0]);
    
    grid.innerHTML = filteredClasses.map(cls => `
        <div class="class-card">
            <div class="class-header">
                <h3>${cls.name}</h3>
                ${cls.classId ? `
                    <button class="register-btn" onclick='openRegistration("${cls.classId}", "${cls.day || cls.season}", ${JSON.stringify({name: cls.name, day: cls.day || cls.season, time: cls.time, style: cls.styles ? cls.styles[0] : "Unknown", instructor: cls.instructor || "Unknown"}).replace(/'/g, "&apos;")})'>
                        <i class="fas fa-user-plus"></i>
                        Register
                    </button>
                ` : ''}
            </div>
            <div class="class-info">
                <div class="class-info-item">
                    <i class="fas fa-clock"></i>
                    <span>${cls.time}</span>
                </div>
                ${cls.date ? `
                    <div class="class-info-item">
                        <i class="fas fa-calendar"></i>
                        <span>${cls.date}</span>
                    </div>
                ` : ''}
                ${cls.day ? `
                    <div class="class-info-item">
                        <i class="fas fa-calendar-day"></i>
                        <span>Every ${cls.day}</span>
                    </div>
                ` : ''}
                <div class="class-info-item">
                    <i class="fas fa-users"></i>
                    <span>${cls.ages}</span>
                </div>
                ${cls.instructor ? `
                    <div class="class-info-item">
                        <i class="fas fa-user"></i>
                        <span>${cls.instructor}</span>
                    </div>
                ` : ''}
                ${cls.level ? `
                    <div class="class-info-item">
                        <i class="fas fa-star"></i>
                        <span>${cls.level}</span>
                    </div>
                ` : ''}
                ${cls.duration ? `
                    <div class="class-info-item">
                        <i class="fas fa-hourglass-half"></i>
                        <span>${cls.duration}</span>
                    </div>
                ` : ''}
            </div>
            ${cls.description ? `
                <div class="class-description">
                    ${cls.description}
                </div>
            ` : ''}
        </div>
    `).join('');
}

// Show/hide loading indicator
function showLoading(show) {
    const loading = document.getElementById('loading');
    const grid = document.getElementById('classes-grid');
    
    if (show) {
        loading.style.display = 'block';
        grid.style.display = 'none';
    } else {
        loading.style.display = 'none';
        grid.style.display = 'grid';
    }
}

// Show error message
function showError(message) {
    const grid = document.getElementById('classes-grid');
    grid.innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error</h3>
            <p>${message}</p>
            <button onclick="loadClassesFromGoogleSheets()" style="background: var(--primary-color); color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer;">Try Again</button>
        </div>
    `;
}

// Open registration page in new tab
function openRegistration(classId, classDay, classData = {}) {
    if (!classId) {
        console.error('Class ID is required for registration');
        alert('Registration is not available for this class. Please contact the studio directly.');
        return;
    }
    
    // Track registration click
    if (window.analytics) {
        window.analytics.trackRegistrationClick({
            classId: classId,
            name: classData.name || 'Unknown',
            day: classDay || classData.day || 'Unknown',
            time: classData.time || 'Unknown',
            style: classData.style || 'Unknown',
            instructor: classData.instructor || 'Unknown'
        });
    }
    
    let registrationUrl = `https://app.thestudiodirector.com/thedancecompanyoflos/portal.sd?page=Enroll&cident=${classId}`;
    
    window.open(registrationUrl, '_blank');
}

// Parse date string into Date object for sorting
function parseClassDate(dateString) {
    if (!dateString) return new Date(0); // Return epoch for empty dates (sort to beginning)
    
    // Try to parse various date formats
    // Common formats: MM/DD/YYYY, MM-DD-YYYY, YYYY-MM-DD, Month DD, YYYY, etc.
    let date = new Date(dateString);
    
    // If direct parsing fails, try some common formats
    if (isNaN(date.getTime())) {
        // Try MM/DD/YYYY or MM-DD-YYYY format
        const parts = dateString.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (parts) {
            date = new Date(parseInt(parts[3]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }
    }
    
    // If still invalid, return epoch date
    if (isNaN(date.getTime())) {
        console.warn('Could not parse date:', dateString);
        return new Date(0);
    }
    
    return date;
}

// Load Master Classes from Google Sheets
async function loadMasterClasses(apiKey) {
    try {
        const range = 'Master Classes!A:H'; // A-H columns
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}?key=${apiKey}`;
        
        console.log('Loading Master Classes...');
        const response = await fetch(url);
        
        if (!response.ok) {
            console.warn('Failed to load Master Classes sheet:', response.status);
            masterClasses = [];
            return;
        }
        
        const data = await response.json();
        const rows = data.values || [];
        
        if (rows.length < 2) {
            console.warn('Master Classes sheet has insufficient data');
            masterClasses = [];
            return;
        }
        
        // Parse master classes from rows (skip header row)
        masterClasses = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length >= 7 && row[0] && row[6]) { // Ensure name and date exist (date is column G)
                console.log('Raw master class row data:', row);
                const masterClass = {
                    name: row[0] || '',           // A: Class Name
                    description: row[1] || '',    // B: Description  
                    performance: row[2] || '',    // C: Performance
                    time: row[3] || '',           // D: Time
                    ages: row[4] || 'All Ages',   // E: Ages
                    choreographer: row[5] || '',  // F: Instructor (renamed from choreographer)
                    date: row[6] || '',           // G: Date
                    classId: row[7] || '',        // H: Class ID
                    type: 'master',
                    styles: extractDanceStyles(row[0] || ''),
                    parsedDate: parseClassDate(row[6] || '') // Add parsed date for sorting (column G)
                };
                console.log('Processed master class:', masterClass.name, 'date:', masterClass.date);
                masterClasses.push(masterClass);
            }
        }
        
        // Sort master classes by date (earliest first)
        masterClasses.sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());
        
        console.log(`Loaded and sorted ${masterClasses.length} master classes by date`);
        
    } catch (error) {
        console.error('Error loading Master Classes:', error);
        masterClasses = [];
    }
}

// Setup view toggle functionality
function setupViewToggle() {
    // This will be handled dynamically by createSeasonTabs()
    console.log('View toggle will be set up after seasons are loaded');
}

// Switch between season views
function switchView(view, isInitialLoad = false) {
    if (currentView === view && !isInitialLoad) return; // Avoid unnecessary re-renders

    const filtersSection = document.getElementById('filters-section');
    const toggleButtons = document.querySelectorAll('.toggle-btn');

    currentView = view;
    
    // Track view change
    if (window.analytics && !isInitialLoad) {
        window.analytics.trackViewChange(view);
    }

    // Remove active class from all buttons
    toggleButtons.forEach(btn => btn.classList.remove('active'));
    
    // Activate season button
    const seasonBtn = document.getElementById(`season-${view.toLowerCase().replace(/\s+/g, '-')}-btn`);
    if (seasonBtn) seasonBtn.classList.add('active');
    
    filtersSection.style.display = 'grid';
    filteredClasses = [...(allClasses[view] || [])];
    applyFilters();

    // Update the URL hash without triggering a page reload
    if (!isInitialLoad) {
        history.pushState(null, null, '#' + view);
    }
}

// Display master classes
function displayMasterClasses() {
    const grid = document.getElementById('classes-grid');
    
    if (masterClasses.length === 0) {
        grid.innerHTML = `
            <div class="no-classes">
                <i class="fas fa-star"></i>
                <h3>No master classes available</h3>
                <p>Check back soon for upcoming master classes with guest choreographers.</p>
            </div>
        `;
        return;
    }
    
    console.log('Displaying master classes:', masterClasses.length);
    
    grid.innerHTML = masterClasses.map(cls => `
        <div class="class-card master-class-card">
            <div class="class-header">
                <h3>${cls.name}</h3>
                <div class="master-class-badge">
                    <i class="fas fa-star"></i>
                    Master Class
                </div>
                ${cls.classId ? `
                    <button class="register-btn" onclick='openRegistration("${cls.classId}", "${cls.date}", ${JSON.stringify({name: cls.name, day: cls.date, time: cls.time || "TBD", style: "Master Class", instructor: cls.choreographer || "Guest"}).replace(/'/g, "&apos;")})'>
                        <i class="fas fa-user-plus"></i>
                        Register
                    </button>
                ` : ''}
            </div>
            <div class="class-info">
                <div class="class-info-item">
                    <i class="fas fa-calendar"></i>
                    <span>${cls.date}</span>
                </div>
                ${cls.time ? `
                    <div class="class-info-item">
                        <i class="fas fa-clock"></i>
                        <span>${cls.time}</span>
                    </div>
                ` : ''}
                <div class="class-info-item">
                    <i class="fas fa-users"></i>
                    <span>${cls.ages}</span>
                </div>
                ${cls.choreographer ? `
                    <div class="class-info-item">
                        <i class="fas fa-user-tie"></i>
                        <span>Choreographer: ${cls.choreographer}</span>
                    </div>
                ` : ''}
            </div>
            ${cls.description ? `
                <div class="class-description">
                    ${cls.description}
                </div>
            ` : ''}
        </div>
    `).join('');
}
