// ********************************************
// 🎮 فایل کمکی: rank.js
// وظایف: مدیریت امتیاز، لول‌آپ و صف ارسال آفلاین
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
        completed: [], // لیست آیدی درس‌های تمام شده
        exams: {} 
    },

    // راه‌اندازی با دیتای سرور
    init: function(savedJson) {
        if(savedJson && savedJson !== "{}") {
            try {
                // اگر جیسون رشته بود، پارس کن
                const parsed = typeof savedJson === 'string' ? JSON.parse(savedJson) : savedJson;
                // ترکیب با دیتای موجود (برای جلوگیری از نال شدن)
                this.data = { ...this.data, ...parsed };
            } catch(e) { console.error("Data Parse Error", e); }
        }
        this.updateUI();
    },

    // اضافه کردن امتیاز
    addXP: function(amount, reason, uniqueId) {
        // جلوگیری از فارم کردن (اگر قبلاً دیده امتیاز نده)
        if(uniqueId && this.data.completed.includes(uniqueId)) return;

        this.data.xp += amount;
        if(uniqueId) this.data.completed.push(uniqueId);
        
        // چک کردن لول آپ
        this.checkRankUp();
        this.updateUI();
        
        // نمایش نوتیفیکیشن
        this.showToast(`⭐ +${amount} امتیاز: ${reason}`);
        
        // ذخیره فوری در صف ارسال
        SyncManager.addToQueue('report', {
            lesson: reason,
            status: 'کسب امتیاز',
            details: `مجموع XP: ${this.data.xp}`,
            device: this.getDevice()
        });
    },

    checkRankUp: function() {
        let currentRankTitle = this.ranks[0].title;
        
        // پیدا کردن رنک جدید بر اساس XP
        for (let i = this.ranks.length - 1; i >= 0; i--) {
            if (this.data.xp >= this.ranks[i].min) {
                currentRankTitle = this.ranks[i].title;
                break;
            }
        }

        // اگر لول تغییر کرد
        if(this.data.rank !== currentRankTitle) {
            const oldRank = this.data.rank;
            this.data.rank = currentRankTitle;
            alert(`🎉 تبریک!\nشما از "${oldRank}" به درجه "${currentRankTitle}" ارتقا یافتید!`);
        }
    },

    updateUI: function() {
        // آپدیت کردن ظاهر پنل کاربری در ایندکس
        const xpEl = document.getElementById('user-xp');
        const rankEl = document.getElementById('user-rank');
        if(xpEl) xpEl.innerText = `${this.data.xp} XP`;
        if(rankEl) rankEl.innerText = this.data.rank;
    },
    
    // نمایش پیام کوچک بالای صفحه
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
        // بازیابی صف از حافظه گوشی
        this.queue = JSON.parse(localStorage.getItem('chamran_queue_v2') || "[]");
        this.processQueue();
        
        // اتوسیو پروفایل هر 5 دقیقه
        setInterval(() => this.syncProfile(), 300000);
    },

    addToQueue: function(action, logData = null) {
        const item = {
            action: action,
            username: this.username,
            password: this.password,
            jsonData: JSON.stringify(RankSystem.data), // همیشه آخرین وضعیت پروفایل را بفرست
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
                badge.innerText = `📡 ${this.queue.length} گزارش در صف...`;
                badge.style.background = navigator.onLine ? "#f39c12" : "#c0392b";
            } else {
                badge.style.display = 'none';
            }
        }
    },

    syncProfile: function() {
        // فقط برای ذخیره وضعیت (بدون لاگ)
        this.addToQueue('sync');
    },

    processQueue: function() {
        if(this.queue.length === 0 || !navigator.onLine) return;

        const item = this.queue[0];
        
        // استفاده از آدرس تعریف شده در فایل ایندکس
        if(typeof REPORT_WEBAPP_URL === 'undefined') return console.error("URL تعریف نشده است");

        fetch(REPORT_WEBAPP_URL, {
            method: 'POST',
            mode: 'no-cors', // برای جلوگیری از ارور امنیتی گوگل
            body: JSON.stringify(item),
            headers: { 'Content-Type': 'text/plain' }
        })
        .then(() => {
            // فرض بر ارسال موفق
            this.queue.shift();
            this.saveQueue();
            // اگر باز هم چیزی در صف هست، سریع بعدی را بفرست
            if(this.queue.length > 0) setTimeout(() => this.processQueue(), 500);
        })
        .catch(err => console.log("Offline or Error", err));
    }
};
