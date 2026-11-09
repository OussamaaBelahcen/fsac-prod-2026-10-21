#!/bin/bash
set -e

# Wait for MySQL to be ready
until mysql -h"$MYSQL_HOST" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" --skip-ssl -e "SELECT 1"; do
  echo "Waiting for MySQL connection..."
  sleep 2
done

# Create admin user if it doesn't exist
if [ "$ADMIN_EMAIL" ] && [ "$ADMIN_PASSWORD" ]; then
  python - <<END
import os, bcrypt
from app import app, mysql
with app.app_context():
    cursor = mysql.connection.cursor()
    # Check if admin user exists
    cursor.execute("SELECT 1 FROM users WHERE email_user = %s", (os.getenv('ADMIN_EMAIL'),))
    if not cursor.fetchone():
        hashed = bcrypt.hashpw(os.getenv('ADMIN_PASSWORD').encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cursor.execute('''
            INSERT INTO users (email_user, mot_de_pass_user, role_user, nom, prenom)
            VALUES (%s, %s, %s, %s, %s)
        ''', (
            os.getenv('ADMIN_EMAIL'),
            hashed,
            os.getenv('ADMIN_ROLE', 'SUPERADMIN'),
            os.getenv('ADMIN_FIRSTNAME', 'Admin'),
            os.getenv('ADMIN_LASTNAME', 'System')
        ))
        mysql.connection.commit()
        print('Admin user created: {}'.format(os.getenv('ADMIN_EMAIL')))
    else:
        print('Admin user already exists')
    cursor.close()
END
fi

# Execute the main container command
exec "$@"