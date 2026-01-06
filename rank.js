// ********************************************
// 🎮 فایل هسته: rank.js (نسخه کامل و دقیق - بازبینی شده ✅)
// ********************************************

// 🔴 آدرس سرور 
const SERVER_URL = (typeof API_URL !== 'undefined') ? API_URL : "https://chamran-api.liara.run"; 

// 🎨 استایل‌های پاپ‌آپ و انیمیشن‌ها (تزریق به صفحه)
const xpPopupStyle = document.createElement('style');
xpPopupStyle.innerHTML = `
    .xp-popup-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); z-index: 20000;
        display: flex; justify-content: center; align-items: center;
        opacity: 0; transition: opacity 0.5s; backdrop-filter: blur(8px);
    }
    .xp-popup-content {
        text-align: center; color: white; transform: scale(0.5); 
        transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .xp-value {
        font-size: 4rem; font-weight: bold; margin: 0;
        background: linear-gradient(to bottom, #f1c40f, #e67e22);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        filter: drop-shadow(0 0 20px rgba(241, 196, 15, 0.8));
    }
    .xp-label { 
        font-size: 1.2rem; letter-spacing: 3px; margin-top: -5px; opacity: 0.9; font-family: sans-serif; text-transform: uppercase;
    }
    .xp-gem { 
        font-size: 2.5rem; margin-top: 15px; display: block; 
        text-shadow: 0 0 15px #9b59b6; animation: floatGem 2s infinite ease-in-out; 
    }
    @keyframes floatGem { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
`;
document.head.appendChild(xpPopupStyle);

const RankSystem = {
    // لیست مقام‌ها بر اساس XP (همان منطق قبلی)
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
            
            this.data = {
                xp: serverData.xp || 0,
                gem: serverData.gem || 0,
                rank: serverData.rank || "🐣 نوآموز",
                completed: serverData.completed || [],
                playback: serverData.playback || {},
                exams: serverData.exams || {},
                exam_details: serverData.exam_details || {}
            };
        }
        this.updateUI();
        this.saveToLocal(); // ذخیره نسخه تازه در مرورگر
        
        // اگر در صفحه اصلی باشیم، لیست درس‌ها را آپدیت کن (برای تیک سبز)
        setTimeout(() => { 
            if(typeof renderList === 'function') renderList(); 
        }, 500);
    },

    // ⭐️ تابع ذخیره آنی در حافظه مرورگر
    saveToLocal: function() {
        try {
            const key = 'chamran_db_vfinal_creds';
            const saved = localStorage.getItem(key);
            if (saved) {
                const creds = JSON.parse(saved);
                creds.jsonData = JSON.stringify(this.data); // آپدیت دیتای جیسون
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
                    wall.innerHTML = '<div style="color:rgba(255,255,255,0.9); font-size:0.9rem; padding:15px; width:100%; text-align:center;">هنوز کسی نمره کامل نگرفته!<br>تو اولین نفر باش 💪</div>';
                } else {
                    wall.innerHTML = '';
                    data.data.forEach((u) => {
                        const icons = ['🥇', '🎖️', '🌟', '👑', '💎']; 
                        const icon = icons[Math.floor(Math.random() * icons.length)];
                        
                        let displayName = u.n;
                        const parts = u.n.split(' ');
                        if(parts.length >= 2) displayName = `${parts[0]} ${parts[1]}`;

                        // ساخت کارت‌ها (دقیقاً همان کلاس‌هایی که در CSS ایندکس تعریف شده)
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
            wall.innerHTML = '<small style="color:rgba(255,255,255,0.7)">خطا در دریافت</small>';
        });
    },

    // 4. ذخیره موقعیت پخش فیلم (برای ادامه پخش)
    savePosition: function(id, time, forceSync = false) {
        const sId = id.toString();
        this.data.playback[sId] = Math.floor(time);
        this.saveToLocal(); // ذخیره محلی فوری
        
        // هر 15 ثانیه به سرور بفرست تا ترافیک زیاد نشود
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
    
    // ✨ پاپ‌آپ جدید و خیره‌کننده (Creative Popup)
    showRewardPopup: function(xp, gem) {
        const div = document.createElement('div');
        div.className = 'xp-popup-overlay';
        div.innerHTML = `
            <div class="xp-popup-content">
                <div class="xp-value">+${xp}</div>
                <div class="xp-label">XP GAINED</div>
                ${gem ? `<div class="xp-gem">+${gem} 💎</div>` : ''}
            </div>
        `;
        document.body.appendChild(div);
        
        // انیمیشن ورود
        requestAnimationFrame(() => {
            div.style.opacity = '1';
            div.querySelector('.xp-popup-content').style.transform = 'scale(1)';
        });

        // انیمیشن خروج
        setTimeout(() => {
            div.style.opacity = '0';
            div.querySelector('.xp-popup-content').style.transform = 'scale(1.5)';
            setTimeout(() => div.remove(), 500);
        }, 3000);
    },
    
    getDevice: function() { return /Mobile|Android/i.test(navigator.userAgent) ? "موبایل" : "کامپیوتر"; },
    
    toPersianNum: function(n) { 
        if(n === undefined || n === null) return "۰"; 
        return n.toString().replace(/\d/g, x => ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'][x]); 
    }
};

// ********************************************
// 📡 مدیر همگام‌سازی (Sync Manager) - با منطق صف
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
        
        // تلاش مجدد خودکار
        setInterval(() => this.processQueue(), 5000);
        window.addEventListener('online', () => this.processQueue());
        window.addEventListener('offline', () => this.updateOfflineBadge());
    },

    addToQueue: function(action, logData = null, forcePlayback = false) {
        let extraParams = {};
        if (action === 'claim_reward' && logData) {
            extraParams = { ...logData }; 
            
            // ⭐️ حیاتی: اگر آزمون تمام شده، همین الان در دیتای اصلی ثبت کن
            if(logData.reward_type === 'exam') {
                const sId = String(logData.reward_id);
                RankSystem.data.exams[sId] = logData.exam_score;
                // تاریخ شمسی تقریبی برای نمایش فوری
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
        
        if(item.action === 'sync') {
            item.jsonData = JSON.stringify(RankSystem.data); 
        }
        
        // ارسال به سرور با پارامتر زمان (ضد کش)
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
                    RankSystem.init(data.serverData); // سینک شدن با دیتای سرور
                    
                    // 🌟 نمایش پاپ‌آپ فقط اگر جایزه‌ای دریافت شده باشد
                    if (data.added && data.added > 0) {
                        if(!document.fullscreenElement) {
                             RankSystem.showRewardPopup(data.added, data.addedGem);
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

// 🌟 تابع جشن و پایکوبی (Confetti) - تقویت شده
function launchConfetti() {
    const c = document.getElementById('confetti-canvas');
    if(!c) return;
    c.style.display = 'block';
    const ctx = c.getContext('2d');
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    
    const pieces = [];
    for(let i=0; i<400; i++) { // تعداد ذرات بیشتر
        pieces.push({
            x: Math.random() * c.width,
            y: Math.random() * c.height - c.height,
            rotation: Math.random() * 360,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`,
            speed: Math.random() * 4 + 2,
            size: Math.random() * 6 + 2
        });
    }

    let animationId;
    function draw() {
        ctx.clearRect(0, 0, c.width, c.height);
        pieces.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            p.y += p.speed;
            p.rotation += 2;
            if(p.y > c.height) p.y = -10;
        });
        animationId = requestAnimationFrame(draw);
    }
    draw();
    setTimeout(() => {
        cancelAnimationFrame(animationId);
        c.style.display = 'none';
    }, 7000); // ⏱️ زمان جشن: 7 ثانیه
}
