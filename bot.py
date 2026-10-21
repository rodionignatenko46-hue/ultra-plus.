import telebot
import requests
from datetime import datetime
import sqlite3
from flask import Flask
import threading
import os
import json

# ВСТАВЬ СВОЙ НОВЫЙ ТОКЕН (поменяй через /revoke у BotFather)
TOKEN = '8980864965:AAErIbgjJ6P_qN_HS-C_KpFy5Vjeupg88pA'
bot = telebot.TeleBot(TOKEN)
API_BASE = "http://109.233.236.101:5000"

# --- БАЗА ДАННЫХ ---
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

# --- РАБОТА С САЙТОМ ---
def get_groups():
    try:
        r = requests.get(f"{API_BASE}/groups")
        return r.json() if r.status_code == 200 else []
    except:
        return []

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

# --- ОБРАБОТЧИКИ КОМАНД ---
@bot.message_handler(commands=['start'])
def start_message(message):
    user_group = get_user_group(message.chat.id)
    author_info = "🤖 **Создатель:** Игнатенко Р.В. (гр. 36тп)\n"
    
    if user_group:
        bot.send_message(message.chat.id, f"👋 С возвращением!\nТвоя группа: **{user_group}**.\n\n{author_info}", parse_mode='Markdown', reply_markup=get_main_menu())
    else:
        bot.send_message(message.chat.id, f"👋 Привет! Я бот для просмотра расписания.\n\n{author_info}\nВыбери свою группу:", parse_mode='Markdown', reply_markup=get_groups_menu())

@bot.message_handler(func=lambda message: message.text == '🔄 Сменить группу')
def change_group(message):
    bot.send_message(message.chat.id, "Выбери новую группу:", reply_markup=get_groups_menu())

# --- ОТЛАДОЧНАЯ ФУНКЦИЯ (Покажет сырые данные) ---
@bot.message_handler(func=lambda message: message.text == '📅 Расписание на сегодня')
def today_schedule(message):
    group = get_user_group(message.chat.id)
    if not group:
        bot.send_message(message.chat.id, "Сначала выбери группу!", reply_markup=get_groups_menu())
        return
        
    today = datetime.now().strftime('%Y-%m-%d')
    bot.send_message(message.chat.id, f"⏳ Смотрю данные с сайта для группы {group}...")
    
    try:
        url = f"{API_BASE}/schedule_range?group={requests.utils.quote(group)}&from={today}&to={today}"
        r = requests.get(url)
        data = r.json()
        
        if data and data[0].get('lessons'):
            first_lesson = data[0]['lessons'][0]
            # Превращаем в красивый текст и отправляем
            debug_text = json.dumps(first_lesson, ensure_ascii=False, indent=2)
            bot.send_message(message.chat.id, f"Вот как выглядит пара в базе сайта:\n\n{debug_text}")
        else:
            bot.send_message(message.chat.id, "На сегодня пар нет (или сайт вернул пустоту).")
    except Exception as e:
        bot.send_message(message.chat.id, f"Ошибка: {e}")

# --- ВЫБОР ГРУППЫ ---
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
