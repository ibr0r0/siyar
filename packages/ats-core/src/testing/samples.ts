/**
 * Sample CVs used by the rubric tests and by the "try it with an example"
 * button in the app. Entirely invented — no real person's details appear here.
 */

/** An Arabic CV that should score well: clear headings, dates, quantified bullets. */
export const GOOD_ARABIC_CV = `أحمد بن سالم القحطاني
مهندس برمجيات أول
الرياض، المملكة العربية السعودية
ahmed.alqahtani@example.com
+966 551234567
linkedin.com/in/ahmed-alqahtani

الملخص المهني
مهندس برمجيات بخبرة ثماني سنوات في بناء أنظمة الدفع وتوسيع البنية السحابية، مع تركيز على الموثوقية وخفض التكاليف التشغيلية.

الخبرة العملية
شركة تقنيات الدفع — مهندس برمجيات أول
يناير 2021 - حتى الآن
• قدت إعادة بناء بوابة الدفع فخفضت زمن الاستجابة من 800 مللي ثانية إلى 120 مللي ثانية
• أدرت فريقا من 6 مهندسين وسلمت 14 مشروعا خلال عامين
• خفضت تكلفة البنية التحتية بنسبة 35% عبر إعادة تصميم طبقة التخزين المؤقت
• أتمتت خط النشر فاختصرت زمن الإصدار من 4 ساعات إلى 20 دقيقة

مجموعة الاتصالات السعودية — مهندس برمجيات
مارس 2018 - ديسمبر 2020
• طورت واجهات برمجية خدمت أكثر من 200000 مستخدم شهريا
• حسنت تغطية الاختبارات من 40% إلى 85% خلال 6 أشهر
• دربت 12 مهندسا جديدا على معايير كتابة الكود

التعليم
جامعة الملك فهد للبترول والمعادن
بكالوريوس علوم حاسب، سبتمبر 2013 - يونيو 2017

المهارات
Java، Spring Boot، PostgreSQL، Kubernetes، AWS، Kafka، Terraform، إدارة الفرق

اللغات
العربية (اللغة الأم)، الإنجليزية (متقدم)
`;

/** The same person, written badly: no headings, no dates, duty-based prose. */
export const WEAK_ARABIC_CV = `أحمد
مطور

عن نفسي
انا مطور احب البرمجة وابحث عن فرصة عمل مناسبة في مجال التقنية وعندي رغبة في التطور

اعمالي
- مسؤول عن تطوير المواقع
- مسؤول عن صيانة الانظمة
- العمل على مشاريع مختلفة مع الفريق حسب الحاجة وبالتنسيق مع الاقسام الاخرى وحسب ما يطلب مني في حينه ومتابعة كل ما يتعلق بذلك من مهام يومية وتقارير دورية والرد على الاستفسارات وحضور الاجتماعات وكل ما يلزم لانجاز العمل على اكمل وجه
- المساعدة في حل المشاكل

الدراسة
بكالوريوس

تاريخ الميلاد: 1995
الحالة الاجتماعية: أعزب
الجنسية: سعودي
`;

/** A solid English CV, for the English-language paths. */
export const GOOD_ENGLISH_CV = `Sara Al-Otaibi
Senior Data Analyst
Jeddah, Saudi Arabia
sara.alotaibi@example.com
+966 559876543
linkedin.com/in/sara-alotaibi

Professional Summary
Data analyst with seven years of experience turning operational data into decisions for retail and logistics teams.

Work Experience
Gulf Retail Group — Senior Data Analyst
Feb 2021 - Present
• Built a demand forecasting model that cut stockouts by 28% across 140 stores
• Led a team of 4 analysts and delivered 30 dashboards used by 500 employees
• Reduced monthly reporting time from 5 days to 6 hours through automation
• Migrated the reporting stack to dbt, saving 120 hours of manual work per quarter

Logistics Co — Data Analyst
Jun 2017 - Jan 2021
• Analysed 2 million delivery records to identify 3 major routing inefficiencies
• Improved on-time delivery from 82% to 94% over 18 months
• Trained 15 staff on self-service reporting tools

Education
King Abdulaziz University
BSc Statistics, Sep 2013 - Jun 2017

Skills
SQL, Python, dbt, Snowflake, Tableau, Power BI, forecasting, experimentation

Languages
Arabic (native), English (fluent)
`;

/** A job description, for exercising the keyword family. */
export const SAMPLE_JOB_DESCRIPTION = `مهندس برمجيات أول

نبحث عن مهندس برمجيات أول للانضمام إلى فريق المنصة في الرياض.

المتطلبات:
- خبرة لا تقل عن 5 سنوات في تطوير الأنظمة الخلفية
- إتقان Java و Spring Boot
- خبرة عملية في Kubernetes و AWS
- معرفة قوية بقواعد البيانات PostgreSQL
- خبرة في أنظمة الرسائل مثل Kafka
- القدرة على قيادة فريق صغير من المهندسين
- خبرة في Terraform وأتمتة البنية التحتية

المهام:
- تصميم وتطوير خدمات مصغرة عالية الأداء
- مراجعة الكود وتدريب المهندسين الجدد
- تحسين موثوقية الأنظمة وخفض زمن الاستجابة
`;
