// Configuration - placeholders will be replaced during build process
const config = {
    googleApiKey: 'AIzaSyC96zgVPNsijSaPAUBOgEAY2r4o-g_Ou5E',
    openRouterApiKey: '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',
    ownerPhoneNumber: '+16509954591'
};

// For browser usage
if (typeof window !== 'undefined') {
    window.config = config;
}

// For Node.js/CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = config;
}
