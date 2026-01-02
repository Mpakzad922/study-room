// ********************************************
// 🎮 فایل هسته: rank.js (نسخه نهایی لیارا)
// ********************************************

// آدرس سرور لیارا (اینجا تعریف می‌کنیم تا در همه صفحات یکسان باشد)
const REPORT_WEBAPP_URL = "https://chamran-api.liara.run";

const RankSystem = {
    ranks: [
        { min: 0, title: "🐣 نوآموز", color: "#7f8c8d" },
        { min: 500, title: "🛡️ محافظ", color: "#27ae60" },
        { min: 1500, title: "⚔️ جنگجو", color: "#2980b9" },
        { min: 3000, title: "👑 فرمانده", color: "#8e44ad" },
        { min: 5000, title: "💎 اسطوره", color: "#c0392b" }
    ],

    data: { xp: 0, rank: "🐣 نوآموز", completed: [], playback: {}, exams: {} },
    STORAGE_KEY: 'chamran_local_rank_vfinal', 

    init: function(serverJson) {
        let serverData = {};
        if(serverJson && serverJson !== "{}") {
            try { serverData = typeof serverJson === 'string' ? JSON.parse(serverJson) : serverJson; } 
            catch(e) { console.error("Server JSON Error", e); }
        }
        
        // اگر سرور دیتا داشت، جایگزین کن
        if (serverData && (serverData.xp !== undefined || serverData.exams)) {
            this.data = {
                xp: serverData.xp || 0,
                rank: serverData.rank || "🐣 نوآموز",
                completed: serverData.completed || [],
                playback: serverData.playback || {},
                exams: serverData.exams || {}
            };
            this.saveToDisk();
        } else {
            const localData = localStorage.getItem(this.STORAGE_KEY);
            if (localData) { try { this.data = JSON.parse(localData); } catch (e) {} }
        }

        this.checkRankUp(); 
        this.updateUI();
        // تلاش برای بروزرسانی لیست اگر تابعش وجود داشته باشد
        setTimeout(() => {
            if(typeof renderList === 'function') renderList();
        }, 500);
    },

    savePosition: function(id, time, force = false) {
        const sId = id.toString();
        // فقط اگر زمان جلوتر رفته بود ذخیره کن (مگر اینکه فورس/جریمه باشد)
        if(force || time > (this.data.playback[sId] || 0)) {
            this.data.playback[sId] = Math.floor(time);
            this.saveToDisk();
            
            if (force) {
                // ارسال فوری (برای جریمه)
                SyncManager.addToQueue('sync', null, true); 
            }
            else if(Math.floor(time) % 10 === 0) {
                // ارسال هر 10 ثانیه یکبار برای کاهش ترافیک سرور
                 SyncManager.addToQueue('sync'); 
            }
        }
    },

    getLastPosition: function(id) { return this.data.playback[id.toString()] || 0; },

    addXP: function(amount, reason, uniqueId) {
        const sId = uniqueId.toString();
        if(uniqueId && this.data.completed.includes(sId)) return;
        
        this.data.xp += amount;
        if(uniqueId) { this.data.completed.push(sId); }
        
        this.checkRankUp();
        this.updateUI(); 
        this.showToast(`⭐ +${amount} امتیاز: ${reason}`); 
        this.saveToDisk();
        
        if(typeof renderList === 'function') renderList(); // بروزرسانی تیک سبز
        
        SyncManager.addToQueue('report', { 
            lesson: reason, 
            status: 'کسب امتیاز / تکمیل', 
            details: `مجموع XP: ${this.data.xp}`, 
            device: this.getDevice() 
        });
    },

    saveToDisk: function() { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data)); },

    checkRankUp: function() {
        let currentRankTitle = this.ranks[0].title;
        for (let i = this.ranks.length - 1; i >= 0; i--) {
            if (this.data.xp >= this.ranks[i].min) { currentRankTitle = this.ranks[i].title; break; }
        }
        
        if(this.data.rank !== currentRankTitle) {
            this.data.rank = currentRankTitle;
            this.saveToDisk();
        }
    },

    updateUI: function() {
        const xpEl = document.getElementById('user-xp');
        const rankEl = document.getElementById('user-rank');
        if(xpEl) xpEl.innerText = `${toPersianNum(this.data.xp)} XP`;
        if(rankEl) rankEl.innerText = this.data.rank;
    },
    
    showToast: function(msg) {
        const t = document.createElement('div');
        t.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:#2c3e50; color:#f1c40f; padding:10px 20px; border-radius:30px; z-index:9000; box-shadow:0 5px 15px rgba(0,0,0,0.3); font-weight:bold; animation: fadeInOut 3s forwards; font-family:'Vazirmatn'; font-size:0.9rem;";
        t.innerText = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 3000);
    },

    getDevice: function() { return /Mobile|Android/i.test(navigator.userAgent) ? "موبایل" : "کامپیوتر"; }
};

const SyncManager = {
    queue: [], username: null, password: null,

    init: function(user, pass) {
        this.username = user; this.password = pass;
        this.queue = JSON.parse(localStorage.getItem('chamran_queue_vfinal') || "[]");
        this.processQueue();
        // هر 15 ثانیه تلاش برای سینک
        setInterval(() => this.processQueue(), 15000);
    },

    addToQueue: function(action, logData = null, forcePlayback = false) {
        const item = {
            action: action, 
            username: this.username, 
            password: this.password,
            jsonData: JSON.stringify(RankSystem.data),
            logData: logData, 
            timestamp: Date.now(),
            force_playback: forcePlayback 
        };
        
        // جلوگیری از تکرار زیاد درخواست‌های sync پشت سر هم
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
        const badge = document.getElementById('offlineBadge');
        if(badge) {
            if(this.queue.length > 0) { 
                badge.style.display = 'block'; 
                badge.innerText = `📡 در حال ذخیره (${toPersianNum(this.queue.length)})...`; 
                badge.style.background = navigator.onLine ? "#e67e22" : "#c0392b"; 
            } 
            else { badge.style.display = 'none'; }
        }
    },

    processQueue: function() {
        if(this.queue.length === 0 || !navigator.onLine) return;
        
        const item = this.queue[0];
        // همیشه آخرین وضعیت دیتا را بفرست
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
                // اگر هنوز چیزی در صف هست، با سرعت بیشتر بفرست
                if(this.queue.length > 0) setTimeout(() => this.processQueue(), 200);
            }
        })
        .catch(err => console.log("Sync Error (Offline):", err));
    }
};

// تابع کمکی تبدیل اعداد
function toPersianNum(n) { 
    if(n === undefined || n === null) return "۰"; 
    return n.toString().replace(/\d/g, x => ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'][x]); 
}
