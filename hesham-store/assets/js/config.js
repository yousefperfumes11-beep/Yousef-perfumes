/* ═══════════════════════════════════════════════════════════
   config.js — إعدادات الاتصال بـ Supabase
   المفتاح هنا هو المفتاح العام (publishable / anon) المخصّص للمتصفح،
   وحمايته بسياسات RLS في قاعدة البيانات. لا تضع هنا أبدًا مفتاح
   service_role أو أي مفتاح سرّي.
   المكان: Supabase ← Project Settings ← API Keys ← Publishable key
   ═══════════════════════════════════════════════════════════ */
window.HS_CONFIG = {
  supabaseUrl: "https://tldwumbrhxixcoxrscro.supabase.co",
  supabaseKey: ""   /* الصق المفتاح العام هنا، مثال: sb_publishable_xxxxxxxx */
};
