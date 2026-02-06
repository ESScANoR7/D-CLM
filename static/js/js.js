// ==========================================
// 1. 🏗️ ЯДРО ТА ІНІЦІАЛІЗАЦІЯ (CORE)
// ==========================================

window.currentEditId = null; 
let mightChartInstance = null;

// Головна ініціалізація
document.addEventListener('DOMContentLoaded', () => {
    console.log("Система: Запуск ядра...");

    // 1. Автозавантаження вкладок залежно від ролі
    const nameSpan = document.getElementById('player-name');
    if (nameSpan) {
        const isGuest = nameSpan.innerText.includes("(Гість)");
        loadTab(isGuest ? 'guest_home' : 'home');
    }

    // 2. Глобальний обробник усіх форм (Делегування подій)
    // Це дозволяє обробляти форми реєстрації Гравця і Гостя однаково
    document.addEventListener('submit', async (e) => {
        const form = e.target;

        // Перевіряємо, чи це наші форми авторизації
        if (form.id === 'guestAuthForm' || form.id === 'mainAuthForm') {
            e.preventDefault();
            console.log("Обробка форми:", form.id);

            // Визначаємо блок для виводу помилок
            const errorBoxId = (form.id === 'guestAuthForm') ? 'guest-auth-error' : 'player-auth-error';
            const errorBox = document.getElementById(errorBoxId);
            if (errorBox) errorBox.style.display = 'none';

            try {
                const formData = new FormData(form);
                const response = await fetch(form.action, {
                    method: 'POST',
                    body: formData,
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });

                const data = await response.json();

                if (response.ok) {
                    // Виконуємо редірект на dashboard (повертається з Python)
                    if (data.redirect) window.location.href = data.redirect;
                    else window.location.href = '/dashboard';
                } else {
                    // Показуємо помилку (невірний пароль, зайнятий нік тощо)
                    if (errorBox) {
                        errorBox.innerText = data.error || "Помилка авторизації";
                        errorBox.style.display = 'block';
                    }
                }
            } catch (error) {
                console.error("Auth error:", error);
                if (errorBox) {
                    errorBox.innerText = "Сталася помилка з'єднання.";
                    errorBox.style.display = 'block';
                }
            }
        }
    });

    // 3. Закриття модалок при кліку на фон
    window.onclick = (e) => {
        if (e.target.id === 'loginModal') toggleLogin(false);
        if (e.target.id === 'player-modal') closePlayerModal();
    };
});

// --- Базові функції керування ---

function toggleLogin(show) {
    const modal = document.getElementById('loginModal');
    if (modal) {
        if (show) modal.classList.add('active');
        else modal.classList.remove('active');
    }
}

async function loadTab(tabName) {
    const holder = document.getElementById('content-holder');
    if (!holder) return;
    holder.style.opacity = '0.3';

    try {
        const response = await fetch(`/tabs/${tabName}`);
        if (!response.ok) throw new Error(`Status: ${response.status}`);
        const html = await response.text();

        setTimeout(() => {
            holder.innerHTML = html;
            holder.style.opacity = '1';
            updateActiveLink(tabName);
            initTabSpecificLogic(tabName);
            window.scrollTo(0, 0);
        }, 150);
    } catch (error) {
        console.error("Load Error:", error);
        holder.innerHTML = `<div class="card"><h2>⚠️ Помилка</h2><p>Не вдалося завантажити вкладку</p></div>`;
        holder.style.opacity = '1';
    }
}

function updateActiveLink(tabName) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        const attr = link.getAttribute('onclick') || "";
        if (attr.includes(`'${tabName}'`)) link.classList.add('active');
    });
}

function initTabSpecificLogic(tabName) {
    // Активація кнопок у вкладках (Status, Team, Tier)
    document.querySelectorAll('.status-btn, .team-btn, .tier-btn, .type-btn, .tier-select').forEach(btn => {
        btn.onclick = function() {
            const parent = this.parentElement;
            if (parent) {
                parent.querySelectorAll('button, .tier-select').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
            }
        };
    });

    if (tabName === 'guest_home') loadGuestHomeData();
    if (tabName === 'home') loadHomeData();
    if (tabName === 'settings') { if(typeof loadProfileData === 'function') loadProfileData(); }
    if (tabName === 'players' || tabName === 'results_player') { 
        if(typeof loadPlayerStats === 'function') loadPlayerStats(); 
        if(typeof loadHistoryChart === 'function') loadHistoryChart(); 
    }
    if (tabName === 'monsters') { if(typeof loadMonsterStats === 'function') loadMonsterStats(false); }
    if (tabName === 'arena') { if(typeof loadArenaData === 'function') loadArenaData(); }
    if (tabName === 'kvk') { if(typeof loadKvkData === 'function') loadKvkData(); }
    if (tabName === 'call_list') { if(typeof window.loadCallList === 'function') window.loadCallList(); }

    if (tabName === 'admin') {
        if(typeof loadAdminDateSettings === 'function') loadAdminDateSettings();
        const activeBtn = document.querySelector('.admin-nav .nav-item.active') || document.querySelector('.admin-nav .nav-item');
        if (activeBtn && typeof window.switchAdminTab === 'function') {
            const tabId = activeBtn.getAttribute('onclick')?.split("'")[1];
            if (tabId) window.switchAdminTab(activeBtn, tabId);
        }
    }
}

async function loadGuestHomeData() {
    try {
        const response = await fetch('/api/home_data');
        const data = await response.json();
        if(document.getElementById('home-announcement')) 
            document.getElementById('home-announcement').innerText = data.announcement || "Ласкаво просимо!";
        runSmartTimer(data.arena_date, data.arena_time || "19:00", 'countdown-arena', 'event-date-display');
        runSmartTimer(data.kvk_date, data.kvk_time || "13:00", 'countdown-kvk', 'date-kvk');
    } catch (err) { console.error("Guest Data Error:", err); }
}


// ==========================================
// 2. 🏠 ГОЛОВНА (HOME)
// ==========================================

async function loadHomeData() {
    try {
        const response = await fetch('/api/home_data');
        const data = await response.json();

        if(document.getElementById('home-nickname')) document.getElementById('home-nickname').innerText = data.user.nickname;
        if(document.getElementById('home-rank')) document.getElementById('home-rank').innerText = data.user.rank;

        const statusBox = document.getElementById('home-status-box');
        if(statusBox) {
            if (data.user.debt > 0) statusBox.innerHTML = `<div class="status-debt">⚠️ БОРГ: ${data.user.debt}</div>`;
            else statusBox.innerHTML = `<div class="status-ok">✅ Боргів немає</div>`;
        }

        if(document.getElementById('home-announcement')) document.getElementById('home-announcement').innerText = data.announcement || "Оголошень немає.";
        if(document.getElementById('home-hunt-rule')) document.getElementById('home-hunt-rule').innerText = `${data.hunt_goal} балів на тиждень`;

        const autoArena = (typeof getNextEventDate === 'function') ? getNextEventDate('arena') : null;
        const autoKvk = (typeof getNextEventDate === 'function') ? getNextEventDate('kvk') : null;
        const pickDate = (dbDate, autoDate) => (!dbDate || dbDate.includes('?') || dbDate.length < 5) ? autoDate : dbDate;

        const arenaDate = pickDate(data.arena_date, autoArena);
        const kvkDate = pickDate(data.kvk_date, autoKvk);

        runSmartTimer(arenaDate, data.arena_time || "19:00", 'countdown-arena', 'event-date-display');
        runSmartTimer(kvkDate, data.kvk_time || "13:00", 'countdown-kvk', 'date-kvk'); 

    } catch (err) { console.error("Home Error:", err); }
}

function runSmartTimer(dateStr, timeStr, elementId, labelId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const label = document.getElementById(labelId);
    
    if (!dateStr || dateStr === "Невідомо") {
        el.innerText = "-- д -- г -- хв";
        if (label) label.innerText = "Очікування...";
        return;
    }

    let target = null;
    let displayDate = dateStr;

    try {
        const timeParts = timeStr.split(':');
        const hours = parseInt(timeParts[0]) || 0;
        const mins = parseInt(timeParts[1]) || 0;

        if (dateStr.includes('.')) {
            const parts = dateStr.split('.');
            target = new Date(parts[2], parts[1]-1, parts[0], hours, mins);
            displayDate = `${parts[0]}.${parts[1]}.${parts[2]}`;
        } else if (dateStr.includes('-')) {
            const parts = dateStr.split('-');
            target = new Date(parts[0], parts[1]-1, parts[2], hours, mins);
            displayDate = `${parts[2]}.${parts[1]}.${parts[0]}`;
        }
    } catch (e) { console.error("Date Parse Error", e); }

    if (label) label.innerText = `${displayDate} о ${timeStr}`;

    if (!target || isNaN(target.getTime())) {
        el.innerText = "Помилка дати";
        return;
    }

    if (el.dataset.timerId) clearInterval(el.dataset.timerId);

    const interval = setInterval(() => {
        const now = new Date();
        const diff = target - now;

        if (diff <= 0) {
            if (diff > -86400000) {
                el.innerText = "🔥 ПОДІЯ ЙДЕ! 🔥";
                el.style.color = "#ff4444";
            } else {
                el.innerText = "Завершено";
                el.style.color = "gray";
                clearInterval(interval);
            }
            return;
        }

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const min = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        el.innerText = `${d}д ${h}г ${min}хв`;
        el.style.color = "#ffd700"; 
    }, 1000);

    el.dataset.timerId = interval;
}

// ==========================================
// 3. 👤 ПРОФІЛЬ ГРАВЦЯ (LOAD & SAVE)
// ==========================================

async function loadProfileData() {
    try {
        const res = await fetch('/api/user_profile');
        const data = await res.json();
        document.getElementById('profile-display-nick').innerText = `👤 ${data.nickname}`;
        document.getElementById('profile-display-id').innerText = `ID: ${data.igg_id}`;
        document.getElementById('settings-new-nick').value = data.nickname;
        document.getElementById('settings-phone').value = data.phone;
        document.getElementById('settings-trap').value = data.trap_type;
    } catch(e) { console.error(e); }
}

async function saveProfileSettings() {
    const res = await fetch('/update_profile', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
            nickname: document.getElementById('settings-new-nick').value, 
            password: document.getElementById('settings-new-pass').value,
            phone: document.getElementById('settings-phone').value,
            trap_type: document.getElementById('settings-trap').value
        })
    });
    const result = await res.json();
    alert(res.ok ? "✨Магія D*C спрацювала. Збережено!✨" : "❌ " + result.error);
    if(res.ok) loadProfileData();
}

async function loadPlayerStats() {
    try {
        const response = await fetch('/api/my_stats');
        const data = await response.json();
        
        if (data.error || data.no_data) {
            console.warn("Дані статистики відсутні");
            return;
        }

        // 1. Основна інформація
        document.getElementById('display-nick').innerText = data.nickname || 'Гравець';
        document.getElementById('stat-might').innerText = data.might || '0M';
        document.getElementById('stat-kills').innerText = data.kills || '0M';

        // 2. Обробка різниці (diff)
        const setDiff = (id, val) => {
            const el = document.getElementById(id);
            if(el && val !== undefined) {
                el.innerText = val;
                // Додаємо класи плюс/мінус залежно від знаку
                el.className = `stat-diff ${val.toString().includes('+') ? 'plus' : 'minus'}`;
            }
        };
        setDiff('stat-might-diff', data.might_diff);
        setDiff('stat-kills-diff', data.kills_diff);

        // 3. Ранги (з захистом від undefined/null)
        const total = data.total || data.total_users || '--';
        
        document.getElementById('stat-rank').innerText = data.rank || '--';
        document.getElementById('stat-total').innerText = total;

        document.getElementById('stat-kills-rank').innerText = data.kills_rank || '--';
        document.getElementById('stat-total-k').innerText = total;
        
        document.getElementById('stat-percent').innerText = `Top ${data.percent || '--'}% (по міці)`;

        // 4. Розрахунок ефективності
        const mVal = parseFloat(data.might?.replace('M','')) || 1;
        const kVal = parseFloat(data.kills?.replace('M','')) || 0;
        const ratio = (kVal / mVal) * 100;
        
        let ratioBox = document.getElementById('km-ratio-box');
        if(!ratioBox) {
            const parent = document.getElementById('stat-kills').parentNode;
            ratioBox = document.createElement('div');
            ratioBox.id = 'km-ratio-box';
            ratioBox.style.marginTop = '10px';
            parent.appendChild(ratioBox);
        }
        
        // Визначення статусу бойової активності
        let color = '#4caf50'; // Фермер
        let label = 'Фермер 🚜';
        if(ratio > 10) { color = '#ff9800'; label = 'Боєць ⚔️'; }
        if(ratio > 30) { color = '#f44336'; label = 'Воїн 🩸'; }
        if(ratio > 50) { color = '#9c27b0'; label = 'ТЕРМІНАТОР 💀'; }

        ratioBox.innerHTML = `
            <div style="font-size:11px; color:#aaa; display:flex; justify-content:space-between; margin-bottom:3px;">
                <span>Ефективність:</span>
                <span style="color:${color}">${ratio.toFixed(1)}% (${label})</span>
            </div>
            <div style="height:6px; background:#333; border-radius:3px; overflow:hidden;">
                <div style="width:${Math.min(ratio, 100)}%; background:${color}; height:100%"></div>
            </div>`;

    } catch (e) { 
        console.error("Помилка завантаження статистики:", e); 
    }
}

async function loadHistoryChart() {
    const ctx = document.getElementById('mightChart');
    if (!ctx || typeof Chart === 'undefined') return;

    try {
        const res = await fetch('/api/my_history_chart');
        const data = await res.json();
        
        if (!data.dates || data.dates.length === 0) return;

        if (window.mightChartInstance) window.mightChartInstance.destroy();

        window.mightChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.dates,
                datasets: [
                    {
                        label: 'Міць (Might)',
                        data: data.might,
                        borderColor: '#ffd700', // Жовтий
                        backgroundColor: 'rgba(255, 215, 0, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        yAxisID: 'y', // Ліва шкала
                        fill: true
                    },
                    {
                        label: 'Вбивства (Kills)',
                        data: data.kills,
                        borderColor: '#ff4444', // Червоний
                        backgroundColor: 'rgba(255, 68, 68, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        yAxisID: 'y1', // Права шкала
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: { 
                    legend: { labels: { color: '#fff' } },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) { label += ': '; }
                                if (context.parsed.y !== null) {
                                    label += formatCompactNumber(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: { 
                        ticks: { color: '#888' }, 
                        grid: { color: '#333' } 
                    },
                    y: { // Ліва вісь (Міць)
                        type: 'linear',
                        display: true,
                        position: 'left',
                        ticks: { color: '#ffd700', callback: v => formatCompactNumber(v) }, 
                        grid: { color: '#333' } 
                    },
                    y1: { // Права вісь (Кіли)
                        type: 'linear',
                        display: true,
                        position: 'right',
                        ticks: { color: '#ff4444', callback: v => formatCompactNumber(v) },
                        grid: { drawOnChartArea: false } // Щоб не було сітки поверх сітки
                    }
                }
            }
        });
    } catch (e) { console.error("Chart Error:", e); }
}

// ==========================================
// 4. 👾 АРЕНА ТА КВК (ЗАВАНТАЖЕННЯ І ЗБЕРЕЖЕННЯ)
// ==========================================

// --- АРЕНА ---
async function loadArenaData() {
    try {
        const response = await fetch('/api/arena_data');
        const data = await response.json();

        // Дати
        const dateEl = document.getElementById('arena-date-display');
        const timeEl = document.getElementById('arena-time-display');
        if (dateEl) {
            let finalDate = data.event_date || getNextEventDate('arena');
            let finalTime = data.event_time || "19:00";
            if(finalDate === "Очікування") finalDate = "Невідомо";
            
            dateEl.innerText = finalDate;
            if(timeEl) timeEl.innerText = finalTime;
            runSmartTimer(finalDate, finalTime, 'countdown-arena-tab'); 
        }

        // Стати гравця
        if (data.user_stats) {
            const s = data.user_stats;
            document.querySelectorAll('#status-group .status-btn').forEach(b => {
                b.classList.remove('active');
                if(b.dataset.val === s.status) b.classList.add('active');
            });
            document.querySelectorAll('#team-group .team-btn').forEach(b => {
                b.classList.remove('active');
                if(b.dataset.val === s.team) b.classList.add('active');
            });
            
            const setVal = (id, val) => { const e = document.getElementById(id); if(e) e.value = val || ''; }
            setVal('stat-inf', s.inf); setVal('stat-rng', s.rng); setVal('stat-cav', s.cav);
            setVal('stat-hp', s.hp); setVal('stat-atk', s.atk); setVal('stat-size', s.size);
        }
    } catch (e) { console.error("Arena Load Error:", e); }
}

// 🔥 ФУНКЦІЯ ЗБЕРЕЖЕННЯ АРЕНИ (ЯКУ Я ЗАБУВ)
async function saveArenaStats() {
    const statusBtn = document.querySelector('#status-group .status-btn.active');
    const teamBtn = document.querySelector('#team-group .team-btn.active');

    const payload = {
        status: statusBtn ? statusBtn.getAttribute('data-val') : null,
        team: teamBtn ? teamBtn.getAttribute('data-val') : null,
        inf: document.getElementById('stat-inf').value,
        rng: document.getElementById('stat-rng').value,
        cav: document.getElementById('stat-cav').value,
        hp: document.getElementById('stat-hp').value,
        atk: document.getElementById('stat-atk').value,
        size: document.getElementById('stat-size').value 
    };

    if (!payload.status) return alert("⚠️ Вкажіть статус (Я буду / Не буду)!");

    try {
        const res = await fetch('/api/save_arena_stats', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        alert(result.message || "Збережено!");
    } catch (e) { alert("Помилка збереження!"); }
}

// --- KVK ---
async function loadKvkData() {
    try {
        const response = await fetch('/api/kvk_data');
        if (!response.ok) return;
        const data = await response.json();

        // Radio buttons
        if (data.is_ready) {
            const yesBtn = document.getElementById('kvk-ready-yes');
            if (yesBtn) yesBtn.checked = true;
        } else {
            const noBtn = document.getElementById('kvk-ready-no');
            if (noBtn) noBtn.checked = true;
        }

        if(document.getElementById('kvk-fly-out')) document.getElementById('kvk-fly-out').checked = data.fly_out || false;
        if(document.getElementById('kvk-mig-closed')) document.getElementById('kvk-mig-closed').checked = data.migration_closed || false;
        if(document.getElementById('kvk-rabbit')) document.getElementById('kvk-rabbit').checked = data.has_rabbit || false;
        if(document.getElementById('kvk-kingdom-num')) document.getElementById('kvk-kingdom-num').value = data.kingdom_num || "";
        
        const setVal = (id, val) => { const e = document.getElementById(id); if(e) e.value = val || ''; }
        setVal('kvk-inf', data.inf); setVal('kvk-rng', data.rng); setVal('kvk-cav', data.cav);
        setVal('kvk-army-atk', data.atk); setVal('kvk-army-hp', data.hp);

    } catch (e) { console.error("KVK Load Error:", e); }
}

// 🔥 ФУНКЦІЯ ЗБЕРЕЖЕННЯ KVK (ЯКУ Я ЗАБУВ)
async function saveKvkData() {
    const readyYes = document.getElementById('kvk-ready-yes');
    const isReady = readyYes ? readyYes.checked : false;

    const payload = {
        is_ready: isReady,
        fly_out: document.getElementById('kvk-fly-out').checked,
        migration_closed: document.getElementById('kvk-mig-closed').checked,
        rabbit: document.getElementById('kvk-rabbit').checked,
        kingdom_num: document.getElementById('kvk-kingdom-num').value,
        inf: document.getElementById('kvk-inf').value,
        rng: document.getElementById('kvk-rng').value,
        cav: document.getElementById('kvk-cav').value,
        atk: document.getElementById('kvk-army-atk').value,
        hp: document.getElementById('kvk-army-hp').value
    };

    try {
        const response = await fetch('/api/save_kvk_stats', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const res = await response.json();
        if (response.ok) alert("✅ " + (res.message || "Збережено!"));
        else alert("❌ Помилка: " + res.error);
    } catch (e) { alert("Помилка з'єднання!"); }
}

async function loadMonsterStats(isLastWeek = false) {
    try {
        const res = await fetch('/api/my_stats');
        const data = await res.json();
        if (data.no_data) return;

        const points = isLastWeek ? data.last_hunt_points : data.hunt_points;
        const goal = data.hunt_goal || 56;
        const debt = Number(data.monster_debt || 0);

        const pEl = document.getElementById('m-total-points');
        if (pEl) {
            pEl.innerText = points || 0;
            pEl.style.color = (points >= goal) ? "#4caf50" : "#ffd700";
        }

        const kEl = document.getElementById('m-total-kills');
        if (kEl) {
            const total = (Number(isLastWeek ? data.last_hunt_l1 : data.hunt_l1) || 0) +
                          (Number(isLastWeek ? data.last_hunt_l2 : data.hunt_l2) || 0) +
                          (Number(isLastWeek ? data.last_hunt_l3 : data.hunt_l3) || 0) +
                          (Number(isLastWeek ? data.last_hunt_l4 : data.hunt_l4) || 0) +
                          (Number(isLastWeek ? data.last_hunt_l5 : data.hunt_l5) || 0);

            kEl.innerHTML = `<span>${total}</span>
                <div style="margin-top:5px; font-size:14px; font-weight:bold; color:${points >= goal ? '#4caf50' : '#ff4d4d'};">
                    ${points >= goal ? 'Виконано ✅' : 'Не виконано ❌'}
                </div>`;
        }

        for (let i = 1; i <= 5; i++) {
            const el = document.getElementById(`m-lvl${i}`);
            if (el) el.innerText = (isLastWeek ? data[`last_hunt_l${i}`] : data[`hunt_l${i}`]) || 0;
        }

        const debtEl = document.querySelector('#monster-debt-display') || document.querySelector('.debt-value');
        if (debtEl && debtEl.id !== 'm-total-points') {
            if (debt <= 0) {
                debtEl.innerHTML = 'Боргів немає 🎉';
                debtEl.style.color = '#4caf50';
            } else {
                debtEl.innerHTML = `Борг: <b>${debt}</b> (Lvl 2)`;
                debtEl.style.color = '#ff4d4d';
            }
        }
    } catch (e) { console.error('Monster stats error:', e); }
}

// ==========================================
// 5. 👑 АДМІН-ПАНЕЛЬ (ДІЇ)
// ==========================================

// Перемикання вкладок
window.switchAdminTab = function(btnElement, tabId) {
    const allBtns = document.querySelectorAll('.admin-nav .nav-item');
    allBtns.forEach(b => b.classList.remove('active'));

    if (btnElement) btnElement.classList.add('active');

    document.querySelectorAll('.admin-view').forEach(view => view.style.display = 'none');
    const activeView = document.getElementById('adm-' + tabId);
    if (activeView) activeView.style.display = 'block';

    if (tabId === 'general') { if(typeof loadAdminUsersList === 'function') loadAdminUsersList(); } 
    else if (tabId === 'arena') { if(typeof loadAdminArenaData === 'function') loadAdminArenaData(); } 
    else if (tabId === 'kvk') { if(typeof loadAdminKvkData === 'function') loadAdminKvkData(); } 
    else if (tabId === 'monsters') { if(typeof loadAdminMonsterData === 'function') loadAdminMonsterData(); } 
    else if (tabId === 'kills') { if(typeof loadAdminKillsData === 'function') loadAdminKillsData(); }
    else if (tabId === 'settings') { 
        if(typeof window.loadUploadHistory === 'function') window.loadUploadHistory(); 
        loadAdminDateSettings();
    }
};

// Завантаження файлів
window.performUpload = async function(type, period) {
    const inputId = type === 'general' ? 'excel-general' : 'excel-monsters';
    const inputElement = document.getElementById(inputId);
    const file = inputElement ? inputElement.files[0] : null;
    
    if (!file) return alert("⚠️ Оберіть файл!");

    const pText = period === 'new' ? "НОВИЙ ТИЖДЕНЬ" : "МИНУЛИЙ ТИЖДЕНЬ";
    if (!confirm(`Завантажити файл "${file.name}"?\nТип: ${type.toUpperCase()}\nПеріод: ${pText}`)) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('period', period);

    const url = type === 'general' ? '/admin/upload_general_stats' : '/admin/upload_monster_stats';

    try {
        const response = await fetch(url, { method: 'POST', body: formData });
        const result = await response.json();
        if (response.ok) {
            alert("✅ " + result.message);
            inputElement.value = ''; 
            window.loadUploadHistory();
            if(type === 'monsters') loadAdminMonsterData();
            if(type === 'general') loadAdminKillsData();
        } else {
            alert("❌ Помилка: " + result.error);
        }
    } catch (err) { console.error(err); alert("❌ Помилка з'єднання"); }
};

// Історія
window.loadUploadHistory = async function() {
    const tbody = document.getElementById('history-body');
    if (!tbody) return;
    try {
        const res = await fetch('/api/admin/upload_history');
        const logs = await res.json();
        tbody.innerHTML = "";
        if(logs.length === 0) { tbody.innerHTML = "<tr><td colspan='6' style='text-align:center;'>Історія порожня</td></tr>"; return; }

        let html = "";
        logs.forEach(l => {
            const type = l.upload_type || l.type;
            const badgeColor = type === 'monsters' ? '#e91e63' : '#2196f3'; 
            const badgeBg = type === 'monsters' ? 'rgba(233, 30, 99, 0.2)' : 'rgba(33, 150, 243, 0.2)';
            const pColor = l.period === 'new' ? '#4caf50' : '#ff9800';
            const pName = l.period === 'new' ? 'NEW' : 'PAST';

            html += `<tr>
                    <td style="color:#fff;">${l.filename}</td>
                    <td><span style="background:${badgeBg}; color:${badgeColor}; padding:2px 6px; border-radius:4px; font-size:0.85em; text-transform:uppercase;">${type}</span></td>
                    <td><span style="color:${pColor}; font-weight:bold;">${pName}</span></td>
                    <td style="color:#aaa;">${l.timestamp || l.date}</td>
                    <td style="color:#ffd700;">${l.admin_name || l.admin}</td>
                    <td><button onclick="deleteUpload(${l.id})" class="icon-btn" title="Видалити">🗑️</button></td>
                </tr>`;
        });
        tbody.innerHTML = html;
    } catch (e) { console.error(e); }
};

window.deleteUpload = async function(id) {
    if(!confirm("Видалити файл і очистити ці дані?")) return;
    try {
        await fetch(`/api/admin/delete_upload`, { 
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ log_id: id })
        });
        window.loadUploadHistory();
    } catch (e) { console.error(e); }
};

// Збереження оголошення
window.updateAnnouncement = async function() {
    const input = document.getElementById('announcement-input');
    if (!input) return alert("Поле вводу не знайдено!");
    try {
        const res = await fetch('/admin/update_announcement', {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ text: input.value })
        });
        if (res.ok) alert("✅ Оголошення оновлено!");
        else alert("❌ Помилка збереження");
    } catch (e) { alert("Помилка з'єднання"); }
};

// Робота з датами адмінки
async function loadAdminDateSettings() {
    try {
        const res = await fetch('/api/home_data');
        const data = await res.json();
        const dIn = document.getElementById('event-date-input');
        const tIn = document.getElementById('event-time-input');
        const kD = document.getElementById('kvk-date-input');
        const kT = document.getElementById('kvk-time-input');
        if (dIn) dIn.value = data.arena_date || '';
        if (tIn) tIn.value = data.arena_time || '';
        if (kD) kD.value = data.kvk_date || '';
        if (kT) kT.value = data.kvk_time || '';
        if (document.getElementById('guild-pass-input')) 
    document.getElementById('guild-pass-input').value = data.guild_pass || "1234";
    } catch (e) { console.error(e); }
    
}
window.saveGuildPass = async function() {
    const pass = document.getElementById('guild-pass-input').value;
    if (!pass) return alert("Пароль не може бути пустим!");

    try {
        await fetch('/api/admin/update_guild_pass', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ guild_pass: pass })
        });
        alert("✅ Код гільдії змінено!");
    } catch(e) { alert("Помилка"); }
};

window.updateEventDates = async function() {
    const data = {
        arena_date: document.getElementById('event-date-input').value,
        arena_time: document.getElementById('event-time-input').value,
        kvk_date: document.getElementById('kvk-date-input').value,
        kvk_time: document.getElementById('kvk-time-input').value
    };
    try {
        const res = await fetch('/admin/update_event_dates', {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)
        });
        if (res.ok) alert("✅ Дати збережено!");
        else alert("❌ Помилка");
    } catch (e) { alert("Помилка з'єднання"); }
};

// --- ТАБЛИЦІ (HTML GENERATION) ---

async function loadAdminUsersList() {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Завантаження...</td></tr>';
    try {
        const res = await fetch('/admin/users');
        const users = await res.json();
        let html = "";
        users.forEach(u => {
            html += `<tr>
                    <td>${u.id}</td>
                    <td style="font-weight:bold; color:#fff;">${u.nickname}</td>
                    <td>${u.igg_id || '-'}</td>
                    <td><select onchange="updateUserRole(${u.id}, this.value)" class="arena-dark-input" style="padding: 5px; text-align:center;">
                            <option value="guest" ${u.role === 'guest' ? 'selected' : ''}>Гість 👤</option>
                            <option value="player" ${u.role === 'player' ? 'selected' : ''}>Гравець ⚔️</option>
                            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Адмін 👑</option>
                        </select></td>
                    <td style="text-align:center;"><button onclick="deleteUser(${u.id}, '${u.nickname}')" style="background:none; border:none; cursor:pointer; font-size:1.2rem;">🗑️</button></td>
                </tr>`;
        });
        tbody.innerHTML = html;
    } catch (e) { tbody.innerHTML = '<tr><td colspan="5">Помилка</td></tr>'; }
}

async function updateUserRole(userId, newRole) {
    if (!confirm(`Змінити роль?`)) { loadAdminUsersList(); return; }
    await fetch('/admin/update_role', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, new_role: newRole }) });
}

async function deleteUser(userId, nickname) {
    if (!confirm(`Видалити "${nickname}"?`)) return;
    await fetch('/admin/delete_user', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ user_id: userId }) });
    loadAdminUsersList();
}

async function loadAdminKillsData() {
    const tbody = document.getElementById('kills-table-body');
    if (!tbody) return;
    try {
        const res = await fetch('/api/admin/general_stats');
        const data = await res.json();
        let html = "";
        data.forEach(u => {
            const mDiff = parseFloat(u.might_diff) || 0;
            const kDiff = parseFloat(u.kills_diff) || 0;
            html += `<tr>
                    <td data-val="${u.nickname}" style="font-weight:bold; color:#fff; text-align:left;">${u.nickname}</td>
                    <td data-val="${u.might}" style="color:#ffd700; font-weight:bold;">${formatCompactNumber(u.might)}</td>
                    <td data-val="${mDiff}" style="color:${mDiff >= 0 ? '#4caf50' : '#f44336'}">${(mDiff>0?'+':'')+formatCompactNumber(mDiff)}</td>
                    <td data-val="${u.kills}" style="color:#f44336; font-weight:bold;">${formatCompactNumber(u.kills)}</td>
                    <td data-val="${kDiff}" style="color:${kDiff >= 0 ? '#4caf50' : '#f44336'}">${(kDiff>0?'+':'')+formatCompactNumber(kDiff)}</td>
                </tr>`;
        });
        tbody.innerHTML = html;
    } catch (e) { console.error(e); }
}

// --- ТАБЛИЦЯ МОНСТРІВ (ОНОВЛЕНА: З РЕДАГУВАННЯМ БОРГУ) ---
async function loadAdminMonsterData() {
    const tbody = document.getElementById('monsters-table-body');
    const debtBody = document.getElementById('debtors-body');
    const debtCard = document.getElementById('debtors-card');
    const debtCount = document.getElementById('debt-count');

    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="9">Завантаження...</td></tr>';

    try {
        const res = await fetch('/api/admin/monster_stats');
        const data = await res.json();
        
        let html = "";
        let debtHtml = "";
        let debtors = 0;

        data.forEach(u => {
            const debtClass = u.debt > 0 ? 'color: #f44336; font-weight:bold;' : 'color: #4caf50;';
            
            // 🔥 ДОДАНО КНОПКУ РЕДАГУВАННЯ БОРГУ
            const debtCell = `
                <div style="display:flex; align-items:center; justify-content:center; gap:5px;">
                    <span>${u.debt}</span>
                    <button onclick="window.editMonsterDebt('${u.igg_id}', '${u.nickname}', ${u.debt})" 
                            style="border:none; background:none; cursor:pointer; font-size:1rem;" title="Змінити борг">
                        ✏️
                    </button>
                </div>
            `;

            html += `
                <tr>
                    <td data-val="${u.nickname}" style="font-weight:bold; color:#fff; text-align:left;">${u.nickname}</td>
                    <td data-val="${u.igg_id}" style="color:#888;">${u.igg_id}</td>
                    <td data-val="${u.points}" style="color:#ffd700; font-weight:bold;">${u.points}</td>
                    <td data-val="${u.debt}" style="${debtClass}">${debtCell}</td>
                    <td>${u.l1}</td><td>${u.l2}</td><td>${u.l3}</td><td>${u.l4}</td><td>${u.l5}</td>
                </tr>`;
            
            if (u.debt > 0) {
                debtors++;
                debtHtml += `<tr><td style="font-weight:bold;">${u.nickname}</td><td>${u.points}</td><td style="color:#f44336;">${u.debt}</td></tr>`;
            }
        });

        tbody.innerHTML = html;
        if(debtBody) debtBody.innerHTML = debtHtml;
        if(debtCard && debtCount) {
            debtCard.style.display = debtors > 0 ? 'block' : 'none';
            debtCount.innerText = debtors;
        }
    } catch (e) { console.error(e); }
}

// 🔥 НОВА ФУНКЦІЯ: ЗМІНА БОРГУ
window.editMonsterDebt = async function(igg_id, name, currentDebt) {
    const newVal = prompt(`Змінити борг для ${name}.\nПоточний борг: ${currentDebt}\n\nВведіть нове значення (0 щоб списати борг):`, currentDebt);
    
    // Якщо натиснули "Скасувати" або нічого не ввели
    if (newVal === null) return;
    
    // Перевірка на число
    const debtNum = parseInt(newVal);
    if (isNaN(debtNum) || debtNum < 0) {
        alert("❌ Будь ласка, введіть коректне число (0 або більше).");
        return;
    }

    try {
        const res = await fetch('/api/admin/update_monster_debt', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ igg_id: igg_id, new_debt: debtNum })
        });
        
        const result = await res.json();
        
        if (res.ok) {
            alert("✅ " + result.message);
            loadAdminMonsterData(); // Оновлюємо таблицю, щоб побачити зміни
        } else {
            alert("❌ Помилка: " + result.error);
        }
    } catch (e) {
        alert("❌ Помилка з'єднання");
    }
};
async function loadAdminArenaData() {
    const tbody = document.getElementById('arena-table-body');
    if (!tbody) return;
    try {
        const res = await fetch('/api/admin/arena_registrations');
        const players = await res.json();
        let html = "";
        players.forEach(p => {
            const statusIcon = p.status === 'yes' ? '✅' : (p.status === 'no' ? '❌' : '❓');
            html += `<tr>
                    <td style="font-weight:bold; color:#fff; text-align:left;">${p.nickname}</td>
                    <td>${statusIcon}</td>
                    <td>${p.team || '-'}</td>
                    <td>${p.inf || 0}%</td><td>${p.rng || 0}%</td><td>${p.cav || 0}%</td><td>${p.atk || 0}%</td><td>${p.hp || 0}%</td>
                    <td style="color:#ffd700;">${p.size || '-'}</td>
                </tr>`;
        });
        tbody.innerHTML = html;
    } catch (e) { console.error(e); }
}

async function loadAdminKvkData() {
    const tbody = document.getElementById('kvk-report-body');
    if (!tbody) return;
    try {
        const res = await fetch('/api/admin/kvk_registrations');
        const players = await res.json();
        let html = "";
        players.forEach(p => {
            html += `<tr>
                    <td style="font-weight:bold; color:#fff; text-align:left;">${p.nickname}</td>
                    <td>${p.is_ready ? '<span style="color:#4caf50">ТАК</span>' : '<span style="color:#f44336">НІ</span>'}</td>
                    <td>${p.fly_out ? '✈️' : ''}</td>
                    <td>${p.migration_closed ? '🔒' : ''}</td>
                    <td>${p.kingdom_num || ''}</td>
                    <td>${p.inf || 0}%</td><td>${p.rng || 0}%</td><td>${p.cav || 0}%</td><td>${p.atk || 0}%</td><td>${p.hp || 0}%</td>
                    <td>${p.rabbit ? '✅' : ''}</td>
                </tr>`;
        });
        tbody.innerHTML = html;
    } catch (e) { console.error(e); }
}

// ==========================================
// 6. 📞 ДОЗВІН (CALL LIST)
// ==========================================

// ==========================================
// 5. 📞 ДОЗВІН (CALL LIST) - ВИПРАВЛЕНО
// ==========================================

// Оголошуємо функції ГЛОБАЛЬНО, щоб HTML їх бачив
window.loadCallList = async function() {
    const tbody = document.getElementById('call-table-body');
    const adminPanel = document.getElementById('call-admin-panel');
    
    if(!tbody) return; // Якщо ми не на тій вкладці, виходимо
    
    // --- ПЕРЕВІРКА ПРАВ ДОСТУПУ ДЛЯ ГОСТЯ ---
    const nameSpan = document.getElementById('player-name');
    const isGuest = nameSpan ? nameSpan.innerText.includes("(Гість)") : false;

    if (isGuest) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 30px; color:#ff4d4d; font-size: 1.1em;">' +
                          '⚠️ Доступ до контактів мають лише учасники гільдії.</td></tr>';
        if (adminPanel) adminPanel.style.display = 'none';
        return; // Зупиняємо виконання, щоб не робити запит до API
    }
    // ---------------------------------------

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888;">Завантаження...</td></tr>';
    
    try {
        const res = await fetch('/api/call_list');
        const responseData = await res.json();
        
        // Якщо сервер повернув помилку доступу
        if (responseData.error) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">${responseData.error}</td></tr>`;
            return;
        }

        const isAdmin = responseData.is_admin;
        const players = responseData.players;
        
        if (adminPanel) adminPanel.style.display = isAdmin ? 'block' : 'none';

        if (!players || players.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Список порожній</td></tr>';
            return;
        }

        let html = "";
        players.forEach(u => {
            const might = formatCompactNumber(u.might);
            const kills = formatCompactNumber(u.kills);
            
            let phoneDisplay = `<span style="color:#666;">—</span>`;
            if (u.phone && u.phone.length > 3) {
                phoneDisplay = `<a href="tel:${u.phone}" style="color:#ffd700; text-decoration:none;">📞 ${u.phone}</a>`;
            }

            let actions = "";
            if (isAdmin) {
                const userJson = JSON.stringify(u).replace(/"/g, '&quot;');
                actions = `
                    <div style="display:flex; gap:10px; justify-content:center;">
                        <button onclick="window.openEditModal(${userJson})" class="icon-btn" title="Редагувати">✏️</button>
                        <button onclick="window.deletePlayer(${u.id}, '${u.nickname}')" class="icon-btn delete-btn" title="Видалити">🗑️</button>
                    </div>
                `;
            }

            html += `
                <tr>
                    <td style="font-weight:bold; color:#fff;">
                        ${u.nickname}
                        <div style="font-size:0.75em; color:#666;">${u.igg_id || ''}</div>
                    </td>
                    <td>${phoneDisplay}</td>
                    <td style="color:#00e5ff;">${u.trap_type || '-'}</td>
                    <td style="color:#ffd700;">${might}</td>
                    <td style="color:#f44336;">${kills}</td>
                    ${isAdmin ? `<td>${actions}</td>` : ''} 
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        
        const actionHeader = document.getElementById('th-action');
        if(actionHeader) actionHeader.style.display = isAdmin ? 'table-cell' : 'none';

    } catch (e) { 
        console.error("Помилка Call List:", e);
        tbody.innerHTML = '<tr><td colspan="6" style="color:red; text-align:center;">Помилка завантаження даних</td></tr>'; 
    }
};

window.deletePlayer = async function(id, name) {
    if (!confirm(`⚠️ Видалити гравця ${name}?`)) return;
    try {
        await fetch('/api/admin/delete_player_contact', {
            method: 'POST', 
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: id })
        });
        window.loadCallList(); 
    } catch (e) { console.error(e); }
};

// --- МОДАЛЬНІ ВІКНА (POPUP) ---

window.openAddModal = function() {
    console.log("Відкриваю вікно додавання...");
    window.currentEditId = null; 
    
    const modal = document.getElementById('player-modal');
    if (!modal) {
        alert("Помилка: Модальне вікно (player-modal) не знайдено в HTML!");
        return;
    }

    document.getElementById('modal-title').innerText = "Додати Гравця";
    
    // Очищаємо поля
    const fields = ['edit-nick', 'edit-igg', 'edit-phone', 'edit-trap'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = "";
    });
    
    modal.style.display = 'flex';
};

window.openEditModal = function(user) {
    console.log("Редагуємо користувача:", user);
    window.currentEditId = user.id;
    
    const modal = document.getElementById('player-modal');
    if (!modal) return;

    document.getElementById('modal-title').innerText = "Редагувати Гравця";
    
    // Заповнюємо поля даними
    if(document.getElementById('edit-nick')) document.getElementById('edit-nick').value = user.nickname || "";
    if(document.getElementById('edit-igg')) document.getElementById('edit-igg').value = user.igg_id || "";
    
    // Телефон: якщо там прочерк, робимо пустим для редагування
    let phoneVal = user.phone;
    if (!phoneVal || phoneVal === "—") phoneVal = "";
    if(document.getElementById('edit-phone')) document.getElementById('edit-phone').value = phoneVal;
    
    if(document.getElementById('edit-trap')) document.getElementById('edit-trap').value = (user.trap_type !== "—") ? user.trap_type : "";
    
    modal.style.display = 'flex';
};

window.closePlayerModal = function() {
    const modal = document.getElementById('player-modal');
    if (modal) modal.style.display = 'none';
};

window.savePlayerFromModal = async function() {
    // Збираємо дані
    const nick = document.getElementById('edit-nick').value;
    const igg = document.getElementById('edit-igg').value;
    const phone = document.getElementById('edit-phone').value;
    const trap = document.getElementById('edit-trap').value;

    const url = window.currentEditId 
        ? '/api/admin/edit_player_contact' 
        : '/api/admin/add_player';
        
    const body = {
        nickname: nick,
        igg_id: igg,
        phone: phone,
        trap_type: trap,
        user_id: window.currentEditId
    };

    console.log("Відправляю на сервер:", body); // Для налагодження

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        });
        const result = await res.json();
        
        if (res.ok) {
            alert("✅ Збережено!");
            window.closePlayerModal();
            window.loadCallList(); 
        } else {
            alert("❌ Помилка: " + result.error);
        }
    } catch (e) { 
        console.error(e);
        alert("❌ Помилка з'єднання"); 
    }
};
// ==========================================
// 7. 🧮 КАЛЬКУЛЯТОРИ (T5, TRAIN, RSS)
// ==========================================

/* =========================================
   ПЕРЕМИКАННЯ ВКЛАДОК (Оновлено)
   ========================================= */
function switchCalcTab(tabId, btnElement) {
    // 1. Ховаємо всі вмісти
    document.querySelectorAll('.calc-content').forEach(el => el.style.display = 'none');
    
    // 2. Показуємо потрібний блок
    const activeSection = document.getElementById('calc-' + tabId);
    if(activeSection) activeSection.style.display = 'block';

    // 3. Перемикаємо активну кнопку
    // Якщо кнопка передана через 'this' (новий HTML)
    if (btnElement) {
        const parent = btnElement.parentElement;
        parent.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
    } else {
        // Старий метод (резервний)
        const nav = document.querySelector('.tabs-wrapper, .calc-tabs-nav');
        if(nav) {
            const btns = nav.querySelectorAll('button');
            btns.forEach(b => b.classList.remove('active'));
            if(tabId === 'train') btns[0]?.classList.add('active');
            if(tabId === 't5') btns[1]?.classList.add('active');
            if(tabId === 'speed') btns[2]?.classList.add('active');
            if(tabId === 'old') btns[3]?.classList.add('active');
        }
    }
}

/* =========================================
   ЛОГІКА Т5 (БЕЗ ЗМІН)
   ========================================= */
function toggleT5SubMode(mode, btnElement) {
    document.getElementById('t5-sub-speed').style.display = (mode === 'speed') ? 'block' : 'none';
    document.getElementById('t5-sub-gems').style.display = (mode === 'gems') ? 'block' : 'none';
    
    // Оновлення кнопок
    if (btnElement) {
        const parent = btnElement.parentElement;
        parent.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
    } else {
        // Резерв
        const btns = document.querySelectorAll('.t5-mode-switch .mode-btn');
        btns.forEach(b => b.classList.remove('active'));
        if(mode === 'speed') btns[0]?.classList.add('active'); else btns[1]?.classList.add('active');
    }
}

const T5_BASE_TIME = 120;
const T5_LUNITE = 100;
const GEM_FACTOR_TIME = 1.01855; 
const GEM_FACTOR_LUNITE = 5.5; 

function calculateT5Rss() {
    const amount = parseFloat(document.getElementById('t5-amount').value) || 0;
    const speed = parseFloat(document.getElementById('t5-speed').value) || 0;
    if (amount <= 0) return;
    const totalSeconds = amount * T5_BASE_TIME;
    const speedMultiplier = 1 + (speed / 100);
    const finalSeconds = totalSeconds / speedMultiplier;
    document.getElementById('t5-time-result').innerText = formatTime(finalSeconds);
    const formatRes = (v) => v >= 1000 ? (v/1000).toFixed(1)+'B' : v.toFixed(1)+'M';
    document.getElementById('t5-lunite').innerText = (amount * 100 / 1000).toFixed(0) + 'K';
    ['food','stone','wood','ore'].forEach(r => document.getElementById('t5-'+r).innerText = formatRes(amount * 100 / 1000000));
    document.getElementById('t5-gold').innerText = formatRes(amount * 50 / 1000000);
    document.getElementById('t5-rss-block').style.display = 'grid';
}

function calculateT5Gems() {
    const amount = parseFloat(document.getElementById('t5-amount').value) || 0;
    const speed = parseFloat(document.getElementById('t5-speed').value) || 0;
    const hasLunite = document.getElementById('t5-has-lunite').checked;
    if (amount <= 0) { document.getElementById('t5-gem-result').innerText = "0 💎"; return; }
    const finalSeconds = (amount * T5_BASE_TIME) / (1 + (speed / 100));
    const timeGems = Math.ceil(Math.ceil(finalSeconds / 60) * GEM_FACTOR_TIME);
    let luniteGems = hasLunite ? 0 : Math.ceil(((amount * T5_LUNITE) / 1000) * GEM_FACTOR_LUNITE);
    document.getElementById('t5-gem-result').innerText = (timeGems + luniteGems).toLocaleString() + " 💎";
    document.getElementById('gem-time-cost').innerText = timeGems.toLocaleString();
    document.getElementById('gem-lunite-cost').innerText = luniteGems.toLocaleString();
    document.getElementById('t5-gem-details').style.display = 'flex';
}

/* =========================================
   ВИБІР ТИПУ І ТІРА
   ========================================= */
function selectTier(btn, type) {
    // Якщо type передано, формуємо ID, якщо ні - шукаємо батьківський елемент
    let parent;
    if (type) {
        let groupId = type === 'train' ? 'tier-group-train' : 'tier-group-old';
        parent = document.getElementById(groupId);
    } else {
        parent = btn.parentElement;
    }

    if(parent) {
        parent.querySelectorAll('.tier-select, .tier-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
}

// 🔥 НОВА ФУНКЦІЯ: ВИБІР ТИПУ ВІЙСЬК (ДЛЯ КОНВЕРТА)
function selectType(btn) {
    const parent = btn.parentElement; // зазвичай id="type-group"
    if(parent) {
        parent.querySelectorAll('.tier-select').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
}

/* =========================================
   ІНШІ РОЗРАХУНКИ (БЕЗ ЗМІН)
   ========================================= */
function calculateTraining() {
    const amount = parseFloat(document.getElementById('train-amount').value) || 0;
    const speedPercent = parseFloat(document.getElementById('train-speed').value) || 0;
    let activeBtn = document.querySelector('#tier-group-train .tier-select.active') || document.querySelector('#tier-group-train .tier-btn.active');
    const baseTimePerUnit = activeBtn ? parseInt(activeBtn.dataset.time) : 15;
    if (amount <= 0) { document.getElementById('train-result').innerText = "0д 0г 0хв"; return; }
    const finalSeconds = (baseTimePerUnit * amount) / (1 + (speedPercent / 100));
    document.getElementById('train-result').innerText = formatTime(finalSeconds);
}

function calculateSpeedTime() {
    let totalMins = 0;
    document.querySelectorAll('#speedup-inputs input').forEach(input => {
        totalMins += (parseInt(input.value) || 0) * parseInt(input.dataset.mins);
    });
    const d = Math.floor(totalMins / 1440);
    const h = Math.floor((totalMins % 1440) / 60);
    const m = totalMins % 60;
    document.getElementById('total-speed-time').innerText = `${d}д ${h}г ${m}хв`;
}

function calculateLeft() {
    const days = parseFloat(document.getElementById('main-days').value) || 0;
    const speed = parseFloat(document.getElementById('main-speed').value) || 0;
    const subsidy = parseFloat(document.getElementById('main-subsidy').value) || 0;
    const activeBtn = document.querySelector('#tier-group-old .tier-select.active') || document.querySelector('#tier-group-old .tier-btn.active');
    if (!activeBtn) return;
    const baseTime = parseInt(activeBtn.dataset.time) || 120;
    const costs = activeBtn.dataset.cost ? activeBtn.dataset.cost.split(',') : [0,0,0,0,0];
    const units = Math.floor((days * 86400 * (1 + speed/100)) / baseTime);
    document.getElementById('res-units').innerText = units.toLocaleString();
    if (units > 0) {
        const formatRes = (val) => val >= 1000 ? (val/1000).toFixed(1)+'B' : val.toFixed(1)+'M';
        const costMult = 1 - (subsidy / 100);
        ['food','stone','wood','ore','gold'].forEach((r, i) => {
            document.getElementById('res-'+r).innerText = formatRes((units * parseInt(costs[i]) * costMult) / 1000000);
        });
        document.getElementById('res-rss-block').style.display = "grid";
    } else { document.getElementById('res-rss-block').style.display = "none"; }
}

function resetBag() {
    document.querySelectorAll('#speedup-inputs input').forEach(input => input.value = '');
    document.getElementById('total-speed-time').innerText = "0д 0г 0хв";
}

function resetCalc(mode) {
    if (mode === 'train') {
        document.getElementById('train-amount').value = '';
        document.getElementById('train-result').innerText = '0д 0г 0хв';
    } else if (mode === 't5') {
        document.getElementById('t5-amount').value = '';
        document.getElementById('t5-rss-block').style.display = 'none';
        document.getElementById('t5-gem-details').style.display = 'none';
        document.getElementById('t5-time-result').innerText = '0д 0г 0хв';
    } else if (mode === 'main') {
        ['main-days','main-speed','main-subsidy'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('res-rss-block').style.display = 'none';
        document.getElementById('res-units').innerText = '0';
    }
}
// ==========================================
// 8. 🛠️ УТИЛІТИ ТА КАЛЕНДАР
// ==========================================

function formatTime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}д ${h}г ${m}хв`;
    if (h > 0) return `${h}г ${m}хв`;
    return `${m}хв`;
}

function formatCompactNumber(num) {
    let n = parseFloat(num);
    if (isNaN(n)) return "0";
    const sign = n < 0 ? "-" : "";
    n = Math.abs(n);
    if (n >= 1000000000000) return sign + (n / 1000000000000).toFixed(2).replace(/\.00$/, '') + 'T';
    if (n >= 1000000000) return sign + (n / 1000000000).toFixed(2).replace(/\.00$/, '') + 'B';
    if (n >= 1000000) return sign + (n / 1000000).toFixed(2).replace(/\.00$/, '') + 'M';
    if (n >= 1000) return sign + (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return sign + n;
}

function sortTable(tableId, colIndex) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const tbody = table.tBodies[0];
    const rows = Array.from(tbody.rows);
    const header = table.querySelectorAll('th')[colIndex];
    const currentDir = header.getAttribute('data-order') || 'desc';
    const newDir = currentDir === 'asc' ? 'desc' : 'asc';

    rows.sort((rowA, rowB) => {
        const a = getCellValue(rowA.cells[colIndex]);
        const b = getCellValue(rowB.cells[colIndex]);
        if (a === b) return 0;
        if (typeof a === 'number' && typeof b === 'number') return newDir === 'asc' ? a - b : b - a;
        return newDir === 'asc' ? String(a).localeCompare(String(b)) : String(b).localeCompare(String(a));
    });

    tbody.append(...rows);
    table.querySelectorAll('th').forEach((th, idx) => {
        let text = th.innerText.replace(/[⬆⬇⇅]/g, '').trim();
        th.innerText = text + (idx === colIndex ? (newDir === 'asc' ? ' ⬆' : ' ⬇') : ' ⇅');
        th.style.color = (idx === colIndex) ? "#ffd700" : "";
        th.setAttribute('data-order', (idx === colIndex) ? newDir : '');
    });
}

function getCellValue(td) {
    if (!td) return 0;
    const rawVal = td.getAttribute('data-val');
    if (rawVal !== null && rawVal !== "") {
        const num = parseFloat(rawVal);
        return !isNaN(num) ? num : rawVal.toLowerCase().trim();
    }
    return td.innerText.trim().toLowerCase();
}

const EVENTS_SCHEDULE = {
   "kvk": ["2026-02-21", "2026-03-14", "2026-04-04", "2026-04-25", "2026-05-16", "2026-06-06", "2026-06-06", "2026-06-27", "2026-07-18", "2026-08-08", "2026-08-29", "2026-09-19", "2026-10-10", "2026-10-31", "2026-11-21", "2026-12-12"],
   
    "arena": ["2026-02-13", "2026-02-20", "2026-03-06", "2026-03-13", "2026-03-27", "2026-04-03", "2026-04-17", "2026-04-24", "2026-05-08", "2026-05-15", "2026-05-29", "2026-06-19", "2026-06-26", "2026-07-10", "2026-07-17", "2026-07-31", "2026-08-07", "2026-08-21", "2026-08-28", "2026-09-11", "2026-09-18", "2026-10-02", "2026-10-09", "2026-10-23", "2026-10-30", "2026-11-13", "2026-11-20", "2026-12-04", "2026-12-11", "2026-12-25"]
};


function getNextEventDate(type) {
    const dates = EVENTS_SCHEDULE[type];
    if (!dates) return "Невідомо";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let dateStr of dates) {
        const eventDate = new Date(dateStr);
        if (eventDate >= today) {
            const parts = dateStr.split('-');
            return `${parts[2]}.${parts[1]}.${parts[0]}`;
        }
    }
    return "Очікування";
}
// ==========================================
// 🔍 УНІВЕРСАЛЬНИЙ ПОШУК
// ==========================================

window.searchTable = function(tableId, inputId) {
    const input = document.getElementById(inputId);
    const filter = input.value.toUpperCase();
    const table = document.getElementById(tableId);
    
    if (!table) return;

    const tr = table.getElementsByTagName("tr");

    // 🔥 ЛОГІКА ВИБОРУ КОЛОНКИ:
    // Якщо це таблиця всіх юзерів ('users-table'), шукаємо в колонці 1 (бо 0 це ID)
    // У всіх інших таблицях (кіли, монстри, дозвін) нік стоїть першим (колонці 0)
    let colIndex = 0;
    if (tableId === 'users-table') colIndex = 1;

    for (let i = 1; i < tr.length; i++) { // Починаємо з 1, щоб не чіпати шапку
        const td = tr[i].getElementsByTagName("td")[colIndex];
        if (td) {
            const txtValue = td.textContent || td.innerText;
            if (txtValue.toUpperCase().indexOf(filter) > -1) {
                tr[i].style.display = "";
            } else {
                tr[i].style.display = "none";
            }
        }
    }
};
// ==========================================
// 📱 МОБІЛЬНЕ МЕНЮ
// ==========================================

function toggleMenu() {
    const menu = document.getElementById('sideMenu');
    const overlay = document.querySelector('.mobile-overlay');
    
    menu.classList.toggle('active');
    overlay.classList.toggle('active');
}

function closeMenu() {
    // Ця функція закриває меню після кліку на посилання
    // Працює тільки якщо ми на телефоні (перевіряємо ширину екрану або наявність класу)
    const menu = document.getElementById('sideMenu');
    const overlay = document.querySelector('.mobile-overlay');
    
    if (menu.classList.contains('active')) {
        menu.classList.remove('active');
        overlay.classList.remove('active');
    }
}
// ... (ВЕСЬ ТВІЙ ПОПЕРЕДНІЙ КОД ВИЩЕ) ...

// ==========================================
// 🔐 АВТОРИЗАЦІЯ (ЛОГІКА ДЛЯ ГОЛОВНОЇ)
// ==========================================

// 1. Відкриття/Закриття модалки
window.toggleLogin = function(show) {
    const modal = document.getElementById('loginModal');
    if (!modal) return; // Захист, якщо ми не на головній сторінці
    
    if (show) modal.classList.add('active');
    else modal.classList.remove('active');
};

// 2. Перемикання між Входом та Реєстрацією
window.switchAuthMode = function(isReg) {
    const form = document.getElementById('mainAuthForm');
    if (!form) return;

    const title = document.getElementById('modal-title');
    const iggField = document.getElementById('igg-id-field');
    const guildField = document.getElementById('guild-code-field');
    const submitBtn = document.getElementById('submit-btn');
    const switchBtn = document.getElementById('switch-auth-btn');
    const errorBox = document.getElementById('player-auth-error');
    const flashBox = document.querySelector('.error-message.server-error'); // Старі помилки сервера

    if(flashBox) flashBox.style.display = 'none';
    errorBox.style.display = 'none';
    errorBox.innerText = '';

    if (isReg) {
        form.action = "/register_player";
        title.innerText = "РЕЄСТРАЦІЯ";
        iggField.style.display = "block";
        guildField.style.display = "block";
        
        // Додаємо атрибут required динамічно
        iggField.querySelector('input').setAttribute('required', 'required');
        guildField.querySelector('input').setAttribute('required', 'required');
        
        submitBtn.innerHTML = '<span class="fist-icon">🛡️</span> ЗАРЕЄСТРУВАТИСЬ';
        switchBtn.innerText = "ВЖЕ МАЮ АКАУНТ (УВІЙТИ)";
        switchBtn.onclick = () => window.switchAuthMode(false);
    } else {
        form.action = "/login";
        title.innerText = "АВТОРИЗАЦІЯ";
        iggField.style.display = "none";
        guildField.style.display = "none";
        
        iggField.querySelector('input').removeAttribute('required');
        guildField.querySelector('input').removeAttribute('required');
        
        submitBtn.innerHTML = '<span class="fist-icon">✊</span> УВІЙТИ';
        switchBtn.innerText = "РЕЄСТРАЦІЯ НОВОГО ГРАВЦЯ";
        switchBtn.onclick = () => window.switchAuthMode(true);
    }
};


window.currentBookPage = 1;
window.totalBookPages = 11;

window.showSection = function(sectionId, btn) {
    const pages = document.querySelectorAll('.guide-page');
    const buttons = document.querySelectorAll('.guide-nav-btn');
    
    pages.forEach(p => {
        p.style.display = 'none';
        p.classList.remove('active');
    });
    buttons.forEach(b => b.classList.remove('active'));

    const target = document.getElementById(sectionId);
    if (target) {
        target.style.display = 'block';
        // Невелика затримка для стабільного перезапуску анімації (fadeIn 0.5s)
        setTimeout(() => {
            target.classList.add('active');
        }, 10);
    }
    if (btn) btn.classList.add('active');
};

window.changeBookPage = function(direction) {
    const next = window.currentBookPage + direction;
    if (next >= 1 && next <= window.totalBookPages) {
        const pages = document.querySelectorAll('.book-page');
        pages.forEach(p => {
            p.style.display = 'none';
            p.classList.remove('active');
        });

        const target = document.querySelector(`.book-page[data-page="${next}"]`);
        if (target) {
            target.style.display = 'block';
            target.classList.add('active');
            window.currentBookPage = next;
            document.getElementById('current-p-num').innerText = next;
        }
        // Скидаємо скрол на початок блоку при перемиканні сторінки
        const main = document.querySelector('.guide-main');
        if (main) main.scrollTop = 0;
    }
};