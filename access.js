/ (Root Directory)
│
├── index.html            <-- মেইন ল্যান্ডিং পেজ (লগইন/রেজিস্ট্রেশন)
├── dashboard.html        <-- এখানে ইউজার লগইন করার পর আসবে (Access Check এখানে হবে)
├── payment.html          <-- পেমেন্ট ফর্ম পেজ (যেখানে tx_id সাবমিট করবে)
├── predictions.html      <-- ফাইনাল প্রেডিকশন পেজ (শুধুমাত্র Paid ইউজারদের জন্য)
│
├── /css
│   └── style.css         <-- তোর সাইটের ডিজাইন
│
└── /js
    ├── supabase-client.js <-- Supabase কানেকশন এবং কনফিগ (সব পেজে এটা লাগবে)
    ├── auth.js           <-- লগইন/লগআউট লজিক
    ├── access.js         <-- ওই checkUserAccess() ফাংশন যেটা আমি আগে দিয়েছি
    └── payment.js        <-- ট্রানজ্যাকশন আইডি সাবমিটের লজিক
