const fs = require('fs');
const path = require('path');

// Configuration
const filesToProcess = [
    {
        path: './config.js',
        replacements: [
            { placeholder: 'YOUR_SUPABASE_URL', env: 'SUPABASE_URL' },
            { placeholder: 'YOUR_SUPABASE_ANON_KEY', env: 'SUPABASE_ANON_KEY' }
        ]
    },
    {
        path: './payment.html',
        replacements: [
            { placeholder: 'YOUR_RAZORPAY_KEY', env: 'RAZORPAY_KEY' }
        ]
    }
];

console.log('🚀 Starting build process: Injecting environment variables...');

filesToProcess.forEach(file => {
    const filePath = path.resolve(__dirname, file.path);
    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Warning: File not found: ${file.path}`);
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    file.replacements.forEach(rep => {
        const envValue = process.env[rep.env];
        if (envValue) {
            console.log(`✅ Injecting ${rep.env} into ${file.path}`);
            content = content.replace(rep.placeholder, envValue);
            modified = true;
        } else {
            console.warn(`❌ Skipping ${rep.env}: Environment variable not set.`);
        }
    });

    if (modified) {
        fs.writeFileSync(filePath, content);
        console.log(`💾 Successfully updated ${file.path}`);
    }
});

console.log('✨ Build completed!');
