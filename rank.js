// ********************************************
// 🎮 فایل هسته: rank.js (نسخه نهایی الماس 💎)
// ********************************************

// 🔴 آدرس سرور (اگر در فایل HTML تعریف نشده باشد، از این استفاده می‌کند)
const SERVER_URL = (typeof API_URL !== 'undefined') ? API_URL : "https://chamran-api.liara.run"; 

const RankSystem = {
    // لیست مقام‌ها بر اساس XP
    ranks: [
        { min: 0, title: "🐣 نوآموز" },
        { min: 500, title: "🛡️ محافظ" },
        { min: 1500, title: "⚔️ جنگجو" },
        { min: 3000, title: "👑 فرمانده" },
        { min: 5000, title: "💎 اسطوره" }
    ],

    // داده‌های پیش‌فرض کاربر
    data: { xp: 0, gem: 0, rank: "🐣 نوآموز", completed: [], playback: {}, exams: {} },
    notifications: [],
    
    // 1. مقداردهی اولیه با داده‌های سرور
    init: function(serverJson) {
        let serverData = {};
        if(serverJson && serverJson !== "{}") {
            try { 
                serverData = typeof serverJson === 'string' ? JSON.parse(serverJson) : serverJson; 
            } catch(e) { console.error("JSON Error", e); }
            
            this.data = {
                xp: serverData.xp || 0,
                gem: serverData.gem || 0, // دریافت الماس
                rank: serverData.rank || "🐣 نوآموز",
                completed: serverData.completed || [],
                playback: serverData.playback || {},
                exams: serverData.exams || {}
            };
        }
        this.updateUI();
        
        // اگر در صفحه اصلی باشیم، لیست درس‌ها را آپدیت کن (برای تیک سبز)
        setTimeout(() => { 
            if(typeof renderList === 'function') renderList(); 
        }, 500);
    },

    // 2. مدیریت اعلانات (Notifications)
    updateNotifications: function(notifList) {
        if (!notifList) return;
        this.notifications = notifList;
        
        // بررسی پیام‌های جدید (با مقایسه ID آخرین پیام دیده شده)
        const lastSeen = parseInt(localStorage.getItem('last_seen_notif') || 0);
        const hasNew = notifList.some(n => n.id > lastSeen);
        
        const dot = document.getElementById('notifDot');
        if(dot) dot.style.display = hasNew ? 'block' : 'none';
    },

    markNotifsAsRead: function() {
        if(this.notifications.length > 0) {
            const newestId = this.notifications[0].id;
            localStorage.setItem('last_seen_notif', newestId);
            const dot = document.getElementById('notifDot');
            if(dot) dot.style.display = 'none';
        }
    },

    // 3. دریافت و ساخت دیوار افتخار (نسخه روبان افقی)
    loadWallOfFame: function() {
        const wall = document.getElementById('wallContainer');
        const badge = document.getElementById('examNameBadge');
        if(!wall) return;
        
        // درخواست به سرور
        fetch(SERVER_URL, {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: 'get_wall_of_fame' })
        })
        .then(res => res.json())
        .then(data => {
            if(data.status === 'success') {
                // نمایش نام آخرین آزمون
                if(badge) badge.innerText = data.examTitle || "هنوز آزمونی نیست";

                if(data.data.length === 0) {
                    wall.innerHTML = '<div style="color:rgba(255,255,255,0.9); font-size:0.9rem; padding:15px; width:100%; text-align:center;">هنوز کسی در این آزمون نمره کامل نگرفته!<br>تو اولین نفر باش 💪</div>';
                } else {
                    wall.innerHTML = '';
                    // حلقه برای ساخت کارت‌ها
                    data.data.forEach((u) => {
                        // انتخاب تصادفی آیکون برای تنوع
                        const icons = ['🥇', '🎖️', '🌟', '👑', '💎']; 
                        const icon = icons[Math.floor(Math.random() * icons.length)];
                        
                        // کوتاه کردن اسم (فقط دو بخش اول)
                        let displayName = u.n;
                        const parts = u.n.split(' ');
                        if(parts.length >= 2) displayName = `${parts[0]} ${parts[1]}`;

                        // ساخت HTML کارت
                        wall.innerHTML += `
                            <div class="champion-card">
                                <div class="champ-icon">${icon}</div>
                                <div class="champ-name">${displayName}</div>
                                <div class="champ-score">نمره عالی</div>
                            </div>
                        `;
                    });
                }
            }
        })
        .catch(e => {
            console.error(e);
            wall.innerHTML = '<small style="color:rgba(255,255,255,0.7)">خطا در دریافت لیست</small>';
        });
    },

    // 4. ذخیره موقعیت پخش فیلم
    savePosition: function(id, time, forceSync = false) {
        const sId = id.toString();
        this.data.playback[sId] = Math.floor(time);
        
        // هر 15 ثانیه ذخیره کن
        if(Math.floor(time) % 15 === 0 || forceSync) {
             SyncManager.addToQueue('sync', null, forceSync); 
        }
    },

    getLastPosition: function(id) { 
        return this.data.playback[id.toString()] || 0; 
    },

    // 5. بروزرسانی ظاهر (XP و الماس)
    updateUI: function() {
        const xpEl = document.getElementById('user-xp');
        const gemEl = document.getElementById('user-gem');
        const rankEl = document.getElementById('user-rank');
        
        if(xpEl) xpEl.innerText = `${this.toPersianNum(this.data.xp)} XP`;
        if(gemEl) gemEl.innerText = this.toPersianNum(this.data.gem);
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
    isSyncing: false,

    init: function(user, pass) {
        this.username = user; 
        this.password = pass;
        // بازیابی صف قبلی اگر مانده باشد
        this.queue = JSON.parse(localStorage.getItem('chamran_queue_vfinal') || "[]");
        
        this.processQueue();
        
        // تلاش مجدد خودکار
        setInterval(() => this.processQueue(), 5000);
        window.addEventListener('online', () => this.processQueue());
        window.addEventListener('offline', () => this.updateOfflineBadge());
    },

    addToQueue: function(action, logData = null, forcePlayback = false) {
        let extraParams = {};
        // اگر پاداش است، پارامترهای اضافی (نمره، غلط‌ها) را هم بفرست
        if (action === 'claim_reward' && logData) {
            extraParams = { ...logData }; 
        }

        const item = {
            action: action, 
            username: this.username, 
            password: this.password,
            jsonData: JSON.stringify(RankSystem.data), // همیشه آخرین وضعیت دیتا
            logData: logData,
            timestamp: Date.now(),
            force_playback: forcePlayback,
            ...extraParams 
        };

        // جلوگیری از تکرار درخواست‌های sync معمولی در صف
        if(action === 'sync' && !forcePlayback && this.queue.length > 0) {
             const lastItem = this.queue[this.queue.length-1];
             if (lastItem.action === 'sync') {
                 this.queue[this.queue.length-1] = item; 
             } else {
                 this.queue.push(item);
             }
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
        const item = this.queue[0]; 
        
        // اطمینان از ارسال آخرین نسخه دیتا
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
                // موفقیت: حذف از صف
                this.queue.shift(); 
                this.saveQueue();
                
                // اگر سرور دیتای جدیدی فرستاد (مثلاً بعد از پاداش)
                if (data.serverData) {
                    RankSystem.init(data.serverData);
                    // آپدیت کردن کش لوکال
                    const creds = JSON.parse(localStorage.getItem('chamran_db_vfinal_creds') || "{}");
                    creds.jsonData = data.serverData;
                    localStorage.setItem('chamran_db_vfinal_creds', JSON.stringify(creds));
                    
                    // نمایش پیام پاداش (شامل الماس)
                    if (data.added && data.added > 0) {
                        const gemMsg = data.addedGem ? ` و ${data.addedGem} الماس 💎` : '';
                        alert(`🎉 تبریک! ${data.added} امتیاز${gemMsg} دریافت شد.`);
                    }
                }
                
                // دریافت اعلانات جدید
                if (data.notifications) {
                    RankSystem.updateNotifications(data.notifications);
                }

                this.isSyncing = false;
                // اگر باز هم موردی هست، ادامه بده
                if(this.queue.length > 0) setTimeout(() => this.processQueue(), 100);
            } else {
                // خطاهای سرور (مثل بن شدن)
                if(data.message && data.message.includes('مسدود')) {
                    alert("⛔ حساب شما مسدود شده است.");
                    this.queue = []; 
                    this.saveQueue();
                } else {
                    // خطای ناشناخته، رد می‌کنیم
                    this.queue.shift();
                    this.saveQueue();
                }
                this.isSyncing = false;
            }
        })
        .catch(err => {
            // خطای شبکه
            console.log("Network Error", err);
            this.isSyncing = false;
            this.updateOfflineBadge();
        });
    }
};

// تابع کمکی برای افکت کانفتی (جشن)
function launchConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if(!canvas) return;
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const pieces = [];
    for(let i=0; i<300; i++) {
        pieces.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            rotation: Math.random() * 360,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`,
            speed: Math.random() * 3 + 2
        });
    }

    let animationId;
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        pieces.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
            ctx.fill();
            p.y += p.speed;
            p.rotation += 2;
            if(p.y > canvas.height) p.y = -10;
        });
        animationId = requestAnimationFrame(draw);
    }
    draw();
    setTimeout(() => {
        cancelAnimationFrame(animationId);
        canvas.style.display = 'none';
    }, 4000);
}
