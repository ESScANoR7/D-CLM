import pymysql

# Підключення до MySQL без вибору конкретної бази
connection = pymysql.connect(
    host='127.0.0.1',
    user='root',
    password='zxc1',
    charset='utf8mb4',
    cursorclass=pymysql.cursors.DictCursor
)

try:
    with connection.cursor() as cursor:
        print("🛠 Створюю базу даних guild_db...")
        cursor.execute("CREATE DATABASE IF NOT EXISTS guild_db")
        print("✅ База даних успішно створена!")
finally:
    connection.close()