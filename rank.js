// ********************************************
// 🎮 فایل هسته: rank.js (نسخه نهایی و هماهنگ)
// ********************************************

const REPORT_WEBAPP_URL = "https://chamran-api.liara.run";

const RankSystem = {
    // لیست مقام‌ها (صرفاً جهت نمایش آفلاین، محاسبه اصلی با سرور است)
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
        
        // تلاش برای خواندن جیسون سرور
        if(serverJson && serverJson !== "{}") {
            try { 
                serverData = typeof serverJson === 'string' ? JSON.parse(serverJson) : serverJson; 
            } catch(e) { 
                console.error("Server JSON Error", e); 
            }
            
            // جایگزینی مستقیم داده‌ها (سرور اولویت دارد)
            this.data = {
                xp: serverData.xp || 0,
                rank: serverData.rank || "🐣 نوآموز",
                completed: serverData.completed || [],
                playback: serverData.playback || {},
                exams: serverData.exams || {}
            };
        }

        // بروزرسانی ظاهر برنامه
        this.updateUI();
        
        // اگر تابع رندر لیست وجود داشت (در صفحه اصلی)، لیست را آپدیت کن
        setTimeout(() => { 
            if(typeof renderList === 'function') renderList(); 
        }, 500);
    },

    // ذخیره موقعیت فیلم (چقدر دیده شده)
    savePosition: function(id, time, forceSync = false) {
        const sId = id.toString();
        this.data.playback[sId] = Math.floor(time);
        
        // استراتژی ذخیره:
        // هر 5 ثانیه یکبار یا اگر دستور اجباری (forceSync) آمد، به صف ارسال بفرست
        // (عدد 5 باعث می‌شود ادمین دقیق‌تر ببیند)
        if(Math.floor(time) % 5 === 0 || forceSync) {
             SyncManager.addToQueue('sync', null, forceSync); 
        }
    },

    // دریافت آخرین موقعیت دیده شده
    getLastPosition: function(id) { 
        return this.data.playback[id.toString()] || 0; 
    },

    // افزودن امتیاز
    addXP: function(amount, reason, uniqueId) {
        const sId = uniqueId.toString();
        
        // اگر قبلاً بابت این آیتم امتیاز گرفته، دوباره نده
        if(uniqueId && this.data.completed.includes(sId)) return;
        
        this.data.xp += amount;
        if(uniqueId) { this.data.completed.push(sId); }
        
        // نکته مهم: محاسبه رنک اصلی وقتی به سرور رسید انجام می‌شود
        // اینجا فقط برای خوشحالی کاربر بصورت محلی آپدیت می‌کنیم
        this.checkRankUpLocal(); 
        this.updateUI(); 
        
        // ارسال فوری گزارش به سرور
        SyncManager.addToQueue('report', { 
            lesson: reason, 
            status: 'کسب امتیاز / تکمیل', 
            details: `مجموع XP: ${this.data.xp}`, 
            device: this.getDevice() 
        });
    },

    // محاسبه محلی رنک (فقط برای نمایش آنی، تا قبل از سینک سرور)
    checkRankUpLocal: function() {
        let currentRankTitle = this.ranks[0].title;
        for (let i = this.ranks.length - 1; i >= 0; i--) {
            if (this.data.xp >= this.ranks[i].min) { currentRankTitle = this.ranks[i].title; break; }
        }
        if(this.data.rank !== currentRankTitle) {
            this.data.rank = currentRankTitle;
        }
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
// 📡 مدیر همگام‌سازی (Sync Manager)
// ********************************************
const SyncManager = {
    queue: [], 
    username: null, 
    password: null,

    init: function(user, pass) {
        this.username = user; 
        this.password = pass;
        // بازیابی صف قبلی از حافظه
        this.queue = JSON.parse(localStorage.getItem('chamran_queue_vfinal') || "[]");
        this.processQueue();
        
        // تلاش برای ارسال صف هر 5 ثانیه
        setInterval(() => this.processQueue(), 5000);
    },

    addToQueue: function(action, logData = null, forcePlayback = false) {
        const item = {
            action: action, 
            username: this.username, 
            password: this.password,
            jsonData: JSON.stringify(RankSystem.data), // همیشه آخرین وضعیت دیتا را بفرست
            logData: logData, 
            timestamp: Date.now(),
            force_playback: forcePlayback 
        };

        // بهینه‌سازی هوشمند: اگر آیتم قبلی هم sync بود، آن را آپدیت کن تا صف شلوغ نشود
        // مگر اینکه فورس باشد (مثل جریمه)
        if(action === 'sync' && !forcePlayback && this.queue.length > 0 && this.queue[this.queue.length-1].action === 'sync') {
             this.queue[this.queue.length-1] = item;
        } else {
             this.queue.push(item);
        }
        
        this.saveQueue(); 
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
                badge.innerText = `📡 در انتظار اتصال... (${this.queue.length})`; 
                badge.style.background = "#c0392b"; 
            } else if (this.queue.length > 0 && navigator.onLine) {
                badge.style.display = 'block'; 
                badge.innerText = `🔄 در حال ارسال...`; 
                badge.style.background = "#e67e22";
            } else { 
                badge.style.display = 'none'; 
            }
        }
    },

    processQueue: function() {
        if(this.queue.length === 0 || !navigator.onLine) {
            this.updateOfflineBadge();
            return;
        }

        const item = this.queue[0];
        // آپدیت دیتا به آخرین لحظه قبل از ارسال
        item.jsonData = JSON.stringify(RankSystem.data); 
        
        fetch(REPORT_WEBAPP_URL, {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item)
        })
        .then(res => res.json())
        .then(data => {
            if(data.status === 'success') {
                this.queue.shift(); // حذف از صف
                this.saveQueue();
                // اگر باز هم چیزی در صف هست، سریع بعدی را بفرست
                if(this.queue.length > 0) setTimeout(() => this.processQueue(), 200);
            }
        })
        .catch(err => {
            console.log("Sync Error (Retrying later)", err);
            this.updateOfflineBadge();
        });
    }
};
