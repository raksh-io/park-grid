const fs = require('fs');
const path = require('path');

// Folder to output the final site
const outputDir = './dist';

// Files and folders to copy to dist
const assetsToCopy = [
    'admin.html', 'admin.js', 'auth.js', 'config.js', 'index.html',
    'dashboard.html', 'login.html', 'payment.html', 'script.js',
    'style.css', 'success.html', 'Bg.jpeg', 'logo.png'
];

// Placeholders to replace inside the dist folder
const replacements = [
    { 
        file: 'config.js', 
        pairs: [
            { placeholder: 'YOUR_SUPABASE_URL', env: 'SUPABASE_URL' },
            { placeholder: 'YOUR_SUPABASE_ANON_KEY', env: 'SUPABASE_ANON_KEY' }
        ] 
    },
    { 
        file: 'payment.html', 
        pairs: [
            { placeholder: 'YOUR_RAZORPAY_KEY', env: 'RAZORPAY_KEY' }
        ] 
    }
];

console.log('🚀 Starting professional build process...');

// 1. Create or clean dist folder
if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
}
fs.mkdirSync(outputDir);

// 2. Copy assets to dist
assetsToCopy.forEach(asset => {
    const src = path.resolve(__dirname, asset);
    const dest = path.resolve(__dirname, outputDir, asset);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`📂 Copied: ${asset}`);
    } else {
        console.warn(`⚠️ Warning: Asset not found: ${asset}`);
    }
});

// 3. Perform injections in the dist folder
replacements.forEach(item => {
    const filePath = path.resolve(__dirname, outputDir, item.file);
    if (!fs.existsSync(filePath)) return;

    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    item.pairs.forEach(pair => {
        const envValue = process.env[pair.env];
        if (envValue) {
            console.log(`✅ Injecting ${pair.env} into ${item.file}`);
            const regex = new RegExp(pair.placeholder, 'g');
            content = content.replace(regex, envValue);
            modified = true;
        } else {
            console.error(`❌ ERROR: Environment variable "${pair.env}" is NOT set in Vercel!`);
            console.error(`👉 Go to Project Settings > Environment Variables and add "${pair.env}".`);
            process.exit(1); // Stop the build immediately
        }
    });

    if (modified) {
        fs.writeFileSync(filePath, content);
    }
});

console.log('✨ Build completed! Your site is ready in the /dist folder.');
