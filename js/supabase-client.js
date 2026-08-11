/**
 * XORTRON SUPABASE CONNECTION CLIENT
 * Objective: Establish a secure bridge between the Frontend and the Database.
 */

// তোর প্রোভাইড করা URL এবং Key এখানে বসানো হলো
const SUPABASE_URL = 'https://xewxigpmvuxkuqtxhxha.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_C-f5NVBKOhZBXXb45ybjvw_JKpCpI8h';

// সঠিক ফাংশন কল: supabase.createClient() ব্যবহার করতে হবে
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("XORTRON: Supabase Connection Established. ⚡");
