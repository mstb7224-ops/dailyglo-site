/**
 * XORTRON ACCESS CONTROL ENGINE
 * Objective: Verify if the user is a 'paid' member before granting access.
 */

async function verifyAccess() {
    try {
        // ১. বর্তমানে লগইন করা ইউজার কে তা চেক করা
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error("Auth Error: ইউজার লগইন করা নেই।");
            window.location.href = 'index.html'; // লগইন পেজে পাঠিয়ে দাও
            return;
        }

        // ২. members টেবিল থেকে ওই ইউজারের টাইপ (free/paid) চেক করা
        const { data: memberData, error: dbError } = await supabase
            .from('members')
            .select('user_type')
            .eq('id', user.id)
            .single();

        if (dbError) {
            throw dbError;
        }

        // ৩. অ্যাক্সেস লজিক
        if (memberData.user_type === 'paid') {
            console.log("Access Granted: Welcome, Paid Member. ⚡");
            // এখানে কিছু করার দরকার নেই, ইউজার পেজে থাকতে পারবে।
        } else {
            console.log("Access Denied: User is Free. Redirecting to payment...");
            window.location.href = 'payment.html'; // পেমেন্ট পেজে পাঠিয়ে দাও
        }

    } catch (error) {
        console.error("Access Verification Error:", error.message);
        alert("সিস্টেমে সমস্যা হয়েছে, দয়া করে পেজটি রিফ্রেশ কর।");
    }
}

// পেজ লোড হওয়ার সাথে সাথে এই ফাংশনটি কল হবে
window.addEventListener('DOMContentLoaded', verifyAccess);
