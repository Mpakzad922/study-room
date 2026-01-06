// ********************************************
// 🎮 فایل هسته: rank.js (نسخه جراحی شده و پایدار 🏥)
// ********************************************

// 🔴 آدرس سرور 
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
    data: { xp: 0, gem: 0, rank: "🐣 نوآموز", completed: [], playback: {}, exams: {}, exam_details: {} },
    notifications: [],
    
    // 1. مقداردهی اولیه با داده‌های سرور
    init: function(serverJson) {
        let serverData = {};
        if(serverJson && serverJson !== "{}") {
            try { 
                serverData = typeof serverJson === 'string' ? JSON.parse(serverJson) : serverJson; 
            } catch(e) { console.error("JSON Error", e); }
            
            // ادغام هوشمند: اگر دیتای لوکال جدیدتر بود (مثلا همین الان آزمون داده)، آن را نگه دار
            // اما فعلاً برای جلوگیری از تضاد، سرور را مرجع قرار می‌دهیم و فقط در لحظه آزمون لوکال را آپدیت می‌کنیم.
            this.data = {
                xp: serverData.xp || 0,
                gem: serverData.gem || 0,
                rank: serverData.rank || "🐣 نوآموز",
                completed: serverData.completed || [],
                playback: serverData.playback || {},
                exams: serverData.exams || {},
                exam_details: serverData.exam_details || {} // ⭐️ حیاتی برای مرور آزمون
            };
        }
        this.updateUI();
        this.saveToLocal(); // ⭐️ ذخیره نسخه تازه در مرورگر
        
        // اگر در صفحه اصلی باشیم، لیست درس‌ها را آپدیت کن
        setTimeout(() => { 
            if(typeof renderList === 'function') renderList(); 
        }, 500);
    },

    // ⭐️ تابع جدید: ذخیره آنی در حافظه مرورگر (برای رفع مشکل پریدن اطلاعات)
    saveToLocal: function() {
        try {
            const key = 'chamran_db_vfinal_creds';
            const saved = localStorage.getItem(key);
            if (saved) {
                const creds = JSON.parse(saved);
                creds.jsonData = JSON.stringify(this.data); // آپدیت دیتای جیسون درون کردینال
                localStorage.setItem(key, JSON.stringify(creds));
            }
        } catch(e) { console.error("Save Local Error", e); }
    },

    // 2. مدیریت اعلانات
    updateNotifications: function(notifList) {
        if (!notifList) return;
        this.notifications = notifList;
        
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

    // 3. دریافت و ساخت دیوار افتخار
    loadWallOfFame: function() {
        const wall = document.getElementById('wallContainer');
        const badge = document.getElementById('examNameBadge');
        if(!wall) return;
        
        // اضافه کردن پارامتر زمان برای جلوگیری از کش (?t=...)
        fetch(`${SERVER_URL}?t=${Date.now()}`, {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: 'get_wall_of_fame' })
        })
        .then(res => res.json())
        .then(data => {
            if(data.status === 'success') {
                if(badge) badge.innerText = data.examTitle || "هنوز آزمونی نیست";

                if(data.data.length === 0) {
                    wall.innerHTML = '<div style="color:rgba(255,255,255,0.9); font-size:0.9rem; padding:15px; width:100%; text-align:center;">هنوز کسی در این آزمون نمره کامل نگرفته!<br>تو اولین نفر باش 💪</div>';
                } else {
                    wall.innerHTML = '';
                    data.data.forEach((u) => {
                        const icons = ['🥇', '🎖️', '🌟', '👑', '💎']; 
                        const icon = icons[Math.floor(Math.random() * icons.length)];
                        
                        let displayName = u.n;
                        const parts = u.n.split(' ');
                        if(parts.length >= 2) displayName = `${parts[0]} ${parts[1]}`;

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
        this.saveToLocal(); // ذخیره محلی فوری
        
        if(Math.floor(time) % 15 === 0 || forceSync) {
             SyncManager.addToQueue('sync', null, forceSync); 
        }
    },

    getLastPosition: function(id) { 
        return this.data.playback[id.toString()] || 0; 
    },

    // 5. بروزرسانی ظاهر
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
// 📡 مدیر همگام‌سازی (Sync Manager) - تقویت شده
// ********************************************
const SyncManager = {
    queue: [], 
    username: null, 
    password: null,
    isSyncing: false,

    init: function(user, pass) {
        this.username = user; 
        this.password = pass;
        this.queue = JSON.parse(localStorage.getItem('chamran_queue_vfinal') || "[]");
        this.processQueue();
        
        setInterval(() => this.processQueue(), 5000);
        window.addEventListener('online', () => this.processQueue());
        window.addEventListener('offline', () => this.updateOfflineBadge());
    },

    addToQueue: function(action, logData = null, forcePlayback = false) {
        let extraParams = {};
        if (action === 'claim_reward' && logData) {
            extraParams = { ...logData }; 
            
            // ⭐️ حیاتی: اگر آزمون تمام شده، همین الان در دیتای اصلی ثبت کن
            // تا قبل از ارسال به سرور هم قابل دسترسی باشد
            if(logData.reward_type === 'exam') {
                const sId = String(logData.reward_id);
                RankSystem.data.exams[sId] = logData.exam_score;
                RankSystem.data.exam_details[sId] = {
                    score: logData.exam_score,
                    wrong: logData.wrong_list,
                    answers: logData.user_answers,
                    date: new Date().toLocaleDateString('fa-IR')
                };
                RankSystem.saveToLocal(); // ذخیره نهایی در مرورگر
            }
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
        
        if(item.action === 'sync') {
            item.jsonData = JSON.stringify(RankSystem.data); 
        }
        
        // ⭐️ اضافه کردن پارامتر زمان برای جلوگیری از کش شدن پاسخ
        fetch(`${SERVER_URL}?t=${Date.now()}`, {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item)
        })
        .then(res => res.json())
        .then(data => {
            if(data.status === 'success') {
                this.queue.shift(); 
                this.saveQueue();
                
                if (data.serverData) {
                    RankSystem.init(data.serverData); // این تابع خودش saveToLocal دارد
                    
                    if (data.added && data.added > 0) {
                        const gemMsg = data.addedGem ? ` و ${data.addedGem} الماس 💎` : '';
                        // فقط اگر کاربر درگیر کار دیگری نیست پیام بده
                        if(!document.fullscreenElement) {
                             alert(`🎉 تبریک! ${data.added} امتیاز${gemMsg} دریافت شد.`);
                        }
                    }
                }
                
                if (data.notifications) {
                    RankSystem.updateNotifications(data.notifications);
                }

                this.isSyncing = false;
                if(this.queue.length > 0) setTimeout(() => this.processQueue(), 100);
            } else {
                if(data.message && data.message.includes('مسدود')) {
                    alert("⛔ حساب شما مسدود شده است.");
                    this.queue = []; 
                    this.saveQueue();
                } else {
                    this.queue.shift();
                    this.saveQueue();
                }
                this.isSyncing = false;
            }
        })
        .catch(err => {
            console.log("Network Error", err);
            this.isSyncing = false;
            this.updateOfflineBadge();
        });
    }
};

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
