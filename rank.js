// ********************************************
// 🎮 فایل کمکی: rank.js (نسخه اصلاح شده - سینک کامل)
// وظایف: مدیریت امتیاز، لول‌آپ، صف ارسال و بازیابی وضعیت ظاهری
// ********************************************

const RankSystem = {
    // تنظیمات لول‌ها
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
        completed: [], // لیست آیدی درس‌های تمام شده (مهم برای تیک سبز)
        exams: {} 
    },

    // 1. راه‌اندازی با دیتای سرور (نقطه شروع اصلاح شده)
    init: function(savedJson) {
        if(savedJson && savedJson !== "{}") {
            try {
                // اگر جیسون رشته بود، پارس کن
                const parsed = typeof savedJson === 'string' ? JSON.parse(savedJson) : savedJson;
                
                // ادغام هوشمند: اگر دیتای لوکال جدیدتر بود، آن را نگه دار (برای آفلاین)
                // اما فعلا فرض می‌کنیم سرور پادشاه است
                this.data = { ...this.data, ...parsed };
                
                console.log("RankSystem initialized:", this.data);
            } catch(e) { console.error("Data Parse Error", e); }
        }
        
        // بلافاصله ظاهر را آپدیت کن
        this.updateUI();
        this.refreshListUI(); 
    },

    // 2. اضافه کردن امتیاز
    addXP: function(amount, reason, uniqueId) {
        // جلوگیری از فارم کردن (اگر قبلاً دیده امتیاز نده)
        // نکته: uniqueId باید حتما استرینگ باشد تا با دیتابیس مچ شود
        const sId = uniqueId.toString();
        if(uniqueId && this.data.completed.includes(sId)) return;

        this.data.xp += amount;
        if(uniqueId) {
            this.data.completed.push(sId);
            // همان لحظه تیک سبز را در لیست بزن
            this.refreshListUI();
        }
        
        this.checkRankUp();
        this.updateUI();
        this.showToast(`⭐ +${amount} امتیاز: ${reason}`);
        
        // ذخیره در صف سرور
        SyncManager.addToQueue('report', {
            lesson: reason,
            status: 'کسب امتیاز',
            details: `مجموع XP: ${this.data.xp}`,
            device: this.getDevice()
        });
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
        }
    },

    updateUI: function() {
        // آپدیت پنل بالا
        const xpEl = document.getElementById('user-xp');
        const rankEl = document.getElementById('user-rank');
        if(xpEl) xpEl.innerText = `${toPersianNum(this.data.xp)} XP`; // تبدیل به فارسی
        if(rankEl) rankEl.innerText = this.data.rank;
    },

    // 3. تابع جدید: روشن کردن تیک‌های سبز در لیست درس‌ها
    refreshListUI: function() {
        // اگر تابع رندر لیست در دسترس بود، دوباره صداش بزن تا با دیتای جدید (completed) لیست را بسازد
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
// 📡 مدیریت صف ارسال (SyncManager)
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
        
        // اتوسیو پروفایل هر 2 دقیقه (برای اطمینان بیشتر)
        setInterval(() => this.syncProfile(), 120000);
    },

    addToQueue: function(action, logData = null) {
        // همیشه قبل از ارسال، آخرین وضعیت رنک را در جیسون قرار بده
        const item = {
            action: action,
            username: this.username,
            password: this.password,
            jsonData: JSON.stringify(RankSystem.data), // کلیدی‌ترین بخش: ارسال دیتای کامل رنک
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
        // این دستور فقط پروفایل را در سرور آپدیت می‌کند بدون نوشتن گزارش اضافه
        this.addToQueue('sync');
    },

    processQueue: function() {
        if(this.queue.length === 0 || !navigator.onLine) return;

        const item = this.queue[0];
        // آپدیت کردن جیسون آیتم داخل صف با آخرین وضعیت (چون شاید از لحظه ساخت آیتم تا الان، کاربر XP بیشتری گرفته باشد)
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

// تابع کمکی برای تبدیل اعداد (چون در rank.js هم استفاده شده)
function toPersianNum(n) { 
    if(n === undefined || n === null) return "۰";
    return n.toString().replace(/\d/g, x => ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'][x]); 
}
