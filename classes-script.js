// Classes Page Script - Standalone class grid functionality

// Global variables
let allClasses = [];
let filteredClasses = [];
let masterClasses = [];
let currentView = 'regular'; // 'regular' or 'master'

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
    const initialView = window.location.hash.substring(1) || 'regular';
    switchView(initialView, true); // true to prevent re-updating the hash

    // Add a listener to handle back/forward navigation
    window.addEventListener('hashchange', () => {
        const newView = window.location.hash.substring(1) || 'regular';
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
        
        // Filter to only Monday through Saturday sheets
        const classSheets = sheets.filter(sheet => {
            const title = sheet.properties.title.toLowerCase();
            return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].includes(title);
        });
        
        console.log('Class sheets found:', classSheets.map(s => s.properties.title));
        
        // Load classes from all relevant sheets
        const allClassPromises = classSheets.map(sheet => 
            loadClassesFromSheet(sheet.properties.title, apiKey)
        );
        
        const classArrays = await Promise.all(allClassPromises);
        allClasses = classArrays.flat().filter(cls => cls && cls.name);
        
        console.log(`Loaded ${allClasses.length} regular classes total`);
        
        // Load Master Classes
        await loadMasterClasses(apiKey);
        
        // Display all classes initially
        filteredClasses = [...allClasses];
        
        // Analyze age ranges and create buckets
        createAgeBuckets();
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
        const range = `${sheetName}!A:H`; // A-H columns (including Class ID in column H)
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
        
        // Parse classes from rows (skip header row)
        const classes = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length >= 4 && row[0] && row[3]) { // Ensure name and time exist
                console.log('Raw row data:', row);
                const classObj = {
                    name: row[0] || '',           // A: Class Name
                    description: row[1] || '',    // B: Description  
                    performance: row[2] || '',    // C: Performance
                    time: row[3] || '',           // D: Time
                    ages: row[4] || 'All Ages',   // E: Ages
                    instructor: row[5] || '',     // F: Instructor
                    date: row[6] || '',           // G: Date (if applicable)
                    classId: row[7] || '',        // H: Class ID
                    day: sheetName,
                    styles: extractDanceStyles(row[0] || ''),
                    ageBucket: parseAgeBucket(row[4] || 'All Ages')
                };
                console.log('Processed class:', classObj.name, 'ages:', classObj.ages, 'time:', classObj.time, 'classId:', classObj.classId);
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

// Create age buckets from all classes
function createAgeBuckets() {
    const buckets = new Set();
    
    allClasses.forEach(cls => {
        const bucket = parseAgeBucket(cls.ages);
        buckets.add(bucket);
        cls.ageBucket = bucket; // Add bucket to class object
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
    const dayFilter = document.getElementById('day-filter');
    
    ageFilter.addEventListener('change', applyFilters);
    styleFilter.addEventListener('change', applyFilters);
    dayFilter.addEventListener('change', applyFilters);
}

// Apply filters to classes
function applyFilters() {
    const ageFilter = document.getElementById('age-filter').value;
    const styleFilter = document.getElementById('style-filter').value;
    const dayFilter = document.getElementById('day-filter').value;
    
    filteredClasses = allClasses.filter(cls => {
        // Age filter - now using buckets
        if (ageFilter && cls.ageBucket !== ageFilter) {
            return false;
        }
        
        // Style filter
        if (styleFilter && !cls.styles.includes(styleFilter)) {
            return false;
        }
        
        // Day filter
        if (dayFilter && cls.day.toLowerCase() !== dayFilter.toLowerCase()) {
            return false;
        }
        
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
                    <button class="register-btn" onclick="openRegistration('${cls.classId}')">
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
                <div class="class-info-item">
                    <i class="fas fa-calendar-day"></i>
                    <span>${cls.day}</span>
                </div>
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
function openRegistration(classId) {
    if (!classId) {
        console.error('Class ID is required for registration');
        alert('Registration is not available for this class. Please contact the studio directly.');
        return;
    }
    
    const registrationUrl = `https://app.thestudiodirector.com/thedancecompanyoflos/portal.sd?page=Enroll&cident=${classId}`;
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
    const regularBtn = document.getElementById('regular-classes-btn');
    const masterBtn = document.getElementById('master-classes-btn');
    
    regularBtn.addEventListener('click', () => switchView('regular'));
    masterBtn.addEventListener('click', () => switchView('master'));
}

// Switch between regular and master class views
function switchView(view, isInitialLoad = false) {
    if (currentView === view && !isInitialLoad) return; // Avoid unnecessary re-renders

    const regularBtn = document.getElementById('regular-classes-btn');
    const masterBtn = document.getElementById('master-classes-btn');
    const filtersSection = document.getElementById('filters-section');

    currentView = view;

    if (view === 'master') {
        masterBtn.classList.add('active');
        regularBtn.classList.remove('active');
        filtersSection.style.display = 'none';
        displayMasterClasses();
    } else {
        regularBtn.classList.add('active');
        masterBtn.classList.remove('active');
        filtersSection.style.display = 'grid';
        filteredClasses = [...allClasses];
        applyFilters();
    }

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
                    <button class="register-btn" onclick="openRegistration('${cls.classId}')">
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
