// ********************************************
// 🎮 فایل هسته: rank.js (نسخه v8 - رفع باگ رنک و هماهنگی دقیق)
// ********************************************

const RankSystem = {
    ranks: [
        { min: 0, title: "🐣 نوآموز", color: "#7f8c8d" },
        { min: 500, title: "🛡️ محافظ", color: "#27ae60" },
        { min: 1500, title: "⚔️ جنگجو", color: "#2980b9" },
        { min: 3000, title: "👑 فرمانده", color: "#8e44ad" },
        { min: 5000, title: "💎 اسطوره", color: "#c0392b" }
    ],

    data: { xp: 0, rank: "🐣 نوآموز", completed: [], playback: {}, exams: {} },
    STORAGE_KEY: 'chamran_local_rank_v8', 

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

        // [اصلاح مهم برای مشکل رنک]
        // بلافاصله بعد از لود شدن، چک کن رنک با امتیاز میخونه یا نه
        this.checkRankUp(); 
        
        this.updateUI();
        setTimeout(() => this.refreshListUI(), 500);
    },

    savePosition: function(id, time, force = false) {
        const sId = id.toString();
        if(force || time > (this.data.playback[sId] || 0)) {
            this.data.playback[sId] = Math.floor(time);
            this.saveToDisk();
            
            if (force) {
                SyncManager.addToQueue('sync', null, true); 
            }
            else if(Math.floor(time) % 5 === 0) {
                 SyncManager.addToQueue('sync'); 
            }
        }
    },

    getLastPosition: function(id) { return this.data.playback[id.toString()] || 0; },

    addXP: function(amount, reason, uniqueId) {
        const sId = uniqueId.toString();
        if(uniqueId && this.data.completed.includes(sId)) return;
        this.data.xp += amount;
        if(uniqueId) { this.data.completed.push(sId); this.refreshListUI(); }
        
        this.checkRankUp(); // اینجا هم چک میکنیم
        this.updateUI(); 
        this.showToast(`⭐ +${amount} امتیاز: ${reason}`); 
        this.saveToDisk();
        
        SyncManager.addToQueue('report', { lesson: reason, status: 'کسب امتیاز / تکمیل', details: `مجموع XP: ${this.data.xp}`, device: this.getDevice() });
    },

    saveToDisk: function() { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data)); },

    // تابع محاسبه رنک
    checkRankUp: function() {
        let currentRankTitle = this.ranks[0].title;
        // پیدا کردن رنک درست بر اساس XP فعلی
        for (let i = this.ranks.length - 1; i >= 0; i--) {
            if (this.data.xp >= this.ranks[i].min) { currentRankTitle = this.ranks[i].title; break; }
        }
        
        // اگر رنک ذخیره شده با رنک واقعی فرق داشت، آپدیت کن
        if(this.data.rank !== currentRankTitle) {
            const oldRank = this.data.rank;
            this.data.rank = currentRankTitle;
            this.saveToDisk();
            
            // فقط اگر رنک ارتقا پیدا کرده بود تبریک بگو (نه موقع رفرش ساده)
            // شرط ساده: اگر مقدار قبلی وجود داشت و کمتر بود
            if(oldRank !== currentRankTitle) {
                 console.log("Rank updated silently or alerted.");
            }
        }
    },

    updateUI: function() {
        const xpEl = document.getElementById('user-xp');
        const rankEl = document.getElementById('user-rank');
        if(xpEl) xpEl.innerText = `${toPersianNum(this.data.xp)} XP`;
        if(rankEl) rankEl.innerText = this.data.rank;
    },

    refreshListUI: function() { if(typeof renderList === 'function') renderList(); },
    
    showToast: function(msg) {
        const t = document.createElement('div');
        t.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:#2c3e50; color:#f1c40f; padding:10px 20px; border-radius:30px; z-index:9000; box-shadow:0 5px 15px rgba(0,0,0,0.3); font-weight:bold; animation: fadeInOut 3s forwards;";
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
        this.queue = JSON.parse(localStorage.getItem('chamran_queue_v8') || "[]");
        this.processQueue();
        setInterval(() => this.syncProfile(), 10000);
    },

    addToQueue: function(action, logData = null, forcePlayback = false) {
        const item = {
            action: action, username: this.username, password: this.password,
            jsonData: JSON.stringify(RankSystem.data),
            logData: logData, timestamp: Date.now(),
            force_playback: forcePlayback 
        };
        
        if(action === 'sync' && !forcePlayback && this.queue.length > 0 && this.queue[this.queue.length-1].action === 'sync') {
             this.queue[this.queue.length-1] = item;
        } else {
             this.queue.push(item);
        }
        
        this.saveQueue(); this.processQueue();
    },

    saveQueue: function() {
        localStorage.setItem('chamran_queue_v8', JSON.stringify(this.queue));
        const badge = document.getElementById('offlineBadge');
        if(badge) {
            if(this.queue.length > 0) { badge.style.display = 'block'; badge.innerText = `📡 در حال ذخیره...`; badge.style.background = navigator.onLine ? "#27ae60" : "#c0392b"; } 
            else { badge.style.display = 'none'; }
        }
    },

    syncProfile: function() { this.addToQueue('sync'); },

    processQueue: function() {
        if(this.queue.length === 0 || !navigator.onLine) return;
        const item = this.queue[0];
        // آپدیت کردن دیتا با آخرین وضعیت قبل از ارسال
        item.jsonData = JSON.stringify(RankSystem.data); 
        
        if(typeof REPORT_WEBAPP_URL === 'undefined') return;

        // --- اصلاح شده برای سرور لیارا ---
        fetch(REPORT_WEBAPP_URL, {
            method: 'POST',
            headers: { "Content-Type": "application/json" }, // <--- هدر درست
            body: JSON.stringify(item)
        })
        .then(res => res.json()) // تبدیل پاسخ سرور به جیسون
        .then(data => {
            if(data.status === 'success') {
                // اگر سرور گفت "دریافت شد"، از صف پاک کن
                this.queue.shift(); 
                this.saveQueue();
                // اگر هنوز آیتمی در صف هست، بعدی را بفرست
                if(this.queue.length > 0) setTimeout(() => this.processQueue(), 500);
            }
        })
        .catch(err => console.log("Offline or Server Error", err));
    }
}; // <--- اینجا درست شد: براکت بسته و سمیکالن اضافه شد

function toPersianNum(n) { if(n === undefined || n === null) return "۰"; return n.toString().replace(/\d/g, x => ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'][x]); }
