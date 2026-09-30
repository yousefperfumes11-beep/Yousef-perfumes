-- 009: منع الزائر غير المسجّل (anon) من استدعاء الدوال، وإبقاؤها للمستخدم المسجّل فقط
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
