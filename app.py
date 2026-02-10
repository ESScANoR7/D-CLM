from flask import Flask, render_template, request, redirect, url_for, session, jsonify, flash
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
import os
import pandas as pd
from datetime import datetime, date, timedelta

# ... твої інші імпорти та налаштування бази даних ...

import gc  # Garbage Collector для примусового закриття файлів


app = Flask(__name__)
app.secret_key = os.urandom(24)

from datetime import timedelta

app.permanent_session_lifetime = timedelta(days=7) # Сесія буде жити 7 днів

# Конфігурація MySQL

# Пріоритет віддаємо базі з інтернету (Render), якщо її немає — локальній
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'mysql+pymysql://root:password@localhost/guild_db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)



# ==========================================
# МОДЕЛІ
# ==========================================

class UploadLog(db.Model):
    __tablename__ = 'upload_log'
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255))
    upload_type = db.Column(db.String(50))
    period = db.Column(db.String(20))
    admin_name = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.now)


class GuildConfig(db.Model):
    __tablename__ = 'guild_config'
    id = db.Column(db.Integer, primary_key=True)
    announcement = db.Column(db.Text)

    # Налаштування дат
    arena_date = db.Column(db.String(20))
    arena_time = db.Column(db.String(10))
    kvk_date = db.Column(db.String(20))
    kvk_time = db.Column(db.String(10))

    hunt_goal = db.Column(db.Integer, default=56)

    # 🔥 НОВЕ ПОЛЕ: ПАРОЛЬ ГІЛЬДІЇ
    guild_pass = db.Column(db.String(50), default="1234")

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    nickname = db.Column(db.String(50), unique=True, nullable=False)
    igg_id = db.Column(db.String(20), unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='player')
    phone = db.Column(db.String(50))
    trap_type = db.Column(db.String(50))


class PlayerStats(db.Model):
    __tablename__ = 'player_stats'
    id = db.Column(db.Integer, primary_key=True)
    igg_id = db.Column(db.String(20), unique=True, nullable=False)
    nickname = db.Column(db.String(100))
    # General
    might_current = db.Column(db.BigInteger, default=0)
    kills_current = db.Column(db.BigInteger, default=0)
    might_start = db.Column(db.BigInteger, default=0)
    kills_start = db.Column(db.BigInteger, default=0)
    might_diff = db.Column(db.BigInteger, default=0)
    kills_diff = db.Column(db.BigInteger, default=0)
    # Monster Hunt (Current)
    hunt_l1 = db.Column(db.Integer, default=0)
    hunt_l2 = db.Column(db.Integer, default=0)
    hunt_l3 = db.Column(db.Integer, default=0)
    hunt_l4 = db.Column(db.Integer, default=0)
    hunt_l5 = db.Column(db.Integer, default=0)
    hunt_points = db.Column(db.Integer, default=0)
    monster_debt = db.Column(db.Integer, default=0)
    # Monster Hunt (Archive)
    last_hunt_l1 = db.Column(db.Integer, default=0)
    last_hunt_l2 = db.Column(db.Integer, default=0)
    last_hunt_l3 = db.Column(db.Integer, default=0)
    last_hunt_l4 = db.Column(db.Integer, default=0)
    last_hunt_l5 = db.Column(db.Integer, default=0)
    last_hunt_points = db.Column(db.Integer, default=0)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)


class PlayerHistory(db.Model):
    __tablename__ = 'player_history'
    id = db.Column(db.Integer, primary_key=True)
    igg_id = db.Column(db.String(20), nullable=False)
    might = db.Column(db.BigInteger, default=0)
    kills = db.Column(db.BigInteger, default=0)
    recorded_at = db.Column(db.Date, default=date.today)


class ArenaStats(db.Model):
    __tablename__ = 'arena_stats'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    status = db.Column(db.String(10))
    team = db.Column(db.String(10))
    inf_atk = db.Column(db.String(20))
    rng_atk = db.Column(db.String(20))
    cav_atk = db.Column(db.String(20))
    army_hp = db.Column(db.String(20))
    army_atk = db.Column(db.String(20))
    army_size = db.Column(db.String(50))
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)


class KvkStats(db.Model):
    __tablename__ = 'kvk_stats'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    is_ready = db.Column(db.Boolean, default=False)
    fly_out = db.Column(db.Boolean, default=False)
    migration_closed = db.Column(db.Boolean, default=False)
    has_rabbit = db.Column(db.Boolean, default=False)
    kingdom_num = db.Column(db.String(20))
    inf_atk = db.Column(db.String(10))
    rng_atk = db.Column(db.String(10))
    cav_atk = db.Column(db.String(10))
    army_atk = db.Column(db.String(10))
    army_hp = db.Column(db.String(10))
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

with app.app_context():
    db.create_all()
    # Перевіряємо, чи є рядок з налаштуваннями гільдії
    if not GuildConfig.query.get(1):
        default_config = GuildConfig(
            id=1,
            announcement="Ласкаво просимо до Гільдії!",
            guild_pass="1234",  # Пароль за замовчуванням
            hunt_goal=56
        )
        db.session.add(default_config)
        db.session.commit()
        print("База ініціалізована: Таблиці та дефолтний конфіг створено!")
    else:
        print("Таблиці успішно перевірені!")
        from sqlalchemy import text


# ==========================================
# ГОЛОВНІ РОУТИ
# ==========================================

@app.route('/')
def index(): return render_template('html.html')


@app.route('/register_guest', methods=['POST'])
def register_guest():
    nickname = request.form.get('nickname')
    password = request.form.get('password')

    # Валідація
    if not nickname or not password:
        return jsonify({"error": "Заповніть всі поля!"}), 400

    # Перевірка унікальності
    if User.query.filter_by(nickname=nickname).first():
        return jsonify({"error": "Цей нікнейм уже зайнятий!"}), 400

    try:
        hashed_pw = bcrypt.generate_password_hash(password).decode('utf-8')

        # Додаємо мітку гостя, щоб JS розпізнав роль після логіну
        display_nick = f"{nickname} (Гість)"

        new_guest = User(
            nickname=display_nick,
            password_hash=hashed_pw,
            role='guest',
            igg_id=None
        )
        db.session.add(new_guest)
        db.session.commit()




        # Авторизація
        session.clear()
        session.permanent = True
        session.update({
            'user_id': new_guest.id,
            'nickname': display_nick,
            'role': 'guest'
        })

        # ВАЖЛИВО: повертаємо JSON для AJAX
        return jsonify({"redirect": url_for('dashboard')}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Помилка бази даних"}), 500


with app.app_context():
    db.create_all()

    from sqlalchemy import text

    try:
        # Очищаємо ТІЛЬКИ монстрів, борги та загальну статистику (кіли/міць)
        db.session.execute(text("""
            UPDATE player_stats 
            SET 
                -- Обнуляємо монстрів
                hunt_l1 = 0, hunt_l2 = 0, hunt_l3 = 0, hunt_l4 = 0, hunt_l5 = 0, 
                hunt_points = 0, monster_debt = 0,
                last_hunt_l1 = 0, last_hunt_l2 = 0, last_hunt_l3 = 0, last_hunt_l4 = 0, last_hunt_l5 = 0, 
                last_hunt_points = 0,

                -- Обнуляємо загальну статку (кіли/міць)
                might_start = 0, might_current = 0, might_diff = 0,
                kills_start = 0, kills_current = 0, kills_diff = 0
        """))

        # Видаляємо історію для графіків та логи завантажень
        db.session.execute(text("DELETE FROM player_history"))
        db.session.execute(text("DELETE FROM upload_log"))

        db.session.commit()
        print("✅ Очищено монстрів та кіли. Арена та КВК збережені!")
    except Exception as e:
        db.session.rollback()
        print(f"❌ Помилка: {e}")
@app.route('/guest_reg')
def guest_reg():
    return render_template('guest.html')


@app.route('/login', methods=['POST'])
def login():
    nickname = request.form.get('nickname')
    password = request.form.get('password')

    # Пошук користувача (звичайний або гість)
    user = User.query.filter_by(nickname=nickname).first()
    if not user:
        user = User.query.filter_by(nickname=f"{nickname} (Гість)").first()

    if user and bcrypt.check_password_hash(user.password_hash, password):
        session.clear()
        session.permanent = True
        session.update({
            'user_id': user.id,
            'nickname': user.nickname,
            'role': user.role
        })

        # Якщо все ОК і це AJAX - шлемо редірект у JSON
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({"redirect": url_for('dashboard')}), 200
        return redirect(url_for('dashboard'))

    # ЯКЩО ПОМИЛКА:
    error_msg = "❌ Невірний нікнейм або пароль!"

    # Якщо запит від JS - повертаємо JSON помилку
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({"error": error_msg}), 401

    # Якщо звичайна форма - шлемо Flash
    flash(error_msg, "login_error")
    return redirect(url_for('index'))
@app.route('/register_player', methods=['POST'])
def register_player():
    nickname = request.form.get('nickname')
    password = request.form.get('password')
    igg_id = request.form.get('igg_id')
    entered_code = request.form.get('guild_code')

    # 1. Перевірка Коду Гільдії
    config = GuildConfig.query.get(1)
    real_code = config.guild_pass if config else "1234"

    if entered_code != real_code:
        # Повертаємо JSON помилку для JavaScript
        return jsonify({"error": "❌ НЕВІРНИЙ КОД ГІЛЬДІЇ! Запитайте код у R4/R5."}), 403

    # 2. Перевірка нікнейму
    if User.query.filter_by(nickname=nickname).first():
        return jsonify({"error": "Цей нікнейм вже зайнятий!"}), 400

    try:
        # 3. Створення користувача
        hashed_pw = bcrypt.generate_password_hash(password).decode('utf-8')
        new_user = User(nickname=nickname, password_hash=hashed_pw, igg_id=igg_id, role='player')

        db.session.add(new_user)
        db.session.commit()

        session.clear()  # Рекомендую очистити стару сесію перед новою
        session.permanent = True

        # 4. Авторизація
        session.update({'user_id': new_user.id, 'nickname': new_user.nickname, 'role': 'player'})

        # 5. ВАЖЛИВО: повертаємо JSON з посиланням на дашборд
        return jsonify({"redirect": url_for('dashboard')}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Помилка бази даних"}), 500
@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))


@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session: return redirect(url_for('index'))
    return render_template('dashboard.html', nickname=session['nickname'], role=session['role'])


@app.route('/tabs/<tab_name>')
def get_tab(tab_name):
    role = session.get('role')

    # Список заборонених вкладок для гостя
    forbidden_for_guest = ['call_list', 'players', 'monsters', 'admin']

    if role == 'guest' and tab_name in forbidden_for_guest:
        return "<div class='card'><h2>🔒 Доступ обмежено</h2><p>Будь ласка, зареєструйтесь як гравець.</p></div>"

    return render_template(f'tabs/{tab_name}.html')
# ==========================================
# API ДЛЯ ЮЗЕРА
# ==========================================

@app.route('/api/user_profile', methods=['GET'])
def get_user_profile():
    if 'user_id' not in session: return jsonify({'error': 'Unauthorized'}), 401
    user = User.query.get(session['user_id'])
    return jsonify({
        'nickname': user.nickname,
        'igg_id': user.igg_id or "Не прив'язано",
        'phone': user.phone or "",
        'trap_type': user.trap_type or ""
    })


@app.route('/update_profile', methods=['POST'])
def update_profile():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        data = request.json
        user = User.query.get(session['user_id'])

        if not user:
            return jsonify({'error': 'Користувача не знайдено'}), 404

        # 🔥 ЗАХИСТ: Якщо роль користувача 'guest', забороняємо будь-які зміни
        if user.role == 'guest':
            return jsonify({'error': 'Гості не мають прав на зміну профілю'}), 403

        new_nick = data.get('nickname')
        new_pass = data.get('password')

        # Логіка зміни нікнейму
        if new_nick and len(new_nick) > 2:
            # Перевіряємо, чи не зайнятий нік іншим користувачем
            existing = User.query.filter_by(nickname=new_nick).first()
            if existing and existing.id != user.id:
                return jsonify({'error': 'Нікнейм зайнятий'}), 400

            user.nickname = new_nick
            session['nickname'] = new_nick

        # Логіка зміни пароля
        if new_pass and len(new_pass) > 3:
            user.password_hash = bcrypt.generate_password_hash(new_pass).decode('utf-8')

        # Оновлення додаткових полів
        if data.get('phone') is not None:
            user.phone = data.get('phone')
        if data.get('trap_type') is not None:
            user.trap_type = data.get('trap_type')

        db.session.commit()
        return jsonify({'message': 'Оновлено успішно'})

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/home_data')
def get_home_data():
    config = GuildConfig.query.get(1) or GuildConfig(id=1)
    user_data = {'nickname': 'Гість', 'rank': '--', 'debt': 0}
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
        if user and user.igg_id:
            stats = PlayerStats.query.filter_by(igg_id=user.igg_id).first()
            if stats:
                user_data['debt'] = stats.monster_debt
                user_data['rank'] = PlayerStats.query.filter(
                    PlayerStats.might_current > stats.might_current).count() + 1
                user_data['nickname'] = user.nickname
    return jsonify({
        'announcement': config.announcement,
        'arena_date': config.arena_date, 'arena_time': config.arena_time,
        'kvk_date': config.kvk_date, 'kvk_time': config.kvk_time,
        'hunt_goal': config.hunt_goal,
        'guild_pass': config.guild_pass,  # <--- ДОДАНО
        'user': user_data
    })


@app.route('/api/my_stats')
def get_my_stats():
    if 'user_id' not in session: return jsonify({'error': 'Unauthorized'}), 401
    user = User.query.get(session['user_id'])

    if not user.igg_id: return jsonify({'no_data': True})

    stats = PlayerStats.query.filter_by(igg_id=user.igg_id).first()
    config = GuildConfig.query.get(1) or GuildConfig(hunt_goal=56)

    if not stats: return jsonify({'no_data': True})

    total = PlayerStats.query.count()

    # 1. Ранг за міццю (Might Rank)
    rank = PlayerStats.query.filter(PlayerStats.might_current > stats.might_current).count() + 1

    # 2. НОВИЙ: Ранг за вбивствами (Kills Rank)
    # Рахуємо скільки гравців мають більше вбивств ніж поточний юзер
    kills_rank = PlayerStats.query.filter(PlayerStats.kills_current > stats.kills_current).count() + 1

    return jsonify({
        'nickname': user.nickname,
        'might': f"{stats.might_current / 1000000:.1f}M",
        'might_diff': f"{stats.might_diff / 1000000:+.1f}M",
        'kills': f"{stats.kills_current / 1000000:.1f}M",
        'kills_diff': f"{stats.kills_diff / 1000000:+.1f}M",
        'hunt_l1': stats.hunt_l1, 'hunt_l2': stats.hunt_l2, 'hunt_l3': stats.hunt_l3,
        'hunt_l4': stats.hunt_l4, 'hunt_l5': stats.hunt_l5,
        'hunt_points': stats.hunt_points, 'monster_debt': stats.monster_debt,
        'last_hunt_l1': stats.last_hunt_l1, 'last_hunt_l2': stats.last_hunt_l2,
        'last_hunt_points': stats.last_hunt_points,
        'hunt_goal': config.hunt_goal,
        'rank': rank,
        'kills_rank': kills_rank,  # Додаємо в JSON
        'total': total,
        'percent': round((rank / total) * 100) if total else 100
    })
@app.route('/api/my_history_chart')
def get_my_history_chart():
    if 'user_id' not in session: return jsonify({'error': 'Unauthorized'}), 401
    user = User.query.get(session['user_id'])
    if not user.igg_id: return jsonify({'dates': [], 'might': [], 'kills': []})

    # Беремо всю історію (прибрали ліміт, або збільшили його)
    history = PlayerHistory.query.filter_by(igg_id=user.igg_id) \
        .order_by(PlayerHistory.recorded_at.asc()).all()

    return jsonify({
        'dates': [h.recorded_at.strftime('%d.%m') for h in history],
        'might': [h.might for h in history],
        'kills': [h.kills for h in history]  # 🔥 ДОДАНО КІЛИ
    })

# ==========================================
# 📞 API: ДОЗВІН (CALL LIST)
# ==========================================

@app.route('/api/call_list', methods=['GET'])
def get_call_list():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    user_role = session.get('role')

    # 🔥 ПРАВКА: Якщо роль - гість, повертаємо порожній список або повідомлення
    if user_role == 'guest':
        return jsonify({
            'is_admin': False,
            'players': [],
            'message': 'Доступ обмежено для гостей'
        })

    viewer = User.query.get(session['user_id'])
    is_admin = (viewer.role == 'admin')
    users = User.query.all()
    result = []

    for u in users:
        stats = PlayerStats.query.filter_by(igg_id=u.igg_id).first()
        result.append({
            'id': u.id, 'nickname': u.nickname, 'igg_id': u.igg_id,
            'phone': u.phone or "—", 'trap_type': u.trap_type or "—",
            'might': stats.might_current if stats else 0, 'kills': stats.kills_current if stats else 0
        })

    result.sort(key=lambda x: x['might'], reverse=True)
    return jsonify({'is_admin': is_admin, 'players': result})


@app.route('/api/admin/add_player', methods=['POST'])
def admin_add_player():
    if session.get('role') != 'admin': return jsonify({'error': 'Forbidden'}), 403
    data = request.json
    if User.query.filter_by(nickname=data.get('nickname')).first(): return jsonify({'error': 'Існує'}), 400
    hashed_pw = bcrypt.generate_password_hash("123456").decode('utf-8')
    new_user = User(nickname=data.get('nickname'), igg_id=data.get('igg_id'), phone=data.get('phone'),
                    trap_type=data.get('trap_type'), password_hash=hashed_pw, role='player')
    db.session.add(new_user)
    db.session.commit()
    return jsonify({'message': '✨Магія D*C спрацювала. Збережено!✨'})


@app.route('/api/admin/edit_player_contact', methods=['POST'])
def admin_edit_player_contact():
    if session.get('role') != 'admin': return jsonify({'error': 'Forbidden'}), 403

    data = request.json
    user = User.query.get(data.get('user_id'))

    if not user: return jsonify({'error': 'User not found'}), 404

    # Оновлюємо дані (Виправлена логіка)
    if 'nickname' in data: user.nickname = data['nickname']
    if 'phone' in data: user.phone = data['phone']  # Тепер дозволяє зберегти пустий номер
    if 'igg_id' in data: user.igg_id = data['igg_id']
    if 'trap_type' in data: user.trap_type = data['trap_type']

    db.session.commit()
    return jsonify({'message': 'Дані оновлено!'})

@app.route('/api/admin/delete_player_contact', methods=['POST'])
def delete_player_contact():
    if session.get('role') != 'admin': return jsonify({'error': 'Forbidden'}), 403
    data = request.json
    user = User.query.get(data.get('user_id'))
    if not user: return jsonify({'error': 'User not found'}), 404
    if user.igg_id: PlayerStats.query.filter_by(igg_id=user.igg_id).delete()
    db.session.delete(user)
    db.session.commit()
    return jsonify({'message': 'Deleted'})


# --- АДМІН: РУЧНА ЗМІНА БОРГУ ---
@app.route('/api/admin/update_monster_debt', methods=['POST'])
def update_monster_debt():
    if session.get('role') != 'admin': return jsonify({'error': 'Forbidden'}), 403

    data = request.json
    igg_id = data.get('igg_id')

    try:
        new_debt = int(data.get('new_debt'))
    except (ValueError, TypeError):
        return jsonify({'error': 'Борг має бути числом!'}), 400

    stat = PlayerStats.query.filter_by(igg_id=igg_id).first()
    if not stat: return jsonify({'error': 'Гравця не знайдено'}), 404

    # Оновлюємо борг (не дозволяємо менше 0)
    stat.monster_debt = max(0, new_debt)
    db.session.commit()

    return jsonify({'message': f'Борг {stat.nickname} змінено на {stat.monster_debt}'})
# ==========================================
# 📥 UPLOAD ЛОГІКА
# ==========================================

def apply_week_result(current_debt, points, goal):
    debt = current_debt or 0
    diff = points - goal
    if diff < 0:
        debt += abs(diff)  # Не виконав -> борг росте
    else:
        debt -= diff  # Перевиконав -> гасить борг
    return max(debt, 0)


@app.route('/admin/upload_monster_stats', methods=['POST'])
def upload_monster_stats():
    if session.get('role') != 'admin': return jsonify({'error': 'Forbidden'}), 403
    file = request.files.get('file')
    period = request.form.get('period')
    if not file: return jsonify({'error': 'No file'}), 400

    try:
        # Унікальне ім'я файлу
        filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        if not os.path.exists('uploads'): os.makedirs('uploads')
        file_path = os.path.join('uploads', filename)
        file.save(file_path)

        db.session.add(
            UploadLog(filename=filename, upload_type='monsters', period=period, admin_name=session.get('nickname')))

        df = pd.read_excel(file_path)
        df.columns = df.columns.str.strip()
        config = GuildConfig.query.get(1)
        GOAL = config.hunt_goal if config else 56
        count = 0

        def gv(row, keys):
            for k in keys:
                if k in df.columns and pd.notnull(row[k]):
                    try:
                        return int(row[k])
                    except:
                        pass
            return 0

        for _, row in df.iterrows():
            raw_igg = row.get('User ID') or row.get('IGG ID') or row.get('ID')
            igg_id = "".join(filter(str.isdigit, str(raw_igg)))
            if not igg_id: continue

            stat = PlayerStats.query.filter_by(igg_id=igg_id).first()
            if not stat:
                stat = PlayerStats(igg_id=igg_id, monster_debt=0)
                db.session.add(stat)

            name = row.get('Name') or row.get('Nickname')
            if name: stat.nickname = str(name)

            l1 = gv(row, ['L1 (Hunt)', 'L1']);
            l2 = gv(row, ['L2 (Hunt)', 'L2'])
            l3 = gv(row, ['L3 (Hunt)', 'L3']);
            l4 = gv(row, ['L4 (Hunt)', 'L4'])
            l5 = gv(row, ['L5 (Hunt)', 'L5'])
            points = (l2 * 1) + (l3 * 3) + (l4 * 8) + (l5 * 8)

            if period == 'new':
                stat.hunt_l1 = l1;
                stat.hunt_l2 = l2;
                stat.hunt_l3 = l3;
                stat.hunt_l4 = l4;
                stat.hunt_l5 = l5
                stat.hunt_points = points
                stat.monster_debt = apply_week_result(stat.monster_debt, points, GOAL)
            elif period == 'past':
                stat.last_hunt_l1 = l1;
                stat.last_hunt_l2 = l2;
                stat.last_hunt_l3 = l3
                stat.last_hunt_l4 = l4;
                stat.last_hunt_l5 = l5;
                stat.last_hunt_points = points
            count += 1

        db.session.commit()
        return jsonify({'message': f'Монстри ({period}): оновлено {count} гравців'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/admin/upload_general_stats', methods=['POST'])
def upload_general_stats():
    if session.get('role') != 'admin': return jsonify({'error': 'Forbidden'}), 403
    file = request.files.get('file')
    period = request.form.get('period')
    if not file: return jsonify({'error': 'No file'}), 400

    try:
        filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        if not os.path.exists('uploads'): os.makedirs('uploads')
        file_path = os.path.join('uploads', filename)
        file.save(file_path)

        db.session.add(
            UploadLog(filename=filename, upload_type='general', period=period, admin_name=session.get('nickname')))

        df = pd.read_excel(file_path)
        # Очищаємо назви колонок: видаляємо пробіли та переводимо в нижній регістр для перевірки
        df.columns = [str(col).strip() for col in df.columns]
        count = 0

        def safe_int(val):
            try:
                if isinstance(val, str): val = val.replace(',', '').replace(' ', '')
                return int(val) if pd.notnull(val) else 0
            except:
                return 0

        # Функція для гнучкого пошуку значення в рядку за списком можливих назв колонок
        def get_value_flexible(row, possible_names):
            for col in df.columns:
                if col.lower() in [name.lower() for name in possible_names]:
                    val = row[col]
                    return val if pd.notnull(val) else None
            return None

        if period == 'past':
            record_date = date.today() - timedelta(days=7)
        else:
            record_date = date.today()

        for _, row in df.iterrows():
            # Гнучкий пошук IGG ID
            raw_igg = get_value_flexible(row, ['IGG ID', 'User ID', 'ID', 'iggid'])
            if raw_igg is None: continue
            igg_id = "".join(filter(str.isdigit, str(raw_igg)))
            if not igg_id: continue

            stat = PlayerStats.query.filter_by(igg_id=igg_id).first()
            if not stat:
                stat = PlayerStats(igg_id=igg_id)
                db.session.add(stat)

            # 🔥 ПРАВКА ТУТ: Гнучкий пошук імені
            name = get_value_flexible(row, ['Name', 'Nickname', 'Нік', 'Никнейм', 'Нікнейм'])
            if name:
                stat.nickname = str(name).strip()
            # Якщо ім'я не знайдено, але гравець вже зареєстрований — спробуємо взяти з таблиці User
            elif not stat.nickname:
                registered_user = User.query.filter_by(igg_id=igg_id).first()
                if registered_user:
                    stat.nickname = registered_user.nickname

            val_might = safe_int(get_value_flexible(row, ['Might', 'Міць', 'Power', 'Сила']))
            val_kills = safe_int(get_value_flexible(row, ['Kills', 'Вбивства', 'Kill Count', 'Убийства']))

            if period == 'new':
                stat.might_current = val_might
                stat.kills_current = val_kills
            elif period == 'past':
                stat.might_start = val_might
                stat.kills_start = val_kills

            history = PlayerHistory.query.filter_by(igg_id=igg_id, recorded_at=record_date).first()
            if not history:
                history = PlayerHistory(igg_id=igg_id, recorded_at=record_date)
                db.session.add(history)

            history.might = val_might
            history.kills = val_kills

            stat.might_diff = (stat.might_current or 0) - (stat.might_start or 0)
            stat.kills_diff = (stat.kills_current or 0) - (stat.kills_start or 0)

            count += 1

        db.session.commit()
        return jsonify({'message': f'Успішно оновлено {count} гравців. Ніки відновлено!'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
# ==========================================
# 🔥 РОЗУМНЕ ВИДАЛЕННЯ (ROLLBACK)
# ==========================================

@app.route('/api/admin/delete_upload', methods=['POST'])
def delete_upload_api():
    if session.get('role') != 'admin': return jsonify({'error': 'Forbidden'}), 403

    try:
        data = request.json
        log = UploadLog.query.get(data.get('log_id'))
        if not log: return jsonify({'error': 'Запис не знайдено'}), 404

        file_path = os.path.abspath(os.path.join('uploads', log.filename))
        print(f"DEBUG: Спроба видалення файлу ({log.upload_type}): {file_path}")

        # --- 1. ВІДКАТ ДАНИХ ДЛЯ МОНСТРІВ ---
        if log.upload_type == 'monsters' and log.period == 'new':
            if os.path.exists(file_path):
                try:
                    df = pd.read_excel(file_path)
                    df.columns = df.columns.str.strip()
                    config = GuildConfig.query.get(1)
                    GOAL = config.hunt_goal if config else 56

                    def gv(row, keys):
                        for k in keys:
                            if k in df.columns and pd.notnull(row[k]):
                                try:
                                    return int(row[k])
                                except:
                                    pass
                        return 0

                    for _, row in df.iterrows():
                        raw_igg = row.get('User ID') or row.get('IGG ID') or row.get('ID')
                        igg_id = "".join(filter(str.isdigit, str(raw_igg)))
                        if not igg_id: continue
                        stat = PlayerStats.query.filter_by(igg_id=igg_id).first()
                        if stat:
                            l2 = gv(row, ['L2 (Hunt)', 'L2'])
                            l3 = gv(row, ['L3 (Hunt)', 'L3'])
                            l4 = gv(row, ['L4 (Hunt)', 'L4'])
                            l5 = gv(row, ['L5 (Hunt)', 'L5'])
                            points = (l2 * 1) + (l3 * 3) + (l4 * 8) + (l5 * 8)
                            diff = points - GOAL

                            # ВІДКАТ БОРГУ
                            if diff < 0:
                                stat.monster_debt -= abs(diff)
                            else:
                                stat.monster_debt += diff
                            if stat.monster_debt < 0: stat.monster_debt = 0

                    del df
                    gc.collect()
                except Exception as e:
                    print(f"ПОМИЛКА ВІДКАТУ МОНСТРІВ: {e}")

            # Скидаємо бали за поточний тиждень
            PlayerStats.query.update({
                PlayerStats.hunt_points: 0, PlayerStats.hunt_l1: 0,
                PlayerStats.hunt_l2: 0, PlayerStats.hunt_l3: 0,
                PlayerStats.hunt_l4: 0, PlayerStats.hunt_l5: 0
            })

        # --- 2. ВІДКАТ ДАНИХ ДЛЯ КІЛІВ/МІЦІ (GENERAL) ---
        elif log.upload_type == 'general':
            # Визначаємо дату, яку треба видалити з історії
            if log.period == 'past':
                record_date = date.today() - timedelta(days=7)
            else:
                record_date = date.today()

            # Видаляємо записи з PlayerHistory за цю дату
            PlayerHistory.query.filter_by(recorded_at=record_date).delete()

            # Якщо видаляємо "НОВИЙ" файл, повертаємо поточні показники до стартових
            if log.period == 'new':
                players = PlayerStats.query.all()
                for stat in players:
                    stat.might_current = stat.might_start
                    stat.kills_current = stat.kills_start
                    stat.might_diff = 0
                    stat.kills_diff = 0

        # --- 3. ФІЗИЧНЕ ВИДАЛЕННЯ ФАЙЛУ ---
        if os.path.exists(file_path):
            try:
                gc.collect()  # Примусово звільняємо ресурси перед видаленням
                os.remove(file_path)
                print("DEBUG: Файл успішно видалено.")
            except Exception as e:
                print(f"DEBUG: Не вдалося видалити файл (зайнятий): {e}")

        # --- 4. ВИДАЛЕННЯ З БАЗИ ---
        db.session.delete(log)
        db.session.commit()

        return jsonify({'message': f'Запис {log.upload_type} видалено, дані відкочено!'})

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
# ==========================================
# ІНШІ API
# ==========================================

@app.route('/admin/users', methods=['GET'])
def get_users_list():
    if session.get('role') != 'admin': return jsonify([])
    users = User.query.all()
    return jsonify([{'id': u.id, 'nickname': u.nickname, 'igg_id': u.igg_id, 'role': u.role} for u in users])


@app.route('/api/admin/monster_stats', methods=['GET'])
def get_admin_monster_stats():
    if session.get('role') != 'admin': return jsonify({'error': 'Forbidden'}), 403
    stats = PlayerStats.query.all()
    return jsonify([{'nickname': s.nickname, 'igg_id': s.igg_id, 'points': s.hunt_points, 'debt': s.monster_debt,
                     'l1': s.hunt_l1, 'l2': s.hunt_l2, 'l3': s.hunt_l3, 'l4': s.hunt_l4, 'l5': s.hunt_l5} for s in
                    stats])


@app.route('/api/admin/general_stats', methods=['GET'])
def get_admin_general_stats():
    if session.get('role') != 'admin': return jsonify({'error': 'Forbidden'}), 403
    stats = PlayerStats.query.all()
    return jsonify([{'nickname': s.nickname, 'might': s.might_current, 'might_diff': s.might_diff,
                     'kills': s.kills_current, 'kills_diff': s.kills_diff} for s in stats])


@app.route('/api/admin/arena_registrations', methods=['GET'])
def get_all_arena_regs():
    if session.get('role') != 'admin': return jsonify([])
    results = db.session.query(User, ArenaStats).join(ArenaStats, User.id == ArenaStats.user_id).all()
    return jsonify([{'nickname': u.nickname, 'status': s.status, 'team': s.team, 'inf': s.inf_atk, 'rng': s.rng_atk,
                     'cav': s.cav_atk, 'hp': s.army_hp, 'atk': s.army_atk, 'size': s.army_size} for u, s in results])


@app.route('/api/admin/kvk_registrations', methods=['GET'])
def get_all_kvk_regs():
    if session.get('role') != 'admin': return jsonify([])
    results = db.session.query(User, KvkStats).join(KvkStats, User.id == KvkStats.user_id).all()
    return jsonify([{'nickname': u.nickname, 'is_ready': s.is_ready, 'fly_out': s.fly_out,
                     'migration_closed': s.migration_closed, 'kingdom_num': s.kingdom_num, 'inf': s.inf_atk,
                     'rng': s.rng_atk, 'cav': s.cav_atk, 'atk': s.army_atk, 'hp': s.army_hp, 'rabbit': s.has_rabbit} for
                    u, s in results])


@app.route('/api/admin/upload_history', methods=['GET'])
def get_upload_history():
    if session.get('role') != 'admin': return jsonify([])
    logs = UploadLog.query.order_by(UploadLog.created_at.desc()).limit(20).all()
    return jsonify([{'id': l.id, 'filename': l.filename, 'upload_type': l.upload_type, 'period': l.period,
                     'timestamp': l.created_at.strftime('%d.%m %H:%M'), 'admin_name': l.admin_name} for l in logs])


@app.route('/admin/update_announcement', methods=['POST'])
def update_announcement():
    if session.get('role') != 'admin': return jsonify({'error': 'Forbidden'}), 403
    data = request.json
    config = GuildConfig.query.get(1) or GuildConfig(id=1)
    config.announcement = data.get('text')
    db.session.add(config)
    db.session.commit()
    return jsonify({'message': '✨Магія D*C спрацювала. Збережено!✨'})


@app.route('/admin/update_event_dates', methods=['POST'])
def update_dates():
    if session.get('role') != 'admin': return jsonify({'error': 'Forbidden'}), 403
    data = request.json
    config = GuildConfig.query.get(1) or GuildConfig(id=1)
    if 'arena_date' in data: config.arena_date = data['arena_date']
    if 'arena_time' in data: config.arena_time = data['arena_time']
    if 'kvk_date' in data: config.kvk_date = data['kvk_date']
    if 'kvk_time' in data: config.kvk_time = data['kvk_time']
    db.session.add(config)
    db.session.commit()
    return jsonify({'message': '✨Магія D*C спрацювала. Збережено!✨'})


@app.route('/admin/update_role', methods=['POST'])
def update_user_role():
    if session.get('role') != 'admin': return jsonify({'error': 'Forbidden'}), 403
    data = request.json
    user = User.query.get(data.get('user_id'))
    if user:
        user.role = data.get('new_role')
        db.session.commit()
        return jsonify({'message': '✨Магія D*C спрацювала. Збережено!✨'})
    return jsonify({'error': 'Not found'}), 404


@app.route('/admin/delete_user', methods=['POST'])
def delete_user():
    if session.get('role') != 'admin':
        return jsonify({'error': 'Forbidden'}), 403

    data = request.json
    user = User.query.get(data.get('user_id'))

    if not user:
        return jsonify({'error': 'Користувача не знайдено'}), 404

    if user.id == session.get('user_id'):
        return jsonify({'error': 'Ви не можете видалити самого себе!'}), 400

    try:
        # 1. Видаляємо реєстрації на івенти (Арена та КВК)
        ArenaStats.query.filter_by(user_id=user.id).delete()
        KvkStats.query.filter_by(user_id=user.id).delete()

        # 2. Видаляємо ігрову статистику та історію для графіків (по IGG ID)
        if user.igg_id:
            # Видаляємо поточні бали, борги по монстрах, міць та кіли
            PlayerStats.query.filter_by(igg_id=user.igg_id).delete()
            # Видаляємо всі точки на графіках, щоб вони не псували загальну статистику гільдії
            PlayerHistory.query.filter_by(igg_id=user.igg_id).delete()

        # 3. Видаляємо самого користувача
        db.session.delete(user)

        db.session.commit()
        return jsonify({'message': f'Користувача {user.nickname} та всі його дані успішно видалено!'})

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Помилка при видаленні: {str(e)}'}), 500

@app.route('/api/admin/update_guild_pass', methods=['POST'])
def update_guild_pass():
    if session.get('role') != 'admin': return jsonify({'error': 'Forbidden'}), 403

    data = request.json
    new_pass = data.get('guild_pass')

    config = GuildConfig.query.get(1) or GuildConfig(id=1)
    config.guild_pass = new_pass

    db.session.add(config)
    db.session.commit()

    return jsonify({'message': 'Пароль гільдії оновлено!'})
# ==========================================
# CLIENT SAVE ROUTES
# ==========================================

@app.route('/api/arena_data', methods=['GET'])
def get_player_arena_data_api():
    if 'user_id' not in session: return jsonify({'error': 'Unauthorized'}), 401
    config = GuildConfig.query.get(1)
    stats = ArenaStats.query.filter_by(user_id=session['user_id']).first()
    user_stats = {}
    if stats:
        user_stats = {'status': stats.status, 'team': stats.team, 'inf': stats.inf_atk, 'rng': stats.rng_atk,
                      'cav': stats.cav_atk, 'hp': stats.army_hp, 'atk': stats.army_atk, 'size': stats.army_size}
    return jsonify(
        {'event_date': config.arena_date if config else None, 'event_time': config.arena_time if config else None,
         'user_stats': user_stats})


@app.route('/api/save_arena_stats', methods=['POST'])
def save_player_arena_stats_api():
    if 'user_id' not in session: return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    user_id = session['user_id']
    stats = ArenaStats.query.filter_by(user_id=user_id).first()
    if not stats: stats = ArenaStats(user_id=user_id); db.session.add(stats)
    stats.status = data.get('status');
    stats.team = data.get('team')
    stats.inf_atk = data.get('inf');
    stats.rng_atk = data.get('rng');
    stats.cav_atk = data.get('cav')
    stats.army_hp = data.get('hp');
    stats.army_atk = data.get('atk');
    stats.army_size = data.get('size')
    db.session.commit()
    return jsonify({'message': '✨Магія D*C спрацювала. Збережено!✨'})


@app.route('/api/kvk_data', methods=['GET'])
def get_player_kvk_data_api():
    if 'user_id' not in session: return jsonify({'error': 'Unauthorized'}), 401
    stats = KvkStats.query.filter_by(user_id=session['user_id']).first()
    data = {}
    if stats:
        data = {'is_ready': stats.is_ready, 'fly_out': stats.fly_out, 'migration_closed': stats.migration_closed,
                'has_rabbit': stats.has_rabbit, 'kingdom_num': stats.kingdom_num, 'inf': stats.inf_atk,
                'rng': stats.rng_atk, 'cav': stats.cav_atk, 'atk': stats.army_atk, 'hp': stats.army_hp}
    return jsonify(data)


@app.route('/api/save_kvk_stats', methods=['POST'])
def save_player_kvk_stats_api():
    if 'user_id' not in session: return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    user_id = session['user_id']
    stats = KvkStats.query.filter_by(user_id=user_id).first()
    if not stats: stats = KvkStats(user_id=user_id); db.session.add(stats)
    stats.is_ready = data.get('is_ready');
    stats.fly_out = data.get('fly_out')
    stats.migration_closed = data.get('migration_closed');
    stats.has_rabbit = data.get('rabbit')
    stats.kingdom_num = data.get('kingdom_num');
    stats.inf_atk = data.get('inf')
    stats.rng_atk = data.get('rng');
    stats.cav_atk = data.get('cav')
    stats.army_atk = data.get('atk');
    stats.army_hp = data.get('hp')
    db.session.commit()
    return jsonify({'message': '✨Магія D*C спрацювала. Збережено!✨'})


if __name__ == '__main__':
    with app.app_context(): db.create_all()
    app.run(debug=True, port=5000)