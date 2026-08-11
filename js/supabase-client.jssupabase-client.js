import { createClient } from '@supabase/supabase-js'

const supabase = createClient('YOUR_SUPABASE_URL', 'YOUR_SUPABASE_ANON_KEY')

async function checkUserAccess() {
    // ১. বর্তমানে লগইন করা ইউজারের আইডি নেওয়া
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        console.log("ইউজার লগইন করা নেই। লগইন পেজে পাঠাও।");
        return 'not_logged_in';
    }

    // ২. members টেবিল থেকে ওই ইউজারের user_type চেক করা
    const { data: memberData, error } = await supabase
        .from('members')
        .select('user_type')
        .eq('id', user.id)
        .single()

    if (error) {
        console.error("ডাটাবেস এরর:", error.message);
        return 'error';
    }

    // ৩. লজিক অ্যাপ্লাই করা
    if (memberData.user_type === 'paid') {
        console.log("Access Granted: এই ইউজার Paid মেম্বার। প্রেডিকশন দেখাও।");
        return 'paid';
    } else {
        console.log("Access Denied: এই ইউজার Free মেম্বার। পেমেন্ট পেজে পাঠাও।");
        return 'free';
    }
}
