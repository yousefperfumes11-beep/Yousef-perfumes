/* ═══════════════════════════════════════════════════════════
   data.js — توليد البيانات التجريبية لمحل «يوسف للعطور».
   مولّد عشوائي بذري (seeded) حتى تبقى الأرقام ثابتة بين
   التحديثات وواقعية في الوقت نفسه: لا قيم مثالية ولا أسماء عامة.
   لا يوجد خادم ولا API: كل شيء يُولَّد في المتصفح.

   قاعدة مهمة في هذا المجال: كل حجم من نفس العطر صنفٌ مستقل —
   باركود مستقل، سعر شراء مستقل، سعر بيع مستقل، ورصيد مستقل.
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var HS = window.HS;

  /* ─────────── الأقسام ─────────── */
  var CATEGORIES = [
    { id: "men",      name: "عطور رجالية",        emoji: "🧔", color: "var(--primary)" },
    { id: "women",    name: "عطور نسائية",        emoji: "👩", color: "var(--accent)" },
    { id: "unisex",   name: "عطور مشتركة",        emoji: "✨", color: "var(--info)" },
    { id: "oriental", name: "عطور شرقية وعود",    emoji: "🪵", color: "var(--warning)" },
    { id: "bakhoor",  name: "بخور ودهن عود ومسك", emoji: "🕯️", color: "var(--danger)" },
    { id: "hair",     name: "عطور الشعر",         emoji: "🌸", color: "var(--accent)" },
    { id: "body",     name: "بودي سبراي ومزيلات",  emoji: "🧴", color: "var(--info)" },
    { id: "home",     name: "معطرات الجو والسيارة", emoji: "🚗", color: "var(--neutral-text)" },
    { id: "sets",     name: "أطقم وهدايا",        emoji: "🎁", color: "var(--success)" },
    { id: "decant",   name: "عبوات تقطيع (ديكانت)", emoji: "🧪", color: "var(--primary)" }
  ];

  /* ─────────── الماركات ───────────
     لكل ماركة بادئة أرقام خاصة بها، تُستعمل في تركيب باركود
     EAN-13 فريد لكل صنف وحجم: بادئة الماركة + الحجم + التسلسل.   */
  var BRANDS = [
    { name: "Dior",               prefix: "3125", country: "فرنسا" },
    { name: "Chanel",             prefix: "3145", country: "فرنسا" },
    { name: "Tom Ford",           prefix: "3348", country: "أمريكا" },
    { name: "Yves Saint Laurent", prefix: "3614", country: "فرنسا" },
    { name: "Giorgio Armani",     prefix: "8005", country: "إيطاليا" },
    { name: "Versace",            prefix: "8011", country: "إيطاليا" },
    { name: "Paco Rabanne",       prefix: "3349", country: "فرنسا" },
    { name: "Jean Paul Gaultier", prefix: "3388", country: "فرنسا" },
    { name: "Dolce & Gabbana",    prefix: "8057", country: "إيطاليا" },
    { name: "Carolina Herrera",   prefix: "8411", country: "إسبانيا" },
    { name: "Lancôme",            prefix: "3605", country: "فرنسا" },
    { name: "Gucci",              prefix: "3616", country: "إيطاليا" },
    { name: "Hugo Boss",          prefix: "4005", country: "ألمانيا" },
    { name: "Montblanc",          prefix: "3387", country: "فرنسا" },
    { name: "Burberry",           prefix: "3617", country: "بريطانيا" },
    { name: "Victoria's Secret",  prefix: "0667", country: "أمريكا" },
    { name: "Rasasi",             prefix: "6291", country: "الإمارات" },
    { name: "Lattafa",            prefix: "6292", country: "الإمارات" },
    { name: "Al Haramain",        prefix: "6293", country: "الإمارات" },
    { name: "Ajmal",              prefix: "6294", country: "الإمارات" },
    { name: "Armaf",              prefix: "6295", country: "الإمارات" },
    { name: "Afnan",              prefix: "6296", country: "الإمارات" },
    { name: "Maison Alhambra",    prefix: "6297", country: "الإمارات" },
    { name: "Khadlaj",            prefix: "6298", country: "الإمارات" },
    { name: "Swiss Arabian",      prefix: "6299", country: "الإمارات" },
    { name: "Ard Al Zaafaran",    prefix: "6281", country: "السعودية" },
    { name: "يوسف للعطور",        prefix: "6251", country: "ليبيا" }
  ];

  /* ─────────── الأصناف ───────────
     [اسم العطر، الماركة، القسم، الحجم رقمًا، وحدة الحجم، سعر الشراء، سعر البيع، الرمز]
     كل حجم سطر مستقل: «سوفاج 60 مل» و«سوفاج 100 مل» صنفان برمزَين ورصيدَين. */
  var PRODUCTS = [
    /* ── رجالية عالمية ── */
    ["Sauvage EDT","Dior","men",60,"مل",455,560,"🧔"],
    ["Sauvage EDT","Dior","men",100,"مل",640,780,"🧔"],
    ["Sauvage EDT","Dior","men",200,"مل",980,1180,"🧔"],
    ["Sauvage EDP","Dior","men",100,"مل",760,920,"🧔"],
    ["Sauvage Parfum","Dior","men",100,"مل",830,1010,"🧔"],
    ["Dior Homme Intense","Dior","men",100,"مل",700,860,"🧔"],
    ["Bleu de Chanel EDT","Chanel","men",50,"مل",460,560,"🧔"],
    ["Bleu de Chanel EDP","Chanel","men",100,"مل",760,920,"🧔"],
    ["Bleu de Chanel Parfum","Chanel","men",100,"مل",880,1080,"🧔"],
    ["Allure Homme Sport","Chanel","men",100,"مل",720,880,"🧔"],
    ["Y Men EDP","Yves Saint Laurent","men",100,"مل",630,760,"🧔"],
    ["Y Men EDT","Yves Saint Laurent","men",60,"مل",430,530,"🧔"],
    ["La Nuit de L'Homme","Yves Saint Laurent","men",100,"مل",595,720,"🧔"],
    ["Acqua di Gio Profondo","Giorgio Armani","men",125,"مل",690,840,"🧔"],
    ["Acqua di Gio EDT","Giorgio Armani","men",100,"مل",610,740,"🧔"],
    ["Stronger With You","Giorgio Armani","men",100,"مل",465,560,"🧔"],
    ["Armani Code Parfum","Giorgio Armani","men",75,"مل",560,680,"🧔"],
    ["Eros EDT","Versace","men",100,"مل",425,520,"🧔"],
    ["Eros Flame","Versace","men",100,"مل",440,540,"🧔"],
    ["Dylan Blue","Versace","men",100,"مل",410,505,"🧔"],
    ["1 Million Elixir","Paco Rabanne","men",100,"مل",470,575,"🧔"],
    ["1 Million EDT","Paco Rabanne","men",100,"مل",445,540,"🧔"],
    ["Invictus Victory","Paco Rabanne","men",100,"مل",455,555,"🧔"],
    ["Phantom EDT","Paco Rabanne","men",100,"مل",430,530,"🧔"],
    ["Le Male Elixir","Jean Paul Gaultier","men",125,"مل",640,780,"🧔"],
    ["Le Male EDT","Jean Paul Gaultier","men",125,"مل",485,590,"🧔"],
    ["Scandal Pour Homme","Jean Paul Gaultier","men",100,"مل",470,575,"🧔"],
    ["The One for Men EDP","Dolce & Gabbana","men",75,"مل",445,540,"🧔"],
    ["K by Dolce & Gabbana","Dolce & Gabbana","men",100,"مل",420,515,"🧔"],
    ["212 VIP Men","Carolina Herrera","men",100,"مل",395,480,"🧔"],
    ["Bad Boy EDT","Carolina Herrera","men",100,"مل",430,525,"🧔"],
    ["Guilty Pour Homme EDT","Gucci","men",90,"مل",460,560,"🧔"],
    ["Gucci By Gucci Sport","Gucci","men",90,"مل",430,525,"🧔"],
    ["Boss Bottled EDP","Hugo Boss","men",100,"مل",395,480,"🧔"],
    ["Boss The Scent","Hugo Boss","men",100,"مل",410,500,"🧔"],
    ["Explorer Montblanc","Montblanc","men",100,"مل",350,430,"🧔"],
    ["Legend Spirit","Montblanc","men",100,"مل",330,405,"🧔"],
    ["Hero EDT","Burberry","men",100,"مل",370,450,"🧔"],
    ["Mr Burberry Indigo","Burberry","men",100,"مل",355,435,"🧔"],

    /* ── نسائية عالمية ── */
    ["La Vie Est Belle","Lancôme","women",75,"مل",595,720,"👩"],
    ["La Vie Est Belle","Lancôme","women",30,"مل",320,400,"👩"],
    ["Trésor Midnight Rose","Lancôme","women",75,"مل",540,660,"👩"],
    ["Coco Mademoiselle EDP","Chanel","women",100,"مل",860,1050,"👩"],
    ["Coco Mademoiselle","Chanel","women",50,"مل",600,730,"👩"],
    ["Chanel N°5 EDP","Chanel","women",100,"مل",900,1100,"👩"],
    ["Gabrielle Essence","Chanel","women",100,"مل",820,1000,"👩"],
    ["Miss Dior EDP","Dior","women",100,"مل",720,880,"👩"],
    ["J'adore EDP","Dior","women",100,"مل",740,900,"👩"],
    ["Libre EDP","Yves Saint Laurent","women",90,"مل",650,790,"👩"],
    ["Black Opium","Yves Saint Laurent","women",90,"مل",620,760,"👩"],
    ["Black Opium","Yves Saint Laurent","women",30,"مل",330,410,"👩"],
    ["My Way","Giorgio Armani","women",90,"مل",610,745,"👩"],
    ["Si Passione","Giorgio Armani","women",100,"مل",590,720,"👩"],
    ["Bright Crystal","Versace","women",90,"مل",390,480,"👩"],
    ["Crystal Noir","Versace","women",90,"مل",400,495,"👩"],
    ["Light Blue","Dolce & Gabbana","women",125,"مل",425,520,"👩"],
    ["The One for Women EDP","Dolce & Gabbana","women",75,"مل",450,550,"👩"],
    ["Good Girl EDP","Carolina Herrera","women",80,"مل",530,640,"👩"],
    ["Good Girl Blush","Carolina Herrera","women",80,"مل",545,660,"👩"],
    ["212 VIP Rosé","Carolina Herrera","women",80,"مل",420,515,"👩"],
    ["Bloom Profumo di Fiori","Gucci","women",100,"مل",540,660,"👩"],
    ["Her EDT","Burberry","women",100,"مل",395,485,"👩"],

    /* ── مشتركة ونيتش ── */
    ["Tobacco Vanille","Tom Ford","unisex",50,"مل",1210,1450,"✨"],
    ["Oud Wood","Tom Ford","unisex",50,"مل",1150,1380,"✨"],
    ["Bitter Peach","Tom Ford","unisex",50,"مل",1180,1420,"✨"],
    ["Lost Cherry","Tom Ford","unisex",50,"مل",1240,1490,"✨"],
    ["Neroli Portofino","Tom Ford","unisex",50,"مل",1190,1430,"✨"],
    ["Baccarat Rouge 540","Maison Alhambra","unisex",100,"مل",135,190,"✨"],
    ["Baroque Rouge Extrait","Maison Alhambra","unisex",100,"مل",142,198,"✨"],
    ["Club de Nuit Intense Man","Armaf","unisex",105,"مل",170,230,"✨"],
    ["Club de Nuit Sillage","Armaf","unisex",105,"مل",178,240,"✨"],
    ["9PM","Afnan","unisex",100,"مل",145,200,"✨"],
    ["Rare Carbon","Afnan","unisex",100,"مل",152,210,"✨"],

    /* ── شرقية وعود ── */
    ["Hawas for Him","Rasasi","oriental",100,"مل",195,260,"🪵"],
    ["La Yuqawam Homme","Rasasi","oriental",75,"مل",245,320,"🪵"],
    ["Amber Oud Gold Edition","Al Haramain","oriental",60,"مل",290,380,"🪵"],
    ["Amber Oud Rouge","Al Haramain","oriental",60,"مل",285,375,"🪵"],
    ["Khamrah","Lattafa","oriental",100,"مل",128,180,"🪵"],
    ["Khamrah Qahwa","Lattafa","oriental",100,"مل",135,188,"🪵"],
    ["Asad","Lattafa","oriental",100,"مل",120,170,"🪵"],
    ["Oud Mood","Lattafa","oriental",100,"مل",105,150,"🪵"],
    ["Yara","Lattafa","oriental",100,"مل",118,165,"🪵"],
    ["Badee Al Oud Amethyst","Lattafa","oriental",100,"مل",125,175,"🪵"],
    ["Amber Wood","Ajmal","oriental",100,"مل",215,290,"🪵"],
    ["Aristocrat Homme","Ajmal","oriental",75,"مل",165,225,"🪵"],
    ["Shaghaf Oud","Swiss Arabian","oriental",75,"مل",152,210,"🪵"],
    ["Kashmire White","Swiss Arabian","oriental",100,"مل",178,240,"🪵"],
    ["Hayaati Gold Elixir","Khadlaj","oriental",100,"مل",98,140,"🪵"],
    ["Shaghaf Al Hawas","Khadlaj","oriental",100,"مل",92,132,"🪵"],
    ["Oud Al Misk","Ard Al Zaafaran","oriental",100,"مل",88,128,"🪵"],
    ["Ana Abiyedh","Ard Al Zaafaran","oriental",100,"مل",82,120,"🪵"],

    /* ── بخور ودهن عود ومسك ── */
    ["دهن عود كمبودي","يوسف للعطور","bakhoor",3,"مل",240,340,"🕯️"],
    ["دهن عود هندي","يوسف للعطور","bakhoor",6,"مل",180,260,"🕯️"],
    ["مسك أبيض طهارة","يوسف للعطور","bakhoor",6,"مل",35,55,"🕯️"],
    ["مسك أسود","يوسف للعطور","bakhoor",6,"مل",32,50,"🕯️"],
    ["بخور معمول ملكي","يوسف للعطور","bakhoor",40,"غ",95,145,"🕯️"],
    ["بخور معمول بالعنبر","يوسف للعطور","bakhoor",40,"غ",78,120,"🕯️"],
    ["عود طبيعي مبخر","يوسف للعطور","bakhoor",20,"غ",260,380,"🕯️"],
    ["معجون بخور بالفواكه","يوسف للعطور","bakhoor",50,"غ",65,100,"🕯️"],
    ["عنبر سائل","يوسف للعطور","bakhoor",12,"مل",88,135,"🕯️"],

    /* ── عطور الشعر ── */
    ["ميست شعر بالياسمين","يوسف للعطور","hair",100,"مل",42,68,"🌸"],
    ["ميست شعر بالعود","يوسف للعطور","hair",100,"مل",48,75,"🌸"],
    ["La Vie Est Belle Hair Mist","Lancôme","hair",30,"مل",240,320,"🌸"],
    ["Miss Dior Hair Mist","Dior","hair",30,"مل",255,340,"🌸"],

    /* ── بودي سبراي ومزيلات ── */
    ["بودي سبراي فانيلا","Victoria's Secret","body",250,"مل",55,85,"🧴"],
    ["بودي سبراي لافندر","Victoria's Secret","body",250,"مل",55,85,"🧴"],
    ["بيور سيدكشن","Victoria's Secret","body",250,"مل",58,88,"🧴"],
    ["مزيل عرق رول أون","يوسف للعطور","body",50,"مل",18,30,"🧴"],
    ["مزيل عرق بخاخ","يوسف للعطور","body",150,"مل",26,42,"🧴"],
    ["كريم جسم مرطب بالعطر","يوسف للعطور","body",200,"مل",45,72,"🧴"],

    /* ── معطرات جو وسيارة ── */
    ["معطر جو بالعود","يوسف للعطور","home",250,"مل",38,62,"🚗"],
    ["معطر جو بالياسمين","يوسف للعطور","home",250,"مل",35,58,"🚗"],
    ["معطر سيارة معلق","يوسف للعطور","home",0,"",12,22,"🚗"],
    ["شامبو سجاد ومفروشات معطر","يوسف للعطور","home",500,"مل",48,78,"🚗"],

    /* ── أطقم وهدايا ── */
    ["طقم هدية سوفاج (عطر + مزيل)","Dior","sets",0,"",880,1050,"🎁"],
    ["طقم هدية لا في إيه بيل","Lancôme","sets",0,"",760,920,"🎁"],
    ["طقم هدية رجالي (عطر + كريم + حقيبة)","يوسف للعطور","sets",0,"",260,360,"🎁"],
    ["طقم هدية نسائي (عطر + ميست شعر)","يوسف للعطور","sets",0,"",220,310,"🎁"],
    ["علبة هدايا فارغة فاخرة","يوسف للعطور","sets",0,"",18,32,"🎁"],

    /* ── عبوات تقطيع (ديكانت) ── */
    ["ديكانت Tobacco Vanille","Tom Ford","decant",10,"مل",145,210,"🧪"],
    ["ديكانت Oud Wood","Tom Ford","decant",10,"مل",138,200,"🧪"],
    ["ديكانت Baccarat Rouge 540","Maison Alhambra","decant",10,"مل",62,95,"🧪"],
    ["ديكانت Bleu de Chanel","Chanel","decant",10,"مل",78,120,"🧪"],
    ["ديكانت Sauvage EDP","Dior","decant",10,"مل",72,110,"🧪"],
    ["ديكانت Good Girl","Carolina Herrera","decant",10,"مل",58,90,"🧪"],
    ["ديكانت Club de Nuit","Armaf","decant",20,"مل",55,85,"🧪"],
    ["ديكانت Khamrah","Lattafa","decant",20,"مل",38,60,"🧪"]
  ];

  /* وزن الشعبية حسب القسم */
  var POPULARITY = {
    body: 2.3, decant: 2.1, men: 1.3, women: 1.3, oriental: 1.15,
    bakhoor: 1.0, hair: .9, unisex: .8, home: .7, sets: .5
  };

  /* أقسام تُباع بالواحدة غالبًا */
  var SINGLE = { sets: 1 };

  /* ─────────── العملاء ─────────── */
  var CUSTOMERS = [
    ["عبدالسلام المبروك","0913245118","طرابلس","دين"],
    ["انتصار الشريف","0925771402","طرابلس","نقدي"],
    ["المعتصم الزوي","0912880355","بنغازي","دين"],
    ["نجوى العقوري","0944129670","تاجوراء","نقدي"],
    ["طارق الهمالي","0916554231","مصراتة","دين"],
    ["سعاد بوغرارة","0927336814","طرابلس","نقدي"],
    ["فيصل الترهوني","0911902447","ترهونة","نقدي"],
    ["مروة الفيتوري","0936118552","جنزور","دين"],
    ["خالد المصراتي","0918664209","مصراتة","نقدي"],
    ["هدى بالكاسم","0922447183","طرابلس","نقدي"],
    ["أنس القماطي","0915220764","الزاوية","دين"],
    ["سلوى العائب","0928771305","طرابلس","نقدي"],
    ["محمد بوخدشة","0919338641","زليتن","نقدي"],
    ["ربيعة السويح","0931552907","طرابلس","دين"],
    ["وسام أبوغرارة","0917446128","صبراتة","نقدي"],
    ["أسماء الطوير","0924880733","طرابلس","نقدي"],
    ["مصطفى الشيباني","0913664902","الخمس","دين"],
    ["زهرة المنصوري","0926227415","طرابلس","نقدي"],
    ["صالون الأناقة للرجال","0912400118","طرابلس","دين"],
    ["صالون لمسة جمال","0915778220","جنزور","دين"],
    ["محل الهدايا الذهبية","0918224470","تاجوراء","دين"],
    ["مكتب الأفراح للمناسبات","0921556604","طرابلس","دين"]
  ];

  /* ─────────── الموردون ─────────── */
  var SUPPLIERS = [
    ["شركة الياسمين للعطور العالمية","عبدالرحمن الشريف","0913220118","طرابلس","men",4.6],
    ["مؤسسة الفخامة لتوريد العطور","سعاد القريتلي","0925441180","مصراتة","women",4.4],
    ["شركة المتوسط للعطور النيتش","خالد العبيدي","0916338807","بنغازي","unisex",4.8],
    ["دار الشرق للعطور الشرقية","يوسف الحمروني","0922115580","طرابلس","oriental",4.5],
    ["مؤسسة العود الكمبودي","ناصر الطرابلسي","0918660241","الزاوية","bakhoor",4.2],
    ["شركة لمسة للعناية بالشعر","إبراهيم الأنصاري","0914772206","طرابلس","hair",4.1],
    ["مخازن الجمال لمستحضرات الجسم","عمر الشتيوي","0917553318","غريان","body",4.3],
    ["شركة الانتشار لمعطرات الجو","عبدالله الفرجاني","0926440117","بني وليد","home",3.9],
    ["مؤسسة الهدايا والأطقم","هالة السنوسي","0913886604","طرابلس","sets",4.0],
    ["مركز التقطيع والعبوات الزجاجية","فتحي المريمي","0911445502","جنزور","decant",4.7],
    ["شركة الأصالة للتوزيع العام","نجيب القزيري","0925661148","طرابلس","oriental",4.3]
  ];

  /* ─────────── المستخدمون ───────────
     صاحب المحل + 3 موظفين. البنية تدعم الأدوار والصلاحيات مستقبلًا
     دون إعادة بناء، لكن النسخة الحالية بلا تعقيد.                */
  var USERS = [
    ["يوسف كريفة","youssef","مدير","صاحب المحل",true],
    ["معتز بن ناصر","moataz","بائع","دوام صباحي",true],
    ["إسراء الفيتوري","esraa","بائع","دوام مسائي",true],
    ["أنس بوغرارة","anas","بائع","دوام صباحي",true]
  ];

  var PERMISSIONS = [
    ["view_dashboard","عرض الصفحة الرئيسية"],
    ["pos_sell","إتمام عمليات البيع"],
    ["pos_discount","منح خصم على الفاتورة"],
    ["sales_refund","تعديل وإلغاء العمليات"],
    ["products_edit","تعديل المنتجات والأسعار"],
    ["inventory_adjust","تعديل أرصدة المخزون"],
    ["cash_manage","الإيداع والسحب من الصندوق"],
    ["debts_manage","تسجيل الديون والدفعات"],
    ["expenses_manage","تسجيل المصروفات"],
    ["purchases_manage","إدارة المشتريات"],
    ["reports_view","عرض التقارير"],
    ["reports_export","تصدير التقارير"],
    ["settings_manage","إدارة إعدادات النظام"],
    ["users_manage","إدارة المستخدمين"]
  ];

  /* كل الموظفين يعملون بكامل الصلاحيات في النسخة الحالية؛
     التقسيم موجود وجاهز للتضييق لاحقًا بلا تغيير في البنية. */
  var ROLE_PERMS = {
    "مدير": PERMISSIONS.map(function (p) { return p[0]; }),
    "بائع": ["view_dashboard","pos_sell","pos_discount","products_edit","inventory_adjust",
             "debts_manage","expenses_manage","cash_manage","reports_view"],
    "مشرف مخزن": ["view_dashboard","products_edit","inventory_adjust","purchases_manage","reports_view","reports_export"],
    "محاسب": ["view_dashboard","sales_refund","expenses_manage","cash_manage","debts_manage","reports_view","reports_export"]
  };

  var EXPENSE_CATS = [
    { id: "rent", name: "إيجار المحل", emoji: "🏠" },
    { id: "utilities", name: "كهرباء وإنترنت", emoji: "💡" },
    { id: "salaries", name: "رواتب وأجور", emoji: "👥" },
    { id: "display", name: "ديكور وفاترينات عرض", emoji: "🪞" },
    { id: "packaging", name: "تغليف وعلب هدايا", emoji: "🎀" },
    { id: "marketing", name: "تسويق وإعلانات", emoji: "📣" },
    { id: "transport", name: "نقل وشحن", emoji: "🚚" },
    { id: "maintenance", name: "صيانة المحل والمعدات", emoji: "🔧" },
    { id: "samples", name: "عينات وتبخير المحل", emoji: "🧪" },
    { id: "other", name: "أخرى", emoji: "📦" }
  ];

  /* ثلاث طرق دفع فقط حسب المطلوب: نقدي وبطاقة ودين */
  var PAY_METHODS = [
    { id: "cash", name: "نقدي", emoji: "💵" },
    { id: "card", name: "بطاقة", emoji: "💳" },
    { id: "credit", name: "دين", emoji: "🧾" }
  ];

  var CITIES = ["طرابلس","بنغازي","مصراتة","الزاوية","تاجوراء","جنزور","زليتن","الخمس","ترهونة","صبراتة","غريان","سبها","بني وليد"];

  /** بادئة ماركة → أرقامها الأربعة الأولى في الباركود */
  function brandPrefix(name) {
    for (var i = 0; i < BRANDS.length; i++) if (BRANDS[i].name === name) return BRANDS[i].prefix;
    return "6250";
  }
  /** بلد الماركة — للعرض في الشاشات */
  function brandCountry(name) {
    for (var i = 0; i < BRANDS.length; i++) if (BRANDS[i].name === name) return BRANDS[i].country;
    return "";
  }

  /* ═══════════════════════════════════════════════════════════
     المولّد الرئيسي
     ═══════════════════════════════════════════════════════════ */
  HS.data = {
    CATEGORIES: CATEGORIES,
    BRANDS: BRANDS.map(function (b) { return b.name; }),
    BRAND_ROWS: BRANDS,
    brandPrefix: brandPrefix,
    brandCountry: brandCountry,
    EXPENSE_CATS: EXPENSE_CATS,
    PAY_METHODS: PAY_METHODS,
    USERS: USERS,
    PERMISSIONS: PERMISSIONS,
    ROLE_PERMS: ROLE_PERMS,
    CITIES: CITIES,

    defaults: function () {
      return {
        storeName: "يوسف للعطور",
        activity: "عطور أصلية · ماركات عالمية وشرقية",
        branch: "الفرع الرئيسي",
        owner: "يوسف كريفة",
        phone: "0913245118",
        address: "شارع الجمهورية، تاجوراء، طرابلس",
        taxNumber: "LY-20418876",
        currency: "د.ل",
        currencyCode: "LYD",
        decimals: 3,
        numerals: "latin",
        dateFormat: "short",
        taxRate: 0,
        lowStockThreshold: 4,
        cashOpening: 2500,
        receiptFooter: "شكرًا لتسوقكم من يوسف للعطور. جميع العطور أصلية 100٪ وبإمكانكم التحقق من الباركود. لا يُقبل الإرجاع بعد فتح العبوة، والاستبدال خلال 3 أيام بالفاتورة وبحالة السلعة الأصلية.",
        showBarcodeOnReceipt: true,
        defaultDiscount: 0,
        allowNegativeStock: false,
        maxCreditDays: 30,
        invoicePrefix: "INV",
        theme: "light",
        density: "cozy",
        accent: "emerald"
      };
    },

    /** توليد مجموعة البيانات الكاملة نسبةً إلى تاريخ معين */
    generate: function (opts) {
      opts = opts || {};
      var today = HS.date.startOfDay(opts.today || new Date());
      var days = opts.days || 90;
      var seed = opts.seed || 20260928;
      var r = HS.rngHelpers(seed);

      var start = HS.date.addDays(today, -(days - 1));

      /* يوم بلا وقت → نضيف ساعة عمل واقعية حتى لا تظهر كل السجلات منتصف الليل */
      function stamp(d, from, to) {
        var x = new Date(HS.date.toDate(d));
        x.setHours(r.int(from == null ? 10 : from, to == null ? 20 : to), r.int(0, 59), r.int(0, 59), 0);
        return HS.date.toStamp(x);
      }

      /* ── الموردون ── */
      var suppliers = SUPPLIERS.map(function (s, i) {
        return {
          id: "sup-" + (i + 1),
          name: s[0], contact: s[1], phone: s[2], city: s[3],
          focus: s[4], rating: s[5],
          balance: HS.round(r.chance(.42) ? r.float(900, 14500, 3) : 0, 3),
          termsDays: r.pick([0, 15, 30, 45]),
          active: true,
          createdAt: stamp(HS.date.addDays(today, -r.int(200, 900)), 8, 20),
          _seed: true
        };
      });

      /* ── المنتجات: كل حجم صنف مستقل بباركود مستقل ── */
      var seenBarcodes = {};
      var products = PRODUCTS.map(function (p, i) {
        var cat = p[2];
        var brand = p[1];
        var cost = p[5];
        var price = p[6];
        var sizeNum = p[3];
        var sizeUnit = p[4];
        var size = sizeNum ? (sizeNum + " " + sizeUnit) : "";
        var sup = suppliers.filter(function (s) { return s.focus === cat; });
        var supplier = (sup.length ? r.pick(sup) : r.pick(suppliers));

        /* باركود EAN-13 فريد: بادئة الماركة + الحجم + التسلسل + خانة تحقق */
        var seq = String(1000 + i + 1).slice(-4);
        var base = brandPrefix(brand) + String(10000 + (sizeNum || i)).slice(-4) + seq;
        var barcode = HS.barcode.ean13(base);
        var guard = 0;
        while (seenBarcodes[barcode] && guard++ < 900) {
          base = brandPrefix(brand) + String(10000 + (sizeNum || i)).slice(-4) + String(1000 + i + 1 + guard).slice(-4);
          barcode = HS.barcode.ean13(base);
        }
        seenBarcodes[barcode] = true;

        /* السعر يحدد سرعة الدوران: الغالي يُباع نادرًا والرخيص يوميًا */
        var turnover = HS.clamp(240 / price, .22, 2.4);
        var isPremium = price > 600;
        var minStock = isPremium ? r.int(1, 2) : price > 200 ? r.int(2, 4) : r.int(3, 8);

        return {
          id: "p-" + (i + 1),
          sku: "YP" + String(1000 + i + 1).slice(-4),
          barcode: barcode,
          name: p[0],
          brand: brand,
          category: cat,
          size: size,
          sizeNum: sizeNum || 0,
          unit: sizeUnit === "غ" ? "علبة" : (cat === "sets" ? "طقم" : "عبوة"),
          price: price,
          cost: cost,
          stock: 0,             /* يُحسب بعد توليد الحركة */
          minStock: minStock,
          /* الرصيد الافتتاحي لا يقلّ عن حد التنبيه، وإلا بدأ الصنف في حالة إنذار */
          opening: Math.max(minStock + r.int(1, 3),
            isPremium ? r.int(2, 5) : price > 200 ? r.int(4, 10) : r.int(minStock * 3, minStock * 6)),
          supplierId: supplier.id,
          emoji: p[7],
          active: true,
          taxable: false,
          popularity: POPULARITY[cat] * turnover * r.float(.5, 1.55, 3),
          createdAt: stamp(HS.date.addDays(today, -r.int(20, 700)), 9, 19),
          _seed: true
        };
      });

      /* ── العملاء ── */
      var customers = CUSTOMERS.map(function (c, i) {
        var isBusiness = /شركة|محل|صالون|مكتب|مؤسسة|مدرسة/.test(c[0]);
        return {
          id: "c-" + (i + 1),
          name: c[0],
          phone: c[1],
          city: c[2],
          accountType: c[3],
          balance: c[3] === "دين" ? HS.round(r.float(isBusiness ? 1200 : 180, isBusiness ? 9800 : 1850, 3), 3) : 0,
          creditLimit: c[3] === "دين" ? (isBusiness ? 15000 : 3500) : 0,
          totalSpent: 0,   /* يُحسب من المبيعات */
          totalPaid: 0,    /* يُحسب من الدفعات */
          visits: 0,
          note: isBusiness ? "حساب تجاري، الفوترة أسبوعية" : "",
          active: true,
          createdAt: stamp(HS.date.addDays(today, -r.int(20, 700)), 10, 20),
          _seed: true
        };
      });

      /* ── المستخدمون ── */
      var users = USERS.map(function (u, i) {
        return {
          id: "u-" + (i + 1),
          name: u[0], username: u[1], role: u[2], status: u[3], active: u[4],
          permissions: ROLE_PERMS[u[2]].slice(),
          phone: "09" + r.int(10, 49) + r.int(100000, 999999),
          lastLogin: stamp(HS.date.addDays(today, -r.int(0, u[4] ? 2 : 14)), 9, 21),
          createdAt: stamp(HS.date.addDays(today, -r.int(60, 600)), 9, 18),
          _seed: true
        };
      });
      var cashiers = users.slice();

      /* ── المبيعات ──
         توزيع واقعي: ذروة مسائية، والجمعة والسبت أعلى (مناسبات وهدايا). */
      var sales = [];
      var movements = [];
      var soldCount = {};
      products.forEach(function (p) { soldCount[p.id] = 0; });

      var invoiceNo = 0;
      var weights = products.map(function (p) { return [p, p.popularity]; });

      for (var d = 0; d < days; d++) {
        var day = HS.date.addDays(start, d);
        var dow = day.getDay();               /* 0=الأحد … 5=الجمعة 6=السبت */
        var base = dow === 5 ? 6.9 : dow === 6 ? 7.6 : dow === 0 ? 3.7 : dow === 3 ? 4.2 : 5.1;
        var trend = 1 + (d / days) * .26;
        var n = Math.max(1, Math.round(base * trend * r.float(.6, 1.45, 3)));

        for (var k = 0; k < n; k++) {
          var hour = r.weighted([
            [10, 1.4], [11, 2.1], [12, 1.9], [13, 1.3], [14, .9],
            [16, 1.5], [17, 2.4], [18, 2.8], [19, 2.5], [20, 1.9], [21, 1.2], [22, .6]
          ]);
          var minute = r.int(0, 59);
          var when = new Date(day); when.setHours(hour, minute, r.int(0, 59), 0);
          if (when > today && d === days - 1 && hour > new Date().getHours()) continue;

          /* سلة المشتريات: غالبًا صنف أو صنفان */
          var itemCount = r.weighted([[1, 4.6], [2, 3.1], [3, 1.6], [4, .9], [5, .45], [6, .22], [7, .1]]);
          var chosen = {}, items = [], guard = 0, hasBig = false;
          while (items.length < itemCount && guard++ < 60) {
            var prod = r.weighted(weights);
            if (chosen[prod.id]) {
              var existing = items.filter(function (it) { return it.productId === prod.id; })[0];
              if (existing && existing.qty < 6 && r.chance(.55)) { existing.qty += 1; }
              continue;
            }
            chosen[prod.id] = true;
            if (prod.price > 500) hasBig = true;
            /* القارورة تُشترى واحدة؛ الرخيص يُشترى بالجملة الصغيرة */
            var qty = SINGLE[prod.category] || prod.price > 500 ? 1
                    : prod.price > 150 ? r.weighted([[1, 6.4], [2, 2.1], [3, .6]])
                    : r.weighted([[1, 5.2], [2, 2.9], [3, 1.4], [4, .6], [5, .3], [6, .15]]);
            items.push({
              productId: prod.id,
              name: prod.name + (prod.size ? " · " + prod.size : ""),
              brand: prod.brand, size: prod.size, unit: prod.unit,
              qty: qty, price: prod.price, cost: prod.cost,
              discount: 0
            });
            soldCount[prod.id] = (soldCount[prod.id] || 0) + qty;
          }
          if (!items.length) continue;

          var subtotal = HS.round(HS.sum(items, function (it) { return it.qty * it.price; }), 3);
          /* خصم: على القوارير الغالية مفاوضات معتادة */
          var discount = 0;
          if (hasBig ? r.chance(.44) : r.chance(.13)) {
            if (subtotal > (hasBig ? 300 : 60)) discount = HS.round(subtotal * r.float(.018, .074, 4), 3);
          }
          var cust = r.chance(.38) ? r.pick(customers) : null;
          var method = r.weighted([["cash", 71], ["card", 18], ["credit", 11]]);
          if (cust && cust.accountType === "دين" && r.chance(.6)) method = "credit";
          if (method === "credit" && !cust) cust = r.pick(customers.filter(function (c) { return c.accountType === "دين"; }));

          var tax = 0;
          var total = HS.round(subtotal - discount + tax, 3);
          var status = "paid";
          var roll = r.next();
          if (roll < .024) status = "returned";
          else if (method === "credit") status = r.chance(.68) ? "partial" : "unpaid";

          /* المحصَّل فعليًا: النقدي كامل، والدين صفر، والجزئي بعضه */
          var collected = status === "paid" ? (method === "credit" ? 0 : total)
                        : status === "returned" ? 0
                        : HS.round(total * r.float(.28, .68, 3), 3);

          invoiceNo++;
          var sale = {
            id: "s-" + invoiceNo,
            number: "INV-" + day.getFullYear() + "-" + String(1000 + invoiceNo).slice(-4),
            date: HS.date.toStamp(when),
            customerId: cust ? cust.id : null,
            customerName: cust ? cust.name : "زبون نقدي",
            items: items,
            subtotal: subtotal,
            discount: discount,
            tax: tax,
            total: total,
            paid: collected,
            method: method,
            status: status,
            cashierId: r.pick(cashiers).id,
            note: "",
            _seed: true
          };
          sales.push(sale);

          items.forEach(function (it) {
            movements.push({
              id: "m-" + movements.length + "-" + invoiceNo,
              date: sale.date,
              productId: it.productId,
              type: status === "returned" ? "return" : "out",
              qty: it.qty,
              reason: status === "returned" ? "إلغاء عملية بيع" : "بيع",
              ref: sale.number,
              userId: sale.cashierId,
              _seed: true
            });
          });
        }
      }

      /* ── المشتريات: تعيد تعبئة المخزون ── */
      var purchases = [];
      for (var pi = 0; pi < 38; pi++) {
        var pday = HS.date.addDays(start, r.int(0, days - 2));
        var sup = r.pick(suppliers);
        var catProducts = products.filter(function (p) { return p.supplierId === sup.id; });
        if (!catProducts.length) catProducts = products;
        var lines = [];
        var lineCount = r.int(2, 6);
        for (var li = 0; li < lineCount; li++) {
          var pp = r.pick(catProducts);
          if (lines.some(function (l) { return l.productId === pp.id; })) continue;
          /* القوارير الغالية تُطلب بأعداد صغيرة، والرخيص بالصناديق */
          var q = pp.price > 600 ? r.int(1, 4) : pp.price > 200 ? r.int(3, 12) : r.int(10, 60);
          lines.push({ productId: pp.id, name: pp.name + (pp.size ? " · " + pp.size : ""), qty: q, cost: HS.round(pp.cost * r.float(.96, 1.06, 3), 3) });
        }
        if (!lines.length) continue;
        var ptotal = HS.round(HS.sum(lines, function (l) { return l.qty * l.cost; }), 3);
        var pr = r.next();
        var pstatus = pr < .72 ? "received" : pr < .88 ? "shipping" : pr < .95 ? "draft" : "cancelled";
        var pnum = "PO-" + pday.getFullYear() + "-" + String(200 + pi).slice(-3);
        purchases.push({
          id: "po-" + (pi + 1),
          number: pnum,
          date: HS.date.toISO(pday),
          expectedDate: HS.date.toISO(HS.date.addDays(pday, r.int(3, 16))),
          supplierId: sup.id,
          supplierName: sup.name,
          items: lines,
          total: ptotal,
          paid: pstatus === "received" ? (r.chance(.55) ? ptotal : HS.round(ptotal * r.float(.3, .8, 3), 3)) : 0,
          status: pstatus,
          note: "",
          _seed: true
        });
        if (pstatus === "received") {
          lines.forEach(function (l) {
            movements.push({
              id: "m-po" + (pi + 1) + "-" + l.productId,
              date: stamp(pday, 10, 18),
              productId: l.productId,
              type: "in",
              qty: l.qty,
              reason: "استلام مشتريات",
              ref: pnum,
              userId: "u-1",
              _seed: true
            });
          });
        }
      }

      /* ── حركات المخزون الافتتاحية (بضاعة موجودة قبل بداية الفترة) ── */
      products.forEach(function (p) {
        movements.unshift({
          id: "m-init-" + p.id,
          date: stamp(HS.date.addDays(start, -r.int(1, 40)), 9, 17),
          productId: p.id, type: "in", qty: p.opening,
          reason: "رصيد افتتاحي", ref: "INIT", userId: "u-1", _seed: true
        });
      });

      /* ── تسويات جرد وتصحيحات ── */
      for (var ai = 0; ai < 20; ai++) {
        var aday = HS.date.addDays(start, r.int(0, days - 1));
        var aprod = r.pick(products);
        var adiff = r.chance(.68) ? -r.int(1, 3) : r.int(1, 4);
        movements.push({
          id: "m-adj-" + (ai + 1),
          date: stamp(aday, 10, 20),
          productId: aprod.id,
          type: "adjust",
          qty: adiff,
          reason: adiff < 0 ? r.pick(["قارورة مكسورة", "تسرب أو تبخر", "فرق جرد", "عينة استُهلكت في المحل", "مفقود"]) : "زيادة جرد",
          ref: "ADJ-" + String(300 + ai).slice(-3),
          userId: r.pick(cashiers).id,
          _seed: true
        });
      }

      /* ── حساب الأرصدة من الحركات ── */
      function balanceOf(p) {
        return HS.sum(movements.filter(function (m) { return m.productId === p.id; }), function (m) {
          if (m.type === "in") return m.qty;
          if (m.type === "out") return -Math.abs(m.qty);
          if (m.type === "return") return Math.abs(m.qty);
          return m.qty;
        });
      }
      products.forEach(function (p) { p.stock = Math.max(0, balanceOf(p)); });

      /* ── تجميع إحصاءات العملاء ── */
      customers.forEach(function (c) {
        var own = sales.filter(function (s) { return s.customerId === c.id && s.status !== "returned"; });
        c.visits = own.length;
        c.totalSpent = HS.round(HS.sum(own, function (s) { return s.total; }), 3);
        c.lastVisit = own.length ? own[own.length - 1].date : null;
      });

      /* ── المصروفات ── */
      var expenses = [];
      for (var mi = 0; mi < 4; mi++) {
        var m0 = HS.date.addMonths(today, -mi);
        expenses.push(exp("rent", new Date(m0.getFullYear(), m0.getMonth(), 1), 2800, "إيجار شهر " + HS.fmt.month(m0)));
        expenses.push(exp("salaries", new Date(m0.getFullYear(), m0.getMonth(), r.int(25, 28)), HS.round(r.float(3200, 4600, 3), 3), "رواتب الموظفين"));
        expenses.push(exp("utilities", new Date(m0.getFullYear(), m0.getMonth(), r.int(8, 18)), HS.round(r.float(280, 690, 3), 3), "فاتورة الكهرباء والإنترنت"));
        if (r.chance(.5)) expenses.push(exp("display", new Date(m0.getFullYear(), m0.getMonth(), r.int(3, 26)), HS.round(r.float(180, 1400, 3), 3), r.pick(["فاترينة عرض زجاجية", "إضاءة LED للفاترينات", "رفوف عرض جديدة", "لوحة محل مضيئة"])));
        if (r.chance(.45)) expenses.push(exp("packaging", new Date(m0.getFullYear(), m0.getMonth(), r.int(2, 27)), HS.round(r.float(120, 640, 3), 3), r.pick(["علب هدايا وأكياس", "أشرطة وورق تغليف", "عبوات زجاجية للتقطيع", "بخاخات ومضخات بديلة"])));
        if (r.chance(.38)) expenses.push(exp("samples", new Date(m0.getFullYear(), m0.getMonth(), r.int(4, 26)), HS.round(r.float(90, 520, 3), 3), r.pick(["عينات تجريبية للزبائن", "تبخير المحل يوميًا", "ورق نشاف للتجربة"])));
        if (r.chance(.35)) expenses.push(exp("transport", new Date(m0.getFullYear(), m0.getMonth(), r.int(4, 24)), HS.round(r.float(150, 780, 3), 3), r.pick(["شحن طلبية من المورد", "نقل بضاعة من المخزن", "توصيل طلبات للعملاء"])));
        if (r.chance(.3)) expenses.push(exp("marketing", new Date(m0.getFullYear(), m0.getMonth(), r.int(5, 25)), HS.round(r.float(150, 700, 3), 3), r.pick(["إعلان ممول على فيسبوك", "طباعة كروت أسعار", "حملة عروض نهاية الأسبوع"])));
        if (r.chance(.28)) expenses.push(exp("maintenance", new Date(m0.getFullYear(), m0.getMonth(), r.int(3, 26)), HS.round(r.float(120, 560, 3), 3), r.pick(["صيانة المكيف", "إصلاح باب المحل", "صيانة جهاز الباركود", "تغيير إضاءة الواجهة"])));
      }
      function exp(cat, date, amount, note) {
        return {
          id: "e-" + expenses.length + "-" + Math.abs(HS.date.toISO(date).split("-").join("")),
          date: stamp(date, 10, 19), category: cat, amount: HS.round(amount, 3),
          note: note,
          /* الإيجار والرواتب تحويل مصرفي، والباقي غالبًا نقدي من الصندوق */
          method: cat === "rent" || cat === "salaries" ? "card" : r.weighted([["cash", 62], ["card", 38]]),
          userId: "u-1", recurring: cat === "rent" || cat === "salaries", _seed: true
        };
      }
      expenses = expenses.filter(function (e) { return HS.date.toDate(e.date) >= start && HS.date.toDate(e.date) <= HS.date.endOfDay(today); });
      expenses.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });

      /* ── سجل مدفوعات عملاء الحسابات المدينة ──
         كل عميل حسابه «دين» له دفعات سابقة تفسّر كيف وصل رصيده الحالي. */
      var payments = [];
      customers.filter(function (c) { return c.accountType === "دين" && c.active; }).forEach(function (c, ci) {
        var n = r.int(2, 6);
        for (var pj = 0; pj < n; pj++) {
          var payDay = HS.date.addDays(start, r.int(2, days - 3));
          payments.push({
            id: "pay-s-" + (ci + 1) + "-" + (pj + 1),
            date: stamp(payDay, 11, 20),
            customerId: c.id, customerName: c.name,
            amount: HS.round(r.float(c.creditLimit ? c.creditLimit * .06 : 150, c.creditLimit ? c.creditLimit * .38 : 1200, 3), 3),
            /* السداد النقدي يدخل الصندوق، وبالطبع لا يدخل إن كان بالبطاقة */
            method: r.weighted([["cash", 68], ["card", 32]]),
            saleId: null,
            note: r.chance(.35) ? r.pick(["تسوية أسبوعية", "دفعة على الحساب", "سداد بعد تسليم الطلبية", ""]) : "",
            userId: "u-1", _seed: true
          });
        }
      });
      payments.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });

      /* ── عمليات الصندوق اليدوية: رصيد افتتاحي وسحوبات وإيداعات ── */
      var cashEntries = [{
        id: "cash-open",
        date: stamp(start, 9, 10),
        type: "in",
        amount: HS.data.defaults().cashOpening,
        reason: "رصيد افتتاحي للصندوق",
        userId: "u-1",
        _seed: true
      }];
      for (var ci2 = 0; ci2 < 7; ci2++) {
        var cday = HS.date.addDays(start, r.int(4, days - 2));
        var isOut = r.chance(.62);
        cashEntries.push({
          id: "cash-" + (ci2 + 1),
          date: stamp(cday, 12, 21),
          type: isOut ? "out" : "in",
          amount: HS.round(isOut ? r.float(150, 2200, 3) : r.float(400, 3500, 3), 3),
          reason: isOut ? r.pick(["توريد مبلغ للمصرف", "سلفة لموظف", "شراء عاجل من السوق", "مصاريف تشغيل نقدي"])
                        : r.pick(["إيداع من صاحب المحل", "تحصيل شيك", "رصيد مُرحَّل من فرع"]),
          userId: "u-1",
          _seed: true
        });
      }
      /* ── توريد أسبوعي إلى المصرف ──
         محل حقيقي لا يُبقي عشرات الآلاف في الدرج: كل أسبوع يُورَّد
         صافي النقد بعد إبقاء مبلغ تشغيلي صغير. هذا يجعل رصيد الصندوق
         المتوقع رقمًا معقولًا وقابلًا للعدّ يدويًا.                    */
      function cashNetBetween(a, b) {
        var inWin = function (d) { var t = HS.date.toDate(d); return t >= a && t <= b; };
        var inc = 0;
        sales.forEach(function (x) {
          if (x.status === "held" || !x.paid) return;
          if ((x.method === "cash" || x.method === "credit") && inWin(x.date)) inc += x.paid;
          if (x.status === "returned" && (x.method === "cash" || x.method === "credit") && inWin(x.returnedAt || x.date)) inc -= x.paid;
        });
        payments.forEach(function (x) { if ((x.method || "cash") === "cash" && inWin(x.date)) inc += x.amount; });
        expenses.forEach(function (x) { if ((x.method || "cash") === "cash" && inWin(x.date)) inc -= x.amount; });
        cashEntries.forEach(function (x) { if (inWin(x.date)) inc += x.type === "out" ? -x.amount : x.amount; });
        return HS.round(inc, 3);
      }
      var wk = 0;
      for (var wStart = new Date(start); wStart < today; wStart = HS.date.addDays(wStart, 7)) {
        wk++;
        var wEnd = HS.date.endOfDay(HS.date.addDays(wStart, 6));
        if (wEnd > HS.date.endOfDay(today)) wEnd = HS.date.endOfDay(today);
        var net = cashNetBetween(wStart, wEnd);
        var keep = HS.round(r.float(1200, 3400, 3), 3);
        if (net - keep < 800) continue;
        cashEntries.push({
          id: "cash-bank-" + wk,
          date: stamp(HS.date.addDays(wStart, r.int(4, 6)), 17, 20),
          type: "out",
          amount: HS.round(net - keep, 3),
          reason: "توريد أسبوعي إلى المصرف",
          userId: "u-1",
          _seed: true
        });
      }
      for (var xi = 0; xi < 3; xi++) {
        cashEntries.push({
          id: "cash-x-" + (xi + 1),
          date: stamp(HS.date.addDays(start, r.int(5, days - 3)), 11, 19),
          type: r.chance(.5) ? "out" : "in",
          amount: HS.round(r.float(200, 1800, 3), 3),
          reason: r.pick(["سلفة لموظف", "شراء عاجل من السوق", "إيداع من صاحب المحل", "رصيد مُرحَّل"]),
          userId: "u-1",
          _seed: true
        });
      }
      cashEntries.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });

      sales.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });

      return {
        generatedAt: new Date().toISOString(),
        anchorDate: HS.date.toISO(today),
        categories: CATEGORIES.map(function (c) { return Object.assign({}, c); }),
        products: products,
        customers: customers,
        suppliers: suppliers,
        users: users,
        sales: sales,
        purchases: purchases,
        movements: movements,
        expenses: expenses,
        payments: payments,
        cashEntries: cashEntries,
        settings: HS.data.defaults(),
        session: { userId: null, since: null },
        carts: { active: [], held: [] },
        ui: { collapsed: false, drawer: false, period: "30d", lastRoute: "#/" }
      };
    }
  };
})();
