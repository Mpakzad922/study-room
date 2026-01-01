// ********************************************
// 🎮 فایل کمکی: rank.js (نسخه نهایی هماهنگ با سرور)
// ********************************************

const RankSystem = {
    ranks: [
        { min: 0, title: "🐣 نوآموز", color: "#7f8c8d" },
        { min: 500, title: "🛡️ محافظ", color: "#27ae60" },
        { min: 1500, title: "⚔️ جنگجو", color: "#2980b9" },
        { min: 3000, title: "👑 فرمانده", color: "#8e44ad" },
        { min: 5000, title: "💎 اسطوره", color: "#c0392b" }
    ],

    // دیتای پیش‌فرض
    data: {
        xp: 0,
        rank: "🐣 نوآموز",
        completed: [], 
        exams: {} 
    },

    // کلید ذخیره‌سازی اختصاصی
    STORAGE_KEY: 'chamran_local_rank_v1',

    // 1. راه‌اندازی هوشمند (ادغام حافظه گوشی و سرور)
    init: function(serverJson) {
        // الف) اول تلاش کن از حافظه گوشی بخوانی
        const localData = localStorage.getItem(this.STORAGE_KEY);
        if (localData) {
            try {
                this.data = JSON.parse(localData);
            } catch (e) { console.error("Local Parse Error"); }
        }

        // ب) اگر سرور دیتایی فرستاده، چک کن کدام جدیدتر/بیشتر است
        if(serverJson && serverJson !== "{}") {
            try {
                const serverData = typeof serverJson === 'string' ? JSON.parse(serverJson) : serverJson;
                
                // قانون طلایی: هر کدام XP بیشتری داشت، برنده است
                if ((serverData.xp || 0) > this.data.xp) {
                    this.data = { ...this.data, ...serverData };
                    this.saveToDisk(); // آپدیت حافظه گوشی با دیتای سرور
                }
            } catch(e) { console.error("Server Parse Error", e); }
        }
        
        // ج) اعمال تغییرات در ظاهر
        this.updateUI();
        setTimeout(() => this.refreshListUI(), 500);
    },

    // 2. امتیازدهی با ذخیره فوری
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
        
        // ذخیره فوری
        this.saveToDisk();
        
        // ارسال به صف سرور
        SyncManager.addToQueue('report', {
            lesson: reason,
            status: 'کسب امتیاز',
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
            const oldRank = this.data.rank;
            this.data.rank = currentRankTitle;
            alert(`🎉 تبریک!\nشما از "${oldRank}" به درجه "${currentRankTitle}" ارتقا یافتید!`);
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
        if(typeof renderList === 'function') {
            renderList(); 
        }
    },
    
    showToast: function(msg) {
        const t = document.createElement('div');
        t.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:#2c3e50; color:#f1c40f; padding:10px 20px; border-radius:30px; z-index:9000; box-shadow:0 5px 15px rgba(0,0,0,0.3); font-weight:bold; animation: fadeInOut 3s forwards;";
        t.innerText = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 3000);
    },

    getDevice: function() {
        return /Mobile|Android/i.test(navigator.userAgent) ? "موبایل" : "کامپیوتر"; 
    }
};

// ********************************************
// 📡 مدیریت صف ارسال
// ********************************************
const SyncManager = {
    queue: [],
    username: null,
    password: null,

    init: function(user, pass) {
        this.username = user;
        this.password = pass;
        this.queue = JSON.parse(localStorage.getItem('chamran_queue_v2') || "[]");
        this.processQueue();
        setInterval(() => this.syncProfile(), 60000);
    },

    addToQueue: function(action, logData = null) {
        const item = {
            action: action,
            username: this.username,
            password: this.password,
            jsonData: JSON.stringify(RankSystem.data),
            logData: logData,
            timestamp: Date.now()
        };
        this.queue.push(item);
        this.saveQueue();
        this.processQueue();
    },

    saveQueue: function() {
        localStorage.setItem('chamran_queue_v2', JSON.stringify(this.queue));
        const badge = document.getElementById('offlineBadge');
        if(badge) {
            if(this.queue.length > 0) {
                badge.style.display = 'block';
                badge.innerText = `📡 ${toPersianNum(this.queue.length)} گزارش در صف...`;
                badge.style.background = navigator.onLine ? "#f39c12" : "#c0392b";
            } else {
                badge.style.display = 'none';
            }
        }
    },

    syncProfile: function() {
        this.addToQueue('sync');
    },

    processQueue: function() {
        if(this.queue.length === 0 || !navigator.onLine) return;
        const item = this.queue[0];
        // آپدیت لحظه‌ای
        item.jsonData = JSON.stringify(RankSystem.data);

        if(typeof REPORT_WEBAPP_URL === 'undefined') return;

        fetch(REPORT_WEBAPP_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(item),
            headers: { 'Content-Type': 'text/plain' }
        })
        .then(() => {
            this.queue.shift();
            this.saveQueue();
            if(this.queue.length > 0) setTimeout(() => this.processQueue(), 500);
        })
        .catch(err => console.log("Offline", err));
    }
};

function toPersianNum(n) { 
    if(n === undefined || n === null) return "۰";
    return n.toString().replace(/\d/g, x => ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'][x]); 
}
