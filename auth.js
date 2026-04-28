// auth.js - ParkGrid Authentication Logic

console.log("auth.js loaded. Initializing...");

// Auto-check session on load
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    console.log("Auth Event:", event);
    if (session) {
        const role = sessionStorage.getItem('selectedRole') || 'user';
        const targetPage = role === 'admin' ? 'admin.html' : 'dashboard.html';
        
        if (!window.location.pathname.includes('dashboard.html') && !window.location.pathname.includes('admin.html')) {
            window.location.href = targetPage;
        }
    }
});

/**
 * Handle Email/Password Registration
 */
async function signUp(email, password) {
    const roleRadio = document.querySelector('input[name="userRole"]:checked');
    if (roleRadio) sessionStorage.setItem('selectedRole', roleRadio.value);

    const btn = document.getElementById("auth-submit-btn");
    setLoading(btn, true, "Creating Account...");

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
        });

        if (error) throw error;
        
        showToast("Registration successful! Check your email for confirmation.", "success");
    } catch (err) {
        console.error("Sign Up Error:", err);
        showToast(err.message, "error");
    } finally {
        setLoading(btn, false, "Sign Up");
    }
}

/**
 * Handle Email/Password Login
 */
async function signIn(email, password) {
    const roleRadio = document.querySelector('input[name="userRole"]:checked');
    if (roleRadio) sessionStorage.setItem('selectedRole', roleRadio.value);

    const btn = document.getElementById("auth-submit-btn");
    setLoading(btn, true, "Signing In...");

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) throw error;
        
        showToast("Login successful!", "success");
    } catch (err) {
        console.error("Sign In Error:", err);
        showToast(err.message, "error");
    } finally {
        setLoading(btn, false, "Sign In");
    }
}

/**
 * Handle Google Login
 */
async function signInWithGoogle() {
    const roleRadio = document.querySelector('input[name="userRole"]:checked');
    if (roleRadio) sessionStorage.setItem('selectedRole', roleRadio.value);

    try {
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/login.html'
            }
        });
        if (error) throw error;
    } catch (err) {
        showToast(err.message, "error");
    }
}

/**
 * Toggle between Sign In/Up
 */
let isSignUp = false;
function toggleAuthMode() {
    isSignUp = !isSignUp;
    const title = document.getElementById("auth-mode-title");
    const subtitle = document.getElementById("auth-mode-subtitle");
    const submitBtn = document.getElementById("auth-submit-btn");
    const toggleLink = document.getElementById("toggle-mode-text");

    if (isSignUp) {
        title.innerText = "Create Account";
        subtitle.innerText = "Join ParkGrid today";
        submitBtn.innerText = "Sign Up";
        toggleLink.innerHTML = 'Already have an account? <a href="#" onclick="toggleAuthMode()">Sign In</a>';
    } else {
        title.innerText = "Welcome Back";
        subtitle.innerText = "Secure Authentication Panel";
        submitBtn.innerText = "Sign In";
        toggleLink.innerHTML = 'Don\'t have an account? <a href="#" onclick="toggleAuthMode()">Sign Up</a>';
    }
}

/**
 * Form Submit Handler
 */
function handleAuthSubmit() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    if (!email || !password) {
        showToast("Please fill in all fields.", "error");
        return;
    }

    if (isSignUp) {
        signUp(email, password);
    } else {
        signIn(email, password);
    }
}

function setLoading(btn, isLoading, text) {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.innerHTML = isLoading ? `<span class="spinner"></span> ${text}` : text;
}
