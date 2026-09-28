/* ═══════════════════════════════════════════════════════════
   icons.js — مجموعة أيقونات SVG مضمّنة (بلا مكتبات خارجية ولا CDN)
   شبكة 24×24، خط 1.7px، نهايات مدوّرة. كل الأيقونات تتبع
   currentColor فتأخذ لون النص تلقائيًا.
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var HS = window.HS;

  var P = {
    "dashboard": '<rect width="7" height="9" x="3" y="3" rx="1.5"/><rect width="7" height="5" x="14" y="3" rx="1.5"/><rect width="7" height="9" x="14" y="12" rx="1.5"/><rect width="7" height="5" x="3" y="16" rx="1.5"/>',
    "cart": '<circle cx="8" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2.2l2.6 11.4a1.8 1.8 0 0 0 1.8 1.4h9.1a1.8 1.8 0 0 0 1.8-1.4L21.5 7H5.4"/>',
    "receipt": '<path d="M4 2.5v19l2-1.2 2 1.2 2-1.2 2 1.2 2-1.2 2 1.2 2-1.2v-19l-2 1.2-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2Z"/><path d="M8.5 8h7"/><path d="M8.5 12h7"/><path d="M8.5 16h4"/>',
    "box": '<path d="M20.5 7.8v8.4a1.8 1.8 0 0 1-.95 1.6l-6.7 3.7a1.8 1.8 0 0 1-1.7 0l-6.7-3.7a1.8 1.8 0 0 1-.95-1.6V7.8a1.8 1.8 0 0 1 .95-1.6l6.7-3.6a1.8 1.8 0 0 1 1.7 0l6.7 3.6a1.8 1.8 0 0 1 .95 1.6Z"/><path d="m3.6 6.6 8.4 4.6 8.4-4.6"/><path d="M12 21.5V11.2"/><path d="m7.6 4.4 8.3 4.6"/>',
    "layers": '<path d="m12.8 2.3 8.5 3.9a.9.9 0 0 1 0 1.7l-8.5 3.9a2 2 0 0 1-1.6 0L2.7 7.9a.9.9 0 0 1 0-1.7l8.5-3.9a2 2 0 0 1 1.6 0Z"/><path d="m21.5 16.4-8.7 4a2 2 0 0 1-1.6 0l-8.7-4"/><path d="m21.5 12.2-8.7 4a2 2 0 0 1-1.6 0l-8.7-4"/>',
    "barcode": '<path d="M3 5.5v13M6.2 5.5v13M9.4 5.5v9M12 5.5v13M15.2 5.5v9M18 5.5v13M21 5.5v13"/>',
    "scan": '<path d="M3 7.5V5.4A2.4 2.4 0 0 1 5.4 3h2.1"/><path d="M16.5 3h2.1A2.4 2.4 0 0 1 21 5.4v2.1"/><path d="M21 16.5v2.1a2.4 2.4 0 0 1-2.4 2.4h-2.1"/><path d="M7.5 21H5.4A2.4 2.4 0 0 1 3 18.6v-2.1"/><path d="M7 12h10"/>',
    "truck": '<path d="M14 17.5V6.2A2.2 2.2 0 0 0 11.8 4H4.2A2.2 2.2 0 0 0 2 6.2v9.1a1.7 1.7 0 0 0 1.7 1.7H6"/><path d="M14.5 17H9.5"/><path d="M18.5 17.5H21a1 1 0 0 0 1-1v-3.2a1 1 0 0 0-.24-.66l-3.1-3.6a1 1 0 0 0-.76-.34H14"/><circle cx="7.5" cy="17.8" r="2"/><circle cx="17" cy="17.8" r="2"/>',
    "users": '<path d="M15.5 20.5v-1.8a3.7 3.7 0 0 0-3.7-3.7H6.2a3.7 3.7 0 0 0-3.7 3.7v1.8"/><circle cx="9" cy="7.5" r="3.7"/><path d="M21.5 20.5v-1.8a3.7 3.7 0 0 0-2.8-3.6"/><path d="M15.5 3.9a3.7 3.7 0 0 1 0 7.2"/>',
    "user": '<path d="M19 20.5v-1.8a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v1.8"/><circle cx="12" cy="7.5" r="4"/>',
    "user-cog": '<circle cx="17" cy="17" r="2.6"/><path d="M21.2 19.4a1 1 0 0 0 .2 1.1l.1.1a1.2 1.2 0 1 1-1.7 1.7l-.1-.1a1 1 0 0 0-1.7.7v.2a1.2 1.2 0 1 1-2.4 0v-.1a1 1 0 0 0-1.8-.7l-.1.1a1.2 1.2 0 1 1-1.7-1.7l.1-.1a1 1 0 0 0-.7-1.7h-.2a1.2 1.2 0 1 1 0-2.4h.1a1 1 0 0 0 .7-1.8l-.1-.1a1.2 1.2 0 1 1 1.7-1.7l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-1v-.2a1.2 1.2 0 1 1 2.4 0v.1a1 1 0 0 0 1.7.7l.1-.1a1.2 1.2 0 1 1 1.7 1.7l-.1.1a1 1 0 0 0 .7 1.7h.2a1.2 1.2 0 1 1 0 2.4h-.1a1 1 0 0 0-1 .6Z"/><path d="M13.5 20.5v-1.8a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1.8"/><circle cx="8" cy="7.5" r="4"/>',
    "wallet": '<path d="M19.5 7.5V5a1.5 1.5 0 0 0-1.5-1.5H5A2 2 0 0 0 3 5.5v13a2 2 0 0 0 2 2h14.5a1.5 1.5 0 0 0 1.5-1.5v-2"/><path d="M21.5 9.5H17a2.5 2.5 0 0 0 0 5h4.5a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 0-.5-.5Z"/><path d="M3 5.5A2.5 2.5 0 0 1 5.5 8v0"/>',
    "trending-up": '<polyline points="21.5 7.5 13.5 15.5 9 11 2.5 17.5"/><polyline points="15.5 7.5 21.5 7.5 21.5 13.5"/>',
    "trending-down": '<polyline points="21.5 16.5 13.5 8.5 9 13 2.5 6.5"/><polyline points="15.5 16.5 21.5 16.5 21.5 10.5"/>',
    "activity": '<path d="M21.5 12h-4l-3 8.5L9 3.5l-3 8.5h-4"/>',
    "bar-chart": '<path d="M3 21h18"/><rect x="5" y="12" width="3.6" height="7" rx="1"/><rect x="10.2" y="7" width="3.6" height="12" rx="1"/><rect x="15.4" y="10" width="3.6" height="9" rx="1"/>',
    "pie-chart": '<path d="M21.2 15.9A9.5 9.5 0 1 1 8.1 2.8"/><path d="M21.5 12A9.5 9.5 0 0 0 12 2.5V12Z"/>',
    "settings": '<circle cx="12" cy="12" r="3"/><path d="M19.2 14.6a1.5 1.5 0 0 0 .3 1.7l.1.1a1.8 1.8 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-2.6 1v.3a1.8 1.8 0 1 1-3.6 0v-.2a1.5 1.5 0 0 0-2.7-1l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0-1-2.6h-.3a1.8 1.8 0 1 1 0-3.6h.2a1.5 1.5 0 0 0 1-2.7l-.1-.1a1.8 1.8 0 1 1 2.6-2.6l.1.1a1.5 1.5 0 0 0 1.7.3h.1a1.5 1.5 0 0 0 .9-1.4v-.3a1.8 1.8 0 1 1 3.6 0v.2a1.5 1.5 0 0 0 2.6 1l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0 1 2.6h.3a1.8 1.8 0 1 1 0 3.6h-.2a1.5 1.5 0 0 0-1.4.9Z"/>',
    "sliders": '<path d="M4 21v-6.5M4 10.5V3M12 21v-9M12 8V3M20 21v-4.5M20 12.5V3"/><path d="M1.8 14.5h4.4M9.8 8h4.4M17.8 16.5h4.4"/>',
    "search": '<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.6-4.6"/>',
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "minus": '<path d="M5 12h14"/>',
    "pencil": '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7.5 18.5 3 20l1.5-4.5Z"/><path d="m14.5 5.5 3 3"/>',
    "trash": '<path d="M3.5 6h17"/><path d="M18.5 6v13.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V6"/><path d="M8.5 6V4.2a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2V6"/><path d="M10.2 11v6M13.8 11v6"/>',
    "x": '<path d="M18 6 6 18M6 6l12 12"/>',
    "check": '<path d="M20 6.5 9.2 17.3 4 12.1"/>',
    "check-circle": '<circle cx="12" cy="12" r="9.2"/><path d="m8.3 12.2 2.6 2.6 4.8-5"/>',
    "x-circle": '<circle cx="12" cy="12" r="9.2"/><path d="m15 9-6 6M9 9l6 6"/>',
    "alert": '<path d="M10.3 3.6 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4.2"/><path d="M12 17.2h.01"/>',
    "info": '<circle cx="12" cy="12" r="9.2"/><path d="M12 16.5v-5"/><path d="M12 8h.01"/>',
    "menu": '<path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h11"/>',
    "panel": '<rect width="18.5" height="18.5" x="2.8" y="2.8" rx="2.4"/><path d="M14.5 2.8v18.5"/>',
    "chevron-down": '<path d="m6 9.5 6 6 6-6"/>',
    "chevron-up": '<path d="m18 14.5-6-6-6 6"/>',
    "chevron-left": '<path d="m14.5 18-6-6 6-6"/>',
    "chevron-right": '<path d="m9.5 18 6-6-6-6"/>',
    "arrow-up": '<path d="M12 19.5V4.5"/><path d="m5.5 11 6.5-6.5L18.5 11"/>',
    "arrow-down": '<path d="M12 4.5v15"/><path d="m18.5 13-6.5 6.5L5.5 13"/>',
    "arrow-left": '<path d="M19.5 12H4.5"/><path d="m11 5.5-6.5 6.5L11 18.5"/>',
    "arrow-right": '<path d="M4.5 12h15"/><path d="m13 5.5 6.5 6.5-6.5 6.5"/>',
    "sort": '<path d="m17.5 4.5 4 4-4 4"/><path d="M21.5 8.5H8"/><path d="m6.5 19.5-4-4 4-4"/><path d="M2.5 15.5H16"/>',
    "print": '<polyline points="6.5 9.5 6.5 2.5 17.5 2.5 17.5 9.5"/><path d="M6.5 18.5H4.4a2 2 0 0 1-2-2v-4.6a2 2 0 0 1 2-2h15.2a2 2 0 0 1 2 2V16.5a2 2 0 0 1-2 2h-2.1"/><rect width="11" height="7.5" x="6.5" y="14" rx="1"/>',
    "filter": '<path d="M21 3.5H3l7.2 8.5v6.4l3.6 2v-8.4Z"/>',
    "download": '<path d="M21 15.5v3.6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3.6"/><polyline points="7.5 10.5 12 15 16.5 10.5"/><path d="M12 15V3"/>',
    "upload": '<path d="M21 15.5v3.6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3.6"/><polyline points="7.5 7.5 12 3 16.5 7.5"/><path d="M12 3v12"/>',
    "refresh": '<path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1l2.6 2.4"/><path d="M20.8 3.5v5h-5"/>',
    "save": '<path d="M19.5 21.5h-15a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2H15l6.5 6.5v10.5a2 2 0 0 1-2 2Z"/><polyline points="17.5 21.5 17.5 13.5 6.5 13.5 6.5 21.5"/><polyline points="6.5 2.5 6.5 8.5 13.5 8.5"/>',
    "eye": '<path d="M2.2 12S5.8 5.2 12 5.2 21.8 12 21.8 12 18.2 18.8 12 18.8 2.2 12 2.2 12Z"/><circle cx="12" cy="12" r="3"/>',
    "eye-off": '<path d="M9.9 5.5A9.6 9.6 0 0 1 12 5.2c6.2 0 9.8 6.8 9.8 6.8a17 17 0 0 1-2.4 3.4"/><path d="M6.4 6.8A16.6 16.6 0 0 0 2.2 12s3.6 6.8 9.8 6.8a9.7 9.7 0 0 0 4-.85"/><path d="m3 3 18 18"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    "copy": '<rect width="13.5" height="13.5" x="8" y="8" rx="2"/><path d="M4.5 16A2.5 2.5 0 0 1 2 13.5v-9A2.5 2.5 0 0 1 4.5 2h9A2.5 2.5 0 0 1 16 4.5"/>',
    "sun": '<circle cx="12" cy="12" r="4"/><path d="M12 2.2v2M12 19.8v2M4.6 4.6 6 6M18 18l1.4 1.4M2.2 12h2M19.8 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
    "moon": '<path d="M12.2 3.2a8.8 8.8 0 0 0 8.6 11.6A8.8 8.8 0 1 1 12.2 3.2Z"/>',
    "logout": '<path d="M9.5 21.5H5.4a2 2 0 0 1-2-2V4.8a2 2 0 0 1 2-2H9.5"/><polyline points="16.5 17 21.5 12 16.5 7"/><path d="M21.5 12h-12"/>',
    "bell": '<path d="M6.2 8.5a5.8 5.8 0 0 1 11.6 0c0 6.2 2.6 8 2.6 8H3.6s2.6-1.8 2.6-8"/><path d="M10.3 20.5a2 2 0 0 0 3.4 0"/>',
    "calendar": '<path d="M8 2.5v4M16 2.5v4"/><rect width="18.5" height="18" x="2.8" y="4.5" rx="2"/><path d="M2.8 10h18.5"/>',
    "clock": '<circle cx="12" cy="12" r="9.2"/><polyline points="12 6.8 12 12 15.6 14"/>',
    "cash": '<rect width="19.5" height="12.5" x="2.2" y="5.8" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01M18 12h.01"/>',
    "card": '<rect width="19.5" height="14" x="2.2" y="5" rx="2"/><path d="M2.2 10h19.5"/><path d="M6 15h4"/>',
    "tag": '<path d="M12.2 2.8H5.4a2.6 2.6 0 0 0-2.6 2.6v6.8a2 2 0 0 0 .6 1.4l8.7 8.7a2 2 0 0 0 2.8 0l6.3-6.3a2 2 0 0 0 0-2.8l-8.7-8.7a2 2 0 0 0-1.3-.7Z"/><circle cx="7.6" cy="7.6" r="1.3"/>',
    "percent": '<path d="M19 5 5 19"/><circle cx="6.8" cy="6.8" r="2.6"/><circle cx="17.2" cy="17.2" r="2.6"/>',
    "star": '<polygon points="12 2.8 14.9 8.7 21.4 9.6 16.7 14.2 17.8 20.7 12 17.6 6.2 20.7 7.3 14.2 2.6 9.6 9.1 8.7"/>',
    "clipboard": '<rect width="8.5" height="4" x="7.8" y="2.2" rx="1.2"/><path d="M16.2 4.2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5.8a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2h2"/><path d="M11.5 11h5M11.5 15.5h5M8 11h.01M8 15.5h.01"/>',
    "database": '<ellipse cx="12" cy="5.5" rx="8.5" ry="3"/><path d="M3.5 5.5v13c0 1.7 3.8 3 8.5 3s8.5-1.3 8.5-3v-13"/><path d="M3.5 12c0 1.7 3.8 3 8.5 3s8.5-1.3 8.5-3"/>',
    "lock": '<rect width="17.5" height="11" x="3.2" y="10.5" rx="2.2"/><path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5"/><path d="M12 15v2.5"/>',
    "shield": '<path d="M19.8 12.5c0 4.6-3.2 7-7 8.3a1.6 1.6 0 0 1-1 0c-3.8-1.3-7-3.7-7-8.3V6a1.5 1.5 0 0 1 1.5-1.5c1.9 0 4.2-1.1 5.8-2.5a1.1 1.1 0 0 1 1.4 0C15.1 3.4 17.4 4.5 19.3 4.5A1.5 1.5 0 0 1 20.8 6Z"/><path d="m9.2 12 2 2 3.6-3.8"/>',
    "sparkle": '<path d="M11 3.2 12.8 9l5.8 1.8-5.8 1.8L11 18.4 9.2 12.6 3.4 10.8 9.2 9Z"/><path d="M18.5 3v3.4M16.8 4.7h3.4"/><path d="M5 17v2.6M3.7 18.3h2.6"/>',
    "list": '<path d="M8.5 6h13M8.5 12h13M8.5 18h13"/><path d="M3.4 6h.01M3.4 12h.01M3.4 18h.01"/>',
    "grid": '<rect width="7.5" height="7.5" x="3" y="3" rx="1.5"/><rect width="7.5" height="7.5" x="13.5" y="3" rx="1.5"/><rect width="7.5" height="7.5" x="13.5" y="13.5" rx="1.5"/><rect width="7.5" height="7.5" x="3" y="13.5" rx="1.5"/>',
    "undo": '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.3"/><path d="M3.2 3.5v5h5"/>',
    "repeat": '<path d="m17 2.5 4 4-4 4"/><path d="M3.5 11.5v-1a4 4 0 0 1 4-4h13.5"/><path d="m7 21.5-4-4 4-4"/><path d="M20.5 12.5v1a4 4 0 0 1-4 4H3"/>',
    "phone": '<path d="M21.5 16.9v2.7a1.9 1.9 0 0 1-2.1 1.9 18.9 18.9 0 0 1-8.2-2.9 18.6 18.6 0 0 1-5.7-5.7A18.9 18.9 0 0 1 2.6 4.6 1.9 1.9 0 0 1 4.5 2.5h2.7a1.9 1.9 0 0 1 1.9 1.6 12.2 12.2 0 0 0 .7 2.7 1.9 1.9 0 0 1-.4 2L8.2 10a15.2 15.2 0 0 0 5.7 5.7l1.2-1.2a1.9 1.9 0 0 1 2-.4 12.2 12.2 0 0 0 2.7.7 1.9 1.9 0 0 1 1.7 2.1Z"/>',
    "pin": '<path d="M19.5 10c0 4.7-5.2 9.6-7 11.1a1 1 0 0 1-1.1 0C9.7 19.6 4.5 14.7 4.5 10a7.5 7.5 0 0 1 15 0Z"/><circle cx="12" cy="10" r="2.8"/>',
    "mail": '<rect width="19.5" height="14.5" x="2.2" y="4.8" rx="2"/><path d="m2.8 6.5 8.3 6a1.6 1.6 0 0 0 1.8 0l8.3-6"/>',
    "hash": '<path d="M4 9.2h16M4 14.8h16"/><path d="m10.2 3-1.8 18M15.6 3l-1.8 18"/>',
    "file": '<path d="M14.8 2.5H6.4a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11.2a2 2 0 0 0 2-2V7.6Z"/><path d="M14.5 2.5v5.2h5"/><path d="M9 13h6M9 17h4"/>',
    "bag": '<path d="M6.2 2.5 3.2 7v13a1.5 1.5 0 0 0 1.5 1.5h14.6A1.5 1.5 0 0 0 20.8 20V7l-3-4.5Z"/><path d="M3.2 7h17.6"/><path d="M15.8 10a3.8 3.8 0 0 1-7.6 0"/>',
    "store": '<path d="m2.5 7.5 2-4.2h15l2 4.2"/><path d="M4.2 7.5v12a1.5 1.5 0 0 0 1.5 1.5h12.6a1.5 1.5 0 0 0 1.5-1.5v-12"/><path d="M9.5 21v-6.2h5V21"/><path d="M2.5 7.5h19"/>',
    "calculator": '<rect width="16" height="19.5" x="4" y="2.2" rx="2"/><path d="M8 6.5h8"/><path d="M8 11h.01M12 11h.01M16 11h.01M8 14.5h.01M12 14.5h.01M16 14.5h.01M8 18h.01M12 18h.01M16 18v0"/>',
    "inbox": '<polyline points="21.5 12.5 16 12.5 14 15.5 10 15.5 8 12.5 2.5 12.5"/><path d="M5.6 5.3 2.5 12.5v6a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2v-6l-3.1-7.2A2 2 0 0 0 16.6 4H7.4a2 2 0 0 0-1.8 1.3Z"/>',
    "external": '<path d="M15 3.2h5.8V9"/><path d="M10 14 20.8 3.2"/><path d="M18.5 13.8v5.7a2 2 0 0 1-2 2H4.8a2 2 0 0 1-2-2V7.8a2 2 0 0 1 2-2h5.7"/>',
    "keyboard": '<rect width="19.5" height="15" x="2.2" y="4.5" rx="2"/><path d="M6 8.5h.01M9.5 8.5h.01M13 8.5h.01M16.5 8.5h.01M6 12h.01M9.5 12h.01M13 12h.01M16.5 12h.01M7.5 15.8h9"/>',
    "target": '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
    "gift": '<rect x="2.8" y="7.5" width="18.4" height="4.5" rx="1"/><path d="M4.5 12v7.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V12"/><path d="M12 7.5V21.5"/><path d="M12 7.5S10.8 2.5 8.2 2.5a2.5 2.5 0 0 0 0 5Z"/><path d="M12 7.5s1.2-5 3.8-5a2.5 2.5 0 0 1 0 5Z"/>',
    "more": '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>',
    "swap": '<path d="M8 3.5 4.5 7 8 10.5"/><path d="M4.5 7h11a4 4 0 0 1 0 8H8"/><path d="m16 20.5 3.5-3.5L16 13.5"/>',
    "box-check": '<path d="M20.5 8.5V16a1.8 1.8 0 0 1-.95 1.6l-6.7 3.7a1.8 1.8 0 0 1-1.7 0l-6.7-3.7A1.8 1.8 0 0 1 3.5 16V8.5"/><path d="m3.7 7.2 8.3 4.5 8.3-4.5"/><path d="m9.5 15.5 1.8 1.8 3.4-3.6"/>',
    "note": '<path d="M15.5 2.8H6.4a2 2 0 0 0-2 2v14.4a2 2 0 0 0 2 2h11.2a2 2 0 0 0 2-2V7.9Z"/><path d="M15.2 2.8v5.2h5.2"/><path d="M8.4 12.6h7.2M8.4 16.2h4.8"/>',
    "flame": '<path d="M12 22c4 0 6.5-2.6 6.5-6 0-4.6-4.3-6.3-3.5-11.5C11.8 5.7 8 8 8 12c0-1.4-.7-2.7-1.6-3.5C5.8 9.9 5.5 11.5 5.5 13c0 3.4 2.5 9 6.5 9Z"/>',
    "pause": '<rect x="6.5" y="4.5" width="4" height="15" rx="1.2"/><rect x="13.5" y="4.5" width="4" height="15" rx="1.2"/>'
  };

  HS.icons = {
    names: Object.keys(P),
    has: function (n) { return !!P[n]; },
    /** يعيد نص SVG كامل */
    get: function (name, size, sw) {
      var body = P[name] || P["info"];
      var s = size || 20;
      var w = sw || 1.7;
      return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" ' +
        'stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + '</svg>';
    },
    raw: function (name) { return P[name] || ""; },
    /** يملأ كل [data-icon] في الشجرة */
    hydrate: function (root) {
      var nodes = HS.$$("[data-icon]", root || document);
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        var name = n.getAttribute("data-icon");
        if (!name) continue;
        var size = n.getAttribute("data-icon-size") || (n.classList.contains("btn__icon") ? 17 : 18);
        if (n.firstElementChild && n.firstElementChild.tagName === "svg" && n.getAttribute("data-icon-rendered") === name) continue;
        n.innerHTML = HS.icons.get(name, size);
        n.setAttribute("data-icon-rendered", name);
        n.setAttribute("aria-hidden", "true");
      }
    }
  };

  /** اختصار: HS.icon('search') */
  HS.icon = function (name, size) { return HS.icons.get(name, size); };
})();
