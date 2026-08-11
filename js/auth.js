/**
 * XORTRON AUTHENTICATION ENGINE
 * Objective: Handle User Sign-Up, Login, and Session Management.
 */

// ১. সাইন-আপ ফাংশন (নতুন ইউজার তৈরি)
async function signUpUser(email, password) {
    try {
        // Supabase Auth-এ ইউজার তৈরি
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
        });

        if (error) throw error;

        // IMPORTANT: ইউজার তৈরি হওয়ার পর তাকে 'members' টেবিলে 'free' হিসেবে অ্যাড করা
        const { error: memberError } = await supabase
            .from('members')
            .insert([{ email: email, user_type: 'free' }]);

        if (memberError) throw memberError;

        return { success: true, message: "Account created successfully! Please check your email for verification." };

    } catch (error) {
        return { success: false, message: error.message };
    }
}

// ২. লগইন ফাংশন
async function loginUser(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) throw error;

        return { success: true, message: "Login successful! Redirecting..." };

    } catch (error) {
        return { success: false, message: error.message };
    }
}

// ৩. লগআউট ফাংশন
async function logoutUser() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        window.location.href = 'index.html';
        return { success: true };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// ৪. সেশন চেক ফাংশন (ইউজার আগে থেকেই লগইন করা কি না)
async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session !== null;
}
