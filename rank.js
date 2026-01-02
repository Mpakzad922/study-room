// ********************************************
// 🎮 فایل هسته: rank.js (نسخه نهایی - سینک سریع ۵ ثانیه)
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

    STORAGE_KEY: 'chamran_local_rank_v3', // تغییر ورژن به v3 برای اطمینان از پاک شدن کش قدیمی

    // 1. شروع سیستم: اولویت با سرور است (برای حل مشکل سینک و بازنشانی)
    init: function(serverJson) {
        let serverData = {};
        
        // تلاش برای خواندن دیتای سرور
        if(serverJson && serverJson !== "{}") {
            try {
                serverData = typeof serverJson === 'string' ? JSON.parse(serverJson) : serverJson;
            } catch(e) { console.error("Server JSON Error", e); }
        }

        // اگر دیتای سرور معتبر بود، آن را جایگزین دیتای لوکال کن (سینک اجباری)
        if (serverData && (serverData.xp !== undefined || serverData.exams)) {
            this.data = {
                xp: serverData.xp || 0,
                rank: serverData.rank || "🐣 نوآموز",
                completed: serverData.completed || [],
                playback: serverData.playback || {},
                exams: serverData.exams || {}
            };
            this.saveToDisk(); // ذخیره در گوشی جدید
        } else {
            // اگر سرور خالی بود (کاربر جدید)، از لوکال بخوان
            const localData = localStorage.getItem(this.STORAGE_KEY);
            if (localData) {
                try { this.data = JSON.parse(localData); } catch (e) {}
            }
        }

        this.updateUI();
        setTimeout(() => this.refreshListUI(), 500);
    },

    // 2. ذخیره پوزیشن فیلم (با ارسال سریعتر به سرور)
    savePosition: function(id, time) {
        const sId = id.toString();
        // فقط اگر زمان جلوتر رفته ذخیره کن
        if(time > (this.data.playback[sId] || 0)) {
            this.data.playback[sId] = Math.floor(time);
            this.saveToDisk();
            
            // [تغییر اصلی اینجاست] کاهش زمان سینک از 60 به 5 ثانیه برای دقت بالا
            // قبلاً: if(Math.floor(time) % 60 === 0)
            if(Math.floor(time) % 5 === 0) {
                 SyncManager.addToQueue('sync'); 
            }
        }
    },

    getLastPosition: function(id) {
        return this.data.playback[id.toString()] || 0;
    },

    // 3. افزودن امتیاز و تکمیل (سینک فوری)
    addXP: function(amount, reason, uniqueId) {
        const sId = uniqueId.toString();
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
        
        // ارسال فوری تغییرات مهم به سرور
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
// 📡 مدیریت صف ارسال (با قابلیت اطمینان بالا)
// ********************************************
const SyncManager = {
    queue: [],
    username: null,
    password: null,

    init: function(user, pass) {
        this.username = user;
        this.password = pass;
        this.queue = JSON.parse(localStorage.getItem('chamran_queue_v3') || "[]");
        this.processQueue();
        // سینک دوره‌ای هر 30 ثانیه برای اطمینان از ذخیره شدن فیلم
        setInterval(() => this.syncProfile(), 30000);
    },

    addToQueue: function(action, logData = null) {
        // همیشه آخرین نسخه دیتا را بفرست
        const item = {
            action: action,
            username: this.username,
            password: this.password,
            jsonData: JSON.stringify(RankSystem.data), // ارسال آخرین وضعیت
            logData: logData,
            timestamp: Date.now()
        };
        
        // جلوگیری از تکرار درخواست‌های sync پشت سر هم
        if(action === 'sync' && this.queue.length > 0 && this.queue[this.queue.length-1].action === 'sync') {
             this.queue[this.queue.length-1] = item; // آپدیت قبلی
        } else {
             this.queue.push(item);
        }
        
        this.saveQueue();
        this.processQueue();
    },

    saveQueue: function() {
        localStorage.setItem('chamran_queue_v3', JSON.stringify(this.queue));
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

    syncProfile: function() { this.addToQueue('sync'); },

    processQueue: function() {
        if(this.queue.length === 0 || !navigator.onLine) return;
        const item = this.queue[0];
        
        // آپدیت لحظه‌ای دیتا قبل از ارسال
        item.jsonData = JSON.stringify(RankSystem.data); 

        if(typeof REPORT_WEBAPP_URL === 'undefined') return;

        fetch(REPORT_WEBAPP_URL, {
            method: 'POST',
            mode: 'no-cors', // برای سرعت بیشتر
            body: JSON.stringify(item),
            headers: { 'Content-Type': 'text/plain' }
        })
        .then(() => {
            this.queue.shift();
            this.saveQueue();
            if(this.queue.length > 0) setTimeout(() => this.processQueue(), 1000);
        })
        .catch(err => console.log("Offline", err));
    }
};

function toPersianNum(n) { 
    if(n === undefined || n === null) return "۰";
    return n.toString().replace(/\d/g, x => ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'][x]); 
}
