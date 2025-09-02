// Configuration - placeholders will be replaced during build process
const config = {
    googleApiKey: '{{GOOGLE_API_KEY}}',
    openRouterApiKey: '{{OPENROUTER_API_KEY}}',
    ownerPhoneNumber: '{{OWNER_PHONE_NUMBER}}'
};

// For browser usage
if (typeof window !== 'undefined') {
    window.config = config;
}

// For Node.js/CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = config;
}
