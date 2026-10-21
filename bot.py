import telebot
import requests
from datetime import datetime
import sqlite3
from flask import Flask
import threading
import os
import json

# Твой токен
TOKEN = '8980864965:AAErIbgjJ6P_qN_HS-C_KpFy5Vjeupg88pA' # НЕ ЗАБУДЬ ВСТАВИТЬ НОВЫЙ ТОКЕН!
bot = telebot.TeleBot(TOKEN)
API_BASE = "http://109.233.236.101:5000"

conn = sqlite3.connect('schedule_bot.db', check_same_thread=False)
cursor = conn.cursor()
cursor.execute('''CREATE TABLE IF NOT EXISTS users (user_id INTEGER PRIMARY KEY, group_name TEXT)''')
conn.commit()

def get_user_group(user_id):
    cursor.execute("SELECT group_name FROM users WHERE user_id = ?", (user_id,))
    result = cursor.fetchone()
    return result[0] if result else None

def set_user_group(user_id, group_name):
    cursor.execute("INSERT OR REPLACE INTO users (user_id, group_name) VALUES (?, ?)", (user_id, group_name))
    conn.commit()

def get_groups():
    try:
        r = requests.get(f"{API_BASE}/groups")
        return r.json() if r.status_code == 200 else []
    except:
        return []

def get_schedule(group, date_from, date_to):
    try:
        url = f"{API_BASE}/schedule_range?group={requests.utils.quote(group)}&from={date_from}&to={date_to}"
        r = requests.get(url)
        if r.status_code != 200: return "⚠️ Ошибка сервера."
        data = r.json()
        if not data: return "На выбранные даты занятий нет."
        
        result = ""
        for day in data:
            date_obj = datetime.strptime(day['date'], '%Y-%m-%d')
            result += f"\n📅 **{date_obj.strftime('%d.%m.%Y')}**\n"
            
            if not day.get('lessons'):
                result += "Занятий нет.\n"
                continue
                
            for lesson in day['lessons']:
                # Ищем площадку (пробуем разные названия из API)
                platform = lesson.get('Building') or lesson.get('Platform') or lesson.get('Korpus') or lesson.get('Housing') or ""
                platform_text = f" | 📍 Площадка {platform}" if platform else ""
                
                result += (f"🔹 Пара {lesson.get('NumberLesson', '?')}: {lesson.get('Discipline', '')}\n"
                           f"   👨‍🏫 {lesson.get('Teacher', '')}\n"
                           f"   🚪 Ауд. {lesson.get('LectureHall', '')}{platform_text}\n")
        return result
    except Exception as e:
        return f"Ошибка: {e}"

def get_main_menu():
    markup = telebot.types.ReplyKeyboardMarkup(resize_keyboard=True)
    markup.add(telebot.types.KeyboardButton('📅 Расписание на сегодня'))
    markup.add(telebot.types.KeyboardButton('🔄 Сменить группу'))
    return markup

def get_groups_menu():
    groups = get_groups()
    markup = telebot.types.ReplyKeyboardMarkup(resize_keyboard=True, row_width=3)
    buttons = [telebot.types.KeyboardButton(g) for g in groups[:50]]
    markup.add(*buttons)
    return markup

@bot.message_handler(commands=['start'])
def start_message(message):
    user_group = get_user_group(message.chat.id)
    
    # Текст с автором
    author_info = "🤖 **Создатель:** Игнатенко Р.В. (гр. 36тп)\n"
    
    if user_group:
        bot.send_message(message.chat.id, f"👋 С возвращением!\nТвоя группа: **{user_group}**.\n\n{author_info}", parse_mode='Markdown', reply_markup=get_main_menu())
    else:
        bot.send_message(message.chat.id, f"👋 Привет! Я бот для просмотра расписания.\n\n{author_info}\nВыбери свою группу:", parse_mode='Markdown', reply_markup=get_groups_menu())

@bot.message_handler(func=lambda message: message.text == '🔄 Сменить группу')
def change_group(message):
    bot.send_message(message.chat.id, "Выбери новую группу:", reply_markup=get_groups_menu())

@bot.message_handler(func=lambda message: message.text == '📅 Расписание на сегодня')
def today_schedule(message):
    group = get_user_group(message.chat.id)
    if not group:
        bot.send_message(message.chat.id, "Сначала выбери группу!", reply_markup=get_groups_menu())
        return
    today = datetime.now().strftime('%Y-%m-%d')
    bot.send_message(message.chat.id, f"⏳ Загружаю расписание на сегодня...")
    schedule = get_schedule(group, today, today)
    bot.send_message(message.chat.id, f"📚 Расписание ({group}):\n{schedule}", parse_mode='Markdown', reply_markup=get_main_menu())

@bot.message_handler(func=lambda message: True)
def handle_text(message):
    text = message.text
    if text in get_groups():
        set_user_group(message.chat.id, text)
        bot.send_message(message.chat.id, f"✅ Отлично! Группа **{text}** сохранена.", parse_mode='Markdown', reply_markup=get_main_menu())
    else:
        bot.send_message(message.chat.id, "Я не знаю такой команды. Нажми /start.")

# --- ЗАПУСК ДЛЯ RENDER ---
app = Flask(__name__)
@app.route('/')
def home(): return "Bot is running!"

def run_bot():
    print("Бот запущен...")
    bot.infinity_polling()

if __name__ == '__main__':
    t = threading.Thread(target=run_bot)
    t.start()
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
