import bcrypt
from pymysql import connect

import os
import bcrypt
from pymysql import connect

# Connexion via socket UNIX si disponible (Mac/Linux), sinon TCP
socket_path = '/tmp/mysql.sock'
connect_kwargs = {
    'user': 'root',
    'password': 'root',
    'database': 'Fsac',
    'charset': 'utf8mb4'
}
if os.path.exists(socket_path):
    connect_kwargs['unix_socket'] = socket_path
else:
    connect_kwargs['host'] = 'localhost'

conn = connect(**connect_kwargs)
cur = conn.cursor()

cur.execute("SELECT iduser FROM users WHERE role_user = 'SUPERADMIN'")
if cur.fetchone():
    print("Un superadmin existe déjà.")
else:
    email = 'superadmin@fsac.ma'
    password = 'admin123'
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    cur.execute("""
        INSERT INTO users (email_user, mot_de_pass_user, role_user, nom, prenom, statut, premiere_connexion, date_creation)
        VALUES (%s, %s, 'SUPERADMIN', 'Super', 'Admin', 'actif', 1, NOW())
    """, (email, hashed))
    conn.commit()
    print(f"Superadmin créé : {email} / {password}")

cur.close()
conn.close()
