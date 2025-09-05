#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load environment variables from .env file if it exists
function loadEnvFile() {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const lines = envContent.split('\n');
        
        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split('=');
                if (key && valueParts.length > 0) {
                    const value = valueParts.join('=').trim();
                    process.env[key.trim()] = value;
                }
            }
        });
    }
}

// Replace placeholders in config.js with environment variables
function buildConfig() {
    console.log('Building configuration...');
    
    // Load environment variables
    loadEnvFile();
    
    // Read the template config file
    const configTemplate = fs.readFileSync(path.join(__dirname, 'config.js'), 'utf8');
    
    // Replace placeholders with environment variables
    let configContent = configTemplate;
    
    const replacements = {
        '{{GOOGLE_API_KEY}}': process.env.GOOGLE_API_KEY || '',
        '{{OPENROUTER_API_KEY}}': process.env.OPENROUTER_API_KEY || '',
        '{{OWNER_PHONE_NUMBER}}': process.env.OWNER_PHONE_NUMBER || '+16509954591'
    };
    
    // Check for required environment variables
    const requiredVars = ['GOOGLE_API_KEY'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        console.error('❌ Missing required environment variables:', missingVars);
        console.error('Please set these environment variables in your Netlify dashboard:');
        console.error('- Go to Site settings > Environment variables');
        console.error('- Add GOOGLE_API_KEY with your Google Sheets API key');
        console.error('- Optionally add OPENROUTER_API_KEY and OWNER_PHONE_NUMBER');
        process.exit(1);
    }
    
    Object.entries(replacements).forEach(([placeholder, value]) => {
        configContent = configContent.replace(new RegExp(placeholder, 'g'), value);
    });
    
    // Write the built config
    const outputPath = path.join(__dirname, 'config.built.js');
    fs.writeFileSync(outputPath, configContent);
    
    console.log('✅ Configuration built successfully!');
    console.log(`Output: ${outputPath}`);
    
    // Validate that all placeholders were replaced
    const remainingPlaceholders = configContent.match(/\{\{[^}]+\}\}/g);
    if (remainingPlaceholders) {
        console.warn('⚠️  Warning: Some placeholders were not replaced:', remainingPlaceholders);
    } else {
        console.log('✅ All placeholders successfully replaced');
    }
}

// Run the build
if (require.main === module) {
    buildConfig();
}

module.exports = { buildConfig };
