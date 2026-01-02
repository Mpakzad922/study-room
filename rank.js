// ********************************************
// 🎮 فایل هسته: rank.js (نسخه نهایی v5 - هماهنگ با سیستم Deep Merge)
// ********************************************

const RankSystem = {
    ranks: [
        { min: 0, title: "🐣 نوآموز", color: "#7f8c8d" },
        { min: 500, title: "🛡️ محافظ", color: "#27ae60" },
        { min: 1500, title: "⚔️ جنگجو", color: "#2980b9" },
        { min: 3000, title: "👑 فرمانده", color: "#8e44ad" },
        { min: 5000, title: "💎 اسطوره", color: "#c0392b" }
    ],

    data: {
        xp: 0,
        rank: "🐣 نوآموز",
        completed: [], 
        playback: {}, 
        exams: {} 
    },

    // تغییر ورژن به v5 برای اینکه کش‌های قدیمی و باگ‌دار پاک شوند
    STORAGE_KEY: 'chamran_local_rank_v5', 

    // 1. شروع سیستم: دیکتاتوری سرور! (Server Authority)
    // چون سرور الان منطق Merge دارد، دیتای سرور همیشه کامل‌تر و درست‌تر از گوشی است.
    init: function(serverJson) {
        let serverData = {};
        
        // تلاش برای پارس کردن دیتای سرور
        if(serverJson && serverJson !== "{}") {
            try {
                serverData = typeof serverJson === 'string' ? JSON.parse(serverJson) : serverJson;
            } catch(e) { console.error("Server JSON Error", e); }
        }

        // اگر سرور دیتای معتبری داشت، حتماً همان را استفاده کن و روی گوشی ذخیره کن
        if (serverData && (serverData.xp !== undefined || serverData.exams || serverData.completed)) {
            console.log("📥 دریافت دیتای هوشمند از سرور");
            this.data = {
                xp: serverData.xp || 0,
                rank: serverData.rank || "🐣 نوآموز",
                completed: serverData.completed || [],
                playback: serverData.playback || {}, 
                exams: serverData.exams || {}
            };
            this.saveToDisk(); // دیتای تمیز سرور را در لوکال ذخیره کن
        } else {
            // فقط اگر کاربر جدید بود (سرور خالی)، از حافظه لوکال استفاده کن
            const localData = localStorage.getItem(this.STORAGE_KEY);
            if (localData) {
                try { this.data = JSON.parse(localData); } catch (e) {}
            }
        }

        this.updateUI();
        // رفرش کردن لیست برای اعمال تیک‌های سبز
        setTimeout(() => this.refreshListUI(), 500);
    },

    // 2. ذخیره پوزیشن فیلم (ارسال پینگ هر 5 ثانیه)
    savePosition: function(id, time) {
        const sId = id.toString();
        
        // ذخیره در رم (فقط اگر زمان جلوتر رفته باشد)
        if(time > (this.data.playback[sId] || 0)) {
            this.data.playback[sId] = Math.floor(time);
            this.saveToDisk();
            
            // [حیاتی] هر 5 ثانیه وضعیت را به سرور بفرست
            // چون سرور منطق Max دارد، ارسال زیاد مشکلی ایجاد نمی‌کند و دقت را بالا می‌برد
            if(Math.floor(time) % 5 === 0) {
                 SyncManager.addToQueue('sync'); 
            }
        }
    },

    getLastPosition: function(id) {
        return this.data.playback[id.toString()] || 0;
    },

    // 3. سیستم امتیازدهی
    addXP: function(amount, reason, uniqueId) {
        const sId = uniqueId.toString();
        // جلوگیری از امتیاز تکراری
        if(uniqueId && this.data.completed.includes(sId)) return;

        this.data.xp += amount;
        if(uniqueId) {
            this.data.completed.push(sId);
            this.refreshListUI(); 
        }
        
        this.checkRankUp();
        this.updateUI();
        this.showToast(`⭐ +${amount} امتیاز: ${reason}`);
        this.saveToDisk();
        
        // تغییرات مهم مثل امتیاز و تیک سبز را "فوری" گزارش بده
        SyncManager.addToQueue('report', {
            lesson: reason,
            status: 'کسب امتیاز / تکمیل',
            details: `مجموع XP: ${this.data.xp}`,
            device: this.getDevice()
        });
    },

    saveToDisk: function() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
    },

    checkRankUp: function() {
        let currentRankTitle = this.ranks[0].title;
        for (let i = this.ranks.length - 1; i >= 0; i--) {
            if (this.data.xp >= this.ranks[i].min) {
                currentRankTitle = this.ranks[i].title;
                break;
            }
        }
        if(this.data.rank !== currentRankTitle) {
            this.data.rank = currentRankTitle;
            alert(`🎉 تبریک!\nشما به درجه "${currentRankTitle}" ارتقا یافتید!`);
            this.saveToDisk();
        }
    },

    updateUI: function() {
        const xpEl = document.getElementById('user-xp');
        const rankEl = document.getElementById('user-rank');
        if(xpEl) xpEl.innerText = `${toPersianNum(this.data.xp)} XP`;
        if(rankEl) rankEl.innerText = this.data.rank;
    },

    refreshListUI: function() {
        if(typeof renderList === 'function') renderList(); 
    },
    
    showToast: function(msg) {
        const t = document.createElement('div');
        t.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:#2c3e50; color:#f1c40f; padding:10px 20px; border-radius:30px; z-index:9000; box-shadow:0 5px 15px rgba(0,0,0,0.3); font-weight:bold; animation: fadeInOut 3s forwards;";
        t.innerText = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 3000);
    },

    getDevice: function() { return /Mobile|Android/i.test(navigator.userAgent) ? "موبایل" : "کامپیوتر"; }
};

// ********************************************
// 📡 مدیریت صف ارسال (Sync Manager)
// ********************************************
const SyncManager = {
    queue: [],
    username: null,
    password: null,

    init: function(user, pass) {
        this.username = user;
        this.password = pass;
        this.queue = JSON.parse(localStorage.getItem('chamran_queue_v5') || "[]");
        this.processQueue();
        
        // یک تایمر پشتیبان هم میگذاریم که هر 15 ثانیه صف را چک کند
        setInterval(() => this.processQueue(), 15000);
    },

    addToQueue: function(action, logData = null) {
        const item = {
            action: action,
            username: this.username,
            password: this.password,
            jsonData: JSON.stringify(RankSystem.data), // همیشه جدیدترین نسخه دیتا را بردار
            logData: logData,
            timestamp: Date.now()
        };
        
        // بهینه‌سازی: اگر درخواست قبلی هم sync بود، آن را آپدیت کن تا صف شلوغ نشود
        if(action === 'sync' && this.queue.length > 0 && this.queue[this.queue.length-1].action === 'sync') {
             this.queue[this.queue.length-1] = item;
        } else {
             this.queue.push(item);
        }
        
        this.saveQueue();
        this.processQueue(); // تلاش برای ارسال فوری
    },

    saveQueue: function() {
        localStorage.setItem('chamran_queue_v5', JSON.stringify(this.queue));
        const badge = document.getElementById('offlineBadge');
        if(badge) {
            if(this.queue.length > 0) {
                badge.style.display = 'block';
                badge.innerText = `📡 در حال ذخیره...`;
                badge.style.background = navigator.onLine ? "#27ae60" : "#c0392b";
            } else {
                badge.style.display = 'none';
            }
        }
    },

    processQueue: function() {
        if(this.queue.length === 0 || !navigator.onLine) return;
        
        // آیتم اول صف را بردار (اما هنوز حذف نکن)
        const item = this.queue[0];
        
        // قبل از ارسال، مطمئن شو آخرین نسخه دیتا را داری
        // (مخصوصاً برای وقتی که اینترنت قطع بوده و کاربر بازی کرده)
        item.jsonData = JSON.stringify(RankSystem.data); 

        if(typeof REPORT_WEBAPP_URL === 'undefined') return;

        fetch(REPORT_WEBAPP_URL, {
            method: 'POST',
            mode: 'no-cors', // حالت no-cors برای سرعت بیشتر و جلوگیری از خطای CORS
            body: JSON.stringify(item),
            headers: { 'Content-Type': 'text/plain' }
        })
        .then(() => {
            // اگر موفق بود، حالا از صف حذف کن
            this.queue.shift();
            this.saveQueue();
            
            // اگر هنوز چیزی در صف هست، بعدی را بفرست
            if(this.queue.length > 0) setTimeout(() => this.processQueue(), 500);
        })
        .catch(err => {
            console.log("Sync Error (Offline?)", err);
            // اگر خطا داد، حذف نکن تا بعداً دوباره تلاش کند
        });
    }
};

function toPersianNum(n) { 
    if(n === undefined || n === null) return "۰";
    return n.toString().replace(/\d/g, x => ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'][x]); 
}
