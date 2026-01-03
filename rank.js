// ********************************************
// 🎮 فایل هسته: rank.js (نسخه امن و پایدار V2)
// ********************************************

// تذکر: API_URL باید در فایل HTML تعریف شده باشد. اگر نبود، پیش‌فرض استفاده می‌شود.
const SERVER_URL = (typeof API_URL !== 'undefined') ? API_URL : "https://chamran-api.liara.run"; 

const RankSystem = {
    // لیست مقام‌ها (صرفاً جهت نمایش، محاسبه اصلی با سرور است)
    ranks: [
        { min: 0, title: "🐣 نوآموز" },
        { min: 500, title: "🛡️ محافظ" },
        { min: 1500, title: "⚔️ جنگجو" },
        { min: 3000, title: "👑 فرمانده" },
        { min: 5000, title: "💎 اسطوره" }
    ],

    // داده‌های پیش‌فرض
    data: { xp: 0, rank: "🐣 نوآموز", completed: [], playback: {}, exams: {} },
    
    // مقداردهی اولیه با داده‌های سرور
    init: function(serverJson) {
        let serverData = {};
        if(serverJson && serverJson !== "{}") {
            try { 
                serverData = typeof serverJson === 'string' ? JSON.parse(serverJson) : serverJson; 
            } catch(e) { console.error("JSON Error", e); }
            
            // جایگزینی مستقیم داده‌ها (سرور همیشه درست می‌گوید)
            this.data = {
                xp: serverData.xp || 0,
                rank: serverData.rank || "🐣 نوآموز",
                completed: serverData.completed || [],
                playback: serverData.playback || {},
                exams: serverData.exams || {}
            };
        }
        this.updateUI();
        // اگر در صفحه لیست دروس باشیم، لیست را رفرش کن تا تیک‌های سبز بیاید
        setTimeout(() => { 
            if(typeof renderList === 'function') renderList(); 
        }, 500);
    },

    // ذخیره موقعیت فیلم (چقدر دیده شده)
    savePosition: function(id, time, forceSync = false) {
        const sId = id.toString();
        this.data.playback[sId] = Math.floor(time);
        
        // استراتژی ذخیره: هر 5 ثانیه یکبار یا اگر دستور اجباری آمد
        if(Math.floor(time) % 15 === 0 || forceSync) {
             SyncManager.addToQueue('sync', null, forceSync); 
        }
    },

    // دریافت آخرین موقعیت دیده شده
    getLastPosition: function(id) { 
        return this.data.playback[id.toString()] || 0; 
    },

    // 🔒 تغییر مهم: درخواست امتیاز فقط از طریق سرور
    // این تابع قبلاً امتیاز می‌داد، الان فقط به کاربر پیام می‌دهد
    // عملیات واقعی توسط SyncManager با اکشن claim_reward انجام می‌شود
    addXP: function(amount, reason, uniqueId) {
        console.log("Requesting XP from server...");
        // اینجا امتیاز محلی اضافه نمی‌کنیم! منتظر سرور می‌مانیم.
        // فقط برای UX شاید لازم باشد پیامی نشان دهیم، اما در دیزاین جدید
        // پیام‌ها در بخش‌های دیگر هندل شده‌اند.
    },

    updateUI: function() {
        const xpEl = document.getElementById('user-xp');
        const rankEl = document.getElementById('user-rank');
        if(xpEl) xpEl.innerText = `${this.toPersianNum(this.data.xp)} XP`;
        if(rankEl) rankEl.innerText = this.data.rank;
    },
    
    getDevice: function() { return /Mobile|Android/i.test(navigator.userAgent) ? "موبایل" : "کامپیوتر"; },
    
    toPersianNum: function(n) { 
        if(n === undefined || n === null) return "۰"; 
        return n.toString().replace(/\d/g, x => ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'][x]); 
    }
};

// ********************************************
// 📡 مدیر همگام‌سازی ضد گلوله (Bulletproof Sync)
// ********************************************
const SyncManager = {
    queue: [], 
    username: null, 
    password: null,
    isSyncing: false,

    init: function(user, pass) {
        this.username = user; 
        this.password = pass;
        // 💾 بازیابی صف از دیسک (مهم برای زمانی که کاربر مرورگر را بسته)
        this.queue = JSON.parse(localStorage.getItem('chamran_queue_vfinal') || "[]");
        
        this.processQueue();
        
        // تلاش دوره‌ای برای ارسال (اگر اینترنت قطع و وصل شد)
        setInterval(() => this.processQueue(), 5000);
        
        // لیسنر وضعیت آنلاین/آفلاین
        window.addEventListener('online', () => this.processQueue());
        window.addEventListener('offline', () => this.updateOfflineBadge());
    },

    addToQueue: function(action, logData = null, forcePlayback = false) {
        // برای claim_reward پارامترهای خاصی داریم که در logData می‌آید
        // باید آنها را استخراج کنیم و در سطح بدنه درخواست بگذاریم
        let extraParams = {};
        if (action === 'claim_reward' && logData) {
            extraParams = { ...logData }; // کپی پارامترها (reward_type, reward_id, exam_score)
        }

        const item = {
            action: action, 
            username: this.username, 
            password: this.password,
            jsonData: JSON.stringify(RankSystem.data), // همیشه آخرین وضعیت دیتا را بفرست
            logData: logData, // این فقط برای لاگ است
            timestamp: Date.now(),
            force_playback: forcePlayback,
            ...extraParams // پارامترهای اضافه مثل پاداش
        };

        // ✅ بهینه‌سازی هوشمند: ادغام درخواست‌های تکراری Sync
        // اگر درخواست قبلی sync بود و این هم sync است، قبلی را آپدیت کن (جلوگیری از اسپم)
        // اما درخواست‌های مهم مثل claim_reward یا report نباید ادغام شوند
        if(action === 'sync' && !forcePlayback && this.queue.length > 0) {
             const lastItem = this.queue[this.queue.length-1];
             if (lastItem.action === 'sync') {
                 this.queue[this.queue.length-1] = item; // جایگزینی با دیتای جدیدتر
             } else {
                 this.queue.push(item);
             }
        } else {
             this.queue.push(item);
        }
        
        this.saveQueue(); // 💾 ذخیره فوری در دیسک
        this.processQueue();
    },

    saveQueue: function() {
        localStorage.setItem('chamran_queue_vfinal', JSON.stringify(this.queue));
        this.updateOfflineBadge();
    },

    updateOfflineBadge: function() {
        const badge = document.getElementById('offlineBadge');
        if(badge) {
            if(this.queue.length > 0 && !navigator.onLine) { 
                badge.style.display = 'block'; 
                badge.innerText = `📡 در انتظار اینترنت... (${this.queue.length})`; 
                badge.style.background = "#c0392b"; 
            } else if (this.queue.length > 0 && navigator.onLine) {
                badge.style.display = 'block'; 
                badge.innerText = `🔄 در حال ارسال...`; 
                badge.style.background = "#f39c12";
            } else { 
                badge.style.display = 'none'; 
            }
        }
    },

    processQueue: function() {
        if(this.queue.length === 0 || !navigator.onLine || this.isSyncing) {
            this.updateOfflineBadge();
            return;
        }

        this.isSyncing = true;
        const item = this.queue[0]; // گرفتن اولین آیتم
        
        // قبل از ارسال، مطمئن می‌شویم آخرین وضعیت دیتا را دارد
        if(item.action === 'sync') {
            item.jsonData = JSON.stringify(RankSystem.data); 
        }
        
        fetch(SERVER_URL, {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item)
        })
        .then(res => res.json())
        .then(data => {
            if(data.status === 'success') {
                // ✅ موفقیت
                this.queue.shift(); // حذف از صف
                this.saveQueue();
                
                // اگر سرور دیتای جدید فرستاد (مثلاً بعد از گرفتن پاداش)، آپدیت کن
                if (data.serverData) {
                    console.log("Server data received & updated.");
                    RankSystem.init(data.serverData);
                    
                    // ذخیره کردشال (Credential) جدید در لوکال استوریج (چون XP عوض شده)
                    const creds = JSON.parse(localStorage.getItem('chamran_db_vfinal_creds') || "{}");
                    creds.jsonData = data.serverData;
                    localStorage.setItem('chamran_db_vfinal_creds', JSON.stringify(creds));
                    
                    // اگر پیام پاداش بود
                    if (data.added && data.added > 0) {
                        alert(`🎉 تبریک! ${data.added} امتیاز از سرور دریافت شد.`);
                    }
                }

                // اگر باز هم چیزی در صف هست، سریع بعدی را بفرست
                this.isSyncing = false;
                if(this.queue.length > 0) setTimeout(() => this.processQueue(), 100);
            } else {
                // خطای منطقی سرور (مثلاً یوزر بن شده)
                console.error("Server Logic Error:", data.message);
                if(data.message && data.message.includes('مسدود')) {
                    alert("⛔ حساب شما مسدود شده است.");
                    this.queue = []; // خالی کردن صف چون فایده ندارد
                    this.saveQueue();
                } else {
                    // سایر خطاها: حذف کن که گیر نکند
                    this.queue.shift();
                    this.saveQueue();
                }
                this.isSyncing = false;
            }
        })
        .catch(err => {
            // ❌ خطای شبکه: در صف نگه دار و بعداً تلاش کن
            console.log("Network Error (Retrying later)", err);
            this.isSyncing = false;
            this.updateOfflineBadge();
        });
    }
};
